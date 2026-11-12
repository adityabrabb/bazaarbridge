// -----------------------------------------------------------------------
// page-routes.ts
// Purpose: the few HTML pages /core serves itself (outside the JSON
//          contract): the mock checkout and mock invoice (mock mode), and
//          the PayPal return/cancel landing pages (sandbox mode), which
//          capture the payment the moment the buyer comes back.
// -----------------------------------------------------------------------

import type { App } from "../app.ts";
import type { Order } from "../types.ts";
import { formatMoney } from "../orders/money.ts";
import { escapeHtml, HTTP_OK, sendHtml } from "./http-utils.ts";
import type { Router } from "./router.ts";

const HTTP_NOT_FOUND_PAGE = 404;

// -----------------------------------------------------------------------
// page
// Purpose: shared page shell with inline styles (no assets to serve).
// -----------------------------------------------------------------------
function page(title: string, body: string): string {
   return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#fff7e0;
color:#1b1b1b;display:flex;justify-content:center;padding:24px 16px}
.card{max-width:420px;width:100%;background:#fff;border:3px solid #1b1b1b;
border-radius:14px;box-shadow:6px 6px 0 #1b1b1b;padding:20px}
.tag{display:inline-block;background:#ff4f7b;color:#fff;font-weight:800;
padding:4px 10px;border-radius:6px;font-size:13px;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin:14px 0}
td{padding:6px 0;border-bottom:1px dashed #bbb}td:last-child{text-align:right}
.total{font-size:22px;font-weight:800}
button{width:100%;padding:14px;font-size:17px;font-weight:800;border:3px
solid #1b1b1b;border-radius:10px;background:#ffd23f;cursor:pointer}
a{color:#0b57d0}
</style></head><body><div class="card">${body}</div></body></html>`;
}

// -----------------------------------------------------------------------
// itemsTable
// Purpose: order lines, shipping, discount and total as an HTML table,
//          in the order's own currency.
// -----------------------------------------------------------------------
function itemsTable(order: Order): string {
   const money = (n: number) => formatMoney(n, order.currency);
   const row = (label: string, value: string) =>
      `<tr><td>${label}</td><td>${value}</td></tr>`;
   const rows = order.items
      .map((i) =>
         row(`${i.qty} x ${escapeHtml(i.name)}`, money(i.qty * i.unitPrice)),
      )
      .join("");
   const extra =
      (order.discount > 0
         ? row("Bulk discount", `-${money(order.discount)}`)
         : "") + row("Shipping", money(order.shipping));
   return (
      `<table>${rows}${extra}</table>` +
      `<p class="total">Total ${money(order.total)} ${order.currency}</p>`
   );
}

// -----------------------------------------------------------------------
// notFound
// Purpose: friendly page for an unknown order id.
// -----------------------------------------------------------------------
function notFound(app: App, res: Parameters<typeof sendHtml>[0]): void {
   sendHtml(
      res,
      HTTP_NOT_FOUND_PAGE,
      page(
         "Order not found",
         `<h2>Order not found</h2>
<p><a href="${escapeHtml(app.config.webDemoUrl)}">Back to the demo</a></p>`,
      ),
   );
}

// -----------------------------------------------------------------------
// registerPageRoutes
// Purpose: attach the HTML routes.
// -----------------------------------------------------------------------
export function registerPageRoutes(router: Router, app: App): void {
   const back = escapeHtml(app.config.webDemoUrl);

   router.add("GET", "/mock/pay/:orderId", ({ res, params }) => {
      const order = app.orders.get(params.orderId ?? "");
      if (!order) {
         notFound(app, res);
         return;
      }
      const id = escapeHtml(order.id);
      const paid = order.status === "paid";
      sendHtml(
         res,
         HTTP_OK,
         page(
            "Mock checkout",
            `
<span class="tag">MOCK CHECKOUT - NO REAL MONEY</span>
<h2>Pay ${escapeHtml(order.customerName)}'s order</h2>
<p>Order <b>${id}</b></p>${itemsTable(order)}
<button id="pay" ${paid ? "disabled" : ""}>${
               paid
                  ? "Already paid"
                  : `Pay ${formatMoney(order.total, order.currency)} ` +
                    "(simulated)"
            }</button>
<p id="msg"></p><p><a href="${back}">Back to the demo</a></p>
<script>
document.getElementById("pay").onclick = async function () {
   this.disabled = true;
   const r = await fetch("/api/orders/${id}/simulate-payment",
      { method: "POST" });
   document.getElementById("msg").textContent = r.ok
      ? "Paid (simulated). You can close this tab."
      : "Could not simulate payment (" + r.status + ").";
};
</script>`,
         ),
      );
   });

   router.add("GET", "/mock/invoice/:orderId", ({ res, params }) => {
      const order = app.orders.get(params.orderId ?? "");
      if (!order) {
         notFound(app, res);
         return;
      }
      sendHtml(
         res,
         HTTP_OK,
         page(
            "Mock invoice",
            `
<span class="tag">MOCK INVOICE</span>
<h2>Invoice ${escapeHtml(order.invoiceId ?? order.id)}</h2>
<p>Billed to <b>${escapeHtml(order.customerName)}</b><br>
Status: <b>${escapeHtml(order.status.toUpperCase())}</b>
${order.paidAt ? `<br>Paid at ${escapeHtml(order.paidAt)}` : ""}</p>
${itemsTable(order)}`,
         ),
      );
   });

   // ----- Invoice issued by this app (used when PayPal Invoicing is
   //       not available). Shows the PayPal capture as proof of payment.
   router.add("GET", "/invoice/:orderId", ({ res, params }) => {
      const order = app.orders.get(params.orderId ?? "");
      if (!order) {
         notFound(app, res);
         return;
      }
      sendHtml(
         res,
         HTTP_OK,
         page(
            "Invoice",
            `
<span class="tag">INVOICE</span>
<h2>Invoice ${escapeHtml(order.invoiceId ?? order.id)}</h2>
<p>From <b>Rangrez Studio, Jaipur, India</b><br>
Billed to <b>${escapeHtml(order.customerName)}</b>
(${escapeHtml(order.buyerCountry)})<br>
Status: <b>${escapeHtml(order.status.toUpperCase())}</b>
${order.paidAt ? `<br>Paid at ${escapeHtml(order.paidAt)}` : ""}
${order.captureId
   ? `<br>PayPal capture: ${escapeHtml(order.captureId)}`
   : ""}</p>
${itemsTable(order)}`,
         ),
      );
   });

   router.add("GET", "/paypal/return", async ({ res, query }) => {
      const order = app.orders.get(query.get("orderId") ?? "");
      if (!order) {
         notFound(app, res);
         return;
      }
      // The buyer just approved on PayPal: capture now, not on next poll.
      const fresh = await app.orders.refresh(order.id);
      const ok = fresh.status === "paid";
      sendHtml(
         res,
         HTTP_OK,
         page(
            "Payment",
            `
<span class="tag">${ok ? "PAID" : "PROCESSING"}</span>
<h2>${ok ? "Payment received, thank you!" : "Payment is processing"}</h2>
${itemsTable(fresh)}
<p>${
               ok
                  ? "You can close this tab and go back to the chat."
                  : "The seller will confirm in the chat shortly."
            }</p>
<p><a href="${back}">Back to the demo</a></p>`,
         ),
      );
   });

   router.add("GET", "/paypal/cancel", ({ res }) => {
      sendHtml(
         res,
         HTTP_OK,
         page(
            "Payment cancelled",
            `
<span class="tag">CANCELLED</span>
<h2>No payment was taken</h2>
<p>You can pay any time from the link in the chat.</p>
<p><a href="${back}">Back to the demo</a></p>`,
         ),
      );
   });
}
