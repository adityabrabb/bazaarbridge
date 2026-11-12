/**
 * Next.js config. Kept empty on purpose: the app talks to the core
 * API straight from the browser, so no rewrites or proxies are needed.
 */
import type { NextConfig } from "next";

const config: NextConfig = {
   // Hide the Next.js dev indicator so it never shows up on video.
   devIndicators: false,
   // The repo root has its own lockfile; pin Turbopack to /web.
   turbopack: { root: process.cwd() },
};

export default config;
