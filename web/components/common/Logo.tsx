/**
 * BazaarBridge wordmark: Rozha lettering with a Devanagari line
 * under it, like the second line on a parcel label.
 */
import Link from "next/link";

/** Renders the wordmark as a link to the landing page. */
export function Logo({ onDark = false }: { onDark?: boolean }) {
   return (
      <Link href="/" className={`logo ${onDark ? "logo--dark" : ""}`}
         aria-label="BazaarBridge home">
         <span className="logo__latin">BAZAARBRIDGE</span>
         <span className="logo__hindi">जयपुर से दुनिया तक</span>
      </Link>
   );
}
