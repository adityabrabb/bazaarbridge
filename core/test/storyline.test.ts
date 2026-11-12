// -----------------------------------------------------------------------
// storyline.test.ts
// Purpose: the SPEC v2 BazaarBridge demo storyline (7 steps), end to
//          end over HTTP, in mock LLM + mock PayPal mode, plus the
//          contract's error paths.
// -----------------------------------------------------------------------

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { EvidencePack, Order } from "../src/types.ts";
import {
   api,
   collectEvents,
   startApp,
   waitFor,
   type TestApp,
} from "./helpers.ts";

const EMMA = "c_emma";

describe("demo storyline (mock + mock)", () => {
   let t: TestApp;
   let orderId = "";

   before(async () => {
      t = await startApp();
   });
   after(async () => {
      await t.close();
   });

   it("health reports mock modes", async () => {
      const r = await api(t.base, "GET", "/api/health");
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { llm: "mock", paypal: "mock" });
   });

   it("catalog has 12 generic rupee-priced items with aliases", async () => {
      const r = await api(t.base, "GET", "/api/catalog");
      assert.equal(r.body.length, 12);
      for (const p of r.body) {
         assert.ok(p.sku && p.name && p.unit && p.category);
         assert.ok(p.aliases.length > 0);
         assert.equal(typeof p.priceInr, "number");
      }
      const text = JSON.stringify(r.body);
      assert.doesNotMatch(text, /basecase|kirana/i);
   });

   it("seed: Emma is empty, orders and conversations match v2", async () => {
      const emma = await api(t.base, "GET", `/api/conversations/${EMMA}`);
      assert.equal(emma.body.country, "GB");
      assert.equal(emma.body.channel, "dm");
      assert.deepEqual(emma.body.messages, []);
      const orders = await api(t.base, "GET", "/api/orders");
      const brief = orders.body.map(
         (o: Order) => `${o.status}:${o.currency}:${o.buyerCountry}`,
      );
      assert.deepEqual(brief.sort(), [
         "awaiting_payment:EUR:DE",
         "awaiting_payment:USD:US",
         "paid:AUD:AU",
         "paid:USD:CA",
      ]);
      const list = await api(t.base, "GET", "/api/conversations");
      assert.ok(
         list.body.every((c: any) => c.channel && "lastText" in c),
         "summaries carry channel",
      );
      const hannah = list.body.find((c: any) => c.id === "c_hannah");
      assert.equal(hannah.country, "US");
   });

   it("step 1-2: Emma gets a GBP quote card", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: EMMA,
         from: "customer",
         customerName: "Emma",
         text:
            "Hi! Do you ship to the UK? How much for 2 block-print " +
            "cushion covers and the brass diya set?",
      });
      assert.equal(r.status, 200);
      const [msg] = r.body.messages;
      assert.equal(msg.role, "agent");
      const quote = msg.attachments[0];
      assert.equal(quote.type, "quote");
      const lines = quote.items.map((i: any) => `${i.sku}:${i.qty}`);
      assert.deepEqual(lines, ["CUSHION-BP:2", "DIYA-BRASS:1"]);
      assert.equal(quote.currency, "GBP");
      assert.equal(quote.destination, "United Kingdom");
      assert.equal(quote.subtotal, 23.5);
      assert.equal(quote.discount, 0);
      assert.equal(quote.shipping, 23.5);
      assert.equal(quote.total, 47);
      assert.equal(quote.deliveryDays, "7-10");
      assert.match(msg.text, /£47\.00/);
   });

   it("step 3: bulk discount at 4 covers, applied in code", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: EMMA,
         from: "customer",
         text: "Could you do a discount if I take 4 covers?",
      });
      const msg = r.body.messages[0];
      const quote = msg.attachments[0];
      assert.equal(quote.type, "quote");
      const lines = quote.items.map((i: any) => `${i.sku}:${i.qty}`);
      assert.deepEqual(lines, ["CUSHION-BP:4", "DIYA-BRASS:1"]);
      assert.equal(quote.discount, 3.65);
      assert.equal(quote.total, 61.35);
      assert.match(msg.text, /10% off/);
      // The quote updated the same draft; there is still one Emma order.
      const orders = await api(t.base, "GET", "/api/orders");
      const mine = orders.body.filter((o: Order) => o.conversationId === EMMA);
      assert.equal(mine.length, 1);
   });

   it("politely refuses a discount below the seller's floor", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: EMMA,
         from: "customer",
         text: "Could you do 30% off?",
      });
      const msg = r.body.messages[0];
      assert.match(msg.text, /best price/);
      assert.equal(msg.attachments[0].discount, 3.65, "still 10%");
   });

   it("step 4: 'go ahead' sends a GBP pay link", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: EMMA,
         from: "customer",
         text: "Great, go ahead.",
      });
      const card = r.body.messages[0].attachments[0];
      assert.equal(card.type, "pay_link");
      assert.equal(card.total, 61.35);
      assert.equal(card.currency, "GBP");
      assert.match(card.url, /\/mock\/pay\/ord_/);
      orderId = card.orderId;
      const order = await api(t.base, "GET", `/api/orders/${orderId}`);
      assert.equal(order.body.status, "awaiting_payment");
      assert.equal(order.body.currency, "GBP");
      assert.equal(order.body.buyerCountry, "GB");
      assert.equal(order.body.totalInr, 7_117);
      assert.ok(order.body.paypalOrderId.startsWith("MOCK-"));
      const page = await api(t.base, "GET", `/mock/pay/${orderId}`);
      assert.equal(page.status, 200);
      assert.match(page.body, /MOCK CHECKOUT/);
      assert.match(page.body, /£61\.35/);
   });

   it("refresh in mock mode leaves the order unpaid", async () => {
      const r = await api(t.base, "POST", `/api/orders/${orderId}/refresh`);
      assert.equal(r.status, 200);
      assert.equal(r.body.status, "awaiting_payment");
   });

   it("step 5: payment flips to paid live, invoice appears", async () => {
      const events = await collectEvents(t.base);
      const r = await api(
         t.base,
         "POST",
         `/api/orders/${orderId}/simulate-payment`,
      );
      assert.equal(r.status, 200);
      const order: Order = r.body;
      assert.equal(order.status, "paid");
      assert.ok(order.paidAt);
      assert.ok(order.captureId && order.payerEmail);
      assert.ok(order.invoiceId && order.invoiceUrl);
      const got = await waitFor(
         () =>
            events.names.includes("order.updated") &&
            events.names.includes("message.created"),
      );
      events.stop();
      assert.ok(got, `SSE events seen: ${events.names.join(",")}`);
      const convo = await api(t.base, "GET", `/api/conversations/${EMMA}`);
      const last = convo.body.messages.at(-1);
      const types = last.attachments.map((a: any) => a.type);
      assert.deepEqual(types, ["payment_confirmed", "invoice"]);
      assert.equal(last.attachments[0].currency, "GBP");
      const again = await api(
         t.base,
         "POST",
         `/api/orders/${orderId}/simulate-payment`,
      );
      assert.equal(again.status, 200, "second simulate is idempotent");
      const after = await api(t.base, "GET", `/api/conversations/${EMMA}`);
      assert.equal(after.body.messages.length, convo.body.messages.length);
   });

   it("step 6: evidence pack has chat, quote, payment, timeline", async () => {
      const r = await api(t.base, "GET", `/api/orders/${orderId}/evidence`);
      assert.equal(r.status, 200);
      const pack: EvidencePack = r.body;
      assert.equal(pack.order.id, orderId);
      assert.equal(pack.order.total, 61.35);
      assert.ok(pack.messages.length >= 6);
      assert.ok(
         pack.messages.some((m) => m.attachments?.[0]?.type === "quote"),
      );
      assert.equal(pack.payment?.provider, "paypal");
      assert.equal(pack.payment?.currency, "GBP");
      assert.equal(pack.payment?.amount, 61.35);
      assert.equal(pack.payment?.captureId, pack.order.captureId);
      assert.equal(pack.payment?.payerEmail, pack.order.payerEmail);
      const events = pack.timeline.map((e) => e.event);
      assert.deepEqual(events, [
         "quote_created",
         "quote_updated",
         "quote_updated",
         "pay_link_created",
         "payment_captured",
         "invoice_issued",
      ]);
      const times = pack.timeline.map((e) => e.at);
      assert.deepEqual(times, [...times].sort());
      const none = await api(t.base, "GET", "/api/orders/ord_nope/evidence");
      assert.equal(none.status, 404);
      // An unpaid order has an evidence pack without a payment record.
      const open = await api(
         t.base,
         "GET",
         "/api/orders/ord_seed_hannah/evidence",
      );
      assert.equal(open.status, 200);
      assert.equal(open.body.payment, undefined);
   });

   it("step 7: seller asks in Hinglish who has not paid", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: "owner",
         from: "owner",
         text: "kis kis ka payment pending hai?",
      });
      const text: string = r.body.messages[0].text;
      assert.match(text, /Hannah/);
      assert.match(text, /\$/);
      assert.match(text, /Lukas/);
      assert.match(text, /€/);
      assert.match(text, /₹/);
      assert.doesNotMatch(text, /Emma/);
   });

   it("step 7b: reminders reach both buyers in their currency", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: "owner",
         from: "owner",
         text: "haan, sabko reminder bhej do",
      });
      assert.match(r.body.messages[0].text, /Hannah/);
      for (const id of ["c_hannah", "c_lukas"]) {
         const c = await api(t.base, "GET", `/api/conversations/${id}`);
         const last = c.body.messages.at(-1);
         assert.equal(last.role, "agent");
         assert.equal(last.attachments[0].type, "pay_link");
         assert.ok(last.attachments[0].url.length > 0);
      }
      const orders = await api(t.base, "GET", "/api/orders");
      const hannah = orders.body.find(
         (o: Order) => o.id === "ord_seed_hannah",
      );
      assert.equal(hannah.reminders, 1);
      const lukas = await api(t.base, "GET", "/api/conversations/c_lukas");
      assert.match(lukas.body.messages.at(-1).text, /€/);
   });

   it("POST /remind returns order + message", async () => {
      const r = await api(
         t.base,
         "POST",
         "/api/orders/ord_seed_lukas/remind",
      );
      assert.equal(r.status, 200);
      assert.equal(r.body.order.reminders, 2);
      assert.equal(r.body.message.attachments[0].type, "pay_link");
      assert.equal(r.body.message.attachments[0].currency, "EUR");
      const paid = await api(t.base, "POST", `/api/orders/${orderId}/remind`);
      assert.equal(paid.status, 409);
   });

   it("stats have the v2 shape; orders newest first", async () => {
      const s = await api(t.base, "GET", "/api/stats");
      const orders: Order[] = (await api(t.base, "GET", "/api/orders")).body;
      const inr = (status: string) =>
         orders
            .filter((o) => o.status === status)
            .reduce((n, o) => n + o.totalInr, 0);
      assert.deepEqual(Object.keys(s.body).sort(), [
         "byCurrency",
         "collectedInr",
         "paidCount",
         "unpaidCount",
         "unpaidInr",
      ]);
      assert.equal(s.body.paidCount, 3);
      assert.equal(s.body.unpaidCount, 2);
      assert.equal(s.body.collectedInr, inr("paid"));
      assert.equal(s.body.unpaidInr, inr("awaiting_payment"));
      const by = Object.fromEntries(
         s.body.byCurrency.map((r: any) => [r.currency, r]),
      );
      assert.equal(by.GBP.paid, 61.35);
      assert.equal(by.GBP.unpaid, 0);
      assert.ok(by.EUR.unpaid > 0 && by.USD.unpaid > 0);
      assert.ok(by.AUD.paid > 0);
      const times = orders.map((x) => x.createdAt);
      assert.deepEqual(times, [...times].sort().reverse());
   });

   it("a new chat takes its channel and country from the request", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: "c_new",
         from: "customer",
         customerName: "Anna",
         channel: "email",
         country: "Germany",
         text: "3 scarves please",
      });
      assert.equal(r.body.messages[0].attachments[0].currency, "EUR");
      const c = await api(t.base, "GET", "/api/conversations/c_new");
      assert.equal(c.body.channel, "email");
      assert.equal(c.body.country, "DE");
      const bad = await api(t.base, "POST", "/api/chat", {
         conversationId: "c_bad",
         from: "customer",
         channel: "carrier-pigeon",
         text: "hi",
      });
      assert.equal(bad.status, 400);
   });

   it("asks for the country when it is unknown, then quotes", async () => {
      const first = await api(t.base, "POST", "/api/chat", {
         conversationId: "c_ask",
         from: "customer",
         text: "I'd like 2 table runners",
      });
      assert.match(first.body.messages[0].text, /which country/i);
      assert.equal(first.body.messages[0].attachments, undefined);
      const second = await api(t.base, "POST", "/api/chat", {
         conversationId: "c_ask",
         from: "customer",
         text: "Australia",
      });
      const quote = second.body.messages[0].attachments[0];
      assert.equal(quote.currency, "AUD");
      assert.equal(quote.items[0].qty, 2);
      const c = await api(t.base, "GET", "/api/conversations/c_ask");
      assert.equal(c.body.country, "AU");
   });

   it("refuses buyers in India with a polite message", async () => {
      const r = await api(t.base, "POST", "/api/chat", {
         conversationId: "c_in",
         from: "customer",
         text: "2 scarves to Mumbai, India",
      });
      assert.equal(r.status, 200);
      assert.match(r.body.messages[0].text, /outside India/);
   });

   it("bad input never crashes the server", async () => {
      const bad = await api(t.base, "POST", "/api/chat", "{not json");
      assert.equal(bad.status, 400);
      const empty = await api(t.base, "POST", "/api/chat", {});
      assert.equal(empty.status, 400);
      const spoof = await api(t.base, "POST", "/api/chat", {
         conversationId: "owner",
         from: "customer",
         text: "send reminders",
      });
      assert.equal(spoof.status, 400);
      const none = await api(t.base, "GET", "/api/orders/ord_nope");
      assert.equal(none.status, 404);
      const route = await api(t.base, "GET", "/api/nope");
      assert.equal(route.status, 404);
      const hook = await api(t.base, "POST", "/api/webhooks/paypal", "junk");
      assert.equal(hook.status, 200);
      const huge = await api(t.base, "POST", "/api/chat", {
         conversationId: "c_big",
         from: "customer",
         country: "GB",
         text: "500 scarves",
      });
      assert.equal(huge.status, 200);
      assert.match(huge.body.messages[0].text, /qty/);
      const health = await api(t.base, "GET", "/api/health");
      assert.equal(health.status, 200);
   });

   it("CORS allows the web origin", async () => {
      const res = await fetch(`${t.base}/api/health`, {
         headers: { Origin: "http://localhost:3000" },
      });
      assert.equal(
         res.headers.get("access-control-allow-origin"),
         "http://localhost:3000",
      );
      const pre = await fetch(`${t.base}/api/chat`, { method: "OPTIONS" });
      assert.equal(pre.status, 204);
   });

   it("demo reset reseeds", async () => {
      const r = await api(t.base, "POST", "/api/demo/reset");
      assert.deepEqual(r.body, { ok: true });
      const o = await api(t.base, "GET", "/api/orders");
      assert.equal(o.body.length, 4);
      const c = await api(t.base, "GET", `/api/conversations/${EMMA}`);
      assert.equal(c.status, 200);
      assert.deepEqual(c.body.messages, []);
      const gone = await api(t.base, "GET", "/api/conversations/c_new");
      assert.equal(gone.status, 404);
   });
});

