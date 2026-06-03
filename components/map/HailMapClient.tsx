"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HailEvent {
  id: number;
  lat: number;
  lng: number;
  city: string;
  date: string;
  isoDate: string;
  maxSizeIn: number;
  severity: string;
  daysAgo: number;
}

interface MapData {
  events: HailEvent[];
  largest: HailEvent | null;
  source: string;
  dateRange: { from: string; to: string; days: number };
}

interface PriorityItem {
  name: string;
  opportunityScore: number;
  medianBuildYear: number;
  avgSqFt: number;
  notes: string;
  events: HailEvent[];
  maxSeverity: string;
  canvassingScore: number;
  centroid: [number, number] | null; // [lng, lat]
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  extreme:  { color: "#ef4444", fill: "rgba(239,68,68,0.25)",  radius: 22, label: "Extreme (≥2\")" },
  severe:   { color: "#f97316", fill: "rgba(249,115,22,0.2)",  radius: 18, label: "Severe (1.5–2\")" },
  moderate: { color: "#eab308", fill: "rgba(234,179,8,0.2)",   radius: 14, label: "Moderate (1–1.5\")" },
  minor:    { color: "#22c55e", fill: "rgba(34,197,94,0.15)",  radius: 10, label: "Minor (<1\")" },
} as const;

const CITY_OPPORTUNITY: Record<string, { score: number; year: number; sqft: number; notes: string }> = {
  "DENVER":               { score: 8, year: 1952, sqft: 1700, notes: "Older housing stock, pre-1960 avg" },
  "AURORA":               { score: 7, year: 1976, sqft: 1850, notes: "1970s–80s suburban, large lots" },
  "LAKEWOOD":             { score: 7, year: 1968, sqft: 1800, notes: "1960s–70s ranch homes" },
  "WHEAT RIDGE":          { score: 8, year: 1958, sqft: 1600, notes: "1950s–60s aging ranch homes" },
  "ARVADA":               { score: 7, year: 1970, sqft: 1750, notes: "1960s–70s ranch suburban" },
  "ENGLEWOOD":            { score: 7, year: 1962, sqft: 1500, notes: "1950s–60s older suburb" },
  "COMMERCE CITY":        { score: 6, year: 1975, sqft: 1500, notes: "1970s–80s homes" },
  "WESTMINSTER":          { score: 6, year: 1982, sqft: 1900, notes: "1980s suburban mix" },
  "THORNTON":             { score: 6, year: 1985, sqft: 1850, notes: "1980s–90s homes" },
  "LITTLETON":            { score: 7, year: 1972, sqft: 1800, notes: "1970s ranch and two-story" },
  "CENTENNIAL":           { score: 6, year: 1990, sqft: 2200, notes: "1990s larger homes" },
  "GREENWOOD VILLAGE":    { score: 7, year: 1978, sqft: 2400, notes: "1970s–80s larger homes" },
  "CHERRY HILLS VILLAGE": { score: 9, year: 1958, sqft: 3200, notes: "Estate homes — very high claim value" },
  "BROOMFIELD":           { score: 5, year: 1990, sqft: 2000, notes: "1990s suburban" },
  "PARKER":               { score: 5, year: 1998, sqft: 2500, notes: "Newer construction" },
  "CASTLE ROCK":          { score: 5, year: 2000, sqft: 2400, notes: "2000s newer builds" },
  "HIGHLANDS RANCH":      { score: 5, year: 1995, sqft: 2400, notes: "Master-planned 1990s" },
};

// ─── Spatial Helpers ──────────────────────────────────────────────────────────

function severityOrder(s: string): number {
  return ({ extreme: 4, severe: 3, moderate: 2, minor: 1, none: 0 } as Record<string, number>)[s] ?? 0;
}

function severityMultiplier(s: string): number {
  return ({ extreme: 2.0, severe: 1.5, moderate: 1.2, minor: 1.0, none: 0 } as Record<string, number>)[s] ?? 0;
}

function getCityOpportunity(cityName: string) {
  const upper = cityName.toUpperCase();
  for (const [key, val] of Object.entries(CITY_OPPORTUNITY)) {
    if (upper === key || upper.startsWith(key + " ") || upper.startsWith(key + ",")) return val;
  }
  return { score: 6, year: 1975, sqft: 1700, notes: "Denver metro residential" };
}

