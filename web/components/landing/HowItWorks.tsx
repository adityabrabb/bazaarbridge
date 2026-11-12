/**
 * Three tear-off slips: the buyer asks and gets a quote in their
 * currency, the PayPal invoice is paid, and the proof is kept while
 * the laggards are chased. Each slip carries a small picture.
 */
import { PaidStamp } from "@/components/common/PaidStamp";

/** Renders the three steps as export-desk slips. */
export function HowItWorks() {
   return (
      <section className="how" id="how" aria-labelledby="how-h">
         <h2 id="how-h" className="how__title">
            Three steps.<br />No spreadsheet, no awkward nudges.
         </h2>
         <ol className="how__slips">
            <li className="slip3 paper slip3--a">
               <span className="slip3__no">1</span>
               <h3>Quote in their currency</h3>
               <p>
                  The buyer asks. The agent prices from your rupee
                  catalogue, adds shipping and the delivery estimate,
                  and replies in pounds, euros, dollars or Australian
                  dollars. It offers your bulk discount, never below
                  your floor.
               </p>
               <div className="slip3__art bubble">
                  Total £59.70, 7-10 days
               </div>
            </li>
            <li className="slip3 paper slip3--b">
               <span className="slip3__no">2</span>
               <h3>PayPal invoice, paid</h3>
               <p>
                  On a yes, the pay link drops into the chat. When the
                  money lands, your dashboard flips to PAID and shows
                  the rupees you receive.
               </p>
               <div className="slip3__art slip3__pay">
                  Pay £59.70 with PayPal &rarr;
               </div>
            </li>
            <li className="slip3 paper slip3--c">
               <span className="slip3__no">3</span>
               <h3>Proof kept, laggards chased</h3>
               <p>
                  Every order gets an evidence pack: chat, quote,
                  invoice and PayPal record, ready for a dispute. Ask
                  who has not paid, in Hinglish if you like, and the
                  reminders go out.
               </p>
               <div className="slip3__art">
                  <PaidStamp caption="evidence kept" />
               </div>
            </li>
         </ol>
      </section>
   );
}
