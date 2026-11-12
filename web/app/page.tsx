/**
 * Landing page `/`. Order follows the argument: what it is (hero),
 * who it is for, how it works, what is under the hood, the ask.
 */
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { UnderTheHood } from "@/components/landing/UnderTheHood";
import { WhoFor } from "@/components/landing/WhoFor";

/** Stacks the landing sections. */
export default function Home() {
   return (
      <main className="landing">
         <Hero />
         <WhoFor />
         <HowItWorks />
         <UnderTheHood />
         <FinalCta />
      </main>
   );
}
