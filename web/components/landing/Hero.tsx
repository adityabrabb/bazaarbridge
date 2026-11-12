/**
 * Landing hero: parcel-label nav, a two-line headline aimed at
 * craft sellers with buyers abroad, the one plain sentence that
 * says what BazaarBridge does, the demo button, and the export
 * invoice with its PAID stamp.
 */
import Link from "next/link";
import { Logo } from "@/components/common/Logo";
import { ExportInvoice } from "./ExportInvoice";

/** First screen of the landing page. */
export function Hero() {
   return (
      <header className="hero">
         <div className="hero__airmail" aria-hidden="true" />
         <nav className="hero__nav">
            <Logo />
            <Link href="/demo" className="btn btn--ink btn--small">
               Try the demo
            </Link>
         </nav>
         <div className="hero__grid">
            <div className="hero__copy">
               <p className="eyebrow">
                  FOR CRAFT MAKERS WHO SELL ABROAD
               </p>
               <h1 className="hero__title">
                  <span className="hero__line">Quoted in pounds.</span>
                  <span className="hero__line">
                     <span className="hero__red">Paid in</span> rupees.
                  </span>
               </h1>
               <p className="hero__lede">
                  Buyers abroad message you for a price and vanish when
                  the quote is slow. BazaarBridge answers in their
                  currency with shipping included, sends the PayPal
                  invoice, stamps it PAID, keeps the proof and chases
                  the ones who forget.
               </p>
               <div className="hero__cta">
                  <Link href="/demo" className="btn btn--red btn--big">
                     Try the demo
                  </Link>
                  <a href="#how" className="btn btn--big">
                     See how it works
                  </a>
               </div>
            </div>
            <div className="hero__art">
               <ExportInvoice />
            </div>
         </div>
      </header>
   );
}
