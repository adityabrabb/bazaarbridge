/**
 * "Who it is for": names the audience plainly (small Indian craft
 * sellers who get enquiries from buyers abroad) and the three ways
 * they lose those sales, next to the parcel artwork.
 */
import { ParcelArt } from "./ParcelArt";

const PAINS: [string, string][] = [
   ["Slow quotes",
      "A buyer in London writes at 11 pm. By the time you add up " +
      "price, shipping and customs, she has bought elsewhere."],
   ["Currency confusion",
      "Pounds, euros, dollars, rupees. A wrong guess eats your " +
      "margin or scares the buyer off."],
   ["Unpaid invoices",
      "You sent it, they said yes, and then nothing. Chasing " +
      "feels awkward across time zones."],
];

const MAKERS = [
   "Block-print textiles", "Brass", "Handmade jewellery",
   "Leather", "Pottery", "Rugs", "Blue pottery",
];

/** Renders the audience section. */
export function WhoFor() {
   return (
      <section className="who" aria-labelledby="who-h">
         <div className="who__grid">
            <div className="who__art">
               <ParcelArt />
            </div>
            <div className="who__copy">
               <p className="eyebrow eyebrow--gold">WHO IT IS FOR</p>
               <h2 id="who-h" className="who__title">
                  One workshop.<br />One phone.<br />
                  <span>Buyers in six time zones.</span>
               </h2>
               <p>
                  You make it in Jaipur, Moradabad or Jodhpur. Enquiries
                  from abroad land in your messages all day, and every
                  one of them is a sale you can lose.
               </p>
               <ul className="who__pains">
                  {PAINS.map(([title, text]) => (
                     <li key={title}>
                        <strong>{title}</strong>
                        <span>{text}</span>
                     </li>
                  ))}
               </ul>
               <ul className="who__chips">
                  {MAKERS.map((s) => <li key={s}>{s}</li>)}
               </ul>
            </div>
         </div>
      </section>
   );
}
