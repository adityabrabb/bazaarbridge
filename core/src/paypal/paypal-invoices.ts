// -----------------------------------------------------------------------
// paypal-invoices.ts
// Purpose: Invoicing v2 calls for a paid order: create a draft invoice,
//          send it (moves it to payable and gives a payer-view link),
//          then record the payment so the invoice shows PAID.
//          Shapes follow the Invoicing v2 OpenAPI spec
//          (developer.paypal.com/api/invoicing/v2/schema.json).
// -----------------------------------------------------------------------

import { PERCENT } from "../constants.ts";
import type { Order } from "../types.ts";
import { formatAmount, itemsSubtotal } from "../orders/money.ts";
import type { InvoiceRef } from "./payment-gateway.ts";
import type { PaypalClient } from "./paypal-client.ts";

type Link = { href: string; rel?: string };

type InvoiceResponse = {
   id?: string;
   status?: string;
   links?: Link[];
   detail?: { metadata?: { recipient_view_url?: string } };
};

const DATE_ONLY_LENGTH = 10;

// -----------------------------------------------------------------------
// isoDate
// Purpose: YYYY-MM-DD, the "date_no_time" format the API wants.
// -----------------------------------------------------------------------
function isoDate(when: Date): string {
   return when.toISOString().slice(0, DATE_ONLY_LENGTH);
}

// -----------------------------------------------------------------------
// buildInvoiceBody
// Purpose: POST /v2/invoicing/invoices body, in the order's currency.
//          Shipping and the bulk discount go in amount.breakdown so the
//          invoice total matches what the buyer paid. The invoicer is
//          left out so PayPal fills it from the sandbox merchant account;
//          the invoice number is left out so PayPal auto-increments it.
// -----------------------------------------------------------------------
export function buildInvoiceBody(order: Order, when: Date) {
   const code = order.currency;
   const subtotal = itemsSubtotal(order.items);
   const breakdown: Record<string, unknown> = {
      shipping: {
         amount: { currency_code: code, value: formatAmount(order.shipping) },
      },
   };
   if (order.discount > 0 && subtotal > 0) {
      // The seller's rule is a flat percentage, so recover it exactly.
      const percent = ((order.discount / subtotal) * PERCENT).toFixed(2);
      breakdown.discount = { invoice_discount: { percent } };
   }
   return {
      detail: {
         currency_code: code,
         invoice_date: isoDate(when),
         reference: order.id,
         note: "Paid with PayPal. Thank you for your order!",
         memo: `Export order ${order.id} to ${order.buyerCountry}`,
      },
      primary_recipients: [
         { billing_info: { name: { given_name: order.customerName } } },
      ],
      items: order.items.map((item) => ({
         name: item.name,
         quantity: String(item.qty),
         unit_amount: {
            currency_code: code,
            value: formatAmount(item.unitPrice),
         },
         unit_of_measure: "QUANTITY",
      })),
      amount: { breakdown },
   };
}

// -----------------------------------------------------------------------
// idFromLinks
// Purpose: a minimal create response may only carry a self link
//          ending in the invoice id; pull the id out of it.
// -----------------------------------------------------------------------
function idFromLinks(links: Link[] | undefined): string {
   const self = (links ?? []).find((l) => !l.rel || l.rel === "self");
   const href = self?.href ?? "";
   return href.split("/").pop() ?? "";
}

// -----------------------------------------------------------------------
// issuePaypalInvoice
// Purpose: create -> send -> record payment. Only create and send are
//          required for a link; a failed "record payment" is logged and
//          the invoice is still returned.
// -----------------------------------------------------------------------
export async function issuePaypalInvoice(
   client: PaypalClient,
   order: Order,
   captureId: string | undefined,
   when: Date = new Date(),
): Promise<InvoiceRef> {
   const created = await client.request<InvoiceResponse>({
      method: "POST",
      path: "/v2/invoicing/invoices",
      body: buildInvoiceBody(order, when),
      prefer: "return=representation",
   });
   const invoiceId = created.id || idFromLinks(created.links);
   if (!invoiceId) {
      throw new Error("PayPal invoice created without an id");
   }
   const path = `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`;
   // The customer already paid through checkout, so no email goes out;
   // sending still turns the draft into a viewable invoice.
   const sent = await client.request<Link>({
      method: "POST",
      path: `${path}/send`,
      body: { send_to_recipient: false, send_to_invoicer: false },
      requestId: `send-${invoiceId}`,
   });
   let invoiceUrl =
      sent.href || created.detail?.metadata?.recipient_view_url || "";
   try {
      await client.request({
         method: "POST",
         path: `${path}/payments`,
         body: {
            method: "OTHER",
            payment_date: isoDate(when),
            note: `Paid via PayPal checkout, capture ${captureId ?? "n/a"}`,
            amount: {
               currency_code: order.currency,
               value: formatAmount(order.total),
            },
         },
         requestId: `pay-${invoiceId}`,
      });
   } catch (err) {
      console.warn("[paypal] record invoice payment:", (err as Error).message);
   }
   if (!invoiceUrl) {
      const full = await client.request<InvoiceResponse>({
         method: "GET",
         path,
      });
      invoiceUrl = full.detail?.metadata?.recipient_view_url ?? "";
   }
   return { invoiceId, invoiceUrl };
}
