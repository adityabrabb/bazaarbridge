// -----------------------------------------------------------------------
// paypal-orders.ts
// Purpose: Orders v2 calls: create (returns the buyer's approve link),
//          get, and capture. Shapes follow the official Orders v2
//          OpenAPI spec (developer.paypal.com/api/orders/v2/schema.json,
//          v2.36): payment_source.paypal.experience_context replaces the
//          deprecated application_context, and the approve link comes
//          back with rel "payer-action".
// -----------------------------------------------------------------------

import { PAYPAL_BRAND_NAME, PAYPAL_ITEM_NAME_MAX } from "../constants.ts";
import type { Order } from "../types.ts";
import { formatAmount, itemsSubtotal } from "../orders/money.ts";
import type { PaymentCheck } from "./payment-gateway.ts";
import type { PaypalClient } from "./paypal-client.ts";

// ----- Response shapes (only the fields we read) ---------------------------
type Link = { href: string; rel: string; method?: string };

type PaypalOrder = {
   id: string;
   status: string;
   payer?: { email_address?: string };
   payment_source?: { paypal?: { email_address?: string } };
   links?: Link[];
   purchase_units?: Array<{
      payments?: { captures?: Array<{ id: string; status: string }> };
   }>;
};

export type ReturnUrls = { returnUrl: string; cancelUrl: string };

// -----------------------------------------------------------------------
// buildCreateOrderBody
// Purpose: the POST /v2/checkout/orders body for one export order, in
//          the order's own currency (USD, GBP, EUR or AUD).
//          item_total must equal the sum of unit_amount x quantity and
//          amount.value must equal item_total + shipping - discount,
//          or PayPal rejects the order.
// -----------------------------------------------------------------------
export function buildCreateOrderBody(order: Order, urls: ReturnUrls) {
   const code = order.currency;
   const money = (amount: number) => ({
      currency_code: code,
      value: formatAmount(amount),
   });
   const breakdown: Record<string, ReturnType<typeof money>> = {
      item_total: money(itemsSubtotal(order.items)),
      shipping: money(order.shipping),
   };
   // PayPal rejects a zero discount on some accounts; send it only when set.
   if (order.discount > 0) {
      breakdown.discount = money(order.discount);
   }
   return {
      intent: "CAPTURE",
      purchase_units: [
         {
            reference_id: order.id,
            custom_id: order.id,
            description:
               `Handmade goods from Jaipur, order ${order.id} ` +
               `for ${order.customerName}`,
            amount: { ...money(order.total), breakdown },
            items: order.items.map((item) => ({
               name: item.name.slice(0, PAYPAL_ITEM_NAME_MAX),
               sku: item.sku,
               quantity: String(item.qty),
               unit_amount: money(item.unitPrice),
               category: "PHYSICAL_GOODS",
            })),
         },
      ],
      payment_source: {
         paypal: {
            experience_context: {
               brand_name: PAYPAL_BRAND_NAME,
               // The address is collected in the chat, not on PayPal.
               shipping_preference: "NO_SHIPPING",
               // Buyer sees "Pay Now", so approval == intent to pay.
               user_action: "PAY_NOW",
               return_url: urls.returnUrl,
               cancel_url: urls.cancelUrl,
            },
         },
      },
   };
}

// -----------------------------------------------------------------------
// findApproveUrl
// Purpose: the buyer link. "payer-action" when payment_source is sent,
//          "approve" on older flows; accept either.
// -----------------------------------------------------------------------
export function findApproveUrl(links: Link[] | undefined): string {
   const link = (links ?? []).find(
      (l) => l.rel === "payer-action" || l.rel === "approve",
   );
   return link?.href ?? "";
}

// -----------------------------------------------------------------------
// createPaypalOrder
// Purpose: create the order; returns PayPal's id and the approve link.
// -----------------------------------------------------------------------
export async function createPaypalOrder(
   client: PaypalClient,
   order: Order,
   urls: ReturnUrls,
   requestId: string,
): Promise<{ id: string; approveUrl: string }> {
   const created = await client.request<PaypalOrder>({
      method: "POST",
      path: "/v2/checkout/orders",
      body: buildCreateOrderBody(order, urls),
      requestId,
      prefer: "return=representation",
   });
   const approveUrl = findApproveUrl(created.links);
   if (!created.id || !approveUrl) {
      throw new Error("PayPal order created without an approve link");
   }
   return { id: created.id, approveUrl };
}

// -----------------------------------------------------------------------
// firstCaptureId
// Purpose: the capture id inside a COMPLETED order, if present.
// -----------------------------------------------------------------------
function firstCaptureId(order: PaypalOrder): string | undefined {
   return order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
}

// -----------------------------------------------------------------------
// payerEmailOf
// Purpose: the buyer's PayPal email from an order response, if present
//          (kept in the evidence pack).
// -----------------------------------------------------------------------
function payerEmailOf(order: PaypalOrder): string | undefined {
   return (
      order.payer?.email_address ??
      order.payment_source?.paypal?.email_address
   );
}

// -----------------------------------------------------------------------
// checkAndCapture
// Purpose: GET the order; if the buyer approved it, capture it.
//          COMPLETED -> paid, APPROVED -> capture -> paid,
//          VOIDED -> voided, anything else -> still pending.
//          The capture uses a fixed PayPal-Request-Id per order, so a
//          double refresh (webhook + poll) cannot capture twice.
// -----------------------------------------------------------------------
export async function checkAndCapture(
   client: PaypalClient,
   paypalOrderId: string,
): Promise<PaymentCheck> {
   const id = encodeURIComponent(paypalOrderId);
   const current = await client.request<PaypalOrder>({
      method: "GET",
      path: `/v2/checkout/orders/${id}`,
   });
   if (current.status === "COMPLETED") {
      return {
         state: "paid",
         captureId: firstCaptureId(current),
         payerEmail: payerEmailOf(current),
      };
   }
   if (current.status === "VOIDED") {
      return { state: "voided" };
   }
   if (current.status !== "APPROVED") {
      return { state: "pending", detail: current.status };
   }
   const captured = await client.request<PaypalOrder>({
      method: "POST",
      path: `/v2/checkout/orders/${id}/capture`,
      body: {},
      requestId: `capture-${paypalOrderId}`,
      prefer: "return=representation",
   });
   if (captured.status === "COMPLETED") {
      return {
         state: "paid",
         captureId: firstCaptureId(captured),
         payerEmail: payerEmailOf(captured) ?? payerEmailOf(current),
      };
   }
   return { state: "pending", detail: captured.status };
}
