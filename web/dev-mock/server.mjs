/**
 * Contract mock server (SPEC v2, BazaarBridge) for building /web
 * before /core is ready. Plain Node, no dependencies, port 8787.
 * Canned behaviour: English buyer parser, Hinglish-friendly seller
 * parser, quotes in the buyer's currency, SSE, mock PayPal pay.
 * Start only if the real core is not answering /api/health.
 */
import http from "node:http";

const PORT = 8787;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "*";

/** Catalog in rupees: [sku, name, aliases, unit, priceInr, category]. */
const CATALOG = [
   ["cover", "Block-print cushion cover", ["cushion", "cover"],
      "piece", 850, "home"],
   ["diya", "Brass diya set", ["diya"], "set", 1450, "brass"],
   ["scarf", "Indigo block-print scarf", ["scarf"], "piece", 1200,
      "textile"],
   ["jhumka", "Handmade jhumka earrings", ["jhumka", "earring"],
      "pair", 650, "jewellery"],
].map(([sku, name, aliases, unit, priceInr, category]) => (
   { sku, name, aliases, unit, priceInr, category }));

/** Fixed rate table (INR -> currency) and the country rules. */
const RATE = { GBP: 0.0095, USD: 0.012, EUR: 0.011, AUD: 0.018 };
const COUNTRY = {
   GB: { currency: "GBP", ship: 9, perItem: 1.5, days: "7-10" },
   US: { currency: "USD", ship: 14, perItem: 2, days: "9-14" },
   DE: { currency: "EUR", ship: 11, perItem: 1.5, days: "8-12" },
   AU: { currency: "AUD", ship: 20, perItem: 3, days: "10-15" },
};
const BULK_PCT = 10;
const BULK_MIN_QTY = 4;

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
let seq = 100;
const nextId = (p) => `${p}_${++seq}`;
const round2 = (n) => Math.round(n * 100) / 100;
/** Rounds up to the next .00 or .50, like the real quote engine. */
const roundHalf = (n) => Math.ceil(n * 2) / 2;

let db;

/** Computes a full quote for items [{sku, qty}] to a country. */
function quote(lines, country, wantDiscount) {
   const rule = COUNTRY[country] ?? { currency: "USD", ship: 18,
      perItem: 2.5, days: "10-16" };
   const items = lines.map((l) => {
      const p = CATALOG.find((c) => c.sku === l.sku);
      return { sku: p.sku, name: p.name, qty: l.qty,
         unitPrice: roundHalf(p.priceInr * RATE[rule.currency]) };
   });
   const qty = items.reduce((s, i) => s + i.qty, 0);
   const subtotal = round2(
      items.reduce((s, i) => s + i.qty * i.unitPrice, 0));
   const discount = wantDiscount && qty >= BULK_MIN_QTY
      ? round2(subtotal * BULK_PCT / 100) : 0;
   const shipping = round2(rule.ship + rule.perItem * qty);
   const total = round2(subtotal - discount + shipping);
   return { items, subtotal, discount, shipping, total,
      currency: rule.currency, deliveryDays: rule.days,
      totalInr: Math.round(total / RATE[rule.currency]) };
}

