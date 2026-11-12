// -----------------------------------------------------------------------
// mock-gateway.ts
// Purpose: a PaymentGateway that needs no PayPal account. Pay links
//          point at a local, clearly-labelled mock checkout page; the
//          payment itself happens through POST /simulate-payment.
// -----------------------------------------------------------------------

import { MOCK_INVOICE_PREFIX, MOCK_PAYPAL_PREFIX } from "../constants.ts";
import type { Order } from "../types.ts";
import type {
   InvoiceRef,
   PaymentCheck,
   PaymentGateway,
   PaymentLink,
} from "./payment-gateway.ts";

export class MockGateway implements PaymentGateway {
   readonly mode = "mock" as const;
   private baseUrl: string;

   // --------------------------------------------------------------------
   // constructor
   // Purpose: remember the public URL of /core for the mock pages.
   // --------------------------------------------------------------------
   constructor(publicBaseUrl: string) {
      this.baseUrl = publicBaseUrl;
   }

   // --------------------------------------------------------------------
   // createPayment
   // Purpose: fake PayPal order id + link to the local mock pay page.
   // --------------------------------------------------------------------
   async createPayment(order: Order): Promise<PaymentLink> {
      return {
         paypalOrderId: `${MOCK_PAYPAL_PREFIX}${order.id}`,
         approveUrl: `${this.baseUrl}/mock/pay/${order.id}`,
      };
   }

   // --------------------------------------------------------------------
   // checkPayment
   // Purpose: mock payments are only ever completed by simulate-payment,
   //          which marks the order paid directly; a refresh is a no-op.
   // --------------------------------------------------------------------
   async checkPayment(_paypalOrderId: string): Promise<PaymentCheck> {
      return { state: "pending", detail: "mock mode: use simulate-payment" };
   }

   // --------------------------------------------------------------------
   // issueInvoice
   // Purpose: fake invoice id + link to the local mock invoice page.
   // --------------------------------------------------------------------
   async issueInvoice(order: Order): Promise<InvoiceRef> {
      return {
         invoiceId: `${MOCK_INVOICE_PREFIX}${order.id}`,
         invoiceUrl: `${this.baseUrl}/mock/invoice/${order.id}`,
      };
   }
}
