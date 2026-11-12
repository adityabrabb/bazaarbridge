/**
 * A little postage stamp with perforated edges: the country code
 * big, a value line under it. Used as the buyer's avatar, in table
 * rows and on the landing art, so "export" reads at a glance.
 */

type Props = {
   code?: string;
   value?: string;
   tone?: "red" | "indigo" | "gold";
   size?: "sm" | "md" | "lg";
};

/** Renders the stamp; decorative, so hidden from screen readers. */
export function PostageStamp(
   { code = "??", value, tone = "red", size = "md" }: Props,
) {
   return (
      <span className={`postage postage--${tone} postage--${size}`}
         aria-hidden="true">
         <span className="postage__code">{code.toUpperCase()}</span>
         {value ? <span className="postage__value">{value}</span> : null}
      </span>
   );
}
