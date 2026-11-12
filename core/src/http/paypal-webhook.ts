// -----------------------------------------------------------------------
// paypal-webhook.ts
// Purpose: react to PayPal webhooks. The event body is treated only as
//          a hint ("look at order X now"): the actual state always comes
//          from our own authenticated GET to PayPal inside refresh(), so
//          a forged webhook cannot mark anything paid. That is why no
//          signature verification is needed for correctness here.
// -----------------------------------------------------------------------

import type { App } from "../app.ts";

type WebhookEvent = {
   event_type?: string;
   resource?: {
      id?: string;
      supplementary_data?: { related_ids?: { order_id?: string } };
   };
};

// Order events carry the PayPal order id as resource.id; capture events
// carry it under supplementary_data.related_ids.order_id.
const ORDER_EVENTS = new Set([
   "CHECKOUT.ORDER.APPROVED",
   "CHECKOUT.ORDER.COMPLETED",
]);
const CAPTURE_EVENTS = new Set(["PAYMENT.CAPTURE.COMPLETED"]);

// -----------------------------------------------------------------------
// paypalOrderIdOf
// Purpose: pull the PayPal order id out of a webhook event, or "".
// -----------------------------------------------------------------------
export function paypalOrderIdOf(event: WebhookEvent): string {
   const type = event.event_type ?? "";
   if (ORDER_EVENTS.has(type)) {
      return event.resource?.id ?? "";
   }
   if (CAPTURE_EVENTS.has(type)) {
      return event.resource?.supplementary_data?.related_ids?.order_id ?? "";
   }
   return "";
}

// -----------------------------------------------------------------------
// handlePaypalWebhook
// Purpose: verify the signature when possible (PAYPAL_WEBHOOK_ID set),
//          then find our order and refresh it. A failed verification
//          drops the event; "cannot verify" proceeds, because refresh()
//          trusts only PayPal's own API anyway. Unknown events and
//          orders are ignored. Never throws.
// -----------------------------------------------------------------------
export async function handlePaypalWebhook(
   app: App,
   body: unknown,
   headers: Record<string, string | string[] | undefined>,
): Promise<void> {
   const event = (
      typeof body === "object" && body ? body : {}
   ) as WebhookEvent;
   const paypalOrderId = paypalOrderIdOf(event);
   if (!paypalOrderId) {
      return;
   }
   const order = app.orders.findByPaypalId(paypalOrderId);
   if (!order) {
      return;
   }
   try {
      const verified = await app.orders.verifyWebhook(headers, body);
      if (verified === false) {
         console.warn("[webhook] signature not verified; ignoring event");
         return;
      }
      await app.orders.refresh(order.id);
   } catch (err) {
      console.warn("[webhook] failed:", (err as Error).message);
   }
}