/** Reseeds the in-memory store: Emma empty, 2 unpaid, 2 paid. */
function seed() {
   const mk = (id, conv, name, country, lines, mins, status, rem) => {
      const q = quote(lines, country, false);
      const o = { id, conversationId: conv, customerName: name,
         buyerCountry: country, ...q, status,
         paypalOrderId: `PP-${id}`,
         approveUrl: `http://localhost:${PORT}/mock/pay/${id}`,
         reminders: rem, createdAt: minutesAgo(mins) };
      if (status === "paid") {
         Object.assign(o, { paidAt: minutesAgo(mins - 40),
            invoiceId: `INV-${id}`, payerEmail: "buyer@example.com",
            captureId: `CAP-${id}`,
            invoiceUrl: `http://localhost:${PORT}/mock/invoice/${id}` });
      }
      return o;
   };
   const orders = [
      mk("ord_0004", "cust-jordan", "Jordan Miller", "US",
         [{ sku: "scarf", qty: 2 }, { sku: "jhumka", qty: 1 }],
         60 * 52, "awaiting_payment", 1),
      mk("ord_0003", "cust-lena", "Lena Fischer", "DE",
         [{ sku: "diya", qty: 2 }, { sku: "cover", qty: 4 }],
         60 * 29, "awaiting_payment", 0),
      mk("ord_0002", "cust-chloe", "Chloe Baker", "AU",
         [{ sku: "scarf", qty: 3 }], 60 * 70, "paid", 0),
      mk("ord_0001", "cust-tom", "Tom Weller", "GB",
         [{ sku: "cover", qty: 6 }], 60 * 120, "paid", 0),
   ];
   const msg = (conv, role, text, mins, attachments) => ({
      id: nextId("msg"), conversationId: conv, role, text,
      attachments, createdAt: minutesAgo(mins),
   });
   const quoteAtt = (o) => ({ type: "quote", items: o.items,
      subtotal: o.subtotal, discount: o.discount,
      shipping: o.shipping, total: o.total, currency: o.currency,
      destination: o.buyerCountry, deliveryDays: o.deliveryDays });
   const thread = (o, ask, paid) => {
      const m = [
         msg(o.conversationId, "customer", ask, 60 * 100,
            undefined),
         msg(o.conversationId, "agent", "Happy to help. Here is " +
            "your quote.", 60 * 100 - 1, [quoteAtt(o)]),
         msg(o.conversationId, "customer", "Go ahead please.",
            60 * 99, undefined),
         msg(o.conversationId, "agent", "Here is your PayPal link.",
            60 * 99 - 1, [{ type: "pay_link", orderId: o.id,
               url: o.approveUrl, total: o.total,
               currency: o.currency }]),
      ];
      if (paid) {
         m.push(msg(o.conversationId, "agent",
            "Payment received, thank you!", 60 * 98,
            [{ type: "payment_confirmed", orderId: o.id,
               total: o.total, currency: o.currency }]));
      }
      return m;
   };
   const conv = (o, channel, country, ask) => ({
      id: o.conversationId, kind: "customer",
      customerName: o.customerName, channel, country,
      messages: thread(o, ask, o.status === "paid"),
   });
   db = {
      orders,
      conversations: {
         owner: { id: "owner", kind: "owner", customerName: "Owner",
            channel: "chat", messages: [msg("owner", "agent",
               "Namaste! Ask me about unpaid invoices, today's " +
               "money, or tell me to send reminders.", 5)] },
         "cust-emma": { id: "cust-emma", kind: "customer",
            customerName: "Emma", channel: "dm", country: "GB",
            messages: [] },
         "cust-jordan": conv(orders[0], "email", "US",
            "Can I get 2 scarves and a pair of jhumkas to Austin?"),
         "cust-lena": conv(orders[1], "chat", "DE",
            "I would like 2 diya sets and 4 covers to Berlin."),
         "cust-chloe": conv(orders[2], "dm", "AU",
            "3 scarves to Sydney please."),
         "cust-tom": conv(orders[3], "email", "GB",
            "6 cushion covers to Leeds please."),
      },
   };
}
seed();

const clients = new Set();
/** Pushes one SSE event to every connected browser. */
function emit(event, data) {
   for (const c of clients) {
      c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
   }
}

/** Appends a message to a conversation and announces it. */
function addMessage(convId, role, text, attachments) {
   const m = {
      id: nextId("msg"), conversationId: convId, role, text,
      attachments, createdAt: new Date().toISOString(),
   };
   db.conversations[convId].messages.push(m);
   emit("message.created", m);
   return m;
}

/** Updates an order and announces it. */
function touch(order, patch) {
   Object.assign(order, patch);
   emit("order.updated", order);
   return order;
}

