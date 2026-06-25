"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

const MESH_URL = "https://raw.githubusercontent.com/tyler-emdur/faraday-tools/mrms-data/mesh-colorado.json";

interface MeshData {
  type: "FeatureCollection";
  features: any[];
  validTime?: string;
  maxInch?: number;
}

const MESH_FILL: Record<number, string> = { 1: "#22c55e", 2: "#eab308", 3: "#f97316", 4: "#ef4444" };

interface HailEvent {
  id: number;
  lat: number;
  lng: number;
  town: string;
  county: string;
  isoDate: string;
  maxSizeIn: number;
  severity: string;
  daysAgo: number;
  source?: "NEXRAD" | "LSR" | "CoCoRaHS" | "mPING" | "NWS_ALERT";
  probSevere?: number | null;
  damage?: string;
}

interface MapData {
  events: HailEvent[];
  largest: HailEvent | null;
  sourceCounts?: {
    radar: number;
    spotterReports: number;
    cocorahs?: number;
    mping?: number;
    alerts?: number;
  };
}

const SOURCE_LABEL: Record<string, string> = {
  NEXRAD: "NEXRAD radar",
  LSR: "NWS spotter",
  CoCoRaHS: "CoCoRaHS",
  mPING: "mPING",
  NWS_ALERT: "NWS Active Alert",
};

