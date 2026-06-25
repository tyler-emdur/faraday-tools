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

  // Each source is independent and returns [] on any failure — one bad feed
  // can never break the map.
  const [swdiEvents, iemEvents, cocoEvents, mpingEvents, alertEvents] = await Promise.all([
    fetchSWDI(bbox, days),
    fetchIEM(sts, ets, bbox),
    fetchCoCoRaHS(days, bbox),
    fetchMPING(sts, ets, bbox),
    fetchNWSAlerts(bbox),
  ]);

  // Replace "Radar cell XXXX" labels with real neighborhood names from Nominatim
  const geocoded = await geocodeNEXRAD(swdiEvents);
  const namedSwdi = swdiEvents.map((e) => {
    const k = `${Math.floor(e.lat / 0.02) * 0.02}|${Math.floor(e.lng / 0.02) * 0.02}`;
    const geo = geocoded.get(k);
    return geo ? { ...e, town: geo.town, county: geo.county } : e;
  });

  // Merge; dedupe each point source against radar on same-day + proximity (~3 km)
  const combined = [...namedSwdi];
  for (const pt of [...iemEvents, ...cocoEvents, ...mpingEvents]) {
    const ptDay = pt.isoDate.slice(0, 10);
    const covered = namedSwdi.some((s) => {
      if (s.isoDate.slice(0, 10) !== ptDay) return false;
      return Math.abs(s.lat - pt.lat) < 0.03 && Math.abs(s.lng - pt.lng) < 0.03;
    });
    if (!covered) combined.push(pt);
  }
  // NWS alerts are real-time warning polygons — not confirmed observations, so skip proximity dedup
  combined.push(...alertEvents);

  // Dedupe exact-ish duplicates (same spot, same day)
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
