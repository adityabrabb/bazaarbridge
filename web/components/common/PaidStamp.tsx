/**
 * The rubber stamp. Double ring, slanted, rough-inked through the
 * SVG filter from the root layout. `slam` plays the thud animation
 * (huge -> normal, with a shake), which is the money shot on video.
 */

type Props = {
   /** Small line under PAID, e.g. a date or amount. */
   caption?: string;
   slam?: boolean;
   size?: "md" | "xl";
};

/** Renders the stamp; purely decorative, so hidden from readers. */
export function PaidStamp({ caption, slam = false, size = "md" }: Props) {
   const cls = ["stamp", `stamp--${size}`, slam ? "stamp--slam" : ""]
      .join(" ");
   return (
      <span className={cls} aria-hidden="true">
         <span className="stamp__ring">
            <span className="stamp__word">PAID</span>
            {caption ? (
               <span className="stamp__caption">{caption}</span>
            ) : null}
         </span>
      </span>
   );
}
