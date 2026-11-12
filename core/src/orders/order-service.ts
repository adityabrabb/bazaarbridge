// -----------------------------------------------------------------------
// order-service.ts
// Purpose: the order lifecycle: draft quote -> PayPal pay link ->
//          paid (+ invoice) -> reminders, plus the seller's stats and
//          the per-order evidence pack. All
//          payment calls go through the PaymentGateway, so this file is
//          the same in mock and sandbox mode.
// -----------------------------------------------------------------------

import {
   EVENT_INVOICE,
   OWN_INVOICE_PREFIX,
   EVENT_PAY_LINK,
   EVENT_PAYMENT,
   EVENT_QUOTE_CANCELLED,
   EVENT_QUOTE_CREATED,
   EVENT_QUOTE_UPDATED,
   EVENT_REMINDER,
   MOCK_CAPTURE_PREFIX,
   MOCK_PAYER_EMAIL,
   MS_PER_DAY,
   SUPPORTED_CURRENCIES,
} from "../constants.ts";
import type { ConversationService } from "../chat/conversation-service.ts";
import {
   HTTP_BAD_GATEWAY,
   HTTP_BAD_REQUEST,
   HTTP_CONFLICT,
   HTTP_NOT_FOUND,
   ServiceError,
} from "../errors.ts";
import type { EventHub } from "../events/event-hub.ts";
import { newId, nowIso } from "../ids.ts";
import type {
   PaymentCheck,
   PaymentGateway,
} from "../paypal/payment-gateway.ts";
import {
   buildQuote,
   QuoteError,
   type Quote,
   type QuoteLine,
} from "../quote/quote-engine.ts";
import { normalizeCountry } from "../quote/countries.ts";
import type { JsonStore } from "../store/json-store.ts";
import type {
   Attachment,
   EvidencePack,
   Message,
   Order,
   Stats,
} from "../types.ts";
import { formatMoney, sumAmounts } from "./money.ts";

export class OrderService {
   private store: JsonStore;
   private hub: EventHub;
   private chats: ConversationService;
   private gateway: PaymentGateway;
   // One in-flight refresh per order: a webhook and a poll arriving
   // together must not mark the order paid (and message the buyer) twice.
   private refreshing = new Map<string, Promise<Order>>();

   // ----- Base URL of this server, for the fallback invoice page.
   private publicBaseUrl: string;

   // --------------------------------------------------------------------
   // constructor
   // Purpose: wire the store, events, chats and payment gateway.
   // --------------------------------------------------------------------
   constructor(
      store: JsonStore,
      hub: EventHub,
      chats: ConversationService,
      gateway: PaymentGateway,
      publicBaseUrl = "",
   ) {
      this.publicBaseUrl = publicBaseUrl;
      this.store = store;
      this.hub = hub;
      this.chats = chats;
      this.gateway = gateway;
   }

   get paymentMode(): PaymentGateway["mode"] {
      return this.gateway.mode;
   }

   // --------------------------------------------------------------------
   // verifyWebhook
   // Purpose: delegate to the gateway's signature check; null when the
   //          gateway cannot verify (mock / no webhook id).
   // --------------------------------------------------------------------
   async verifyWebhook(
      headers: Record<string, string | string[] | undefined>,
      event: unknown,
   ): Promise<boolean | null> {
      if (!this.gateway.verifyWebhook) {
         return null;
      }
      return this.gateway.verifyWebhook(headers, event);
   }

   // --------------------------------------------------------------------
   // list
   // Purpose: all orders, newest first (GET /api/orders).
   // --------------------------------------------------------------------
   list(): Order[] {
      return [...this.store.db.orders].sort((a, b) =>
         b.createdAt.localeCompare(a.createdAt),
      );
   }

   // --------------------------------------------------------------------
   // get / require
   // Purpose: find an order; `require` throws a 404 ServiceError.
   // --------------------------------------------------------------------
   get(id: string): Order | undefined {
      return this.store.db.orders.find((o) => o.id === id);
   }

   require(id: string): Order {
      const order = this.get(id);
      if (!order) {
         throw new ServiceError(HTTP_NOT_FOUND, `order ${id} not found`);
      }
      return order;
   }

   // --------------------------------------------------------------------
   // draftFor
   // Purpose: the open (draft) order of a conversation, if any.
   // --------------------------------------------------------------------
   draftFor(conversationId: string): Order | undefined {
      return this.store.db.orders.find(
         (o) => o.conversationId === conversationId && o.status === "draft",
      );
   }

   // --------------------------------------------------------------------
   // latestFor
   // Purpose: the newest non-draft order of a conversation, if any.
   // --------------------------------------------------------------------
   latestFor(conversationId: string): Order | undefined {
      return this.list().find(
         (o) => o.conversationId === conversationId && o.status !== "draft",
      );
   }

