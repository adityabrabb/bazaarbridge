/**
 * Root layout: loads the two Google fonts through next/font, the
 * global stylesheets, and the shared SVG "rubber stamp" filter that
 * every PAID stamp uses for its rough, inked edge.
 */
import type { Metadata } from "next";
import { Hind, Rozha_One } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/common.css";
import "@/styles/chat.css";
import "@/styles/postage.css";
import "@/styles/quote.css";
import "@/styles/evidence.css";
import "@/styles/dashboard.css";
import "@/styles/demo.css";
import "@/styles/landing.css";

// Display face: heavy signboard serif with real Devanagari.
const display = Rozha_One({
   weight: "400",
   subsets: ["latin", "devanagari"],
   variable: "--font-rozha",
   display: "swap",
});

// Utility face: readable Latin + Devanagari for chat and tables.
const body = Hind({
   weight: ["400", "500", "600", "700"],
   subsets: ["latin", "devanagari"],
   variable: "--font-hind",
   display: "swap",
});

export const metadata: Metadata = {
   title: "BazaarBridge | Export sales desk for craft sellers",
   description:
      "A chat agent for small Indian craft sellers: quotes buyers " +
      "abroad in their own currency, sends the PayPal invoice, " +
      "keeps the evidence and chases unpaid orders.",
};

/** Wraps every page. */
export default function RootLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <html lang="en" className={`${display.variable} ${body.variable}`}>
         <body>
            <svg width="0" height="0" style={{ position: "absolute" }}
               aria-hidden="true" focusable="false">
               <filter id="rough-ink">
                  <feTurbulence type="fractalNoise" baseFrequency="0.04"
                     numOctaves="3" seed="4" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n"
                     scale="3.5" />
               </filter>
            </svg>
            {children}
         </body>
      </html>
   );
}
