// -----------------------------------------------------------------------
// ids.ts
// Purpose: short, URL-safe, prefixed ids (ord_..., msg_..., c_...).
// -----------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { ID_RANDOM_CHARS } from "./constants.ts";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// -----------------------------------------------------------------------
// newId
// Purpose: `${prefix}_` + random lowercase alphanumerics.
// -----------------------------------------------------------------------
export function newId(prefix: string): string {
   const bytes = randomBytes(ID_RANDOM_CHARS);
   let out = "";
   for (const byte of bytes) {
      out += ALPHABET[byte % ALPHABET.length];
   }
   return `${prefix}_${out}`;
}

// -----------------------------------------------------------------------
// nowIso
// Purpose: the current time as an ISO string (one place to stub it).
// -----------------------------------------------------------------------
export function nowIso(): string {
   return new Date().toISOString();
}
