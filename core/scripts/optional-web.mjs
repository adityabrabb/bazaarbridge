// -----------------------------------------------------------------------
// optional-web.mjs
// Purpose: run `npm <args>` inside /web only if /web exists, so the root
//          `npm run setup` and `npm run dev` still work (core only) when
//          the web app is missing. Usage: node core/scripts/optional-web.mjs
//          install | run dev
// -----------------------------------------------------------------------

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(HERE, "..", "..", "web");
const args = process.argv.slice(2);

if (!existsSync(path.join(WEB_DIR, "package.json"))) {
   console.log(
      "[web] web/package.json not found; skipping web " +
         `"${args.join(" ")}". Core still works on its own.`,
   );
   process.exit(0);
}

// A shell is needed so Windows finds npm.cmd; pass one quoted command
// string (Node deprecates separate args together with shell: true).
// The args come from our own package.json scripts, not from users.
const quoted = [`"${WEB_DIR}"`, ...args.map((a) => `"${a}"`)];
const command = `npm --prefix ${quoted.join(" ")}`;
const child = spawn(command, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
   console.error("[web] could not start npm:", err.message);
   process.exit(1);
});
