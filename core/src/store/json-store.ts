// -----------------------------------------------------------------------
// json-store.ts
// Purpose: keep the whole Database in memory and persist it to one JSON
//          file in /data. Writes go to a temp file first and are queued,
//          so a crash mid-write never leaves a half-written db.json.
// -----------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { DB_FILE_NAME } from "../constants.ts";
import type { Database } from "../types.ts";
import { buildSeedDatabase } from "./seed-data.ts";

export class JsonStore {
   readonly file: string;
   db: Database;
   // Chain of pending writes; each save waits for the previous one.
   private writing: Promise<void> = Promise.resolve();

   // --------------------------------------------------------------------
   // constructor
   // Purpose: open (or create and seed) the store in `dataDir`.
   //          Side effect: may create the folder and write db.json.
   // --------------------------------------------------------------------
   constructor(dataDir: string) {
      this.file = path.join(dataDir, DB_FILE_NAME);
      mkdirSync(dataDir, { recursive: true });
      this.db = this.readOrSeed();
   }

   // --------------------------------------------------------------------
   // readOrSeed
   // Purpose: load db.json; if missing or corrupt, start from the seed.
   //          A corrupt file is kept as db.json.corrupt for debugging.
   // --------------------------------------------------------------------
   private readOrSeed(): Database {
      if (!existsSync(this.file)) {
         const seeded = buildSeedDatabase();
         this.save(seeded);
         return seeded;
      }
      try {
         const parsed = JSON.parse(readFileSync(this.file, "utf8"));
         if (isDatabase(parsed)) {
            return parsed;
         }
         throw new Error("db.json has the wrong shape");
      } catch (err) {
         console.warn("[store] reseeding:", (err as Error).message);
         void copyFile(this.file, `${this.file}.corrupt`).catch(() => {});
         const seeded = buildSeedDatabase();
         this.save(seeded);
         return seeded;
      }
   }

   // --------------------------------------------------------------------
   // save
   // Purpose: queue a write of the current (or given) database.
   //          Returns a promise that settles when this write is done.
   //          Never rejects: a failed write is logged, the server lives.
   // --------------------------------------------------------------------
   save(db: Database = this.db): Promise<void> {
      const snapshot = JSON.stringify(db, null, 1);
      this.writing = this.writing.then(() => this.writeNow(snapshot));
      return this.writing;
   }

   // --------------------------------------------------------------------
   // writeNow
   // Purpose: temp-file + rename. On Windows a rename can fail with EPERM
   //          while another program has the file open (antivirus, an
   //          editor); fall back to a direct write in that case.
   // --------------------------------------------------------------------
   private async writeNow(snapshot: string): Promise<void> {
      const tmp = `${this.file}.tmp`;
      try {
         await writeFile(tmp, snapshot, "utf8");
         await rename(tmp, this.file);
      } catch {
         try {
            await writeFile(this.file, snapshot, "utf8");
         } catch (err) {
            console.error("[store] write failed:", (err as Error).message);
         }
      }
   }

   // --------------------------------------------------------------------
   // reset
   // Purpose: throw away all state and reseed (POST /api/demo/reset).
   // --------------------------------------------------------------------
   async reset(): Promise<void> {
      this.db = buildSeedDatabase();
      await this.save();
   }

   // --------------------------------------------------------------------
   // flush
   // Purpose: wait for all queued writes (used by tests and shutdown).
   // --------------------------------------------------------------------
   flush(): Promise<void> {
      return this.writing;
   }
}

// -----------------------------------------------------------------------
// isDatabase
// Purpose: cheap shape check so a hand-edited db.json cannot crash us.
// -----------------------------------------------------------------------
function isDatabase(value: unknown): value is Database {
   if (typeof value !== "object" || value === null) {
      return false;
   }
   const v = value as Record<string, unknown>;
   return (
      Array.isArray(v.catalog) &&
      Array.isArray(v.orders) &&
      Array.isArray(v.conversations) &&
      // A v1 file (no events, rupee-less catalog) must be reseeded.
      Array.isArray(v.events) &&
      typeof (v.catalog[0] as { priceInr?: unknown } | undefined)
         ?.priceInr === "number"
   );
}
