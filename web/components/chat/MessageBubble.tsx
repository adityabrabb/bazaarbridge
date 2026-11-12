/**
 * One chat bubble plus its attachment cards. `viewer` decides which
 * side is "mine": in the customer phone the customer is on the
 * right; in the owner chat the owner is.
 */
import { clock } from "@/lib/format";
import type { Message } from "@/lib/types";
import { AttachmentCard } from "./AttachmentCard";
import type { AttachmentContext } from "./attachmentContext";

type Props = {
   message: Message;
   viewer: "customer" | "owner";
   ctx: AttachmentContext;
};

/** Renders text, then cards, then the time under the bubble. */
export function MessageBubble({ message, viewer, ctx }: Props) {
   const mine = message.role === viewer;
   return (
      <div className={`msg ${mine ? "msg--mine" : "msg--theirs"}`}>
         {message.text ? (
            <div className="msg__bubble">{message.text}</div>
         ) : null}
         {message.attachments?.map((a, i) => (
            <AttachmentCard key={`${message.id}-${i}`} item={a} ctx={ctx} />
         ))}
         <div className="msg__time">{clock(message.createdAt)}</div>
      </div>
   );
}
