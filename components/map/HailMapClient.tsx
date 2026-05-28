"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

const HAIL_EVENTS = [
  { id: 1, lat: 39.7392, lng: -104.9903, city: "Denver — Capitol Hill", date: "Aug 14, 2025", maxSizeIn: 1.75, severity: "severe",   area: "5 sq mi" },
  { id: 2, lat: 40.0150, lng: -105.2705, city: "Boulder — Table Mesa",  date: "Jun 22, 2025", maxSizeIn: 1.0,  severity: "moderate", area: "3 sq mi" },
  { id: 3, lat: 39.5501, lng: -105.7821, city: "Conifer",               date: "Sep 5, 2024",  maxSizeIn: 2.5,  severity: "extreme",  area: "8 sq mi" },
  { id: 4, lat: 39.9205, lng: -105.0866, city: "Westminster",           date: "Jul 31, 2025", maxSizeIn: 0.75, severity: "minor",    area: "2 sq mi" },
  { id: 5, lat: 39.6066, lng: -104.9123, city: "Aurora — Southlands",   date: "Aug 28, 2025", maxSizeIn: 1.25, severity: "moderate", area: "4 sq mi" },
  { id: 6, lat: 40.5853, lng: -105.0844, city: "Fort Collins — Midtown",date: "Jul 14, 2025", maxSizeIn: 0.5,  severity: "minor",    area: "1.5 sq mi"},
  { id: 7, lat: 38.8339, lng: -104.8214, city: "Colorado Springs — Nor",date: "Jun 25, 2025", maxSizeIn: 1.5,  severity: "severe",   area: "6 sq mi" },
  { id: 8, lat: 39.7555, lng: -105.2211, city: "Lakewood — Green Mtn",  date: "Aug 5, 2025",  maxSizeIn: 2.0,  severity: "severe",   area: "7 sq mi" },
  { id: 9, lat: 39.8817, lng: -104.7677, city: "Commerce City",         date: "May 17, 2025", maxSizeIn: 0.75, severity: "minor",    area: "2.5 sq mi"},
  { id:10, lat: 39.4817, lng: -106.0452, city: "Breckenridge area",     date: "Jul 8, 2025",  maxSizeIn: 1.0,  severity: "moderate", area: "4 sq mi" },
];

const SEVERITY_CONFIG = {
  extreme:  { color: "#ef4444", fill: "rgba(239,68,68,0.25)",  radius: 22, label: "Extreme (2.5\")" },
  severe:   { color: "#f97316", fill: "rgba(249,115,22,0.2)",  radius: 18, label: "Severe (1.5–2\")" },
  moderate: { color: "#eab308", fill: "rgba(234,179,8,0.2)",   radius: 14, label: "Moderate (1–1.5\")" },
  minor:    { color: "#22c55e", fill: "rgba(34,197,94,0.15)",  radius: 10, label: "Minor (<1\")" },
};

function FitBounds() {
  const map = useMap();
  useEffect(() => {
    map.setView([40.015, -105.27], 9);
  }, [map]);
  return null;
}

export default function HailMapClient() {
  const [selected, setSelected] = useState<typeof HAIL_EVENTS[0] | null>(null);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(14,165,233,0.15)" }}>
      {/* Legend */}
      <div
        className="absolute top-4 right-4 z-[1000] p-4 rounded-xl text-xs space-y-2"
        style={{ background: "rgba(4,8,15,0.9)", border: "1px solid rgba(14,165,233,0.15)", backdropFilter: "blur(8px)" }}
      >
        <div className="font-semibold text-white mb-2 text-sm">Hail Severity</div>
        {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cfg.color }} />
            <span className="text-slate-300">{cfg.label}</span>
          </div>
        ))}
        <div className="pt-1 border-t border-white/10 text-slate-500">
          Last 12 months
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1000] flex flex-wrap gap-4 px-4 py-3"
        style={{ background: "rgba(4,8,15,0.88)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(14,165,233,0.12)" }}
      >
        <div className="text-xs text-slate-400">
          <span className="text-white font-semibold">{HAIL_EVENTS.length}</span> events mapped
        </div>
        <div className="text-xs text-slate-400">
          Largest: <span className="text-red-400 font-semibold">2.5" diameter</span> (Conifer, Sep 2024)
        </div>
        <div className="ml-auto">
          <Link href="/hail" className="btn-primary text-xs px-4 py-2">
            Was your home affected? →
          </Link>
        </div>
      </div>

      <MapContainer
        center={[40.015, -105.27]}
        zoom={8}
        style={{ height: "600px", width: "100%", background: "#04080f" }}
        zoomControl={true}
      >
        <FitBounds />
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        {HAIL_EVENTS.map((event) => {
          const cfg = SEVERITY_CONFIG[event.severity as keyof typeof SEVERITY_CONFIG];
          return (
            <CircleMarker
              key={event.id}
              center={[event.lat, event.lng]}
              radius={cfg.radius}
              fillColor={cfg.fill}
              color={cfg.color}
              weight={2}
              opacity={0.9}
              fillOpacity={0.7}
              eventHandlers={{ click: () => setSelected(event) }}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-white text-sm leading-tight">{event.city}</h3>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}55` }}
                    >
                      {event.severity}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Date</span>
                      <span>{event.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Hail Size</span>
                      <span className="font-bold text-white">{event.maxSizeIn}"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Affected Area</span>
                      <span>{event.area}</span>
                    </div>
                  </div>
                  <a
                    href="/hail"
                    className="mt-3 w-full text-center block text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    style={{ background: "rgba(14,165,233,0.15)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.25)" }}
                  >
                    Check my home →
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
