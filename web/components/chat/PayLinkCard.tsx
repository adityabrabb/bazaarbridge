/**
 * Pay-link attachment: a big PayPal button that opens the approve
 * URL in a new tab. In PayPal mock mode only, a second control lets
 * the demo "pay" without leaving the page. If the order is already
 * paid the card turns into a calm "paid" line instead.
 */
import { useState } from "react";
import { money } from "@/lib/format";
import type { Attachment } from "@/lib/types";
import type { AttachmentContext } from "./attachmentContext";

type PayLink = Extract<Attachment, { type: "pay_link" }>;

/** Renders the pay button (and the mock-only simulate control). */
export function PayLinkCard(
   { link, ctx }: { link: PayLink; ctx: AttachmentContext },
) {
   const [busy, setBusy] = useState(false);
   const paid = ctx.paidOrderIds.has(link.orderId);

   /** Runs the simulated payment and shows a busy state. */
   const simulate = async () => {
      setBusy(true);
      await ctx.onSimulate(link.orderId);
      setBusy(false);
   };

   if (paid) {
      return (
         <div className="paycard paycard--done">
            Paid {money(link.total, link.currency)}. Link closed.
         </div>
      );
   }
   return (
      <div className="paycard">
         <div className="paycard__label">PAY INVOICE</div>
         <a className="paycard__btn" href={link.url} target="_blank"
            rel="noopener noreferrer">
            Pay {money(link.total, link.currency)} with PayPal
            <span aria-hidden="true"> &rarr;</span>
         </a>
         {ctx.mockPayPal ? (
            <button className="paycard__sim" onClick={simulate}
               disabled={busy}>
               {busy ? "Paying..." : "Simulate payment (mock mode)"}
            </button>
         ) : null}
      </div>
   );
}