/** English parser: "2 cushion covers", "4 covers", "diya set". */
function parseLines(text) {
   const t = text.toLowerCase();
   const found = [];
   for (const p of CATALOG) {
      const alias = p.aliases.find((a) => t.includes(a));
      if (!alias) continue;
      const at = t.indexOf(alias);
      const before = t.slice(Math.max(0, at - 24), at);
      const m = before.match(/(\d+)\s*(block-print\s*)?(brass\s*)?$/);
      found.push({ sku: p.sku, qty: m ? Number(m[1]) : 1 });
   }
   return found;
}

/** The attachment card for a quote. */
const quoteAtt = (o) => ({ type: "quote", items: o.items,
   subtotal: o.subtotal, discount: o.discount, shipping: o.shipping,
   total: o.total, currency: o.currency,
   destination: o.buyerCountry, deliveryDays: o.deliveryDays });

/** Buyer turn: quote, discount, go-ahead, or a polite fallback. */
function customerTurn(body) {
   const { conversationId: id, text } = body;
   if (!db.conversations[id]) {
      db.conversations[id] = { id, kind: "customer",
         customerName: body.customerName ?? "Buyer",
         channel: body.channel ?? "chat", country: body.country,
         messages: [] };
   }
   const conv = db.conversations[id];
   addMessage(id, "customer", text);
   const draft = db.orders.find(
      (o) => o.conversationId === id && o.status === "draft");
   if (/go ahead|yes|confirm|ok\b/i.test(text) && draft) {
      touch(draft, { status: "awaiting_payment",
         paypalOrderId: `PP-${draft.id}`,
         approveUrl: `http://localhost:${PORT}/mock/pay/${draft.id}` });
      return [addMessage(id, "agent",
         "Wonderful! Here is your PayPal link.",
         [{ type: "pay_link", orderId: draft.id, url: draft.approveUrl,
            total: draft.total, currency: draft.currency }])];
   }
   const lines = parseLines(text);
   const wantsDiscount = /discount|cheaper|bulk|reduce/i.test(text);
   if (lines.length || (wantsDiscount && draft)) {
      const country = conv.country ?? "GB";
      const base = lines.length ? lines : draft.items.map(
         (i) => ({ sku: i.sku, qty: i.qty }));
      // Merge a changed quantity into the existing draft lines.
      const merged = draft && lines.length
         ? [...draft.items.map((i) => ({ sku: i.sku, qty: i.qty })
            )].map((l) => lines.find((x) => x.sku === l.sku) ?? l)
            .concat(lines.filter((x) => !draft.items.some(
               (i) => i.sku === x.sku)))
         : base;
      const q = quote(merged, country, wantsDiscount);
      let order = draft;
      if (order) touch(order, q);
      else {
         order = { id: nextId("ord"), conversationId: id,
            customerName: conv.customerName, buyerCountry: country,
            ...q, status: "draft", reminders: 0,
            createdAt: new Date().toISOString() };
         db.orders.unshift(order);
         emit("order.updated", order);
      }
      const note = wantsDiscount && q.discount > 0
         ? `Yes, with 4 or more pieces I can take ${BULK_PCT}% off. ` +
           "That is the best I can do. Updated quote:"
         : wantsDiscount
            ? "A bulk discount starts at 4 pieces. Add more and I " +
              "will update the quote."
            : "Yes, we ship to you! Here is your quote:";
      return [addMessage(id, "agent", note, [quoteAtt(order)])];
   }
   return [addMessage(id, "agent",
      "Sorry, I did not catch that. Tell me the items and how many, " +
      "for example '2 block-print cushion covers'.")];
}

/** Formats an amount like the UI does. */
const SYM = { USD: "$", GBP: "£", EUR: "€", AUD: "A$" };
const fmt = (o) => `${SYM[o.currency]}${o.total.toFixed(2)}`;

