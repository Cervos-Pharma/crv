"use client";

import { useEffect, useRef, useState } from "react";
import type { NetworkHealthMetrics } from "@/lib/actions/hq";

interface BranchPoint {
  lat: number | null;
  lng: number | null;
  name: string;
  accountName: string;
  status: "healthy" | "at_risk" | "locked";
}

interface Props {
  networkHealth: NetworkHealthMetrics;
  branchLocations?: BranchPoint[];
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "#146C2E",
  at_risk: "#B3261E",
  locked: "#7D5260",
};

interface GlobeInstance {
  container(el: HTMLElement): GlobeInstance;
  globeImageUrl(url: string): GlobeInstance;
  bumpImageUrl(url: string): GlobeInstance;
  backgroundImageUrl(url: string): GlobeInstance;
  pointsData(data: BranchPoint[]): GlobeInstance;
  pointLat(lat: string): GlobeInstance;
  pointLng(lng: string): GlobeInstance;
  pointColor(fn: (p: BranchPoint) => string): GlobeInstance;
  pointAltitude(n: number): GlobeInstance;
  pointRadius(n: number): GlobeInstance;
  pointLabel(fn: (p: BranchPoint) => string): GlobeInstance;
  onGlobeReady(fn: () => void): GlobeInstance;
  onError(fn: (err: string) => void): GlobeInstance;
  autoRotate(n: number): GlobeInstance;
  destroy(): void;
}

declare global {
  interface Window {
    Globe: (opts?: Record<string, unknown>) => GlobeInstance;
    THREE: unknown;
  }
}

