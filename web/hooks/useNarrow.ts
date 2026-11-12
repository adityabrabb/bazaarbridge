"use client";
/**
 * True when the viewport is phone-width. The orders grid uses it to
 * swap to a compact column set, because AG Grid columns cannot be
 * reflowed by CSS alone.
 */
import { useEffect, useState } from "react";

/** Tracks a max-width media query; false during server render. */
export function useNarrow(maxWidthPx: number): boolean {
   const [narrow, setNarrow] = useState(false);

   useEffect(() => {
      const query = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
      const update = () => setNarrow(query.matches);
      update();
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
   }, [maxWidthPx]);

   return narrow;
}