function raycast(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(lng: number, lat: number, feature: any): boolean {
  const geom = feature?.geometry;
  if (!geom) return false;
  if (geom.type === "Polygon") return raycast(lng, lat, geom.coordinates[0]);
  if (geom.type === "MultiPolygon") return geom.coordinates.some((poly: number[][][]) => raycast(lng, lat, poly[0]));
  return false;
}

function computeCentroid(geometry: any): [number, number] | null {
  try {
    const ring: number[][] = geometry.type === "Polygon"
      ? geometry.coordinates[0]
      : geometry.coordinates[0][0];
    let sumLng = 0, sumLat = 0;
    for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; }
    return [sumLng / ring.length, sumLat / ring.length];
  } catch { return null; }
}

function scoreColor(score: number): string {
  if (score >= 8) return "#f97316";
  if (score >= 6) return "#f59e0b";
  return "#94a3b8";
}

// ─── GeoJSON layer functions (module-level for stability) ─────────────────────

function geoJSONStyle(feature: any) {
  const score: number = feature?.properties?.opportunityScore ?? 5;
  const hasHail: boolean = (feature?.properties?.hailCount ?? 0) > 0;
  if (!hasHail) {
    return { fillColor: "rgba(30,41,59,0.2)", fillOpacity: 1, color: "rgba(71,85,105,0.4)", weight: 0.5 };
  }
  const fill = score >= 8 ? "rgba(234,88,12,0.4)" : score >= 6 ? "rgba(217,119,6,0.32)" : "rgba(107,114,128,0.25)";
  const border = score >= 8 ? "#f97316" : score >= 6 ? "#f59e0b" : "#94a3b8";
  return { fillColor: fill, fillOpacity: 1, color: border, weight: 2 };
}

function onEachFeature(feature: any, layer: any) {
  const p = feature?.properties ?? {};
  const name: string = p.name || p.NBHD_NAME || "Neighborhood";
  const score: number = p.opportunityScore ?? 5;
  const sc = scoreColor(score);
  const hailCount: number = p.hailCount ?? 0;
  const maxSev: string = p.maxSeverity ?? "none";
  const sevColors: Record<string, string> = { extreme: "#ef4444", severe: "#f97316", moderate: "#eab308", minor: "#22c55e" };
  const sevColor = sevColors[maxSev] ?? "#94a3b8";

  const hailBlock = hailCount > 0
    ? `<div style="margin-top:8px;padding:6px 8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);border-radius:6px"><span style="color:${sevColor};font-weight:600">${hailCount} hail event${hailCount > 1 ? "s" : ""}</span><span style="color:#64748b"> · ${maxSev}</span></div>`
    : `<div style="color:#475569;margin-top:6px;font-style:italic;font-size:11px">No recent hail in this window</div>`;

  const navBlock = p.centroid
    ? `<a href="https://www.google.com/maps?q=${p.centroid[1]},${p.centroid[0]}&zoom=14" target="_blank" rel="noopener" style="display:block;margin-top:10px;text-align:center;padding:6px 12px;background:rgba(14,165,233,0.1);color:#38bdf8;border:1px solid rgba(14,165,233,0.22);border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">Navigate to neighborhood →</a>`
    : "";

  layer.bindPopup(`
    <div style="min-width:210px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <strong style="font-size:13px;line-height:1.3">${name}</strong>
        <span style="background:${sc}22;color:${sc};border:1px solid ${sc}44;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap">${score}/10</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.7">
        <div>Built ~${p.medianBuildYear ?? 1965} · ~${(p.avgSqFt ?? 1700).toLocaleString()} sqft avg</div>
        <div style="color:#cbd5e1;margin-top:2px">${p.notes ?? ""}</div>
        ${hailBlock}
      </div>
      ${navBlock}
    </div>
  `);
}

// ─── Map sub-component ────────────────────────────────────────────────────────

