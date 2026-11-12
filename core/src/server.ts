// -----------------------------------------------------------------------
// server.ts
// Purpose: process entry point. Loads .env, prints which modes are live
//          (and why mock was chosen), starts listening, and shuts down
//          cleanly on Ctrl+C so db.json writes finish.
// -----------------------------------------------------------------------

import { createApp } from "./app.ts";
import { loadConfig, loadDotEnv } from "./config.ts";

// -----------------------------------------------------------------------
// main
// Purpose: boot the API server.
// -----------------------------------------------------------------------
function main(): void {
   const hadEnv = loadDotEnv();
   const config = loadConfig();
   if (!hadEnv) {
      console.log("[config] no .env at repo root; running in mock mode");
   }
   for (const note of config.notes) {
      console.log(`[config] ${note}`);
   }
   const app = createApp(config);
   app.server.on("error", (err) => {
      console.error(`[server] cannot listen on ${config.port}:`, err.message);
      process.exit(1);
   });
   app.server.listen(config.port, () => {
      const model = config.llm.mode === "mock" ? "" : ` (${config.llm.model})`;
      console.log(
         `[server] BazaarBridge core on http://localhost:${config.port}` +
            ` | llm=${config.llm.mode}${model}` +
            ` | paypal=${config.paypal.mode}`,
      );
   });
   const shutdown = () => {
      app.server.close();
      app.store.flush().finally(() => process.exit(0));
      // Open SSE streams keep close() waiting; do not hang forever.
      const FORCE_EXIT_MS = 1_500;
      setTimeout(() => process.exit(0), FORCE_EXIT_MS).unref();
   };
   process.on("SIGINT", shutdown);
   process.on("SIGTERM", shutdown);
   process.on("unhandledRejection", (err) => {
      console.error("[server] unhandled rejection:", err);
   });
}

main();
