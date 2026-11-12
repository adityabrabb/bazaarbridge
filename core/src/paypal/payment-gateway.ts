// -----------------------------------------------------------------------
// payment-gateway.ts
// Purpose: the one interface the rest of the engine uses for payments.
//          Two implementations: the real PayPal sandbox (REST) and a
//          mock that needs no account. Callers never know which is live.
// -----------------------------------------------------------------------

import type { Order, PaypalMode } from "../types.ts";

export type PaymentLink = {
   paypalOrderId: string;
   approveUrl: string;
};

export type PaymentState = "pending" | "paid" | "voided";

export type PaymentCheck = {
   state: PaymentState;
   captureId?: string;
   payerEmail?: string;
   detail?: string;
};

export type InvoiceRef = {
   invoiceId: string;
   invoiceUrl: string;
};

export interface PaymentGateway {
   readonly mode: PaypalMode;

   // Create a PayPal order for `order` and return the buyer's pay link.
   createPayment(order: Order): Promise<PaymentLink>;

   // Look the PayPal order up; capture it if the buyer approved it.
   checkPayment(paypalOrderId: string): Promise<PaymentCheck>;

   // Create, send and mark paid an invoice for a paid order.
   issueInvoice(order: Order, captureId?: string): Promise<InvoiceRef>;

   // Optional: true/false from PayPal's signature check, null when this
   // gateway cannot verify (mock, or no webhook id configured).
   verifyWebhook?(
      headers: Record<string, string | string[] | undefined>,
      event: unknown,
   ): Promise<boolean | null>;
}