function DenverFocus() {
  const map = useMap();
  useEffect(() => {
    map.setView([39.7392, -104.9903], 11);
  }, [map]);
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HailMapClient() {
  const [days, setDays] = useState(7);
  const [showNeighborhoods, setShowNeighborhoods] = useState(true);
  const [hailData, setHailData] = useState<MapData | null>(null);
  const [hailLoading, setHailLoading] = useState(true);
  const [hailError, setHailError] = useState(false);
  const [nbhdGeoJSON, setNbhdGeoJSON] = useState<any>(null);

  useEffect(() => {
    setHailLoading(true);
    setHailError(false);
    fetch(`/api/hail-map?days=${days}&metro=denver`)
      .then(r => r.json())
      .then(d => { setHailData(d); setHailLoading(false); })
      .catch(() => { setHailError(true); setHailLoading(false); });
  }, [days]);

  useEffect(() => {
    fetch("/api/denver-neighborhoods")
      .then(r => r.json())
      .then(d => { if (d.type === "FeatureCollection") setNbhdGeoJSON(d); })
      .catch(() => {});
  }, []);

  // Assign hail events to neighborhoods via point-in-polygon
  const enrichedFeatures = useMemo(() => {
    if (!nbhdGeoJSON?.features || !hailData?.events) return [];
    return nbhdGeoJSON.features.map((feature: any) => {
      const events = hailData.events.filter(e => pointInFeature(e.lng, e.lat, feature));
      const maxSev = events.reduce(
        (best, e) => severityOrder(e.severity) > severityOrder(best) ? e.severity : best,
        "none"
      );
      return {
        ...feature,
        properties: {
          ...feature.properties,
          hailCount: events.length,
          events,
          maxSeverity: maxSev,
          canvassingScore: events.length > 0
            ? (feature.properties.opportunityScore ?? 5) * severityMultiplier(maxSev)
            : 0,
          centroid: computeCentroid(feature.geometry),
        },
      };
    });
  }, [nbhdGeoJSON, hailData]);

  // Build the sorted canvassing priority list
  const priorityList = useMemo((): PriorityItem[] => {
    if (nbhdGeoJSON && enrichedFeatures.length > 0) {
      return enrichedFeatures
        .filter((f: any) => f.properties.hailCount > 0)
        .sort((a: any, b: any) => b.properties.canvassingScore - a.properties.canvassingScore)
        .slice(0, 15)
        .map((f: any) => ({
          name: f.properties.name || f.properties.NBHD_NAME || "Unknown",
          opportunityScore: f.properties.opportunityScore ?? 5,
          medianBuildYear: f.properties.medianBuildYear ?? 1970,
          avgSqFt: f.properties.avgSqFt ?? 1650,
          notes: f.properties.notes ?? "",
          events: f.properties.events,
          maxSeverity: f.properties.maxSeverity,
          canvassingScore: f.properties.canvassingScore,
          centroid: f.properties.centroid,
        }));
    }

    if (!hailData?.events?.length) return [];

    // Fallback: city-level priority when neighborhood GeoJSON is unavailable
    const cityMap = new Map<string, PriorityItem>();
    for (const event of hailData.events) {
      const cityName = event.city.split(",")[0].trim();
      if (!cityMap.has(cityName)) {
        const d = getCityOpportunity(cityName);
        cityMap.set(cityName, {
          name: cityName,
          opportunityScore: d.score,
          medianBuildYear: d.year,
          avgSqFt: d.sqft,
          notes: d.notes,
          events: [],
          maxSeverity: "none",
          canvassingScore: 0,
          centroid: null,
        });
      }
      cityMap.get(cityName)!.events.push(event);
    }

    return Array.from(cityMap.values())
      .map(item => {
        const maxSev = item.events.reduce(
          (best, e) => severityOrder(e.severity) > severityOrder(best) ? e.severity : best,
          "none"
        );
        return { ...item, maxSeverity: maxSev, canvassingScore: item.opportunityScore * severityMultiplier(maxSev) };
      })
      .sort((a, b) => b.canvassingScore - a.canvassingScore)
      .slice(0, 15);
  }, [nbhdGeoJSON, enrichedFeatures, hailData]);

  const events = hailData?.events ?? [];
  const timeLabel = days === 7 ? "Last 7 Days" : days === 30 ? "Last 30 Days" : "Last Year";
  const geoJSONKey = `${days}-${events.length}-${enrichedFeatures.filter((f: any) => f.properties?.hailCount > 0).length}`;

  return (
    <div className="space-y-4">
      {/* Time range + layer controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "rgba(14,165,233,0.2)" }}>
          {([7, 30, 365] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: days === d ? "rgba(14,165,233,0.2)" : "rgba(4,8,15,0.8)",
                color: days === d ? "#38bdf8" : "#64748b",
                borderRight: d !== 365 ? "1px solid rgba(14,165,233,0.15)" : undefined,
              }}
            >
              {d === 7 ? "Last 7 Days" : d === 30 ? "Last 30 Days" : "Last Year"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showNeighborhoods}
            onChange={e => setShowNeighborhoods(e.target.checked)}
            className="accent-sky-400 w-3.5 h-3.5"
          />
          <span>Neighborhood overlay</span>
        </label>

        {hailLoading && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <svg className="animate-spin w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading storm data…
          </div>
        )}
      </div>

      {/* Main layout: sidebar + map */}
      <div className="flex gap-4 items-start">

        {/* ── Canvassing Priority Sidebar ─────────────────────────────────── */}
        <div
          className="hidden lg:flex flex-col w-72 shrink-0 rounded-2xl overflow-hidden border"
          style={{ borderColor: "rgba(14,165,233,0.15)", background: "rgba(4,8,15,0.95)" }}
        >
          <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "rgba(14,165,233,0.12)" }}>
            <div className="font-semibold text-white text-sm">Canvassing Targets</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {timeLabel} · hail severity × roof opportunity
            </div>
          </div>

          <div className="overflow-y-auto flex-1" style={{ maxHeight: "528px" }}>
            {hailLoading ? (
              <div className="p-4 text-xs text-slate-400">Loading storm data…</div>
            ) : priorityList.length === 0 ? (
              <div className="p-4">
                <p className="text-xs text-slate-400 mb-3">
                  No hail events found in Denver metro for this window.
                </p>
                {days < 365 && (
                  <button
                    onClick={() => setDays(days === 7 ? 30 : 365)}
                    className="text-xs text-sky-400 underline"
                  >
                    Expand to {days === 7 ? "last 30 days" : "last year"} →
                  </button>
                )}
              </div>
            ) : (
              priorityList.map((item, idx) => {
                const sc = scoreColor(item.opportunityScore);
                const sevColors: Record<string, string> = { extreme: "#ef4444", severe: "#f97316", moderate: "#eab308", minor: "#22c55e" };
                const sevColor = sevColors[item.maxSeverity] ?? "#94a3b8";
                const latestEvent = [...item.events].sort(
                  (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime()
                )[0];
                const navHref = item.centroid
                  ? `https://www.google.com/maps?q=${item.centroid[1]},${item.centroid[0]}&zoom=14`
                  : `https://www.google.com/maps/search/${encodeURIComponent(item.name + " Denver Colorado")}`;

                return (
                  <div
                    key={item.name}
                    className="px-4 py-3 border-b transition-colors"
                    style={{ borderColor: "rgba(14,165,233,0.07)" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="text-slate-600 text-xs pt-0.5 shrink-0">{idx + 1}.</span>
                        <span className="font-semibold text-white text-sm leading-tight">{item.name}</span>
                      </div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: `${sc}22`, color: sc, border: `1px solid ${sc}44` }}
                      >
                        {item.opportunityScore}/10
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 ml-4 space-y-0.5">
                      <div>~{item.medianBuildYear} built · ~{item.avgSqFt.toLocaleString()} sqft avg</div>
                      <div className="text-slate-600 leading-snug">{item.notes}</div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-4 mt-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sevColor }} />
                      <span style={{ color: sevColor }} className="font-medium">
                        {item.events.length} {item.maxSeverity} event{item.events.length > 1 ? "s" : ""}
                      </span>
                      {latestEvent && (
                        <span className="text-slate-600">· {latestEvent.date}</span>
                      )}
                    </div>

                    <a
                      href={navHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 mt-2 inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      Navigate →
                    </a>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t shrink-0 text-xs text-slate-600" style={{ borderColor: "rgba(14,165,233,0.1)" }}>
            {nbhdGeoJSON ? "Neighborhood-level precision" : "City-level data"} · NOAA LSR
          </div>
        </div>

        {/* ── Map ──────────────────────────────────────────────────────────── */}
        <div
          className="flex-1 min-w-0 relative rounded-2xl overflow-hidden border"
          style={{ borderColor: "rgba(14,165,233,0.15)" }}
        >
          {/* Legend */}
          <div
            className="absolute top-4 right-4 z-[1000] p-3 rounded-xl text-xs space-y-1.5"
            style={{ background: "rgba(4,8,15,0.92)", border: "1px solid rgba(14,165,233,0.15)", backdropFilter: "blur(8px)" }}
          >
            <div className="font-semibold text-white mb-1.5">Hail Severity</div>
            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cfg.color }} />
                <span className="text-slate-300">{cfg.label}</span>
              </div>
            ))}
            {nbhdGeoJSON && (
              <>
                <div
                  className="pt-2 mt-0.5 border-t font-semibold text-white"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                >
                  Roof Opportunity
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#ea580c", opacity: 0.8 }} />
                  <span className="text-slate-300">High (8–10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#d97706", opacity: 0.8 }} />
                  <span className="text-slate-300">Medium (6–7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#6b7280", opacity: 0.6 }} />
                  <span className="text-slate-300">Lower (&lt;6)</span>
                </div>
              </>
            )}
            <div
              className="pt-1.5 mt-0.5 border-t text-slate-500"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              {timeLabel} · Denver metro
            </div>
          </div>

          {/* Stats bar */}
          <div
            className="absolute bottom-0 left-0 right-0 z-[1000] flex flex-wrap items-center gap-4 px-4 py-2.5"
            style={{ background: "rgba(4,8,15,0.88)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(14,165,233,0.12)" }}
          >
            {hailLoading ? (
              <div className="text-xs text-slate-400">Loading…</div>
            ) : hailError ? (
              <div className="text-xs text-red-400">Failed to load storm data</div>
            ) : (
              <>
                <div className="text-xs text-slate-400">
                  <span className="text-white font-semibold">{events.length}</span> events · Denver metro
                </div>
                {hailData?.largest && (
                  <div className="text-xs text-slate-400">
                    Largest: <span className="text-red-400 font-semibold">{hailData.largest.maxSizeIn}&quot;</span>
                    {" "}({hailData.largest.city.split(",")[0]}, {hailData.largest.date})
                  </div>
                )}
              </>
            )}
            <div className="ml-auto">
              <Link href="/hail" className="btn-primary text-xs px-4 py-2">
                Check my home →
              </Link>
            </div>
          </div>

          <MapContainer
            center={[39.7392, -104.9903]}
            zoom={11}
            style={{ height: "580px", width: "100%", background: "#04080f" }}
          >
            <DenverFocus />
            <TileLayer
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />

            {showNeighborhoods && enrichedFeatures.length > 0 && (
              <GeoJSON
                key={geoJSONKey}
                data={{ type: "FeatureCollection", features: enrichedFeatures } as any}
                style={geoJSONStyle}
                onEachFeature={onEachFeature}
              />
            )}

            {events.map((event) => {
              const cfg = SEVERITY_CONFIG[event.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.minor;
              const isRecent = event.daysAgo <= 7;
              return (
                <CircleMarker
                  key={event.id}
                  center={[event.lat, event.lng]}
                  radius={cfg.radius}
                  fillColor={cfg.fill}
                  color={cfg.color}
                  weight={isRecent ? 3 : 2}
                  opacity={isRecent ? 1 : 0.75}
                  fillOpacity={isRecent ? 0.85 : 0.5}
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
                          <span className="text-slate-400">Hail Size</span>
                          <span className="font-bold text-white">{event.maxSizeIn}&quot; diameter</span>
                        </div>
                        {isRecent && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            <span className="text-green-400 font-medium">Within last 7 days</span>
                          </div>
                        )}
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
      </div>

      {/* Mobile: priority list below map */}
      {priorityList.length > 0 && (
        <div className="lg:hidden">
          <h3 className="text-white font-semibold text-sm mb-3">
            Canvassing Targets — {timeLabel}
          </h3>
          <div className="space-y-2">
            {priorityList.slice(0, 5).map((item, idx) => {
              const sc = scoreColor(item.opportunityScore);
              const sevColors: Record<string, string> = { extreme: "#ef4444", severe: "#f97316", moderate: "#eab308", minor: "#22c55e" };
              const sevColor = sevColors[item.maxSeverity] ?? "#94a3b8";
              return (
                <div
                  key={item.name}
                  className="rounded-xl p-3 border flex items-start gap-3"
                  style={{ borderColor: "rgba(14,165,233,0.12)", background: "rgba(4,8,15,0.8)" }}
                >
                  <span className="text-slate-600 text-sm w-5 shrink-0 pt-0.5">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-white text-sm">{item.name}</span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: `${sc}22`, color: sc, border: `1px solid ${sc}44` }}
                      >
                        {item.opportunityScore}/10
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{item.notes}</div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sevColor }} />
                      <span style={{ color: sevColor }}>
                        {item.events.length} {item.maxSeverity} event{item.events.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
