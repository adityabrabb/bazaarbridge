/**
 * The evidence pack drawn as a document a seller could hand over
 * in a payment dispute: numbered sections for the quote, PayPal
 * payment record, invoice, timeline and the full chat transcript.
 * Airmail border outside, plain ruled paper inside.
 */
import { PaidStamp } from "@/components/common/PaidStamp";
import { SELLER_CITY, SELLER_NAME } from "@/lib/constants";
import {
   billNo, countryName, inr, money, stamp,
} from "@/lib/format";
import type { Attachment, EvidencePack } from "@/lib/types";

/** One-line text for a card inside the transcript. */
function describe(a: Attachment): string {
   switch (a.type) {
      case "quote":
         return `[Quote card: ${money(a.total, a.currency)} incl. ` +
            `shipping, delivery ${a.deliveryDays} days]`;
      case "pay_link":
         return `[PayPal pay link: ${money(a.total, a.currency)}]`;
      case "invoice":
         return "[Invoice link]";
      case "payment_confirmed":
         return `[Payment confirmed: ${money(a.total, a.currency)}]`;
      default:
         return "[Attachment]";
   }
}

/** Who said it, in plain words for a printed record. */
const ROLE_LABEL = {
   customer: "Buyer", agent: "Agent", owner: "Seller",
} as const;

/** Renders the whole pack. */
export function EvidenceDocument({ pack }: { pack: EvidencePack }) {
   const { order, payment } = pack;
   const cur = order.currency;
   return (
      <article className="dossier">
         <header className="dossier__head">
            <p className="dossier__kicker">
               {SELLER_NAME.toUpperCase()} · {SELLER_CITY.toUpperCase()}
            </p>
            <h2 className="dossier__title">Order Evidence Pack</h2>
            <p className="dossier__meta">
               {billNo(order.id)} · {order.customerName} ·{" "}
               {countryName(order.buyerCountry)}
            </p>
            {order.status === "paid" ? (
               <div className="dossier__stamp">
                  <PaidStamp size="md" caption={cur} />
               </div>
            ) : (
               <span className="dossier__open">UNPAID</span>
            )}
         </header>

         <section className="dossier__sec">
            <h3><b>1</b> Quote agreed</h3>
            <table className="dossier__table">
               <tbody>
                  {order.items.map((i) => (
                     <tr key={i.sku}>
                        <td>{i.qty} x {i.name}</td>
                        <td>{money(i.qty * i.unitPrice, cur)}</td>
                     </tr>
                  ))}
                  {order.discount > 0 ? (
                     <tr><td>Bulk discount</td>
                        <td>-{money(order.discount, cur)}</td></tr>
                  ) : null}
                  <tr><td>Shipping ({order.deliveryDays} days)</td>
                     <td>{money(order.shipping, cur)}</td></tr>
                  <tr className="dossier__sum">
                     <td>Total in {cur}</td>
                     <td>{money(order.total, cur)}</td></tr>
                  <tr><td>Rupee value at quote time</td>
                     <td>{inr(order.totalInr)}</td></tr>
               </tbody>
            </table>
         </section>

         <section className="dossier__sec">
            <h3><b>2</b> PayPal payment record</h3>
            {payment ? (
               <dl className="dossier__dl">
                  <dt>Provider</dt><dd>PayPal</dd>
                  <dt>Order ID</dt><dd>{payment.orderId}</dd>
                  <dt>Capture ID</dt><dd>{payment.captureId ?? "n/a"}</dd>
                  <dt>Payer</dt><dd>{payment.payerEmail ?? "n/a"}</dd>
                  <dt>Amount</dt>
                  <dd>{money(payment.amount, payment.currency)}</dd>
                  <dt>Paid at</dt><dd>{stamp(payment.paidAt)}</dd>
               </dl>
            ) : (
               <p className="dossier__none">
                  No payment captured yet. PayPal order{" "}
                  {order.paypalOrderId ?? "not created"}.
               </p>
            )}
         </section>

         <section className="dossier__sec">
            <h3><b>3</b> Invoice</h3>
            {order.invoiceUrl ? (
               <p>
                  <a href={order.invoiceUrl} target="_blank"
                     rel="noopener noreferrer">
                     {order.invoiceId ?? "Open invoice"} &rarr;
                  </a>
               </p>
            ) : (
               <p className="dossier__none">Not issued yet.</p>
            )}
         </section>

         <section className="dossier__sec">
            <h3><b>4</b> Timeline</h3>
            <ol className="dossier__time">
               {pack.timeline.map((t, i) => (
                  <li key={`${t.at}-${i}`}>
                     <time>{stamp(t.at)}</time>
                     <strong>{t.event}</strong>
                     <span>{t.detail}</span>
                  </li>
               ))}
            </ol>
         </section>

         <section className="dossier__sec">
            <h3><b>5</b> Chat transcript</h3>
            <ul className="dossier__chat">
               {pack.messages.map((m) => (
                  <li key={m.id}>
                     <span className="dossier__who">
                        {ROLE_LABEL[m.role]} · {stamp(m.createdAt)}
                     </span>
                     {m.text ? <p>{m.text}</p> : null}
                     {m.attachments?.map((a, i) => (
                        <p key={i} className="dossier__card">
                           {describe(a)}
                        </p>
                     ))}
                  </li>
               ))}
            </ul>
         </section>
      </article>
   );
}
