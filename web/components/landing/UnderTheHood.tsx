/**
 * "Under the hood" as a printed customs manifest: what the agent
 * actually calls. Every line is a real part of the build (SPEC v2);
 * nothing here is invented proof.
 */

const PARTS: [string, string][] = [
   ["PayPal Orders v2", "multi-currency order and pay link"],
   ["PayPal Invoicing v2", "create and send the invoice"],
   ["Quote engine", "rupees to GBP, EUR, USD, AUD, in code"],
   ["Agent tools", "quote, discount, invoice, remind"],
   ["Evidence pack", "chat, quote, invoice, PayPal record"],
   ["Seller chat", "ask who has not paid, in Hinglish"],
];

/** Renders the parts list as a ruled slip on ink. */
export function UnderTheHood() {
   return (
      <section className="hood" aria-labelledby="hood-h">
         <h2 id="hood-h" className="hood__title">
            What the agent<br />actually calls
         </h2>
         <ul className="hood__list">
            {PARTS.map(([name, what]) => (
               <li key={name}>
                  <strong>{name}</strong>
                  <i aria-hidden="true" />
                  <span>{what}</span>
               </li>
            ))}
         </ul>
      </section>
   );
}
