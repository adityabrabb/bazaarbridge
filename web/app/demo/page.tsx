/**
 * /demo route. All behaviour lives in DemoStudio (a client
 * component); this file only mounts it and sets the page title.
 */
import type { Metadata } from "next";
import { DemoStudio } from "@/components/DemoStudio";

export const metadata: Metadata = { title: "BazaarBridge live demo" };

/** Renders the split-screen demo. */
export default function DemoPage() {
   return <DemoStudio />;
}
