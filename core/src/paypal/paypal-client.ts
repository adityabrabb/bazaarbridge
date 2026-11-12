// -----------------------------------------------------------------------
// paypal-client.ts
// Purpose: low-level PayPal REST access: OAuth2 client-credentials token
//          (cached until shortly before expiry) and a JSON request helper
//          with a timeout and readable errors. Request shapes follow
//          developer.paypal.com/api/rest/authentication.
// -----------------------------------------------------------------------

import { PAYPAL_TIMEOUT_MS, PAYPAL_TOKEN_MARGIN_S } from "../constants.ts";

export type FetchFn = typeof fetch;

export type PaypalCredentials = {
   clientId: string;
   clientSecret: string;
   baseUrl: string;
   // Only needed to verify webhook signatures.
   webhookId?: string;
};

// -----------------------------------------------------------------------
// PaypalError
// Purpose: a failed PayPal call, with the HTTP status, PayPal's error
//          name / first issue code and debug_id (needed for support).
// -----------------------------------------------------------------------
export class PaypalError extends Error {
   status: number;
   issue: string;
   debugId: string;

   constructor(message: string, status: number, issue = "", debugId = "") {
      super(message);
      this.name = "PaypalError";
      this.status = status;
      this.issue = issue;
      this.debugId = debugId;
   }
}

type RequestOptions = {
   method: "GET" | "POST";
   path: string;
   body?: unknown;
   requestId?: string;
   prefer?: string;
};

export class PaypalClient {
   private creds: PaypalCredentials;
   private fetchFn: FetchFn;
   private token = "";
   private tokenExpiresAt = 0;

   // --------------------------------------------------------------------
   // constructor
   // Purpose: keep credentials and the fetch function (stubbed in tests).
   // --------------------------------------------------------------------
   constructor(creds: PaypalCredentials, fetchFn: FetchFn = fetch) {
      this.creds = creds;
      this.fetchFn = fetchFn;
   }

   // --------------------------------------------------------------------
   // getToken
   // Purpose: POST /v1/oauth2/token with HTTP Basic auth and
   //          grant_type=client_credentials; reuse it until near expiry.
   // --------------------------------------------------------------------
   async getToken(): Promise<string> {
      const now = Date.now();
      if (this.token && now < this.tokenExpiresAt) {
         return this.token;
      }
      const basic = Buffer.from(
         `${this.creds.clientId}:${this.creds.clientSecret}`,
      ).toString("base64");
      const res = await this.send(`${this.creds.baseUrl}/v1/oauth2/token`, {
         method: "POST",
         headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
         },
         body: "grant_type=client_credentials",
      });
      const json = (await readJson(res)) as {
         access_token?: string;
         expires_in?: number;
      };
      if (!res.ok || !json.access_token) {
         throw toPaypalError("OAuth token request failed", res.status, json);
      }
      const MS_PER_S = 1_000;
      const life = Math.max(0, (json.expires_in ?? 0) - PAYPAL_TOKEN_MARGIN_S);
      this.token = json.access_token;
      this.tokenExpiresAt = now + life * MS_PER_S;
      return this.token;
   }

   // --------------------------------------------------------------------
   // request
   // Purpose: authenticated JSON call. Throws PaypalError on non-2xx.
   //          A 401 clears the cached token so the next call re-auths.
   // --------------------------------------------------------------------
   async request<T>(opts: RequestOptions): Promise<T> {
      const token = await this.getToken();
      const headers: Record<string, string> = {
         Authorization: `Bearer ${token}`,
         "Content-Type": "application/json",
         Accept: "application/json",
      };
      if (opts.requestId) {
         // Idempotency key: a retried call returns the first result.
         headers["PayPal-Request-Id"] = opts.requestId;
      }
      if (opts.prefer) {
         headers.Prefer = opts.prefer;
      }
      const init: RequestInit = { method: opts.method, headers };
      if (opts.method === "POST") {
         init.body = JSON.stringify(opts.body ?? {});
      }
      const res = await this.send(`${this.creds.baseUrl}${opts.path}`, init);
      const json = await readJson(res);
      const UNAUTHORIZED = 401;
      if (res.status === UNAUTHORIZED) {
         this.token = "";
         this.tokenExpiresAt = 0;
      }
      if (!res.ok) {
         throw toPaypalError(`${opts.method} ${opts.path}`, res.status, json);
      }
      return json as T;
   }

   // --------------------------------------------------------------------
   // send
   // Purpose: fetch with a timeout; network failures become PaypalError
   //          (status 0) so callers handle one error type.
   // --------------------------------------------------------------------
   private async send(url: string, init: RequestInit): Promise<Response> {
      try {
         return await this.fetchFn(url, {
            ...init,
            signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
         });
      } catch (err) {
         throw new PaypalError(
            `network error calling PayPal: ${(err as Error).message}`,
            0,
         );
      }
   }
}

// -----------------------------------------------------------------------
// readJson
// Purpose: parse a response body as JSON; empty or non-JSON bodies
//          (204, HTML error pages) become {} instead of throwing.
// -----------------------------------------------------------------------
async function readJson(res: Response): Promise<unknown> {
   try {
      const text = await res.text();
      return text ? JSON.parse(text) : {};
   } catch {
      return {};
   }
}

// -----------------------------------------------------------------------
// toPaypalError
// Purpose: lift PayPal's error body (name, details[0].issue, debug_id)
//          into a PaypalError. Never includes credentials.
// -----------------------------------------------------------------------
function toPaypalError(
   what: string,
   status: number,
   body: unknown,
): PaypalError {
   const b = (body ?? {}) as {
      name?: string;
      message?: string;
      error?: string;
      error_description?: string;
      debug_id?: string;
      details?: Array<{ issue?: string; description?: string }>;
   };
   const issue = b.details?.[0]?.issue ?? b.name ?? b.error ?? "";
   const text =
      b.details?.[0]?.description ??
      b.message ??
      b.error_description ??
      "no details";
   return new PaypalError(
      `${what}: HTTP ${status} ${issue} ${text}`.trim(),
      status,
      issue,
      b.debug_id ?? "",
   );
}
