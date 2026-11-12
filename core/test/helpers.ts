// -----------------------------------------------------------------------
// helpers.ts
// Purpose: shared test plumbing: boot the app on a random port with a
//          throwaway data folder, small HTTP helpers, a fetch stub that
//          records requests, and an SSE reader.
// -----------------------------------------------------------------------

import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp, type App, type AppOverrides } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";

export type TestApp = {
   app: App;
   base: string;
   close: () => Promise<void>;
};

// -----------------------------------------------------------------------
// startApp
// Purpose: mock-mode app on port 0 with its own temp data dir.
// -----------------------------------------------------------------------
export async function startApp(
   overrides: AppOverrides = {},
   env: Record<string, string> = {},
): Promise<TestApp> {
   const dataDir = mkdtempSync(path.join(tmpdir(), "bazaarbridge-test-"));
   const config = loadConfig({ DATA_DIR: dataDir, ...env });
   const app = createApp(config, overrides);
   await new Promise<void>((resolve) => app.server.listen(0, resolve));
   const port = (app.server.address() as AddressInfo).port;
   const base = `http://127.0.0.1:${port}`;
   // Pay links must point at this test server, not the default port.
   app.config.publicBaseUrl = base;
   return {
      app,
      base,
      close: async () => {
         app.server.closeAllConnections();
         await new Promise<void>((resolve) =>
            app.server.close(() => resolve()),
         );
         await app.store.flush();
         rmSync(dataDir, { recursive: true, force: true });
      },
   };
}

// -----------------------------------------------------------------------
// api
// Purpose: JSON request helper -> { status, body }.
// -----------------------------------------------------------------------
export async function api(
   base: string,
   method: string,
   urlPath: string,
   body?: unknown,
): Promise<{ status: number; body: any }> {
   const init: RequestInit = { method, headers: {} };
   if (body !== undefined) {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
      init.headers = { "Content-Type": "application/json" };
   }
   const res = await fetch(`${base}${urlPath}`, init);
   const text = await res.text();
   let parsed: unknown = text;
   try {
      parsed = JSON.parse(text);
   } catch {
      // HTML pages stay as text.
   }
   return { status: res.status, body: parsed };
}

export type Recorded = {
   url: string;
   method: string;
   headers: Record<string, string>;
   body: string;
};

// -----------------------------------------------------------------------
// stubFetch
// Purpose: a fetch replacement that records every request and answers
//          from `respond`. Lets tests check exact request construction.
// -----------------------------------------------------------------------
export function stubFetch(
   respond: (
      req: Recorded,
      index: number,
   ) => {
      status?: number;
      json: unknown;
   },
): { fetch: typeof fetch; calls: Recorded[] } {
   const calls: Recorded[] = [];
   const fn = async (input: unknown, init?: RequestInit) => {
      const req = input instanceof Request ? input : null;
      const url = req ? req.url : String(input);
      const headers: Record<string, string> = {};
      new Headers(init?.headers ?? req?.headers).forEach((v, k) => {
         headers[k.toLowerCase()] = v;
      });
      let body = "";
      if (typeof init?.body === "string") {
         body = init.body;
      } else if (init?.body) {
         body = await new Response(init.body).text();
      } else if (req) {
         body = await req.text();
      }
      const recorded = {
         url,
         method: init?.method ?? req?.method ?? "GET",
         headers,
         body,
      };
      calls.push(recorded);
      const out = respond(recorded, calls.length - 1);
      return new Response(JSON.stringify(out.json), {
         status: out.status ?? 200,
         headers: { "Content-Type": "application/json" },
      });
   };
   return { fetch: fn as typeof fetch, calls };
}

// -----------------------------------------------------------------------
// collectEvents
// Purpose: open /api/events and gather "event:" names until stopped.
// -----------------------------------------------------------------------
export async function collectEvents(base: string): Promise<{
   names: string[];
   stop: () => void;
}> {
   const names: string[] = [];
   const ctrl = new AbortController();
   const res = await fetch(`${base}/api/events`, { signal: ctrl.signal });
   const reader = res.body!.getReader();
   const decoder = new TextDecoder();
   void (async () => {
      try {
         for (;;) {
            const { value, done } = await reader.read();
            if (done) {
               break;
            }
            for (const line of decoder.decode(value).split("\n")) {
               if (line.startsWith("event: ")) {
                  names.push(line.slice("event: ".length));
               }
            }
         }
      } catch {
         // Aborted by stop().
      }
   })();
   return { names, stop: () => ctrl.abort() };
}

// -----------------------------------------------------------------------
// waitFor
// Purpose: poll a condition (for async SSE delivery) up to ~1 s.
// -----------------------------------------------------------------------
export async function waitFor(check: () => boolean): Promise<boolean> {
   const TRIES = 50;
   const STEP_MS = 20;
   for (let i = 0; i < TRIES; i += 1) {
      if (check()) {
         return true;
      }
      await new Promise((r) => setTimeout(r, STEP_MS));
   }
   return check();
}
