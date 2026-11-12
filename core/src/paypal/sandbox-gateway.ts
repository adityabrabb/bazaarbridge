// -----------------------------------------------------------------------
// sandbox-gateway.ts
// Purpose: the real PayPal sandbox PaymentGateway: Orders v2 for the pay
//          link and capture, Invoicing v2 for the receipt.
// -----------------------------------------------------------------------

import { newId } from "../ids.ts";
import type { Order } from "../types.ts";
import type {
   InvoiceRef,
   PaymentCheck,
   PaymentGateway,
   PaymentLink,
} from "./payment-gateway.ts";
import {
   PaypalClient,
   type FetchFn,
   type PaypalCredentials,
} from "./paypal-client.ts";
import { checkAndCapture, createPaypalOrder } from "./paypal-orders.ts";
import { issuePaypalInvoice } from "./paypal-invoices.ts";
import {
   verifyWebhookSignature,
   type WebhookHeaders,
} from "./paypal-webhook-verify.ts";

export class SandboxGateway implements PaymentGateway {
   readonly mode = "sandbox" as const;
   private client: PaypalClient;
   private publicBaseUrl: string;
   private webhookId: string;

   // --------------------------------------------------------------------
   // constructor
   // Purpose: wire credentials, the public /core URL (for return_url)
   //          and an injectable fetch (tests stub it).
   // --------------------------------------------------------------------
   constructor(
      creds: PaypalCredentials,
      publicBaseUrl: string,
      fetchFn: FetchFn = fetch,
   ) {
      this.client = new PaypalClient(creds, fetchFn);
      this.publicBaseUrl = publicBaseUrl;
      this.webhookId = creds.webhookId ?? "";
   }

   // --------------------------------------------------------------------
   // createPayment
   // Purpose: create a PayPal order. return_url points back at /core,
   //          which captures right away and then sends the buyer on.
   // --------------------------------------------------------------------
   async createPayment(order: Order): Promise<PaymentLink> {
      const q = `orderId=${encodeURIComponent(order.id)}`;
      const created = await createPaypalOrder(
         this.client,
         order,
         {
            returnUrl: `${this.publicBaseUrl}/paypal/return?${q}`,
            cancelUrl: `${this.publicBaseUrl}/paypal/cancel?${q}`,
         },
         newId("create"),
      );
      return { paypalOrderId: created.id, approveUrl: created.approveUrl };
   }

   // --------------------------------------------------------------------
   // checkPayment
   // Purpose: GET + capture-if-approved (see paypal-orders.ts).
   // --------------------------------------------------------------------
   checkPayment(paypalOrderId: string): Promise<PaymentCheck> {
      return checkAndCapture(this.client, paypalOrderId);
   }

   // --------------------------------------------------------------------
   // issueInvoice
   // Purpose: Invoicing v2 receipt for a paid order.
   // --------------------------------------------------------------------
   issueInvoice(order: Order, captureId?: string): Promise<InvoiceRef> {
      return issuePaypalInvoice(this.client, order, captureId);
   }

   // --------------------------------------------------------------------
   // verifyWebhook
   // Purpose: PayPal-side signature check. null = cannot verify (no
   //          PAYPAL_WEBHOOK_ID); errors count as "not verified".
   // --------------------------------------------------------------------
   async verifyWebhook(
      headers: WebhookHeaders,
      event: unknown,
   ): Promise<boolean | null> {
      if (!this.webhookId) {
         return null;
      }
      try {
         return await verifyWebhookSignature(
            this.client,
            headers,
            event,
            this.webhookId,
         );
      } catch (err) {
         console.warn("[paypal] webhook verify:", (err as Error).message);
         return false;
      }
   }
}
