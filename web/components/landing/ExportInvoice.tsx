/**
 * The hero artefact: an export invoice for the demo's own order
 * (Emma, London, in pounds, with the rupee value printed under it),
 * a buyer message stuck on its corner, postage stamps and the PAID
 * rubber stamp slammed across it. Numbers match the mock storyline.
 */
import { PaidStamp } from "@/components/common/PaidStamp";
import { PostageStamp } from "@/components/common/PostageStamp";
import { SELLER_CITY, SELLER_NAME } from "@/lib/constants";

const LINES: [string, string, string][] = [
   ["4x", "Block-print cushion cover", "£34.00"],
   ["1x", "Brass diya set", "£14.00"],
   ["", "Bulk discount (10%)", "-£4.80"],
   ["", "Shipping to UK", "£16.50"],
];

/** Renders the invoice; decorative, but all text is real. */
export function ExportInvoice() {
   return (
      <div className="exinv">
         <div className="exinv__bubble">
            Do you ship to the UK? How much for 2 block-print cushion
            covers and the brass diya set?
         </div>
         <div className="exinv__stamps" aria-hidden="true">
            <PostageStamp code="GB" value="£" tone="red" size="lg" />
            <PostageStamp code="IN" value="₹" tone="indigo" size="lg" />
         </div>
         <div className="exinv__paper paper">
            <div className="exinv__airmail" aria-hidden="true" />
            <div className="exinv__head">
               <strong>{SELLER_NAME.toUpperCase()}</strong>
               <span>EXPORT INVOICE · No. 0111</span>
            </div>
            <div className="exinv__route">
               <span>{SELLER_CITY}, India</span>
               <i aria-hidden="true">&rarr;</i>
               <span>Emma, London</span>
            </div>
            <ul>
               {LINES.map(([qty, name, price]) => (
                  <li key={name}>
                     <span>{qty}</span>
                     <span>{name}</span>
                     <i aria-hidden="true" />
                     <span>{price}</span>
                  </li>
               ))}
            </ul>
            <div className="exinv__total">
               <span>TOTAL GBP</span>
               <strong>£59.70</strong>
            </div>
            <div className="exinv__inr">= ₹6,284 lands in Jaipur</div>
            <div className="exinv__stamp">
               <PaidStamp slam size="xl" caption="via PayPal" />
            </div>
         </div>
      </div>
   );
}
