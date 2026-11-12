// -----------------------------------------------------------------------
// http-utils.ts
// Purpose: small helpers on top of node:http: CORS, JSON/HTML replies,
//          and a size-capped JSON body reader that never throws past
//          the request handler.
// -----------------------------------------------------------------------

import type { IncomingMessage, ServerResponse } from "node:http";
import { MAX_BODY_BYTES } from "../constants.ts";
import { HTTP_BAD_REQUEST, ServiceError } from "../errors.ts";

export const HTTP_OK = 200;
export const HTTP_NO_CONTENT = 204;
export const HTTP_PAYLOAD_TOO_LARGE = 413;
export const HTTP_SERVER_ERROR = 500;

// -----------------------------------------------------------------------
// applyCors
// Purpose: allow the web app's origin(s). Reflecting only known origins
//          (instead of "*") keeps other sites from driving the API.
// -----------------------------------------------------------------------
export function applyCors(
   req: IncomingMessage,
   res: ServerResponse,
   allowed: string[],
): void {
   const origin = req.headers.origin;
   if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
   }
   res.setHeader("Vary", "Origin");
   res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
   res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// -----------------------------------------------------------------------
// sendJson
// Purpose: write a JSON reply (no-op if the socket is already closed).
// -----------------------------------------------------------------------
export function sendJson(
   res: ServerResponse,
   status: number,
   body: unknown,
): void {
   if (res.headersSent || res.writableEnded) {
      return;
   }
   res.statusCode = status;
   res.setHeader("Content-Type", "application/json; charset=utf-8");
   res.setHeader("Cache-Control", "no-store");
   res.end(JSON.stringify(body));
}

// -----------------------------------------------------------------------
// sendHtml
// Purpose: write an HTML page (mock checkout, PayPal return page).
// -----------------------------------------------------------------------
export function sendHtml(
   res: ServerResponse,
   status: number,
   html: string,
): void {
   if (res.headersSent || res.writableEnded) {
      return;
   }
   res.statusCode = status;
   res.setHeader("Content-Type", "text/html; charset=utf-8");
   res.setHeader("Cache-Control", "no-store");
   res.end(html);
}

// -----------------------------------------------------------------------
// readJsonBody
// Purpose: read and parse the request body. Empty body -> {}.
//          Too large -> 413, bad JSON -> 400 (as ServiceError).
// -----------------------------------------------------------------------
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
   const chunks: Buffer[] = [];
   let size = 0;
   for await (const chunk of req) {
      const buf = chunk as Buffer;
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
         throw new ServiceError(HTTP_PAYLOAD_TOO_LARGE, "body too large");
      }
      chunks.push(buf);
   }
   const text = Buffer.concat(chunks).toString("utf8").trim();
   if (!text) {
      return {};
   }
   try {
      return JSON.parse(text);
   } catch {
      throw new ServiceError(HTTP_BAD_REQUEST, "body is not valid JSON");
   }
}

// -----------------------------------------------------------------------
// escapeHtml
// Purpose: make user text (names, item names) safe inside HTML.
// -----------------------------------------------------------------------
export function escapeHtml(text: string): string {
   return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}