   // --------------------------------------------------------------------
   // setQuote
   // Purpose: price `lines` for `country` in code (never by the model)
   //          and store the result as the conversation's draft order,
   //          creating the draft if needed. An empty list cancels the
   //          draft. requestedDiscountPct is what the buyer asked for;
   //          the seller's rule caps it (see quote-engine).
   //          Side effect: saves and emits order.updated.
   // --------------------------------------------------------------------
   setQuote(
      conversationId: string,
      customerName: string,
      lines: QuoteLine[],
      country: string,
      requestedDiscountPct = 0,
   ): { order: Order; quote?: Quote } {
      let order = this.draftFor(conversationId);
      const empty =
         Array.isArray(lines) && lines.every((l) => Number(l?.qty) === 0);
      if (empty) {
         if (!order) {
            throw new ServiceError(HTTP_BAD_REQUEST, "nothing to quote");
         }
         order.status = "cancelled";
         this.logEvent(order.id, EVENT_QUOTE_CANCELLED, "Quote cancelled");
         this.touch(order);
         return { order };
      }
      let quote: Quote;
      try {
         quote = buildQuote(
            lines,
            this.store.db.catalog,
            normalizeCountry(country),
            requestedDiscountPct,
         );
      } catch (err) {
         if (err instanceof QuoteError) {
            throw new ServiceError(HTTP_BAD_REQUEST, err.message);
         }
         throw err;
      }
      const fresh = !order;
      if (!order) {
         order = {
            id: newId("ord"),
            conversationId,
            customerName,
            buyerCountry: quote.buyerCountry,
            items: [],
            subtotal: 0,
            discount: 0,
            shipping: 0,
            total: 0,
            currency: quote.currency,
            totalInr: 0,
            deliveryDays: quote.deliveryDays,
            status: "draft",
            reminders: 0,
            createdAt: nowIso(),
         };
         this.store.db.orders.push(order);
      }
      order.customerName = customerName;
      order.buyerCountry = quote.buyerCountry;
      order.items = quote.items;
      order.subtotal = quote.subtotal;
      order.discount = quote.discount;
      order.shipping = quote.shipping;
      order.total = quote.total;
      order.currency = quote.currency;
      order.totalInr = quote.totalInr;
      order.deliveryDays = quote.deliveryDays;
      this.logEvent(
         order.id,
         fresh ? EVENT_QUOTE_CREATED : EVENT_QUOTE_UPDATED,
         `Quote ${formatMoney(quote.total, quote.currency)} ` +
            `(${quote.currency}) to ${quote.destination}, ` +
            `${quote.discountPct}% bulk discount`,
      );
      this.touch(order);
      return { order, quote };
   }

   // --------------------------------------------------------------------
   // confirm
   // Purpose: turn the conversation's draft into a PayPal order and
   //          return it with approveUrl set. If PayPal fails the draft
   //          stays a draft so the customer can simply try again.
   // --------------------------------------------------------------------
   async confirm(conversationId: string): Promise<Order> {
      const order = this.draftFor(conversationId);
      if (!order) {
         throw new ServiceError(HTTP_CONFLICT, "no cart to confirm");
      }
      await this.attachPayLink(order);
      order.status = "awaiting_payment";
      this.logEvent(
         order.id,
         EVENT_PAY_LINK,
         `PayPal order ${order.paypalOrderId ?? ""} in ${order.currency}`,
      );
      this.touch(order);
      return order;
   }

   // --------------------------------------------------------------------
   // attachPayLink
   // Purpose: create the PayPal order if this order has none yet (seeded
   //          orders get theirs lazily, on the first reminder).
   // --------------------------------------------------------------------
   private async attachPayLink(order: Order): Promise<void> {
      if (order.paypalOrderId && order.approveUrl) {
         return;
      }
      try {
         const link = await this.gateway.createPayment(order);
         order.paypalOrderId = link.paypalOrderId;
         order.approveUrl = link.approveUrl;
      } catch (err) {
         console.error("[orders] create payment:", (err as Error).message);
         throw new ServiceError(
            HTTP_BAD_GATEWAY,
            "could not create the PayPal payment link",
         );
      }
   }

   // --------------------------------------------------------------------
   // refresh
   // Purpose: ask PayPal about an awaiting order; capture + mark paid
   //          when approved. Safe to call any number of times.
   // --------------------------------------------------------------------
   refresh(orderId: string): Promise<Order> {
      const running = this.refreshing.get(orderId);
      if (running) {
         return running;
      }
      const task = this.refreshOnce(orderId).finally(() => {
         this.refreshing.delete(orderId);
      });
      this.refreshing.set(orderId, task);
      return task;
   }