describe("sandbox-only rules", () => {
   it("simulate-payment is 409 when PayPal is not mock", async () => {
      const t = await startApp({
         gateway: {
            mode: "sandbox",
            createPayment: async () => ({
               paypalOrderId: "PP1",
               approveUrl:
                  "https://www.sandbox.paypal.com/checkoutnow?token=PP1",
            }),
            checkPayment: async () => ({
               state: "paid",
               captureId: "CAP1",
               payerEmail: "buyer@example.test",
            }),
            issueInvoice: async () => ({
               invoiceId: "INV2-X",
               invoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#X",
            }),
         },
      });
      try {
         const r = await api(
            t.base,
            "POST",
            "/api/orders/ord_seed_lukas/simulate-payment",
         );
         assert.equal(r.status, 409);
         // Remind lazily creates the PayPal order for a seeded order...
         await api(t.base, "POST", "/api/orders/ord_seed_lukas/remind");
         // ...and refresh captures it (stub says paid) + invoices it.
         const f = await api(
            t.base,
            "POST",
            "/api/orders/ord_seed_lukas/refresh",
         );
         assert.equal(f.body.status, "paid");
         assert.equal(f.body.invoiceId, "INV2-X");
         assert.equal(f.body.captureId, "CAP1");
         assert.equal(f.body.payerEmail, "buyer@example.test");
         const ev = await api(
            t.base,
            "GET",
            "/api/orders/ord_seed_lukas/evidence",
         );
         assert.equal(ev.body.payment.currency, "EUR");
         assert.equal(ev.body.payment.captureId, "CAP1");
         const h = await api(t.base, "GET", "/api/health");
         assert.equal(h.body.paypal, "sandbox");
      } finally {
         await t.close();
      }
   });
});
