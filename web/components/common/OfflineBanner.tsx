/**
 * Visible "API offline" state. Shown instead of crashing when the
 * core is not reachable, with the one command that fixes it.
 */
import { API_URL } from "@/lib/constants";

/** Renders a hazard-striped banner with the URL we tried. */
export function OfflineBanner() {
   return (
      <div className="offline" role="alert">
         <strong>API offline.</strong>{" "}
         Cannot reach {API_URL}. Start the core
         (<code>npm run dev</code>) and this page reconnects by itself.
      </div>
   );
}
