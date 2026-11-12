/**
 * Payment-confirmed attachment: the receipt paper with the PAID
 * stamp slammed across it. This is the card that must be
 * unmissable on video, so the stamp animates in.
 */
import { money } from "@/lib/format";
import { PaidStamp } from "@/components/common/PaidStamp";
import type { Attachment } from "@/lib/types";

type Paid = Extract<Attachment, { type: "payment_confirmed" }>;

/** Renders amount received with the stamp over it. */
export function PaidCard({ paid }: { paid: Paid }) {
   return (
      <div className="paidcard">
         <div className="paidcard__label">PAYMENT RECEIVED</div>
         <div className="paidcard__amount">{money(paid.total, paid.currency)}</div>
         <div className="paidcard__stamp">
            <PaidStamp slam caption="via PayPal" />
         </div>
      </div>
   );
}
