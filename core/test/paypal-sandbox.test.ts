// -----------------------------------------------------------------------
// paypal-sandbox.test.ts
// Purpose: the real PayPal adapter's request construction, checked
//          against a stubbed fetch (no network, no keys).
// -----------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaypalError } from "../src/paypal/paypal-client.ts";
import { SandboxGateway } from "../src/paypal/sandbox-gateway.ts";
import type { Order } from "../src/types.ts";
import { stubFetch, type Recorded } from "./helpers.ts";

const BASE = "https://api-m.sandbox.paypal.com";
const CREDS = { clientId: "cid", clientSecret: "secret", baseUrl: BASE };
const PUBLIC = "http://localhost:8787";

const ORDER: Order = {
   id: "ord_test1",
   conversationId: "c1",
   customerName: "Emma",
   buyerCountry: "GB",
   items: [
      {
         sku: "CUSHION-BP",
         name: "Block-print cushion cover",
         qty: 4,
         unitPrice: 6.5,
      },
      { sku: "DIYA-BRASS", name: "Brass diya set", qty: 1, unitPrice: 10.5 },
   ],
   subtotal: 36.5,
   discount: 3.65,
   shipping: 28.5,
   total: 61.35,
   currency: "GBP",
   totalInr: 7117,
   deliveryDays: "7-10",
   status: "awaiting_payment",
   reminders: 0,
   createdAt: "2026-11-11T00:00:00.000Z",
};

const CHECKOUT_URL = "https://www.sandbox.paypal.com/checkoutnow?token=5O1";

const TOKEN = {
   access_token: "tok123",
   token_type: "Bearer",
   expires_in: 32400,
};

// -----------------------------------------------------------------------
// route
// Purpose: answer stubbed PayPal calls by path.
// -----------------------------------------------------------------------
function route(table: Record<string, unknown>) {
   return (req: Recorded) => {
      const path = req.url.replace(BASE, "");
      if (path === "/v1/oauth2/token") {
         return { json: TOKEN };
      }
      const key = `${req.method} ${path}`;
      if (key in table) {
         return { json: table[key] };
      }
      return { status: 404, json: { name: "RESOURCE_NOT_FOUND" } };
   };
}

