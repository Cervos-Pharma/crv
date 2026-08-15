"use client";

import { useEffect, useRef, useState } from "react";
import type { NetworkHealthMetrics } from "@/lib/actions/hq";

interface BranchPoint {
  lat: number;
  lng: number;
  name: string;
  accountName: string;
  status: "healthy" | "at_risk" | "locked";
}

interface Props {
  networkHealth: NetworkHealthMetrics;
  branchLocations?: BranchPoint[];
}

const STATUS_COLORS = {
  healthy: "#146C2E",
  at_risk: "#B3261E",
  locked: "#7D5260",
};

export default function NetworkGlobe({ networkHealth, branchLocations = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<unknown>(null);
  const [view, setView] = useState<"globe" | "map">("globe");
  const [globeError, setGlobeError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let cleanup: (() => void) | undefined;

    const init = async () => {
      if (view === "map") return;

      try {
        // @ts-ignore globe.gl ships its own types but TS may not find them
        const Globe = (await import("globe.gl")).default;
        const points = branchLocations.filter((b) => b.lat && b.lng);

        if (points.length === 0) {
          if (isMounted) setGlobeError("No branch locations available for 3D view.");
          return;
        }

        if (!isMounted || !containerRef.current) return;

        const globeInstance = Globe()
          .container(containerRef.current)
          .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
          .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
          .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
          .pointsData(points)
          .pointLat("lat")
          .pointLng("lng")
          .pointColor((p: BranchPoint) => STATUS_COLORS[p.status] ?? "#6750A4")
          .pointAltitude(0.01)
          .pointRadius(0.4)
          .pointLabel((p: BranchPoint) =>
            `<div style="font-family:sans-serif;color:#222;padding:8px;min-width:140px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
              <strong>${p.name}</strong><br/>
              <span style="color:#666;font-size:12px">${p.accountName}</span><br/>
              <span style="color:${STATUS_COLORS[p.status]};font-size:11px;font-weight:600">${p.status.toUpperCase()}</span>
            </div>`
          )
          .onGlobeReady(() => {
            if (isMounted && containerRef.current) {
              (globeInstance as { autoRotate: (n: number) => typeof globeInstance }).autoRotate(0.3);
            }
          });

        if (isMounted) {
          globeRef.current = globeInstance;
        }
      } catch {
        if (isMounted) setGlobeError("WebGL not available. Switch to 2D map view.");
      }
    };

    if (view === "globe") {
      init();
    }

    return () => {
      isMounted = false;
      cleanup?.();
      if (globeRef.current) {
        try { (globeRef.current as { destroy: () => void }).destroy(); } catch { /* ignore */ }
        globeRef.current = null;
      }
    };
  }, [view, branchLocations]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex rounded-lg border border-outline-variant overflow-hidden">
          <button
            onClick={() => setView("globe")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              view === "globe" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            3D Globe
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              view === "map" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            2D Map
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {(Object.entries(STATUS_COLORS) as [keyof typeof STATUS_COLORS, string][]).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-body-sm text-on-surface-variant text-xs capitalize">{status.replace("_", " ")}</span>
            </div>
          ))}
          <span className="font-body-sm text-on-surface-variant text-xs ml-2">
            {branchLocations.length} locations plotted
          </span>
        </div>
      </div>

      {view === "globe" ? (
        globeError ? (
          <div className="w-full h-[420px] flex items-center justify-center border border-outline-variant rounded-lg bg-surface-base">
            <div className="text-center p-6">
              <p className="font-body-md text-on-surface-variant mb-3">{globeError}</p>
              <button
                onClick={() => setView("map")}
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90"
              >
                Switch to 2D Map
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="w-full h-[420px] rounded-lg overflow-hidden border border-outline-variant"
            style={{ background: "#0a0a1a" }}
          />
        )
      ) : (
        <div className="w-full h-[420px] flex items-center justify-center border border-outline-variant rounded-lg bg-surface-base">
          <p className="font-body-md text-on-surface-variant">
            2D view — use the Branch tab for detailed Leaflet map
          </p>
        </div>
      )}
    </div>
  );
}