   // --------------------------------------------------------------------
   // refreshOnce
   // Purpose: the body of refresh(). PayPal errors are logged and the
   //          unchanged order returned, so polling never breaks the UI.
   // --------------------------------------------------------------------
   private async refreshOnce(orderId: string): Promise<Order> {
      const order = this.require(orderId);
      if (order.status !== "awaiting_payment" || !order.paypalOrderId) {
         return order;
      }
      try {
         const check = await this.gateway.checkPayment(order.paypalOrderId);
         if (check.state === "paid") {
            await this.markPaid(order, check);
         }
      } catch (err) {
         console.warn("[orders] refresh:", (err as Error).message);
      }
      return order;
   }

   // --------------------------------------------------------------------
   // findByPaypalId
   // Purpose: map a PayPal order id (from a webhook) to our order.
   // --------------------------------------------------------------------
   findByPaypalId(paypalOrderId: string): Order | undefined {
      return this.store.db.orders.find(
         (o) => o.paypalOrderId === paypalOrderId,
      );
   }

   // --------------------------------------------------------------------
   // simulatePayment
   // Purpose: mock mode only: pretend the buyer paid.
   // --------------------------------------------------------------------
   async simulatePayment(orderId: string): Promise<Order> {
      if (this.gateway.mode !== "mock") {
         throw new ServiceError(
            HTTP_CONFLICT,
            "simulate-payment is only available in mock mode",
         );
      }
      const order = this.require(orderId);
      if (order.status === "paid") {
         return order;
      }
      if (order.status !== "awaiting_payment") {
         throw new ServiceError(
            HTTP_CONFLICT,
            `order is ${order.status}, not awaiting_payment`,
         );
      }
      await this.markPaid(order, {
         state: "paid",
         captureId: `${MOCK_CAPTURE_PREFIX}${order.id}`,
         payerEmail: MOCK_PAYER_EMAIL,
      });
      return order;
   }

   // --------------------------------------------------------------------
   // markPaid
   // Purpose: flip to paid, issue the invoice (best effort; the payment
   //          stands even if invoicing fails), tell the customer.
   //          Side effect: saves, emits order.updated + message.created.
   // --------------------------------------------------------------------
   private async markPaid(order: Order, check: PaymentCheck): Promise<void> {
      if (order.status === "paid") {
         return;
      }
      order.status = "paid";
      order.paidAt = nowIso();
      // Kept for the evidence pack (who paid, which PayPal capture).
      order.captureId = check.captureId;
      order.payerEmail = check.payerEmail;
      this.logEvent(
         order.id,
         EVENT_PAYMENT,
         `Payment captured (${check.captureId ?? "no id"})` +
            (check.payerEmail ? ` from ${check.payerEmail}` : ""),
      );
      this.touch(order);
      await this.issueInvoice(order, check.captureId);
      const attachments: Attachment[] = [
         {
            type: "payment_confirmed",
            orderId: order.id,
            total: order.total,
            currency: order.currency,
         },
      ];
      if (order.invoiceUrl) {
         attachments.push({
            type: "invoice",
            orderId: order.id,
            url: order.invoiceUrl,
         });
      }
      this.chats.append(
         order.conversationId,
         "agent",
         `Payment received, thank you ${order.customerName}! ` +
            "Your order is being packed. Your invoice is below.",
         attachments,
      );
   }

   // --------------------------------------------------------------------
   // issueInvoice
   // Purpose: create the invoice once for a paid order. Errors are
   //          logged, never thrown: the invoice is a nice-to-have.
   // --------------------------------------------------------------------
   async issueInvoice(order: Order, captureId?: string): Promise<Order> {
      if (order.status !== "paid" || order.invoiceUrl) {
         return order;
      }
      try {
         const ref = await this.gateway.issueInvoice(order, captureId);
         order.invoiceId = ref.invoiceId;
         order.invoiceUrl = ref.invoiceUrl;
         this.logEvent(
            order.id,
            EVENT_INVOICE,
            `PayPal invoice ${ref.invoiceId}`,
         );
         this.touch(order);
      } catch (err) {
         console.warn("[orders] invoice:", (err as Error).message);
         this.issueOwnInvoice(order);
      }
      return order;
   }

   // --------------------------------------------------------------------
   // issueOwnInvoice
   // Purpose: side effect: give a paid order a BazaarBridge invoice page
   //          when PayPal Invoicing is unavailable (for example the app
   //          lacks the Invoicing permission). Why: the buyer still needs
   //          a document, and the payment itself is already on PayPal.
   // --------------------------------------------------------------------
   private issueOwnInvoice(order: Order): void {
      if (!this.publicBaseUrl) {
         return;
      }
      order.invoiceId = `${OWN_INVOICE_PREFIX}${order.id}`;
      order.invoiceUrl = `${this.publicBaseUrl}/invoice/${order.id}`;
      this.logEvent(
         order.id,
         EVENT_INVOICE,
         `BazaarBridge invoice ${order.invoiceId} ` +
            "(PayPal Invoicing not available on this account)",
      );
      this.touch(order);
   }

