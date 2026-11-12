/**
 * Picks the right card for one attachment. Unknown types render
 * nothing, so a newer core can never crash an older UI.
 */
import type { Attachment } from "@/lib/types";
import type { AttachmentContext } from "./attachmentContext";
import { InvoiceCard } from "./InvoiceCard";
import { PaidCard } from "./PaidCard";
import { PayLinkCard } from "./PayLinkCard";
import { QuoteCard } from "./QuoteCard";

/** Switches on the attachment's `type`. */
export function AttachmentCard(
   { item, ctx }: { item: Attachment; ctx: AttachmentContext },
) {
   switch (item.type) {
      case "quote":
         return <QuoteCard quote={item} />;
      case "pay_link":
         return <PayLinkCard link={item} ctx={ctx} />;
      case "invoice":
         return <InvoiceCard invoice={item} />;
      case "payment_confirmed":
         return <PaidCard paid={item} />;
      default:
         return null;
   }
}
