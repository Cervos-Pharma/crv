"use client";

import { useEffect, useRef, useState } from "react";
import type { BranchIntelligenceMetrics } from "@/lib/actions/hq";

interface Props {
  branches: BranchIntelligenceMetrics["branchLocations"];
}

export default function BranchMap({ branches }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (branches.length === 0) return;

    let isMounted = true;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        const map = L.map(mapRef.current!).setView([-6.7924, 39.2083], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);

        if (!isMounted) return;

        const validBranches = branches.filter((b) => b.lat != null && b.lng != null);
        if (validBranches.length === 0) {
          setMapError("No branches have coordinates to display on the map.");
          return;
        }

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
          }).addTo(map);

          marker.bindPopup(`
            <div style="font-family: sans-serif; min-width: 160px">
              <strong style="font-size: 14px">${branch.branchName}</strong><br/>
              <span style="color: #666; font-size: 12px">${branch.accountName}</span><br/>
              <hr style="margin: 6px 0"/>
              <span style="font-size: 13px"><strong>Revenue:</strong> TZS ${branch.revenue.toLocaleString()}</span><br/>
              <span style="font-size: 12px; color: ${color}">&#9679; ${radius < 8 ? "Low" : radius < 15 ? "Medium" : "Top"} performer</span>
            </div>
          `);
        }

        if (validBranches.length > 1) {
          const group = L.featureGroup(
            validBranches.map((b) =>
              L.circleMarker([b.lat!, b.lng!], { radius: 0.1, interactive: false })
            )
          );
          map.fitBounds(group.getBounds().pad(0.1));
        }

        mapInstanceRef.current = map;
      } catch (err) {
        if (isMounted) setMapError("Failed to load map. Please try again.");
      }
    })();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, [branches]);

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
      <div ref={mapRef} className="w-full h-[420px] rounded-lg overflow-hidden border border-outline-variant z-0" />
    </div>
  );
}
