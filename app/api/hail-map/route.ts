import { NextResponse } from "next/server";

interface SWDIRecord {
  WSR_ID: string;
  CELL_ID: string;
  ZTIME: string; // "YYYYMMDD_HHMM"
  PROB: number;
  SEVPROB: number;
  MAXSIZE: number; // inches
  LAT: number;
  LON: number;
}

interface IEMFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    magnitude: number | string;
    city: string;
    county: string;
    valid: string;
    wfo: string;
    remark?: string;
  };
}

type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

interface HailEvent {
  lat: number;
  lng: number;
  town: string;
  county: string;
  isoDate: string;
  maxSizeIn: number;
  severity: string;
  daysAgo: number;
  source: "NEXRAD" | "LSR" | "CoCoRaHS" | "mPING" | "NWS_ALERT";
  probSevere: number | null;
  damage?: string;
}

// Colorado state bounds (with a hair of padding)
const COLORADO_BBOX: BBox = { minLat: 36.95, maxLat: 41.05, minLng: -109.06, maxLng: -102.04 };
const DENVER_BBOX: BBox = { minLat: 39.45, maxLat: 40.15, minLng: -105.35, maxLng: -104.55 };

// Published MRMS MESH swath — used to cross-validate spotter report sizes
const MESH_GEOJSON_URL =
  "https://raw.githubusercontent.com/tyler-emdur/faraday-tools/mrms-data/mesh-colorado.json";
// 1-hour max MESH — near-real-time layer produced by the same Action
const MESH_NOWCAST_URL =
  "https://raw.githubusercontent.com/tyler-emdur/faraday-tools/mrms-data/mesh-nowcast.json";

// Max cap applied when a spotter report exceeds what MRMS detected (1.5× band upper bound).
// sev 4 (≥2") has no cap from MESH — radar confirming large hail, trust the spotter.
const MESH_BAND_CAP: Record<number, number> = { 1: 1.5, 2: 2.25, 3: 3.0 };

interface MeshGrid {
  features: Array<{
    geometry: { type: string; coordinates: unknown };
    properties: { sev: number };
  }>;
  validTime?: string;
}

function inBBox(lat: number, lng: number, b: BBox) {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

function sizeToSeverity(sizeIn: number) {
  if (sizeIn >= 2.0) return "extreme";
  if (sizeIn >= 1.5) return "severe";
  if (sizeIn >= 1.0) return "moderate";
  return "minor";
}

// LSR magnitude has mixed units: most are inches ("1.75"), but some are hundredths
// ("81" meaning 0.81"). Anything over 8" is physically impossible for hail.
function normalizeSize(raw: number | string): number | null {
  let v = typeof raw === "number" ? raw : parseFloat(raw);
  if (!isFinite(v) || v <= 0) return null;
  if (v > 8) v = v / 100;
  return Math.round(v * 100) / 100;
}

// Strip the NWS "{distance} {bearing} " prefix → clean town name. "1 SE Berthoud" → "Berthoud"
function cleanTown(raw: string): string {
  if (!raw) return "Unknown";
  return raw.replace(/^\d+\s+(?:N|NE|NW|S|SE|SW|E|W|NNE|NNW|SSE|SSW|ENE|ESE|WNW|WSW)\s+/i, "").trim() || raw;
}

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// NOAA SWDI — radar-derived NEXRAD MESH hail (24–48 hr lag, but precise footprints)
async function fetchSWDI(bbox: BBox, days: number): Promise<HailEvent[]> {
  const now = new Date();
  const start = new Date(now.getTime() - Math.min(days, 365) * 86400000);
  const url = `https://www.ncei.noaa.gov/swdiws/json/nx3hail/${toYYYYMMDD(start)}:${toYYYYMMDD(now)}?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const records: SWDIRecord[] = data?.result ?? [];
    return records
      .filter((r) => r.LAT && r.LON && inBBox(r.LAT, r.LON, bbox))
      .map((r) => {
        const size = normalizeSize(r.MAXSIZE);
        if (size == null) return null;
        const raw = String(r.ZTIME);
        const isoDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:00Z`;
        return {
          lat: r.LAT,
          lng: r.LON,
          town: `Radar cell ${r.CELL_ID}`,
          county: "",
          isoDate,
          maxSizeIn: size,
          severity: sizeToSeverity(size),
          daysAgo: Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86400000),
          source: "NEXRAD" as const,
          probSevere: r.SEVPROB ?? null,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null && e.maxSizeIn >= 0.5);
  } catch {
    return [];
  }
}