/** Seller turn (Hinglish ok): list unpaid, or remind everyone. */
function ownerTurn(body) {
   const id = "owner";
   addMessage(id, "owner", body.text);
   const unpaid = db.orders.filter((o) => o.status === "awaiting_payment");
   if (/remind|yaad|nudge|bhej/i.test(body.text)) {
      unpaid.forEach((o) => remind(o));
      return [addMessage(id, "agent", unpaid.length
         ? `Done. Reminder sent to ${unpaid.length} buyers.`
         : "Nothing pending, so no reminders sent.")];
   }
   const lines = unpaid.map((o) =>
      `${o.customerName} (${o.buyerCountry}) ${fmt(o)}`).join("; ");
   return [addMessage(id, "agent", unpaid.length
      ? `${unpaid.length} invoices pending: ${lines}. ` +
        "Reminder bhej doon?"
      : "Sab payment aa gaya. Koi pending nahi.")];
}

/** Sends a reminder into the buyer's chat; bumps the counter. */
function remind(order) {
   touch(order, { reminders: order.reminders + 1 });
   if (!db.conversations[order.conversationId]) return undefined;
   return addMessage(order.conversationId, "agent",
      `Hi ${order.customerName}, a gentle reminder: your invoice ` +
      `for ${fmt(order)} is still open. Pay link:`,
      [{ type: "pay_link", orderId: order.id, url: order.approveUrl,
         total: order.total, currency: order.currency }]);
}

/** Marks an order paid and posts confirmation + invoice. */
function markPaid(order) {
   if (order.status === "paid") return order;
   touch(order, { status: "paid", paidAt: new Date().toISOString(),
      invoiceId: `INV-${order.id}`, payerEmail: "buyer@example.com",
      captureId: `CAP-${order.id}`,
      invoiceUrl: `http://localhost:${PORT}/mock/invoice/${order.id}` });
   if (db.conversations[order.conversationId]) {
      addMessage(order.conversationId, "agent",
         "Payment received, thank you! Your invoice is below.",
         [{ type: "payment_confirmed", orderId: order.id,
            total: order.total, currency: order.currency },
          { type: "invoice", orderId: order.id,
            url: order.invoiceUrl }]);
   }
   return order;
}

/** Builds the evidence pack from the order and its chat. */
function evidence(order) {
   const messages = db.conversations[order.conversationId]
      ?.messages ?? [];
   const timeline = [{ at: order.createdAt, event: "Quote created",
      detail: `${fmt(order)} to ${order.buyerCountry}, ` +
         `${order.deliveryDays} days` }];
   if (order.status !== "draft") {
      timeline.push({ at: order.createdAt, event: "PayPal link sent",
         detail: `Order ${order.paypalOrderId}` });
   }
   for (let i = 0; i < order.reminders; i += 1) {
      timeline.push({ at: minutesAgo(10), event: "Reminder sent",
         detail: `Nudge ${i + 1} to ${order.customerName}` });
   }
   if (order.paidAt) {
      timeline.push({ at: order.paidAt, event: "Payment captured",
         detail: `${fmt(order)} via PayPal` });
   }
   const payment = order.paidAt ? { provider: "paypal",
      orderId: order.paypalOrderId, captureId: order.captureId,
      payerEmail: order.payerEmail, amount: order.total,
      currency: order.currency, paidAt: order.paidAt } : undefined;
   return { order, messages, timeline, payment };
}

/** Reads and parses a JSON request body (empty body is fine). */
function readBody(req) {
   return new Promise((resolve) => {
      let raw = "";
      req.on("data", (c) => { raw += c; });
      req.on("end", () => {
         try { resolve(raw ? JSON.parse(raw) : {}); }
         catch { resolve({}); }
      });
   });
}

/** Tiny HTML page standing in for the PayPal approve screen. */
function payPage(id) {
   return `<!doctype html><meta charset=utf-8><title>Mock pay</title>
<body style="font:20px sans-serif;padding:40px;max-width:480px">
<h1>Mock PayPal sandbox</h1><p>Order ${id}</p>
<button style="font-size:20px;padding:12px 24px"
 onclick="fetch('/api/orders/${id}/simulate-payment',
 {method:'POST'}).then(()=>document.body.append(' Paid. Close me.'))">
Approve payment</button></body>`;
}

