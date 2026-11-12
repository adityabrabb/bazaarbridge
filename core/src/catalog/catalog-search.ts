// -----------------------------------------------------------------------
// catalog-search.ts
// Purpose: match free text (English, Hindi in Latin script, Hinglish)
//          to catalog products through each product's alias list.
// -----------------------------------------------------------------------

import type { Product } from "../types.ts";

export type AliasHit = {
   product: Product;
   // Token index where the alias starts, and how many tokens it spans.
   start: number;
   length: number;
};

// -----------------------------------------------------------------------
// tokenize
// Purpose: lowercase words and numbers. "2kg" is split into "2", "kg"
//          so quantities glued to units still parse.
// -----------------------------------------------------------------------
export function tokenize(text: string): string[] {
   return text
      .toLowerCase()
      .replace(/(\d)([a-z])/g, "$1 $2")
      .replace(/[^a-z0-9.\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.replace(/^\.+|\.+$/g, ""))
      .filter((t) => t.length > 0);
}

// -----------------------------------------------------------------------
// findAliasHits
// Purpose: every place an alias occurs in the token list, longest alias
//          first so "chai patti" wins over "chai". Each token is used
//          by at most one hit.
// -----------------------------------------------------------------------
export function findAliasHits(
   tokens: string[],
   catalog: Product[],
): AliasHit[] {
   const candidates: Array<{ product: Product; words: string[] }> = [];
   for (const product of catalog) {
      for (const alias of product.aliases) {
         candidates.push({ product, words: tokenize(alias) });
      }
   }
   candidates.sort((a, b) => b.words.length - a.words.length);
   const used = new Array<boolean>(tokens.length).fill(false);
   const hits: AliasHit[] = [];
   for (const { product, words } of candidates) {
      if (words.length === 0) {
         continue;
      }
      for (let i = 0; i + words.length <= tokens.length; i += 1) {
         let match = true;
         for (let j = 0; j < words.length; j += 1) {
            if (used[i + j] || tokens[i + j] !== words[j]) {
               match = false;
               break;
            }
         }
         if (!match) {
            continue;
         }
         for (let j = 0; j < words.length; j += 1) {
            used[i + j] = true;
         }
         hits.push({ product, start: i, length: words.length });
      }
   }
   return hits.sort((a, b) => a.start - b.start);
}

// -----------------------------------------------------------------------
// searchCatalog
// Purpose: products mentioned in `query`; if none match by alias, fall
//          back to a substring match on names and SKUs.
// -----------------------------------------------------------------------
export function searchCatalog(query: string, catalog: Product[]): Product[] {
   const hits = findAliasHits(tokenize(query), catalog);
   const found: Product[] = [];
   for (const hit of hits) {
      if (!found.includes(hit.product)) {
         found.push(hit.product);
      }
   }
   if (found.length > 0) {
      return found;
   }
   const q = query.trim().toLowerCase();
   if (!q) {
      return [...catalog];
   }
   return catalog.filter(
      (p) =>
         p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
   );
}