describe("SandboxGateway", () => {
   it("gets a Basic-auth OAuth token, then creates the order", async () => {
      const stub = stubFetch(
         route({
            "POST /v2/checkout/orders": {
               id: "5O190127TN364715T",
               status: "PAYER_ACTION_REQUIRED",
               links: [
                  { href: `${BASE}/v2/checkout/orders/5O1`, rel: "self" },
                  {
                     href: CHECKOUT_URL,
                     rel: "payer-action",
                  },
               ],
            },
         }),
      );
      const gw = new SandboxGateway(CREDS, PUBLIC, stub.fetch);
      const link = await gw.createPayment(ORDER);
      assert.equal(link.paypalOrderId, "5O190127TN364715T");
      assert.equal(link.approveUrl, CHECKOUT_URL);

      const [tokenReq, createReq] = stub.calls;
      assert.ok(tokenReq && createReq);
      assert.equal(tokenReq.url, `${BASE}/v1/oauth2/token`);
      assert.equal(tokenReq.method, "POST");
      const basic = Buffer.from("cid:secret").toString("base64");
      assert.equal(tokenReq.headers.authorization, `Basic ${basic}`);
      assert.equal(
         tokenReq.headers["content-type"],
         "application/x-www-form-urlencoded",
      );
      assert.equal(tokenReq.body, "grant_type=client_credentials");

      assert.equal(createReq.url, `${BASE}/v2/checkout/orders`);
      assert.equal(createReq.headers.authorization, "Bearer tok123");
      assert.ok(createReq.headers["paypal-request-id"]);
      assert.equal(createReq.headers.prefer, "return=representation");
      const body = JSON.parse(createReq.body);
      assert.equal(body.intent, "CAPTURE");
      const unit = body.purchase_units[0];
      assert.equal(unit.reference_id, "ord_test1");
      // Multi-currency: GBP, with shipping and the bulk discount broken
      // out so item_total + shipping - discount equals the amount.
      assert.deepEqual(unit.amount, {
         currency_code: "GBP",
         value: "61.35",
         breakdown: {
            item_total: { currency_code: "GBP", value: "36.50" },
            shipping: { currency_code: "GBP", value: "28.50" },
            discount: { currency_code: "GBP", value: "3.65" },
         },
      });
      assert.deepEqual(unit.items[0], {
         name: "Block-print cushion cover",
         sku: "CUSHION-BP",
         quantity: "4",
         unit_amount: { currency_code: "GBP", value: "6.50" },
         category: "PHYSICAL_GOODS",
      });
      const ctx = body.payment_source.paypal.experience_context;
      assert.equal(ctx.user_action, "PAY_NOW");
      assert.equal(ctx.shipping_preference, "NO_SHIPPING");
      assert.equal(
         ctx.return_url,
         `${PUBLIC}/paypal/return?orderId=ord_test1`,
      );
      assert.equal(
         ctx.cancel_url,
         `${PUBLIC}/paypal/cancel?orderId=ord_test1`,
      );
      assert.equal(body.application_context, undefined);
   });

   it("captures an APPROVED order with an idempotent request id", async () => {
      const stub = stubFetch(
         route({
            "GET /v2/checkout/orders/PP1": { id: "PP1", status: "APPROVED" },
            "POST /v2/checkout/orders/PP1/capture": {
               id: "PP1",
               status: "COMPLETED",
               payer: { email_address: "buyer@example.test" },
               purchase_units: [
                  {
                     payments: {
                        captures: [{ id: "CAP9", status: "COMPLETED" }],
                     },
                  },
               ],
            },
         }),
      );
      const gw = new SandboxGateway(CREDS, PUBLIC, stub.fetch);
      const check = await gw.checkPayment("PP1");
      assert.deepEqual(check, {
         state: "paid",
         captureId: "CAP9",
         payerEmail: "buyer@example.test",
      });
      const capture = stub.calls[2];
      assert.ok(capture);
      assert.equal(capture.method, "POST");
      assert.equal(capture.headers["paypal-request-id"], "capture-PP1");
      assert.equal(capture.headers["content-type"], "application/json");
      assert.equal(capture.body, "{}");
      // Token is cached: one token call for two API calls.
      const tokenCalls = stub.calls.filter((c) => c.url.endsWith("/token"));
      assert.equal(tokenCalls.length, 1);
   });

   it("reports pending without capturing an unapproved order", async () => {
      const stub = stubFetch(
         route({
            "GET /v2/checkout/orders/PP2": {
               id: "PP2",
               status: "PAYER_ACTION_REQUIRED",
            },
         }),
      );
      const gw = new SandboxGateway(CREDS, PUBLIC, stub.fetch);
      const check = await gw.checkPayment("PP2");
      assert.equal(check.state, "pending");
      assert.ok(!stub.calls.some((c) => c.url.endsWith("/capture")));
   });

   it("maps PayPal 422 errors to PaypalError with the issue", async () => {
      const stub = stubFetch((req) =>
         req.url.endsWith("/token")
            ? { json: TOKEN }
            : {
                 status: 422,
                 json: {
                    name: "UNPROCESSABLE_ENTITY",
                    debug_id: "dbg1",
                    details: [{ issue: "ITEM_TOTAL_MISMATCH" }],
                 },
              },
      );
      const gw = new SandboxGateway(CREDS, PUBLIC, stub.fetch);
      await assert.rejects(gw.createPayment(ORDER), (err: unknown) => {
         assert.ok(err instanceof PaypalError);
         assert.equal(err.status, 422);
         assert.equal(err.issue, "ITEM_TOTAL_MISMATCH");
         assert.equal(err.debugId, "dbg1");
         assert.doesNotMatch(err.message, /secret/);
         return true;
      });
   });

   it("creates, sends and marks paid an invoice", async () => {
      const stub = stubFetch(
         route({
            "POST /v2/invoicing/invoices": {
               id: "INV2-AAAA-BBBB",
               status: "DRAFT",
               detail: { metadata: { recipient_view_url: "https://x/inv" } },
            },
            "POST /v2/invoicing/invoices/INV2-AAAA-BBBB/send": {
               href: "https://www.sandbox.paypal.com/invoice/p/#AAAABBBB",
               rel: "payer-view",
               method: "GET",
            },
            "POST /v2/invoicing/invoices/INV2-AAAA-BBBB/payments": {
               payment_id: "EXTR-1",
            },
         }),
      );
      const gw = new SandboxGateway(CREDS, PUBLIC, stub.fetch);
      const ref = await gw.issueInvoice({ ...ORDER, status: "paid" }, "CAP9");
      assert.deepEqual(ref, {
         invoiceId: "INV2-AAAA-BBBB",
         invoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#AAAABBBB",
      });
      const create = JSON.parse(stub.calls[1]?.body ?? "{}");
      assert.equal(create.detail.currency_code, "GBP");
      assert.deepEqual(create.amount.breakdown, {
         shipping: { amount: { currency_code: "GBP", value: "28.50" } },
         discount: { invoice_discount: { percent: "10.00" } },
      });
      assert.equal(create.detail.reference, "ord_test1");
      assert.match(create.detail.invoice_date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(
         create.primary_recipients[0].billing_info.name.given_name,
         "Emma",
      );
      assert.deepEqual(create.items[1], {
         name: "Brass diya set",
         quantity: "1",
         unit_amount: { currency_code: "GBP", value: "10.50" },
         unit_of_measure: "QUANTITY",
      });
      assert.equal(create.invoicer, undefined);
      const send = JSON.parse(stub.calls[2]?.body ?? "{}");
      assert.deepEqual(send, {
         send_to_recipient: false,
         send_to_invoicer: false,
      });
      const pay = JSON.parse(stub.calls[3]?.body ?? "{}");
      assert.equal(pay.method, "OTHER");
      assert.deepEqual(pay.amount, { currency_code: "GBP", value: "61.35" });
   });

   it("turns network failures into PaypalError status 0", async () => {
      const failing = (async () => {
         throw new TypeError("fetch failed");
      }) as unknown as typeof fetch;
      const gw = new SandboxGateway(CREDS, PUBLIC, failing);
      await assert.rejects(gw.checkPayment("PP1"), (err: unknown) => {
         assert.ok(err instanceof PaypalError);
         assert.equal(err.status, 0);
         return true;
      });
   });
});

describe("webhook signature verification", () => {
   const HEADERS = {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/cert.pem",
      "paypal-transmission-id": "t-1",
      "paypal-transmission-sig": "sig",
      "paypal-transmission-time": "2026-11-11T00:00:00Z",
   };
   const EVENT = { event_type: "CHECKOUT.ORDER.APPROVED" };

   it("posts the documented body and trusts only SUCCESS", async () => {
      const stub = stubFetch(
         route({
            "POST /v1/notifications/verify-webhook-signature": {
               verification_status: "SUCCESS",
            },
         }),
      );
      const creds = { ...CREDS, webhookId: "WH-1" };
      const gw = new SandboxGateway(creds, PUBLIC, stub.fetch);
      assert.equal(await gw.verifyWebhook(HEADERS, EVENT), true);
      const body = JSON.parse(stub.calls[1]?.body ?? "{}");
      assert.deepEqual(body, {
         auth_algo: "SHA256withRSA",
         cert_url: "https://api.sandbox.paypal.com/cert.pem",
         transmission_id: "t-1",
         transmission_sig: "sig",
         transmission_time: "2026-11-11T00:00:00Z",
         webhook_id: "WH-1",
         webhook_event: EVENT,
      });
   });

   it("returns null without a webhook id, false on FAILURE", async () => {
      const stub = stubFetch(
         route({
            "POST /v1/notifications/verify-webhook-signature": {
               verification_status: "FAILURE",
            },
         }),
      );
      const noId = new SandboxGateway(CREDS, PUBLIC, stub.fetch);
      assert.equal(await noId.verifyWebhook(HEADERS, EVENT), null);
      const creds = { ...CREDS, webhookId: "WH-1" };
      const gw = new SandboxGateway(creds, PUBLIC, stub.fetch);
      assert.equal(await gw.verifyWebhook(HEADERS, EVENT), false);
      assert.equal(await gw.verifyWebhook({}, EVENT), false);
   });
});
