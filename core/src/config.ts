// -----------------------------------------------------------------------
// config.ts
// Purpose: read settings from the repo-root .env (if any) and the process
//          environment, and decide which LLM and PayPal modes to run in.
//          Missing keys always fall back to mock mode with a clear log
//          line, so judges can run the project with no accounts at all.
// -----------------------------------------------------------------------

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
   DEFAULT_ANTHROPIC_MODEL,
   DEFAULT_GEMINI_MODEL,
   DEFAULT_PORT,
   DEFAULT_WEB_ORIGIN,
   DATA_DIR_NAME,
   PAYPAL_SANDBOX_BASE,
} from "./constants.ts";
import type { LlmMode, PaypalMode } from "./types.ts";

// ----- Paths -------------------------------------------------------------
// core/src/config.ts -> repo root is two folders up.
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..", "..");

export type Config = {
   port: number;
   webOrigin: string;
   webDemoUrl: string;
   publicBaseUrl: string;
   dataDir: string;
   llm: {
      mode: LlmMode;
      apiKey: string;
      model: string;
   };
   paypal: {
      mode: PaypalMode;
      clientId: string;
      clientSecret: string;
      baseUrl: string;
      webhookId: string;
   };
   notes: string[];
};

type Env = Record<string, string | undefined>;

// -----------------------------------------------------------------------
// loadDotEnv
// Purpose: load REPO_ROOT/.env into process.env if the file exists.
//          Side effect: mutates process.env (existing vars win, which is
//          Node's own loadEnvFile behaviour).
// -----------------------------------------------------------------------
export function loadDotEnv(): boolean {
   const file = path.join(REPO_ROOT, ".env");
   if (!existsSync(file)) {
      return false;
   }
   try {
      process.loadEnvFile(file);
      return true;
   } catch (err) {
      // A malformed .env must not stop the server; mock mode still works.
      console.warn("[config] could not parse .env:", (err as Error).message);
      return false;
   }
}

// -----------------------------------------------------------------------
// clean
// Purpose: trim an env value and treat blank strings as missing.
// -----------------------------------------------------------------------
function clean(value: string | undefined): string {
   return (value ?? "").trim();
}

// -----------------------------------------------------------------------
// resolveLlm
// Purpose: pick the LLM provider. A provider without a key degrades to
//          mock instead of failing at the first chat message.
// -----------------------------------------------------------------------
function resolveLlm(env: Env, notes: string[]): Config["llm"] {
   const wanted = clean(env.LLM_PROVIDER).toLowerCase();
   const model = clean(env.LLM_MODEL);
   if (wanted === "anthropic") {
      const key = clean(env.LLM_API_KEY) || clean(env.ANTHROPIC_API_KEY);
      if (key) {
         return {
            mode: "anthropic",
            apiKey: key,
            model: model || DEFAULT_ANTHROPIC_MODEL,
         };
      }
      notes.push("LLM_PROVIDER=anthropic but no key; using mock LLM");
   } else if (wanted === "gemini") {
      const key = clean(env.LLM_API_KEY) || clean(env.GEMINI_API_KEY);
      if (key) {
         return {
            mode: "gemini",
            apiKey: key,
            model: model || DEFAULT_GEMINI_MODEL,
         };
      }
      notes.push("LLM_PROVIDER=gemini but no key; using mock LLM");
   } else if (wanted && wanted !== "mock") {
      notes.push(`unknown LLM_PROVIDER "${wanted}"; using mock LLM`);
   } else if (!wanted) {
      notes.push("LLM_PROVIDER not set; using mock LLM");
   }
   return { mode: "mock", apiKey: "", model: "rule-based" };
}

// -----------------------------------------------------------------------
// resolvePaypal
// Purpose: pick sandbox only when both credentials are present.
// -----------------------------------------------------------------------
function resolvePaypal(env: Env, notes: string[]): Config["paypal"] {
   const wanted = clean(env.PAYPAL_ENV).toLowerCase();
   const clientId = clean(env.PAYPAL_CLIENT_ID);
   const clientSecret = clean(env.PAYPAL_CLIENT_SECRET);
   const baseUrl = clean(env.PAYPAL_BASE_URL) || PAYPAL_SANDBOX_BASE;
   const webhookId = clean(env.PAYPAL_WEBHOOK_ID);
   if (wanted === "sandbox") {
      if (clientId && clientSecret) {
         return {
            mode: "sandbox",
            clientId,
            clientSecret,
            baseUrl,
            webhookId,
         };
      }
      notes.push("PAYPAL_ENV=sandbox but keys missing; using mock PayPal");
   } else if (wanted === "live" || wanted === "production") {
      // Real money is out of scope for a hackathon demo.
      notes.push("live PayPal is not supported; using mock PayPal");
   } else if (!wanted) {
      notes.push("PAYPAL_ENV not set; using mock PayPal");
   }
   return {
      mode: "mock",
      clientId: "",
      clientSecret: "",
      baseUrl,
      webhookId: "",
   };
}

// -----------------------------------------------------------------------
// parsePort
// Purpose: read PORT, falling back to the contract port on bad input.
// -----------------------------------------------------------------------
function parsePort(raw: string): number {
   const port = Number.parseInt(raw, 10);
   const MAX_PORT = 65_535;
   if (Number.isInteger(port) && port > 0 && port <= MAX_PORT) {
      return port;
   }
   return DEFAULT_PORT;
}

// -----------------------------------------------------------------------
// loadConfig
// Purpose: build the full Config from an env map. Pure: no I/O, so tests
//          can pass their own env.
// -----------------------------------------------------------------------
export function loadConfig(env: Env = process.env): Config {
   const notes: string[] = [];
   const port = parsePort(clean(env.PORT));
   const webOrigin = clean(env.WEB_ORIGIN) || DEFAULT_WEB_ORIGIN;
   const publicBaseUrl =
      clean(env.PUBLIC_BASE_URL) || `http://localhost:${port}`;
   const dataDir = clean(env.DATA_DIR) || path.join(REPO_ROOT, DATA_DIR_NAME);
   return {
      port,
      webOrigin,
      webDemoUrl: clean(env.WEB_DEMO_URL) || `${webOrigin}/demo`,
      publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
      dataDir,
      llm: resolveLlm(env, notes),
      paypal: resolvePaypal(env, notes),
      notes,
   };
}
