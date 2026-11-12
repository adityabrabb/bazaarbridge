// -----------------------------------------------------------------------
// router.ts
// Purpose: a tiny method + path router. Paths use ":name" segments,
//          e.g. "/api/orders/:id/refresh". Any error thrown by a handler
//          becomes a JSON error reply; the server never crashes on one
//          bad request.
// -----------------------------------------------------------------------

import type { IncomingMessage, ServerResponse } from "node:http";
import { ServiceError } from "../errors.ts";
import { HTTP_SERVER_ERROR, sendJson } from "./http-utils.ts";

export type RouteContext = {
   req: IncomingMessage;
   res: ServerResponse;
   params: Record<string, string>;
   query: URLSearchParams;
};

export type Handler = (ctx: RouteContext) => Promise<void> | void;

type Route = {
   method: string;
   pattern: RegExp;
   keys: string[];
   handler: Handler;
};

export class Router {
   private routes: Route[] = [];

   // --------------------------------------------------------------------
   // add
   // Purpose: register a route; ":name" segments become params.
   // --------------------------------------------------------------------
   add(method: string, path: string, handler: Handler): void {
      const keys: string[] = [];
      const source = path
         .split("/")
         .map((part) => {
            if (part.startsWith(":")) {
               keys.push(part.slice(1));
               return "([^/]+)";
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
         })
         .join("/");
      this.routes.push({
         method,
         pattern: new RegExp(`^${source}/?$`),
         keys,
         handler,
      });
   }

   // --------------------------------------------------------------------
   // handle
   // Purpose: dispatch a request. Returns false when no route matched.
   // --------------------------------------------------------------------
   async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
      const url = new URL(req.url ?? "/", "http://localhost");
      for (const route of this.routes) {
         if (route.method !== req.method) {
            continue;
         }
         const match = route.pattern.exec(url.pathname);
         if (!match) {
            continue;
         }
         const params: Record<string, string> = {};
         route.keys.forEach((key, i) => {
            params[key] = safeDecode(match[i + 1] ?? "");
         });
         try {
            await route.handler({ req, res, params, query: url.searchParams });
         } catch (err) {
            replyWithError(res, err);
         }
         return true;
      }
      return false;
   }
}

// -----------------------------------------------------------------------
// safeDecode
// Purpose: decodeURIComponent that tolerates malformed escapes.
// -----------------------------------------------------------------------
function safeDecode(value: string): string {
   try {
      return decodeURIComponent(value);
   } catch {
      return value;
   }
}

// -----------------------------------------------------------------------
// replyWithError
// Purpose: ServiceError -> its status; anything else -> 500, logged.
// -----------------------------------------------------------------------
export function replyWithError(res: ServerResponse, err: unknown): void {
   if (err instanceof ServiceError) {
      sendJson(res, err.status, { error: err.message });
      return;
   }
   console.error("[http] unhandled:", err);
   sendJson(res, HTTP_SERVER_ERROR, { error: "internal error" });
}
