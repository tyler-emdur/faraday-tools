"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

interface HailEvent {
  id: number;
  lat: number;
  lng: number;
  city: string;
  date: string;
  isoDate: string;
  maxSizeIn: number;
  severity: string;
}

interface MapData {
  events: HailEvent[];
  largest: HailEvent | null;
  source: string;
}

const SEVERITY_CONFIG = {
  extreme:  { color: "#ef4444", fill: "rgba(239,68,68,0.25)",  radius: 22, label: "Extreme (≥2\")" },
  severe:   { color: "#f97316", fill: "rgba(249,115,22,0.2)",  radius: 18, label: "Severe (1.5–2\")" },
  moderate: { color: "#eab308", fill: "rgba(234,179,8,0.2)",   radius: 14, label: "Moderate (1–1.5\")" },
  minor:    { color: "#22c55e", fill: "rgba(34,197,94,0.15)",  radius: 10, label: "Minor (<1\")" },
};

function FitBounds() {
  const map = useMap();
  useEffect(() => {
    map.setView([39.7, -105.0], 8);
  }, [map]);
  return null;
}

export default function HailMapClient() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/hail-map")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const events = data?.events ?? [];
  const largest = data?.largest;

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
          Last 12 months · NOAA LSR
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1000] flex flex-wrap gap-4 px-4 py-3"
        style={{ background: "rgba(4,8,15,0.88)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(14,165,233,0.12)" }}
      >
        {loading ? (
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <svg className="animate-spin w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading storm data…
          </div>
        ) : error ? (
          <div className="text-xs text-red-400">Failed to load storm data</div>
        ) : (
          <>
            <div className="text-xs text-slate-400">
              <span className="text-white font-semibold">{events.length}</span> events mapped
            </div>
            {largest && (
              <div className="text-xs text-slate-400">
                Largest: <span className="text-red-400 font-semibold">{largest.maxSizeIn}&quot; diameter</span> ({largest.city}, {largest.date})
              </div>
            )}
          </>
        )}
        <div className="ml-auto">
          <Link href="/hail" className="btn-primary text-xs px-4 py-2">
            Was your home affected? →
          </Link>
        </div>
      </div>

      <MapContainer
        center={[39.7, -105.0]}
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
        {events.map((event) => {
          const cfg = SEVERITY_CONFIG[event.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.minor;
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
                      <span className="font-bold text-white">{event.maxSizeIn}&quot;</span>
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
