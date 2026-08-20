"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { BranchIntelligenceMetrics } from "@/lib/actions/hq";

interface Props {
  branches: BranchIntelligenceMetrics["branchLocations"];
}

export default function BranchMap({ branches }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersLayerRef = useRef<unknown>(null);
  const leafletLoadedRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const validBranches = useMemo(
    () => branches.filter((b) => b.lat != null && b.lng != null),
    [branches]
  );

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current).setView([-6.7924, 39.2083], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);

        mapInstanceRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);
        leafletLoadedRef.current = true;
      } catch {
        if (!cancelled) setMapError("Failed to load map. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        leafletLoadedRef.current = false;
      }
    };
  }, []);

  // Sync markers when branches change
  useEffect(() => {
    if (!leafletLoadedRef.current || !mapInstanceRef.current || !markersLayerRef.current) return;
    if (validBranches.length === 0) {
      setMapError("No branches have coordinates to display on the map.");
      return;
    }

    (async () => {
      const L = (await import("leaflet")).default;
      const layer = markersLayerRef.current as ReturnType<typeof L.layerGroup>;
      if (!layer) return;

      layer.clearLayers();

      const maxRevenue = Math.max(...validBranches.map((b) => b.revenue), 1);

      for (const branch of validBranches) {
        const radius = Math.max(4, Math.min(20, (branch.revenue / maxRevenue) * 20));
        const color = branch.revenue > maxRevenue * 0.5 ? "#146C2E" : branch.revenue > maxRevenue * 0.2 ? "#0061A4" : "#B3261E";

        const marker = L.circleMarker([branch.lat!, branch.lng!], {
          radius,
          fillColor: color,
          color: "#fff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.75,
        }).addTo(layer);

        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:160px">
            <strong style="font-size:14px">${branch.branchName}</strong><br/>
            <span style="color:#666;font-size:12px">${branch.accountName}</span><br/>
            <hr style="margin:6px 0"/>
            <span style="font-size:13px"><strong>Revenue:</strong> TZS ${branch.revenue.toLocaleString()}</span><br/>
            <span style="font-size:12px;color:${color}">&#9679; ${radius < 8 ? "Low" : radius < 15 ? "Medium" : "Top"} performer</span>
          </div>
        `);
      }

      if (validBranches.length > 1) {
        const group = L.featureGroup(
          validBranches.map((b) =>
            L.circleMarker([b.lat!, b.lng!], { radius: 0.1, interactive: false })
          )
        );
        (mapInstanceRef.current as { fitBounds: (b: unknown, o?: unknown) => void }).fitBounds(group.getBounds().pad(0.1));
      }
    })();
  }, [validBranches]);

  if (branches.length === 0) {
    return (
      <div className="bg-surface-base border border-outline-variant p-6 text-center">
        <p className="font-body-md text-on-surface-variant">No branches with coordinates available.</p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="bg-surface-base border border-outline-variant p-6 text-center">
        <p className="font-body-md text-on-surface-variant">{mapError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 flex-wrap">
        {[
          { color: "#146C2E", label: "Top performer (>50% max)" },
          { color: "#0061A4", label: "Mid performer (20-50%)" },
          { color: "#B3261E", label: "Low performer (<20%)" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: item.color }} />
            <span className="font-body-sm text-on-surface-variant text-xs">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <span className="font-body-sm text-on-surface-variant text-xs">Circle size = revenue</span>
        </div>
      </div>
      <div ref={mapRef} className="w-full h-[500px] max-h-[600px] rounded-lg overflow-hidden border border-outline-variant" style={{ zIndex: 0 }} />
    </div>
  );
}