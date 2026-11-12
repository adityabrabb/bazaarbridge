// -----------------------------------------------------------------------
// api/index.ts
// Purpose: Vercel function entry. Builds the same app the local server
//          uses, once per warm instance, and hands each request to its
//          HTTP handler. Data lives in /tmp because the rest of the
//          function's disk is read-only.
// -----------------------------------------------------------------------

import type { IncomingMessage, ServerResponse } from "node:http";

import { createApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";

const VERCEL_DATA_DIR = "/tmp/bazaarbridge-data";

const app = createApp(
   loadConfig({ ...process.env, DATA_DIR: process.env.DATA_DIR || VERCEL_DATA_DIR }),
);

// -----------------------------------------------------------------------
// handler
// Purpose: forward one request to the app's server, exactly as a local
//          listen() would, so routing and SSE behave the same.
// -----------------------------------------------------------------------
export default function handler(req: IncomingMessage, res: ServerResponse): void {
   app.server.emit("request", req, res);
}