interface TownGroup {
  town: string;
  county: string;
  maxSize: number;
  count: number;
  severity: string;
  lat: number;
  lng: number;
  latestIso: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const SEVERITY_CONFIG = {
  extreme:  { color: "#ef4444", radius: 8, label: "Extreme (≥2\")" },
  severe:   { color: "#f97316", radius: 6, label: "Severe (1.5–2\")" },
  moderate: { color: "#eab308", radius: 5, label: "Moderate (1–1.5\")" },
  minor:    { color: "#22c55e", radius: 4, label: "Minor (<1\")" },
} as const;

const SEV_COLORS: Record<string, string> = {
  extreme: "#ef4444", severe: "#f97316", moderate: "#eab308", minor: "#22c55e",
};

const CO_BOUNDS: [[number, number], [number, number]] = [[36.8, -109.2], [41.2, -101.9]];

// Boulder, CO — used for proximity scoring
const BOULDER = { lat: 40.015, lng: -105.2705 };

function distMiles(lat: number, lng: number): number {
  const R = 3958.8;
  const dLat = ((lat - BOULDER.lat) * Math.PI) / 180;
  const dLng = ((lng - BOULDER.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((BOULDER.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type SortBy = "score" | "size" | "count";
type MinSize = 0.5 | 0.75 | 1.0 | 1.5;

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: "score", label: "Priority" },
  { key: "size", label: "Hail Size" },
  { key: "count", label: "Most Reports" },
];

const MIN_SIZE_OPTIONS: { val: MinSize; label: string }[] = [
  { val: 0.5, label: "All" },
  { val: 0.75, label: "¾\"+" },
  { val: 1.0, label: "1\"+" },
  { val: 1.5, label: "1.5\"+" },
];

function exactTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Denver", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }) + " MT";
  } catch { return iso; }
}

// Priority score: hail size × density bonus × recency bonus × Boulder proximity
// Closer neighborhoods rank higher — team is based in Boulder.
function canvassScore(t: TownGroup): number {
  const d = Math.floor((Date.now() - new Date(t.latestIso).getTime()) / 86400000);
  const recency = d === 0 ? 2.5 : d === 1 ? 1.5 : d <= 3 ? 1.0 : 0.6;
  const miles = distMiles(t.lat, t.lng);
  const proximity = Math.max(0.25, 1 / (1 + miles / 50));
  return t.maxSize * Math.sqrt(t.count) * recency * proximity;
}

function priorityTier(score: number): "PRIME" | "HOT" | null {
  if (score >= 3.5) return "PRIME";
  if (score >= 1.8) return "HOT";
  return null;
}

// Rough bounding-box area for a town cluster (1° lat ≈ 69 mi, 1° lng ≈ 53 mi at CO latitude)
function areaLabel(t: TownGroup): string | null {
  if (t.count < 2) return null;
  const sqMi = Math.round((t.maxLat - t.minLat) * 69 * (t.maxLng - t.minLng) * 53);
  return sqMi >= 1 ? `~${sqMi} sq mi` : null;
}

function FlyController({ target }: { target: { lat: number; lng: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 12, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function HailMapClient() {
  const [days, setDays] = useState(1);
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [mesh, setMesh] = useState<MeshData | null>(null);
  const [showSwath, setShowSwath] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [minSize, setMinSize] = useState<MinSize>(0.5);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/hail-map?days=${days}&metro=colorado`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [days]);

  useEffect(() => {
    fetch(MESH_URL, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.type === "FeatureCollection") setMesh(d); })
      .catch(() => {});
  }, []);

  const events = data?.events ?? [];

  // Apply min-size filter to both the map markers and the sidebar grouping
  const filteredEvents = useMemo(
    () => events.filter(e => e.maxSizeIn >= minSize),
    [events, minSize]
  );

  const towns = useMemo<TownGroup[]>(() => {
    const map = new Map<string, TownGroup>();
    for (const e of filteredEvents) {
      const key = `${e.town}|${e.county}`;
      const g = map.get(key);
      if (!g) {
        map.set(key, {
          town: e.town, county: e.county, maxSize: e.maxSizeIn, count: 1,
          severity: e.severity, lat: e.lat, lng: e.lng, latestIso: e.isoDate,
          minLat: e.lat, maxLat: e.lat, minLng: e.lng, maxLng: e.lng,
        });
      } else {
        g.count++;
        if (e.maxSizeIn > g.maxSize) {
          g.maxSize = e.maxSizeIn; g.severity = e.severity; g.lat = e.lat; g.lng = e.lng;
        }
        if (new Date(e.isoDate) > new Date(g.latestIso)) g.latestIso = e.isoDate;
        g.minLat = Math.min(g.minLat, e.lat);
        g.maxLat = Math.max(g.maxLat, e.lat);
        g.minLng = Math.min(g.minLng, e.lng);
        g.maxLng = Math.max(g.maxLng, e.lng);
      }
    }
    return Array.from(map.values())
      .filter(g =>
        g.town !== "Unknown" && !g.town.startsWith("Radar cell") &&
        g.town !== "mPING report" && g.town !== "CoCoRaHS station"
      )
      .sort((a, b) => {
        if (sortBy === "count") return b.count - a.count;
        if (sortBy === "score") return canvassScore(b) - canvassScore(a);
        return b.maxSize - a.maxSize;
      });
  }, [filteredEvents, sortBy]);

  const flyTo = (lat: number, lng: number) =>
    setFlyTarget({ lat, lng, key: Date.now() });

  return (
    <div className="space-y-3">
      {/* Header / stats */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-white font-bold text-lg">
          Colorado Hail — {days === 1 ? "Last 24 Hours" : "Last 7 Days"}
        </h1>

        {/* Time range toggle */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgba(14,165,233,0.2)" }}>
          {([1, 7] as const).map((d, i) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: days === d ? "rgba(14,165,233,0.2)" : "rgba(4,8,15,0.8)",
                color: days === d ? "#38bdf8" : "#64748b",
                borderRight: i === 0 ? "1px solid rgba(14,165,233,0.15)" : undefined,
              }}
            >
              {d === 1 ? "Last 24 hours" : "Last 7 days"}
            </button>
          ))}
        </div>

        {/* Min hail size filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Min size:</span>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgba(14,165,233,0.2)" }}>
            {MIN_SIZE_OPTIONS.map((opt, i) => (
              <button
                key={opt.val}
                onClick={() => setMinSize(opt.val)}
                className="px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: minSize === opt.val ? "rgba(14,165,233,0.2)" : "rgba(4,8,15,0.8)",
                  color: minSize === opt.val ? "#38bdf8" : "#64748b",
                  borderRight: i < MIN_SIZE_OPTIONS.length - 1 ? "1px solid rgba(14,165,233,0.15)" : undefined,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {mesh && (
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSwath}
              onChange={e => setShowSwath(e.target.checked)}
              className="accent-sky-400 w-3.5 h-3.5"
            />
            <span>Radar swath (MRMS 24h)</span>
          </label>
        )}

        {loading && <span className="text-xs text-slate-400">Loading live storm data…</span>}
        {!loading && !error && (
          <span className="text-xs text-slate-500">
            <span className="text-white font-semibold">{filteredEvents.length}</span> reports ·{" "}
            <span className="text-white font-semibold">{towns.length}</span> towns ·{" "}
            {data?.sourceCounts && (
              <>
                {[
                  data.sourceCounts.spotterReports ? `${data.sourceCounts.spotterReports} spotter` : null,
                  data.sourceCounts.radar ? `${data.sourceCounts.radar} radar` : null,
                  data.sourceCounts.cocorahs ? `${data.sourceCounts.cocorahs} CoCoRaHS` : null,
                  data.sourceCounts.mping ? `${data.sourceCounts.mping} mPING` : null,
                  data.sourceCounts.alerts ? `${data.sourceCounts.alerts} active alert` : null,
                ].filter(Boolean).join(" + ")}
              </>
            )}
          </span>
        )}
        {data?.largest && (
          <span className="text-xs text-slate-400 ml-auto">
            Largest: <span className="text-red-400 font-bold">{data.largest.maxSizeIn}&quot;</span>{" "}
            {data.largest.town} · {exactTime(data.largest.isoDate)}
          </span>
        )}
      </div>

      <div className="flex gap-3 items-start">

        {/* Door-knock priority sidebar */}
        <div
          className="hidden lg:flex flex-col w-72 shrink-0 rounded-xl overflow-hidden border"
          style={{ borderColor: "rgba(14,165,233,0.15)", background: "rgba(4,8,15,0.97)" }}
        >
          <div className="px-3 py-2.5 border-b shrink-0" style={{ borderColor: "rgba(14,165,233,0.12)" }}>
            <div className="font-semibold text-white text-sm">Where to Knock</div>

            {/* Sort controls */}
            <div className="flex mt-2 rounded-md overflow-hidden border" style={{ borderColor: "rgba(14,165,233,0.15)" }}>
              {SORT_OPTIONS.map((opt, i) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className="flex-1 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: sortBy === opt.key ? "rgba(14,165,233,0.18)" : "rgba(4,8,15,0.8)",
                    color: sortBy === opt.key ? "#38bdf8" : "#475569",
                    borderRight: i < SORT_OPTIONS.length - 1 ? "1px solid rgba(14,165,233,0.12)" : undefined,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-600 mt-1.5">
              {sortBy === "score" && "size × density × recency × proximity"}
              {sortBy === "size" && "largest reported hail first"}
              {sortBy === "count" && "most reports in one area"}
            </div>
          </div>

          <div className="overflow-y-auto flex-1" style={{ maxHeight: "600px" }}>
            {loading ? (
              <div className="p-3 text-xs text-slate-500">Loading…</div>
            ) : towns.length === 0 ? (
              <div className="p-3 text-xs text-slate-500">
                No hail reports in Colorado in the {days === 1 ? "last 24 hours" : "last 7 days"}.
                {days === 1 && (
                  <button onClick={() => setDays(7)} className="block mt-2 text-sky-400 underline">
                    Try last 7 days →
                  </button>
                )}
              </div>
            ) : (
              towns.map((t, idx) => {
                const color = SEV_COLORS[t.severity] ?? "#94a3b8";
                const score = canvassScore(t);
                const tier = priorityTier(score);
                const area = areaLabel(t);
                const miles = Math.round(distMiles(t.lat, t.lng));
                const mapsUrl = `https://maps.google.com/?q=${t.lat},${t.lng}`;
                return (
                  <div
                    key={`${t.town}-${idx}`}
                    className="border-b"
                    style={{ borderColor: "rgba(14,165,233,0.07)" }}
                  >
                    <button
                      onClick={() => flyTo(t.lat, t.lng)}
                      className="w-full text-left px-3 pt-2.5 pb-1.5 hover:bg-sky-500/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-xs w-4 shrink-0">{idx + 1}</span>
                        <span className="text-base font-bold tabular-nums shrink-0" style={{ color }}>
                          {t.maxSize}&quot;
                        </span>
                        <span className="text-white text-sm font-medium truncate flex-1">{t.town}</span>
                        {tier && (
                          <span
                            className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              background: tier === "PRIME" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.12)",
                              color: tier === "PRIME" ? "#ef4444" : "#f97316",
                              border: `1px solid ${tier === "PRIME" ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.25)"}`,
                            }}
                          >
                            {tier}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 ml-6">
                        {t.county && `${t.county} Co. · `}
                        {t.count} report{t.count > 1 ? "s" : ""}
                        {area && ` · ${area}`}
                        {" · "}<span className="text-slate-600">{miles} mi from Boulder</span>
                        {" · "}{exactTime(t.latestIso)}
                      </div>
                    </button>
                    {/* One-tap Maps link */}
                    <div className="pb-2 pl-9 pr-3">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors hover:bg-sky-500/10"
                        style={{
                          color: "#38bdf8",
                          background: "rgba(14,165,233,0.07)",
                          border: "1px solid rgba(14,165,233,0.18)",
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        Open in Maps →
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Map */}
        <div
          className="flex-1 min-w-0 relative rounded-xl overflow-hidden border"
          style={{ borderColor: "rgba(14,165,233,0.15)" }}
        >
          {/* Legend */}
          <div
            className="absolute top-3 right-3 z-[1000] p-2.5 rounded-lg text-xs space-y-1.5"
            style={{ background: "rgba(4,8,15,0.92)", border: "1px solid rgba(14,165,233,0.15)", backdropFilter: "blur(8px)" }}
          >
            <div className="font-semibold text-slate-300 mb-1">Hail Size</div>
            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                <span className="text-slate-400">{cfg.label}</span>
              </div>
            ))}
            {showSwath && mesh && (
              <div className="pt-1.5 mt-0.5 border-t text-slate-500" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-slate-300 font-medium">Radar swath = filled area</div>
                {mesh.validTime && <div>24h max · {exactTime(mesh.validTime)}</div>}
              </div>
            )}
          </div>

          {error && (
            <div className="absolute bottom-3 left-3 z-[1000] text-xs text-red-400 bg-black/70 px-3 py-1.5 rounded">
              Failed to load storm data
            </div>
          )}

          <MapContainer
            center={[39.3, -105.2]}
            zoom={7}
            minZoom={6}
            maxBounds={CO_BOUNDS}
            maxBoundsViscosity={1.0}
            ref={mapRef}
            style={{ height: "640px", width: "100%", background: "#04080f" }}
          >
            <FlyController target={flyTarget} />
            <TileLayer
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />

            {showSwath && mesh && (
              <GeoJSON
                key={mesh.validTime || "mesh"}
                data={mesh as any}
                style={(feature?: any) => {
                  const sev = feature?.properties?.sev ?? 1;
                  const c = MESH_FILL[sev] ?? "#22c55e";
                  return { stroke: false, weight: 0, fillColor: c, fillOpacity: 0.4 };
                }}
              />
            )}

            {filteredEvents.map((event) => {
              const cfg = SEVERITY_CONFIG[event.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.minor;
              const isToday = event.daysAgo === 0;
              const isAlert = event.source === "NWS_ALERT";
              return (
                <CircleMarker
                  key={event.id}
                  center={[event.lat, event.lng]}
                  radius={isAlert ? cfg.radius + 2 : cfg.radius}
                  fillColor={cfg.color}
                  color={isAlert ? "#fbbf24" : "#ffffff"}
                  weight={isAlert ? 2 : 1}
                  opacity={0.85}
                  fillOpacity={isAlert ? 0.55 : 0.95}
                >
                  <Popup>
                    <div style={{ minWidth: "210px", fontFamily: "monospace" }}>
                      {isAlert && (
                        <div style={{
                          background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)",
                          borderRadius: "6px", padding: "4px 8px", marginBottom: "8px",
                          color: "#fbbf24", fontSize: "11px", fontWeight: 700,
                        }}>
                          ⚡ ACTIVE NWS WARNING
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "26px", fontWeight: 700, color: cfg.color, lineHeight: 1 }}>
                          {event.maxSizeIn}&quot;
                        </span>
                        <span style={{ fontSize: "11px", color: cfg.color, textTransform: "uppercase" }}>
                          {event.severity}
                        </span>
                      </div>
                      <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                        <tbody>
                          <tr>
                            <td style={{ color: "#64748b", paddingRight: "10px" }}>Town</td>
                            <td style={{ color: "#e2e8f0", fontWeight: 600 }}>
                              {event.town}{event.county && `, ${event.county} Co.`}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: "#64748b", paddingRight: "10px" }}>
                              {isAlert ? "Issued" : "Reported"}
                            </td>
                            <td style={{ color: "#e2e8f0" }}>{exactTime(event.isoDate)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: "#64748b", paddingRight: "10px" }}>Coords</td>
                            <td style={{ color: "#94a3b8" }}>{event.lat.toFixed(4)}, {event.lng.toFixed(4)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: "#64748b", paddingRight: "10px" }}>Source</td>
                            <td style={{
                              color: event.source === "NEXRAD" ? "#38bdf8"
                                : event.source === "NWS_ALERT" ? "#fbbf24"
                                : "#94a3b8",
                              fontWeight: 600,
                            }}>
                              {SOURCE_LABEL[event.source ?? ""] ?? event.source ?? "—"}
                            </td>
                          </tr>
                          {event.damage && (
                            <tr>
                              <td style={{ color: "#64748b", paddingRight: "10px", verticalAlign: "top" }}>
                                {isAlert ? "Status" : "Damage"}
                              </td>
                              <td style={{ color: isAlert ? "#fbbf24" : "#fca5a5" }}>{event.damage}</td>
                            </tr>
                          )}
                          {isToday && !isAlert && (
                            <tr>
                              <td colSpan={2} style={{ paddingTop: "4px" }}>
                                <span style={{ color: "#4ade80", fontWeight: 600 }}>● TODAY</span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      <a
                        href={`https://www.google.com/maps?q=${event.lat},${event.lng}&zoom=15`}
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "block", marginTop: "9px", textAlign: "center",
                          padding: "5px 10px", background: "rgba(14,165,233,0.12)",
                          color: "#38bdf8", border: "1px solid rgba(14,165,233,0.25)",
                          borderRadius: "6px", fontSize: "11px", fontWeight: 600, textDecoration: "none",
                        }}
                      >
                        Open in Google Maps →
                      </a>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Mobile town list */}
      {towns.length > 0 && (
        <div className="lg:hidden space-y-1.5">
          <h2 className="text-white font-semibold text-sm">Where to Knock</h2>
          {towns.slice(0, 12).map((t, idx) => {
            const color = SEV_COLORS[t.severity] ?? "#94a3b8";
            const tier = priorityTier(canvassScore(t));
            return (
              <div key={`${t.town}-${idx}`} className="flex items-center gap-2 rounded-lg px-3 py-2 border" style={{ borderColor: "rgba(14,165,233,0.12)", background: "rgba(4,8,15,0.8)" }}>
                <span className="text-base font-bold tabular-nums" style={{ color }}>{t.maxSize}&quot;</span>
                <span className="text-white text-sm flex-1">{t.town}</span>
                {tier && (
                  <span className="text-xs font-bold" style={{ color: tier === "PRIME" ? "#ef4444" : "#f97316" }}>
                    {tier}
                  </span>
                )}
                <span className="text-xs text-slate-500">{t.count}×</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
