/**
 * Quote attachment, drawn as an export pro-forma slip: lines with
 * dotted leaders, a discount line only when one applies, shipping,
 * delivery estimate and the total in the buyer's own currency.
 */
import { countryName, money } from "@/lib/format";
import type { QuoteAttachment } from "@/lib/types";

/** Renders the quote the agent computed (never typed by the model). */
export function QuoteCard({ quote }: { quote: QuoteAttachment }) {
   const cur = quote.currency;
   return (
      <div className="quote">
         <div className="quote__head">
            <span>QUOTE</span>
            <span>TO {countryName(quote.destination).toUpperCase()}</span>
         </div>
         <ul className="quote__lines">
            {quote.items.map((item) => (
               <li key={item.sku}>
                  <span className="quote__qty">{item.qty}x</span>
                  <span className="quote__name">{item.name}</span>
                  <span className="quote__dots" aria-hidden="true" />
                  <span>{money(item.qty * item.unitPrice, cur)}</span>
               </li>
            ))}
            {quote.discount > 0 ? (
               <li className="quote__discount">
                  <span className="quote__name">Bulk discount</span>
                  <span className="quote__dots" aria-hidden="true" />
                  <span>-{money(quote.discount, cur)}</span>
               </li>
            ) : null}
            <li>
               <span className="quote__name">Shipping</span>
               <span className="quote__dots" aria-hidden="true" />
               <span>{money(quote.shipping, cur)}</span>
            </li>
         </ul>
         <div className="quote__eta">
            Delivery in {quote.deliveryDays} days
         </div>
         <div className="quote__total">
            <span>TOTAL {cur}</span>
            <strong>{money(quote.total, cur)}</strong>
         </div>
      </div>
   );
}