export default function NetworkGlobe({ networkHealth, branchLocations = [] }: Props) {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<unknown>(null);
  const leafletMapRef = useRef<unknown>(null);
  const [view, setView] = useState<"globe" | "map">("globe");
  const [globeError, setGlobeError] = useState<string | null>(null);

  const validPoints = branchLocations.filter((b) => b.lat != null && b.lng != null);

  // ── 2D Leaflet map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "map") return;

    let isMounted = true;
    let map: ReturnType<typeof import("leaflet")["map"]> | null = null;

    (async () => {
      const L = (await import("leaflet")).default;

      if (!isMounted || !mapContainerRef.current) return;

      map = L.map(mapContainerRef.current).setView([-6.7924, 39.2083], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      if (validPoints.length === 0) return;

      for (const point of validPoints) {
        if (point.lat == null || point.lng == null) continue;
        const color = STATUS_COLORS[point.status] ?? "#6750A4";
        L.circleMarker([point.lat, point.lng], {
          radius: 6,
          fillColor: color,
          color: "#fff",
          weight: 1.5,
          fillOpacity: 0.8,
        }).bindPopup(`
          <div style="font-family:sans-serif;min-width:140px">
            <strong>${point.name}</strong><br/>
            <span style="color:#666;font-size:12px">${point.accountName}</span><br/>
            <span style="color:${color};font-size:11px;font-weight:600">${point.status.toUpperCase().replace("_", " ")}</span>
          </div>
        `).addTo(map);
      }

      if (validPoints.length > 1) {
        const group = L.featureGroup(
          validPoints
            .filter((p) => p.lat != null && p.lng != null)
            .map((p) => L.circleMarker([p.lat!, p.lng!], { radius: 0.1, interactive: false }))
        );
        map.fitBounds(group.getBounds().pad(0.1));
      }

      if (isMounted) leafletMapRef.current = map;
    })();

    return () => {
      isMounted = false;
      if (map) {
        map.remove();
        map = null;
        leafletMapRef.current = null;
      }
    };
  }, [view, validPoints.length, branchLocations]);

  // ── 3D Globe via CDN script ─────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "globe") return;

    let isMounted = true;
    let cleanup: (() => void) | undefined;

    const init = () => {
      if (!isMounted || !globeContainerRef.current) return;
      if (validPoints.length === 0) {
        setGlobeError("No branch locations available for 3D view.");
        return;
      }

      const container = globeContainerRef.current;

      // Load globe.gl from CDN (avoids Three.js bundling issues in Vercel Edge)
      const loadGlobe = () => {
        if (!window.Globe) {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/globe.gl@2.27.2/dist/globe.gl.js";
          script.onload = () => {
            if (!isMounted) return;
            mountGlobe(window.Globe);
          };
          script.onerror = () => {
            if (isMounted) setGlobeError("Failed to load globe.gl. Please switch to 2D map.");
          };
          document.head.appendChild(script);
        } else {
          mountGlobe(window.Globe);
        }
      };

      const mountGlobe = (GlobeFn: (opts?: Record<string, unknown>) => GlobeInstance) => {
        if (!isMounted || !container) return;

        let instance: GlobeInstance;
        try {
          instance = GlobeFn({});
        } catch (_) {
          if (isMounted) setGlobeError("Failed to initialize 3D globe. Please use 2D map.");
          return;
        }

        instance
          .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
          .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
          .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
          .pointsData(validPoints)
          .pointLat("lat")
          .pointLng("lng")
          .pointColor((p: BranchPoint) => STATUS_COLORS[p.status] ?? "#6750A4")
          .pointAltitude(0.01)
          .pointRadius(0.4)
          .pointLabel((p: BranchPoint) =>
            `<div style="font-family:sans-serif;color:#222;padding:8px;min-width:140px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
              <strong>${p.name}</strong><br/>
              <span style="color:#666;font-size:12px">${p.accountName}</span><br/>
              <span style="color:${STATUS_COLORS[p.status]};font-size:11px;font-weight:600">${p.status.toUpperCase().replace("_", " ")}</span>
            </div>`
          )
          .onGlobeReady(() => {
            if (isMounted) {
              instance.autoRotate(0.3);
              globeInstanceRef.current = instance;
            }
          })
          .onError((err: string) => {
            console.warn("Globe error:", err);
          });
      };

      // Check for WebGL
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) {
          if (isMounted) setGlobeError("WebGL not available on this device. Please use the 2D map view.");
          return;
        }
      } catch (_) {
        if (isMounted) setGlobeError("WebGL check failed. Please use the 2D map view.");
        return;
      }

      loadGlobe();
    };

    init();

    return () => {
      isMounted = false;
      cleanup?.();
      if (globeInstanceRef.current) {
        try {
          (globeInstanceRef.current as { destroy: () => void }).destroy();
        } catch (_) { /* ignore */ }
        globeInstanceRef.current = null;
      }
    };
  }, [view, validPoints]);

  const totalPlotted = validPoints.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
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
          {(Object.entries(STATUS_COLORS)).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-body-sm text-on-surface-variant text-xs capitalize">{status.replace("_", " ")}</span>
            </div>
          ))}
          <span className="font-body-sm text-on-surface-variant text-xs ml-2">
            {totalPlotted} location{totalPlotted !== 1 ? "s" : ""} plotted
          </span>
        </div>
      </div>

      {view === "globe" ? (
        globeError ? (
          <div className="w-full h-[420px] flex items-center justify-center border border-outline-variant rounded-lg bg-surface-base">
            <div className="text-center p-6">
              <p className="font-body-md text-on-surface-variant mb-3">{globeError}</p>
              <button
                onClick={() => { setGlobeError(null); setView("map"); }}
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90"
              >
                Switch to 2D Map
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={globeContainerRef}
            className="w-full aspect-square max-h-[500px] rounded-lg overflow-hidden border border-outline-variant"
            style={{ background: "#0a0a1a" }}
          />
        )
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap text-xs text-on-surface-variant">
            {[
              { color: STATUS_COLORS.healthy, label: "Healthy" },
              { color: STATUS_COLORS.at_risk, label: "At Risk" },
              { color: STATUS_COLORS.locked, label: "Locked" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div ref={mapContainerRef} className="w-full aspect-square max-h-[500px] rounded-lg overflow-hidden border border-outline-variant" style={{ zIndex: 0 }} />
        </div>
      )}
    </div>
  );
}