/** Rupee and per-currency totals for /api/stats. */
function stats() {
   const paid = db.orders.filter((o) => o.status === "paid");
   const unpaid = db.orders.filter((o) => o.status === "awaiting_payment");
   const by = {};
   const add = (o, key) => {
      by[o.currency] ??= { currency: o.currency, paid: 0, unpaid: 0 };
      by[o.currency][key] = round2(by[o.currency][key] + o.total);
   };
   paid.forEach((o) => add(o, "paid"));
   unpaid.forEach((o) => add(o, "unpaid"));
   const inr = (list) => list.reduce((s, o) => s + o.totalInr, 0);
   return { collectedInr: inr(paid), paidCount: paid.length,
      unpaidCount: unpaid.length, unpaidInr: inr(unpaid),
      byCurrency: Object.values(by) };
}

const server = http.createServer(async (req, res) => {
   res.setHeader("Access-Control-Allow-Origin", WEB_ORIGIN);
   res.setHeader("Access-Control-Allow-Headers", "Content-Type");
   res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
   if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
   const url = new URL(req.url, `http://localhost:${PORT}`);
   const path = url.pathname;
   const json = (data, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
   };
   const orderId = path.match(/^\/api\/orders\/([^/]+)/)?.[1];
   const order = db.orders.find((o) => o.id === orderId);
   try {
      if (path === "/api/health") {
         return json({ llm: "mock", paypal: "mock" });
      }
      if (path === "/api/catalog") return json(CATALOG);
      if (path === "/api/events") {
         res.writeHead(200, { "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache", Connection: "keep-alive" });
         res.write(": hi\n\n");
         clients.add(res);
         req.on("close", () => clients.delete(res));
         return;
      }
      if (path === "/api/conversations") {
         return json(Object.values(db.conversations).map((c) => {
            const last = c.messages.at(-1);
            return { id: c.id, kind: c.kind, customerName: c.customerName,
               channel: c.channel, country: c.country,
               lastText: last?.text ?? "", updatedAt:
               last?.createdAt ?? new Date().toISOString() };
         }));
      }
      const conv = path.match(/^\/api\/conversations\/([^/]+)$/);
      if (conv) {
         const c = db.conversations[conv[1]];
         return c ? json(c) : json({ error: "not found" }, 404);
      }
      if (path === "/api/chat" && req.method === "POST") {
         const body = await readBody(req);
         const messages = body.from === "owner"
            ? ownerTurn(body) : customerTurn(body);
         return json({ messages });
      }
      if (path === "/api/orders") return json(db.orders);
      if (path === "/api/stats") return json(stats());
      if (orderId && !order && path.startsWith("/api/orders/")) {
         return json({ error: "not found" }, 404);
      }
      if (order && /\/evidence$/.test(path)) return json(evidence(order));
      if (order && /\/remind$/.test(path)) {
         const message = remind(order);
         return json({ order, message });
      }
      if (order && /\/simulate-payment$/.test(path)) {
         return json(markPaid(order));
      }
      if (order && /\/refresh$/.test(path)) return json(order);
      if (order) return json(order);
      if (path === "/api/demo/reset") {
         seed();
         emit("order.updated", db.orders[0]);
         return json({ ok: true });
      }
      if (path === "/api/webhooks/paypal") return json({ ok: true });
      const pay = path.match(/^\/mock\/pay\/([^/]+)$/);
      if (pay) {
         res.writeHead(200, { "Content-Type": "text/html" });
         return res.end(payPage(pay[1]));
      }
      if (path.startsWith("/mock/invoice/")) {
         res.writeHead(200, { "Content-Type": "text/html" });
         return res.end("<h1>Mock invoice</h1>");
      }
      json({ error: "not found" }, 404);
   } catch (err) {
      console.error(err);
      json({ error: "server error" }, 500);
   }
});

server.listen(PORT, () => console.log(`mock core on :${PORT}`));
