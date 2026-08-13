/**
 * @file components/MapClientWrapper.tsx
 * @description Client-side wrapper for CervosMap that disables SSR.
 *
 * Leaflet requires browser globals (window, document) that are unavailable
 * during server-side rendering. `dynamic(..., { ssr: false })` ensures the map
 * is only instantiated in the browser, preventing hydration errors.
 *
 * Use MapClientWrapper everywhere CervosMap is needed — never import CervosMap directly.
 * Props are forwarded transparently to CervosMap.
 */
"use client";

import dynamic from "next/dynamic";

const CervosMap = dynamic(() => import("./CervosMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface-container-low animate-pulse flex items-center justify-center">
      <span className="text-on-surface-variant text-label-md font-label-md uppercase tracking-wider">
        Loading map…
      </span>
    </div>
  ),
});

export default CervosMap;