// IEM LSR — NWS Local Storm Reports (fresh, named towns). NOTE: the wfo= param is
// ignored by this endpoint (returns the whole US), so we MUST filter by bbox.
async function fetchIEM(sts: string, ets: string, bbox: BBox): Promise<HailEvent[]> {
  try {
    const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?type=H&sts=${sts}&ets=${ets}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json();
    const now = new Date();
    return (data.features as IEMFeature[] ?? [])
      .map((f) => {
        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        if (!inBBox(lat, lng, bbox)) return null;
        const size = normalizeSize(f.properties.magnitude);
        if (size == null || size < 0.5) return null;
        const date = new Date(f.properties.valid);
        return {
          lat,
          lng,
          town: cleanTown(f.properties.city),
          county: f.properties.county ?? "",
          isoDate: f.properties.valid,
          maxSizeIn: size,
          severity: sizeToSeverity(size),
          daysAgo: Math.floor((now.getTime() - date.getTime()) / 86400000),
          source: "LSR" as const,
          probSevere: null as number | null,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  } catch {
    return [];
  }
}

// CoCoRaHS — citizen hail-pad measurements (keyless CSV export). Adds confirmed
// ground-truth reports with town names and often damage notes.
async function fetchCoCoRaHS(days: number, bbox: BBox): Promise<HailEvent[]> {
  const mdy = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  const now = new Date();
  const start = new Date(now.getTime() - days * 86400000);
  const url = `https://data.cocorahs.org/cocorahs/export/exportreports.aspx?ReportType=Hail&Format=CSV&State=CO&StartDate=${mdy(start)}&EndDate=${mdy(now)}&dtf=1&Units=us`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const cols = lines[0].split(",").map((c) => c.trim());
    const idx = (name: string) => cols.indexOf(name);
    const iDate = idx("ObservationDate"), iTime = idx("ObservationTime"), iLat = idx("Latitude"),
      iLon = idx("Longitude"), iName = idx("StationName"), iSize = idx("LargestSize"), iDmg = idx("Damage");
    if (iLat < 0 || iLon < 0 || iSize < 0) return [];

    const out: HailEvent[] = [];
    for (let r = 1; r < lines.length; r++) {
      const f = lines[r].split(",").map((c) => c.trim());
      const lat = parseFloat(f[iLat]), lng = parseFloat(f[iLon]);
      if (!isFinite(lat) || !isFinite(lng) || !inBBox(lat, lng, bbox)) continue;
      const size = normalizeSize(f[iSize]);
      if (size == null || size < 0.5) continue;

      // ObservationDate "2026-06-24", ObservationTime "09:45 PM" — local Mountain time
      const date = f[iDate];
      let isoDate = `${date}T00:00:00-06:00`;
      const tm = (f[iTime] || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (tm) {
        let h = parseInt(tm[1], 10);
        if (/PM/i.test(tm[3]) && h < 12) h += 12;
        if (/AM/i.test(tm[3]) && h === 12) h = 0;
        isoDate = `${date}T${String(h).padStart(2, "0")}:${tm[2]}:00-06:00`;
      }
      const station = (f[iName] || "").replace(/\s+\d+(\.\d+)?\s+[NSEW]{1,3}$/i, "").trim();
      const dmg = iDmg >= 0 ? (f[iDmg] || "").trim() : "";
      out.push({
        lat, lng,
        town: station || "CoCoRaHS station",
        county: "",
        isoDate,
        maxSizeIn: size,
        severity: sizeToSeverity(size),
        daysAgo: Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86400000),
        source: "CoCoRaHS",
        probSevere: null,
        damage: dmg && !/^no damage$/i.test(dmg) ? dmg : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// mPING — crowdsourced reports via the NOAA app. Requires a free API token
// (register at mping.ou.edu). Disabled gracefully until MPING_TOKEN is set.
async function fetchMPING(sts: string, ets: string, bbox: BBox): Promise<HailEvent[]> {
  const token = process.env.MPING_TOKEN;
  if (!token) return [];
  try {
    const url = `https://mping.ou.edu/mping/api/v2/reports?category=Hail&start=${encodeURIComponent(sts)}&end=${encodeURIComponent(ets)}`;
    const res = await fetch(url, { headers: { Authorization: `Token ${token}` }, next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results ?? data?.features ?? [];
    const now = new Date();
    const out: HailEvent[] = [];
    for (const it of items) {
      const coords = it?.geom?.coordinates ?? it?.geometry?.coordinates;
      if (!coords) continue;
      const lng = coords[0], lat = coords[1];
      if (!inBBox(lat, lng, bbox)) continue;
      const desc: string = it?.description_id?.description ?? it?.description ?? it?.properties?.description ?? "";
      const m = String(desc).match(/([\d.]+)\s*in/i);
      const size = m ? normalizeSize(m[1]) : null;
      if (size == null || size < 0.5) continue;
      const iso = it?.obtime ?? it?.valid ?? it?.properties?.obtime ?? ets;
      out.push({
        lat, lng,
        town: "mPING report",
        county: "",
        isoDate: iso,
        maxSizeIn: size,
        severity: sizeToSeverity(size),
        daysAgo: Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000),
        source: "mPING",
        probSevere: null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Reverse-geocode the top NEXRAD radar cells to real neighborhood / city names via Nominatim.
// Only the top 10 unique grid squares by hail size are looked up; results are cached for 24 h
// by Next.js fetch cache so Nominatim's 1-req/sec policy is respected in practice.
async function geocodeNEXRAD(
  events: HailEvent[]
): Promise<Map<string, { town: string; county: string }>> {
  // Deduplicate to ~2 km grid squares, pick top 10 by size
  const grid = new Map<string, HailEvent>();
  for (const e of events) {
    const k = `${Math.floor(e.lat / 0.02) * 0.02}|${Math.floor(e.lng / 0.02) * 0.02}`;
    const ex = grid.get(k);
    if (!ex || e.maxSizeIn > ex.maxSizeIn) grid.set(k, e);
  }
  const top = Array.from(grid.values()).sort((a, b) => b.maxSizeIn - a.maxSizeIn).slice(0, 10);

  const result = new Map<string, { town: string; county: string }>();
  await Promise.all(
    top.map(async (e) => {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${e.lat.toFixed(4)}&lon=${e.lng.toFixed(4)}&zoom=12&format=json`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "FaradayHailTool/1.0 (contact: healthreinvented@gmail.com)" },
          next: { revalidate: 86400 },
        });
        if (!res.ok) return;
        const data = await res.json();
        const addr = data.address ?? {};
        const town =
          addr.suburb ?? addr.neighbourhood ?? addr.city_district ??
          addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? "";
        const county = (addr.county ?? "").replace(/ County$/i, "");
        if (town) {
          const k = `${Math.floor(e.lat / 0.02) * 0.02}|${Math.floor(e.lng / 0.02) * 0.02}`;
          result.set(k, { town, county });
        }
      } catch {
        // silently skip — a failed geocode just keeps the "Radar cell" label
      }
    })
  );
  return result;
}

// ─── Data quality helpers ────────────────────────────────────────────────────

async function fetchMeshGrid(url: string): Promise<MeshGrid | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

// Ray-casting point-in-polygon. GeoJSON rings are [[lng, lat], ...].
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// Returns the MRMS MESH severity (1–4) at a point, or 0 if not covered.
function meshSevAt(lat: number, lng: number, mesh: MeshGrid): number {
  for (const f of mesh.features) {
    const sev = f.properties.sev;
    const geom = f.geometry as { type: string; coordinates: number[][][][] | number[][][] };
    const polys: number[][][][] =
      geom.type === "Polygon"
        ? [geom.coordinates as number[][][]]
        : (geom.coordinates as number[][][][]);
    for (const poly of polys) {
      if (pointInRing(lat, lng, poly[0]) && !poly.slice(1).some((h) => pointInRing(lat, lng, h)))
        return sev;
    }
  }
  return 0;
}

// Fetch 0°C isotherm height from open-meteo (free, no key; HRRR-equivalent accuracy).
// Returns km above sea level; falls back to Colorado summer average on failure.
async function fetchFreezingLevelKm(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=39.5&longitude=-105.5" +
        "&hourly=freezinglevel_height&timezone=UTC&forecast_days=1",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return 3.8;
    const d = await res.json();
    const heights: number[] = d?.hourly?.freezinglevel_height ?? [];
    const h = heights[new Date().getUTCHours()] ?? heights[0];
    return typeof h === "number" ? Math.round((h / 1000) * 10) / 10 : 3.8;
  } catch { return 3.8; }
}

// Hail loses diameter falling through warm air below the freezing level.
// Formula tuned for Colorado's dry air (hail preserves better than humid climates).
// Applied to ground observations only — NEXRAD MESH is already a surface estimate.
function meltCorrect(sizeIn: number, freezingKm: number): number {
  const factor = Math.exp(-0.04 * Math.max(0, freezingKm - 2.5));
  return Math.max(0.25, Math.round(sizeIn * factor * 100) / 100);
}

// Cluster point-source events within ~8 miles (0.1°) and 60 minutes.
// Keeps the most credible reporter from each cluster; absorbs the max size seen.
// This eliminates the "4 identical 4-inch reports" problem from the same storm cell.
function dedupePointSources(events: HailEvent[]): HailEvent[] {
  const CRED: Partial<Record<string, number>> = { LSR: 3, CoCoRaHS: 2, mPING: 1 };
  // Process highest-credibility first so the anchor is always the best reporter
  const sorted = [...events].sort((a, b) => (CRED[b.source] ?? 0) - (CRED[a.source] ?? 0));
  const used = new Set<number>();
  const out: HailEvent[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const anchor = { ...sorted[i] };
    used.add(i);
    const tA = new Date(anchor.isoDate).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      const o = sorted[j];
      if (Math.abs(anchor.lat - o.lat) > 0.1 || Math.abs(anchor.lng - o.lng) > 0.1) continue;
      if (Math.abs(tA - new Date(o.isoDate).getTime()) > 3600000) continue;
      // Same storm cluster — keep the anchor reporter but take the max size observed
      if (o.maxSizeIn > anchor.maxSizeIn) {
        anchor.maxSizeIn = o.maxSizeIn;
        anchor.severity = sizeToSeverity(o.maxSizeIn);
      }
      used.add(j);
    }
    out.push(anchor);
  }
  return out;
}

// ─── NWS Active Alerts ───────────────────────────────────────────────────────

// NWS Active Alerts — real-time severe thunderstorm / tornado warnings with hail sizes.
// This fires BEFORE any LSR/SWDI reports exist, giving the earliest signal for a new event.
async function fetchNWSAlerts(bbox: BBox): Promise<HailEvent[]> {
  try {
    const res = await fetch(
      "https://api.weather.gov/alerts/active?area=CO&status=actual&message_type=alert",
      {
        headers: { "User-Agent": "FaradayHailTool/1.0 (contact: healthreinvented@gmail.com)" },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const now = new Date();
    const out: HailEvent[] = [];

    for (const feature of (data.features ?? []) as any[]) {
      const props = feature.properties ?? {};
      if (!/severe thunderstorm|tornado/i.test(props.event ?? "")) continue;

      // Parse numeric hail size from the alert description text
      const text: string = (props.description ?? "") + " " + (props.headline ?? "");
      const m = text.match(/HAIL(?:\s+UP\s+TO)?\s+([\d.]+)\s*IN(?:CH(?:ES)?)?/i);
      if (!m) continue;
      const size = normalizeSize(m[1]);
      if (!size || size < 0.5) continue;

      // Compute centroid from polygon geometry (county-coded alerts have no geometry — skip them)
      const geom = feature.geometry;
      let lat = 0, lng = 0;
      if (geom?.type === "Polygon") {
        const ring = geom.coordinates[0] as [number, number][];
        lng = ring.reduce((s: number, c: [number, number]) => s + c[0], 0) / ring.length;
        lat = ring.reduce((s: number, c: [number, number]) => s + c[1], 0) / ring.length;
      } else if (geom?.type === "MultiPolygon") {
        const all = (geom.coordinates as [number, number][][][]).flat(2);
        lng = all.reduce((s, c) => s + c[0], 0) / all.length;
        lat = all.reduce((s, c) => s + c[1], 0) / all.length;
      } else {
        continue;
      }

      if (!inBBox(lat, lng, bbox)) continue;

      const areaDesc: string = props.areaDesc ?? "Warning Area";
      out.push({
        lat,
        lng,
        town: areaDesc.split(";")[0].trim(),
        county: "",
        isoDate: props.effective ?? now.toISOString(),
        maxSizeIn: size,
        severity: sizeToSeverity(size),
        daysAgo: 0,
        source: "NWS_ALERT",
        probSevere: null,
        damage: "Active warning — hail expected",
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? "7")));
  const metro = searchParams.get("metro") ?? "colorado";
  const bbox = metro === "denver" ? DENVER_BBOX : COLORADO_BBOX;

  const now = new Date();
  const ets = now.toISOString().split(".")[0] + "Z";
  const sts = new Date(now.getTime() - days * 86400000).toISOString().split(".")[0] + "Z";

  // Fetch all sources and ancillary data in parallel — failures return safe defaults
  const [swdiEvents, iemEvents, cocoEvents, mpingEvents, alertEvents, meshGrid, freezingKm] =
    await Promise.all([
      fetchSWDI(bbox, days),
      fetchIEM(sts, ets, bbox),
      fetchCoCoRaHS(days, bbox),
      fetchMPING(sts, ets, bbox),
      fetchNWSAlerts(bbox),
      fetchMeshGrid(MESH_GEOJSON_URL),
      fetchFreezingLevelKm(),
    ]);

  // Replace "Radar cell XXXX" labels with real neighborhood names from Nominatim
  const geocoded = await geocodeNEXRAD(swdiEvents);
  const namedSwdi = swdiEvents.map((e) => {
    const k = `${Math.floor(e.lat / 0.02) * 0.02}|${Math.floor(e.lng / 0.02) * 0.02}`;
    const geo = geocoded.get(k);
    return geo ? { ...e, town: geo.town, county: geo.county } : e;
  });

  // ── Point-source quality pipeline ─────────────────────────────────────────

  // Step 1: cluster spotter reports within 8 mi + 60 min → eliminates duplicate
  // reports of the same storm cell (the "4 different 4-inch hail" problem)
  const dedupedPoints = dedupePointSources([...iemEvents, ...cocoEvents, ...mpingEvents]);

  // Step 2: MESH cross-validation — cap spotter sizes that radar doesn't support.
  // Only applied to today's events; MESH_Max_1440min rolls off older dates.
  const validatedPoints = dedupedPoints.map((e) => {
    if (e.daysAgo > 0 || !meshGrid) return e;
    const sev = meshSevAt(e.lat, e.lng, meshGrid);
    const cap = MESH_BAND_CAP[sev];
    if (cap && e.maxSizeIn > cap) {
      return { ...e, maxSizeIn: cap, severity: sizeToSeverity(cap) };
    }
    // Radar shows no hail here but spotter says > 1.5" — apply conservative floor
    if (sev === 0 && e.maxSizeIn > 1.5) {
      return { ...e, maxSizeIn: 1.0, severity: sizeToSeverity(1.0) };
    }
    return e;
  });

  // Step 3: melt correction — adjust surface size for the freezing level altitude.
  // Higher freezing level = more melt = smaller actual hailstone at ground level.
  const correctedPoints = validatedPoints.map((e) => {
    const corrected = meltCorrect(e.maxSizeIn, freezingKm);
    return corrected < e.maxSizeIn
      ? { ...e, maxSizeIn: corrected, severity: sizeToSeverity(corrected) }
      : e;
  });

  // ── Merge sources ──────────────────────────────────────────────────────────

  const combined = [...namedSwdi];
  for (const pt of correctedPoints) {
    const ptDay = pt.isoDate.slice(0, 10);
    const covered = namedSwdi.some((s) => {
      if (s.isoDate.slice(0, 10) !== ptDay) return false;
      return Math.abs(s.lat - pt.lat) < 0.03 && Math.abs(s.lng - pt.lng) < 0.03;
    });
    if (!covered) combined.push(pt);
  }
  // NWS alerts are real-time warning polygons — not confirmed observations, so skip proximity dedup
  combined.push(...alertEvents);

  const seen = new Set<string>();
  const events = combined
    .filter((e) => {
      const key = `${e.lat.toFixed(3)}|${e.lng.toFixed(3)}|${e.isoDate.slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime())
    .slice(0, 400)
    .map((e, i) => ({ ...e, id: i + 1 }));

  const largest = events.reduce(
    (max: (typeof events)[number] | null, e) => (e.maxSizeIn > (max?.maxSizeIn ?? 0) ? e : max),
    null
  );

  return NextResponse.json({
    events,
    largest,
    freezingLevelKm: freezingKm,
    source: "NOAA NEXRAD (SWDI) + NWS LSR + CoCoRaHS + mPING + NWS Alerts",
    sourceCounts: {
      radar: events.filter((e) => e.source === "NEXRAD").length,
      spotterReports: events.filter((e) => e.source === "LSR").length,
      cocorahs: events.filter((e) => e.source === "CoCoRaHS").length,
      mping: events.filter((e) => e.source === "mPING").length,
      alerts: events.filter((e) => e.source === "NWS_ALERT").length,
    },
    dateRange: { from: sts, to: ets, days },
  });
}
