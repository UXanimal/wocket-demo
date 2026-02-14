"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Building {
  bin: string;
  address: string;
  score_grade: string | null;
  latitude: number | null;
  longitude: number | null;
  open_class_c: number | null;
  total_hpd_violations: number | null;
  ecb_penalties: number | null;
}

const gradeColors: Record<string, string> = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

export default function OwnerMap({ buildings }: { buildings: Building[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const withCoords = buildings.filter((b) => b.latitude && b.longitude);

  useEffect(() => {
    if (!mapRef.current) return;

    // Create map once
    if (!mapInstance.current) {
      const map = L.map(mapRef.current, { scrollWheelZoom: true });
      mapInstance.current = map;
      markersRef.current = L.layerGroup().addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);
    }

    const map = mapInstance.current;
    const markerLayer = markersRef.current!;

    // Clear existing markers
    markerLayer.clearLayers();

    if (withCoords.length === 0) return;

    const circleMarkers: L.CircleMarker[] = [];
    withCoords.forEach((b) => {
      const color = gradeColors[b.score_grade || ""] || "#9ca3af";
      const marker = L.circleMarker([b.latitude!, b.longitude!], {
        radius: 10,
        fillColor: color,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.85,
      });

      marker.bindPopup(`
        <div style="font-family:Inter,sans-serif;min-width:180px">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${b.address}</div>
          <div style="display:inline-block;background:${color};color:#fff;font-weight:700;padding:2px 8px;border-radius:4px;font-size:13px;margin-bottom:6px">${b.score_grade || "?"}</div>
          <div style="font-size:12px;color:#555;line-height:1.6">
            Open Class C: ${b.open_class_c || 0}<br/>
            HPD Violations: ${b.total_hpd_violations || 0}<br/>
            ECB Penalties: $${Number(b.ecb_penalties || 0).toLocaleString()}
          </div>
          <a href="/building/${b.bin}" style="display:block;margin-top:6px;font-size:12px;color:#2563eb;font-weight:600">View Building →</a>
        </div>
      `);
      markerLayer.addLayer(marker);
      circleMarkers.push(marker);
    });

    if (circleMarkers.length > 0) {
      const group = L.featureGroup(circleMarkers);
      map.fitBounds(group.getBounds().pad(0.15));
    }
  }, [withCoords.length, buildings]); // Re-render when buildings change

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  if (withCoords.length === 0) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        No coordinates available for mapping
      </div>
    );
  }

  const resetView = () => {
    if (!mapInstance.current || !markersRef.current) return;
    const markers = markersRef.current.getLayers() as L.CircleMarker[];
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      mapInstance.current.fitBounds(group.getBounds().pad(0.15));
    }
  };

  return (
    <div>
      <div className="relative">
        <div ref={mapRef} className="w-full h-80 md:h-96 rounded-xl border border-gray-200 dark:border-gray-700 z-0" />
        <button
          onClick={resetView}
          className="absolute top-2 right-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm z-[1000]"
          title="Reset map view"
        >
          ⟲ Reset
        </button>
      </div>
      {withCoords.length < buildings.length && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Showing {withCoords.length} of {buildings.length} properties on map ({buildings.length - withCoords.length} missing coordinates)
        </div>
      )}
    </div>
  );
}
