/**
 * Closing band: the ask, in the maker's voice, plus the footer
 * line. Wears the airmail border so the page ends like a parcel.
 */
import Link from "next/link";

/** Renders the red call-to-action band and footer. */
export function FinalCta() {
   return (
      <footer className="final">
         <h2 className="final__title">
            Ship the craft.<br />Skip the chasing.
         </h2>
         <div className="final__side">
            <p>
               Watch a buyer in London go from a first message to a
               PAID stamp, and see the evidence pack behind it.
            </p>
            <Link href="/demo" className="btn btn--ink btn--big">
               Try the demo
            </Link>
         </div>
         <p className="final__fine">
            BazaarBridge · built for the PayPal AI Hackathon · demo
            runs in sandbox with a fictional seller (Rangrez Studio,
            Jaipur); no real money moves.
         </p>
         <div className="final__airmail" aria-hidden="true" />
      </footer>
   );
}
