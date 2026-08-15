/**
 * @file components/CervosMap.tsx
 * @description Enhanced Leaflet map for HQ network view.
 * Supports click handlers, rich popup content, animated markers,
 * CartoDB dark tiles, and marker clusters.
 */
"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MarkerData {
  id?: string;
  lat: number;
  lng: number;
  label: string;
  status?: "online" | "offline" | "grace";
  detail?: string;
  accountName?: string;
  lastSync?: string;
}

interface CervosMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  className?: string;
  onMarkerClick?: (marker: MarkerData) => void;
  selectedId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  online: "#1039b9",
  grace: "#d97706",
  offline: "#ba1a1a",
  active: "#1039b9",
  trial: "#1039b9",
  locked: "#ba1a1a",
};

export default function CervosMap({
  center = [-6.816, 39.2803],
  zoom = 11,
  markers = [],
  className = "h-full w-full",
  onMarkerClick,
  selectedId,
}: CervosMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add markers
      markers.forEach((m) => {
        const color = STATUS_COLORS[m.status ?? "online"] ?? STATUS_COLORS.online;
        const isSelected = m.id === selectedId;
        const size = isSelected ? 20 : 14;
        const zOffset = isSelected ? 1000 : 0;

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:3px solid ${isSelected ? "#fff" : "rgba(255,255,255,0.7)"};
            border-radius:50%;
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
            cursor:pointer;
            position:relative;
            z-index:${zOffset};
          ">
            ${m.status === "online" ? `<div style="
              position:absolute;inset:-5px;border-radius:50%;
              border:2px solid ${color};
              opacity:0.4;
              animation:pulse-ring 2s ease infinite;
            "></div>` : ""}
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        });

        const marker = L.marker([m.lat, m.lng], { icon })
          .addTo(map);

        const popupContent = [
          `<div style="min-width:180px">`,
          `<div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#1a1a1a">${m.label}</div>`,
          m.accountName ? `<div style="font-size:12px;color:#666;margin-bottom:4px">${m.accountName}</div>` : "",
          m.detail ? `<div style="font-size:12px;color:#444;margin-bottom:4px">${m.detail}</div>` : "",
          m.lastSync ? `<div style="font-size:11px;color:#888;margin-top:4px">Last sync: ${m.lastSync}</div>` : "",
          `<div style="margin-top:6px;font-size:11px;font-weight:600;color:${color};text-transform:uppercase">${m.status ?? "active"}</div>`,
          `</div>`,
        ].join("");

        marker.bindPopup(popupContent, { maxWidth: 220 });

        if (onMarkerClick) {
          marker.on("click", () => onMarkerClick(m));
        }

        if (m.id) {
          markersRef.current[m.id] = marker;
        }
      });

      // Fit bounds if multiple markers
      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
        markersRef.current = {};
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .leaflet-popup-content-wrapper { border-radius: 8px !important; }
        .leaflet-popup-content { margin: 12px !important; }
      `}</style>
      <div ref={mapRef} className={className} />
    </>
  );
}
