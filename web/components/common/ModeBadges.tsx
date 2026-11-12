/**
 * Two small badges showing which brain (LLM) and which PayPal mode
 * the core is running, straight from /api/health. Mock modes are
 * labelled plainly so judges never mistake them for the real thing.
 */
import type { Health } from "@/lib/types";

/** Renders LLM + PayPal badges, or a dim placeholder if unknown. */
export function ModeBadges({ health }: { health: Health | null }) {
   if (!health) {
      return <span className="badge badge--off">checking API</span>;
   }
   const llmMock = health.llm === "mock";
   const ppMock = health.paypal === "mock";
   return (
      <span className="badges">
         <span className={`badge ${llmMock ? "badge--mock" : ""}`}>
            AI: {llmMock ? "mock parser" : health.llm}
         </span>
         <span className={`badge ${ppMock ? "badge--mock" : "badge--live"}`}>
            PayPal: {ppMock ? "mock" : "sandbox"}
         </span>
      </span>
   );
}