   // --------------------------------------------------------------------
   // remind
   // Purpose: nudge the customer of an unpaid order with the pay link.
   //          Side effect: posts a message, bumps reminders, emits events.
   // --------------------------------------------------------------------
   async remind(orderId: string): Promise<{ order: Order; message: Message }> {
      const order = this.require(orderId);
      if (order.status !== "awaiting_payment") {
         throw new ServiceError(
            HTTP_CONFLICT,
            `order is ${order.status}; only unpaid orders get reminders`,
         );
      }
      await this.attachPayLink(order);
      order.reminders += 1;
      this.logEvent(
         order.id,
         EVENT_REMINDER,
         `Reminder ${order.reminders} sent in chat`,
      );
      this.touch(order);
      const message = this.chats.append(
         order.conversationId,
         "agent",
         `Hi ${order.customerName}, a friendly reminder: your order of ` +
            `${formatMoney(order.total, order.currency)} is still waiting ` +
            "for payment. You can pay securely with PayPal below. Thank you!",
         [
            {
               type: "pay_link",
               orderId: order.id,
               url: order.approveUrl ?? "",
               total: order.total,
               currency: order.currency,
            },
         ],
      );
      return { order, message };
   }

   // --------------------------------------------------------------------
   // listUnpaid
   // Purpose: awaiting orders, optionally only those from the last
   //          `days` days ("who hasn't paid this week?").
   // --------------------------------------------------------------------
   listUnpaid(days?: number): Order[] {
      const cutoff =
         typeof days === "number" && days > 0
            ? Date.now() - days * MS_PER_DAY
            : 0;
      return this.list().filter(
         (o) =>
            o.status === "awaiting_payment" &&
            Date.parse(o.createdAt) >= cutoff,
      );
   }

   // --------------------------------------------------------------------
   // stats
   // Purpose: dashboard tiles (GET /api/stats). Rupee totals use each
   //          order's quote-time rupee value; byCurrency shows what is
   //          received / owed in each buyer currency actually in use.
   //          Summed in cents.
   // --------------------------------------------------------------------
   stats(): Stats {
      const orders = this.store.db.orders;
      const paid = orders.filter((o) => o.status === "paid");
      const unpaid = orders.filter((o) => o.status === "awaiting_payment");
      const inr = (list: Order[]) => list.reduce((n, o) => n + o.totalInr, 0);
      const byCurrency: Stats["byCurrency"] = [];
      for (const currency of SUPPORTED_CURRENCIES) {
         const total = (list: Order[]) =>
            sumAmounts(
               list.filter((o) => o.currency === currency).map((o) => o.total),
            );
         const row = { currency, paid: total(paid), unpaid: total(unpaid) };
         if (row.paid > 0 || row.unpaid > 0) {
            byCurrency.push(row);
         }
      }
      return {
         collectedInr: inr(paid),
         paidCount: paid.length,
         unpaidCount: unpaid.length,
         unpaidInr: inr(unpaid),
         byCurrency,
      };
   }

   // --------------------------------------------------------------------
   // evidence
   // Purpose: GET /api/orders/:id/evidence. Everything the seller needs
   //          to back a dispute: the chat, the quote (on the order), the
   //          PayPal payment record and the dated timeline.
   // --------------------------------------------------------------------
   evidence(orderId: string): EvidencePack {
      const order = this.require(orderId);
      const messages = this.chats.get(order.conversationId)?.messages ?? [];
      const timeline = this.store.db.events
         .filter((e) => e.orderId === order.id)
         .map(({ at, event, detail }) => ({ at, event, detail }))
         .sort((a, b) => a.at.localeCompare(b.at));
      const pack: EvidencePack = { order, messages, timeline };
      if (order.status === "paid" && order.paypalOrderId && order.paidAt) {
         pack.payment = {
            provider: "paypal",
            orderId: order.paypalOrderId,
            captureId: order.captureId,
            payerEmail: order.payerEmail,
            amount: order.total,
            currency: order.currency,
            paidAt: order.paidAt,
         };
      }
      return pack;
   }

   // --------------------------------------------------------------------
   // logEvent
   // Purpose: append one line to the order's audit trail (evidence
   //          timeline). Saved with the next touch().
   // --------------------------------------------------------------------
   private logEvent(orderId: string, event: string, detail: string): void {
      this.store.db.events.push({ orderId, at: nowIso(), event, detail });
   }

   // --------------------------------------------------------------------
   // touch
   // Purpose: persist and broadcast a changed order.
   // --------------------------------------------------------------------
   private touch(order: Order): void {
      void this.store.save();
      this.hub.publish({ type: "order.updated", data: order });
   }
}
