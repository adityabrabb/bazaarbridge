// -----------------------------------------------------------------------
// paypal-webhook-verify.ts
// Purpose: ask PayPal whether a webhook really came from PayPal, via
//          POST /v1/notifications/verify-webhook-signature (Webhooks v1
//          OpenAPI spec). Needs the webhook id from the developer
//          dashboard (PAYPAL_WEBHOOK_ID).
// -----------------------------------------------------------------------

import type { PaypalClient } from "./paypal-client.ts";

export type WebhookHeaders = Record<string, string | string[] | undefined>;

// -----------------------------------------------------------------------
// header
// Purpose: one header value as a string (node may give arrays).
// -----------------------------------------------------------------------
function header(headers: WebhookHeaders, name: string): string {
   const value = headers[name];
   return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// -----------------------------------------------------------------------
// buildVerifyBody
// Purpose: the request body, from PayPal's transmission headers.
// -----------------------------------------------------------------------
export function buildVerifyBody(
   headers: WebhookHeaders,
   event: unknown,
   webhookId: string,
) {
   return {
      auth_algo: header(headers, "paypal-auth-algo"),
      cert_url: header(headers, "paypal-cert-url"),
      transmission_id: header(headers, "paypal-transmission-id"),
      transmission_sig: header(headers, "paypal-transmission-sig"),
      transmission_time: header(headers, "paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
   };
}

// -----------------------------------------------------------------------
// verifyWebhookSignature
// Purpose: true only when PayPal answers verification_status SUCCESS.
//          Missing headers short-circuit to false without a call.
// -----------------------------------------------------------------------
export async function verifyWebhookSignature(
   client: PaypalClient,
   headers: WebhookHeaders,
   event: unknown,
   webhookId: string,
): Promise<boolean> {
   const body = buildVerifyBody(headers, event, webhookId);
   if (!body.transmission_id || !body.transmission_sig) {
      return false;
   }
   const res = await client.request<{ verification_status?: string }>({
      method: "POST",
      path: "/v1/notifications/verify-webhook-signature",
      body,
   });
   return res.verification_status === "SUCCESS";
}
