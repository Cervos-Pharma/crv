/**
 * @file components/CervosMap.tsx
 * @description Leaflet map component for displaying pharmacy branch locations.
 *
 * Dynamically imports Leaflet in a useEffect to avoid SSR issues (window/document
 * unavailable server-side). Must be wrapped by MapClientWrapper which sets `ssr: false`.
 *
 * The Leaflet CSS is imported from the npm package to avoid CDN requests in the
 * preview iframe.
 *
 * Default icon URLs point to unpkg CDN (acceptable — only icons, not scripts).
 * Replace with local `/public/` assets if CDN access is a concern in production.
 *
 * @param center  - Map centre [lat, lng]. Defaults to Dar es Salaam.
 * @param zoom    - Initial zoom level. Defaults to 11.
 * @param markers - Branch markers with name, status, and optional popupContent.
 * @param className - Tailwind/CSS classes for the container div. Defaults to "h-full w-full".
 */
"use client";

import { useEffect, useRef } from "react";
// Import Leaflet CSS from the installed package — avoids CDN blocks
import "leaflet/dist/leaflet.css";

interface MarkerData {
  lat: number;
  lng: number;
  label: string;
  status?: "online" | "offline" | "grace";
}

interface CervosMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  className?: string;
}

export default function CervosMap({
  center = [-6.816, 39.2803],
  zoom = 11,
  markers = [],
  className = "h-full w-full",
}: CervosMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Fix broken default icon paths in webpack/Turbopack
      // @ts-expect-error Leaflet private property
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markers.forEach((m) => {
        const color =
          m.status === "offline"
            ? "#ba1a1a"
            : m.status === "grace"
            ? "#d97706"
            : "#1039b9";

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:14px;height:14px;
            background:${color};
            border:2px solid #fff;
            border-radius:50%;
            box-shadow:0 1px 4px rgba(0,0,0,0.35)
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        L.marker([m.lat, m.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${m.label}</strong><br>Status: ${m.status ?? "active"}`
          );
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mapRef} className={className} />;
}
