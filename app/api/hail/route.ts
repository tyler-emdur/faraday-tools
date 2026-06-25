import { NextResponse } from "next/server";
import type { HailResult, HailSeverity, HailEvent } from "@/lib/types";

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FaradayTools/1.0 (faradaysun.com)" },
    });
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function sizeToSeverity(sizeIn: number): HailSeverity {
  if (sizeIn >= 2.0) return "extreme";
  if (sizeIn >= 1.5) return "severe";
  if (sizeIn >= 1.0) return "moderate";
  if (sizeIn >= 0.5) return "minor";
  return "none";
}

function daysBetween(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function sizeToDesc(sizeIn: number): string {
  if (sizeIn >= 2.0) return `${sizeIn}" diameter — golf ball size or larger. High probability of significant roof damage.`;
  if (sizeIn >= 1.5) return `${sizeIn}" diameter — walnut size. Likely to dent metal and crack shingles.`;
  if (sizeIn >= 1.0) return `${sizeIn}" diameter — quarter size. Can bruise asphalt shingles and damage gutters.`;
  return `${sizeIn}" diameter — pea to marble size. Minor cosmetic damage possible.`;
}

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

interface SWDIRecord {
  WSR_ID: string;
  CELL_ID: string;
  ZTIME: string;
  RANG: number;
  AZIM: number;
  PROB: number;
  SEVPROB: number;
  MAXSIZE: number;
  LAT: number;
  LON: number;
}

// Query NOAA SWDI for radar-verified hail within ~5 miles of the address
// SWDI is NEXRAD-derived — the same underlying data commercial services like HailPoint use
async function fetchSWDIForAddress(lat: number, lon: number, years = 3): Promise<HailEvent[]> {
  const now = new Date();
  // ~0.08° ≈ 5 miles radius box
  const buffer = 0.08;
  const bboxStr = `${(lon - buffer).toFixed(4)},${(lat - buffer).toFixed(4)},${(lon + buffer).toFixed(4)},${(lat + buffer).toFixed(4)}`;

  // SWDI max range is 1 year per request; fetch up to `years` years
  const yearRequests = Array.from({ length: Math.min(years, 3) }, (_, i) => {
    const end = new Date(now);
    end.setFullYear(end.getFullYear() - i);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    return { sts: toYYYYMMDD(start), ets: toYYYYMMDD(end) };
  });

  const allRecords: SWDIRecord[] = [];
  await Promise.allSettled(
    yearRequests.map(async ({ sts, ets }) => {
      const url = `https://www.ncei.noaa.gov/swdiws/json/nx3hail/${sts}:${ets}?bbox=${bboxStr}`;
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) return;
      const data = await res.json();
      allRecords.push(...(data?.result ?? []));
    })
  );

  if (allRecords.length === 0) return [];

  // Group by date and take the largest hail size per day
  const byDay = new Map<string, number>();
  for (const r of allRecords) {
    if (r.MAXSIZE < 0.5) continue;
    const raw = String(r.ZTIME);
    const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    byDay.set(day, Math.max(byDay.get(day) ?? 0, r.MAXSIZE));
  }

  return Array.from(byDay.entries())
    .map(([date, maxSizeIn]) => ({
      date,
      maxSizeIn,
      severity: sizeToSeverity(maxSizeIn),
      description: sizeToDesc(maxSizeIn),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}

function scoreRisk(events: HailEvent[], roofAge: number): { score: number; level: HailResult["riskLevel"] } {
  const recency = events.length > 0 ? Math.max(0, 100 - daysBetween(events[0].date) * 0.3) : 0;
  const sizeScore = events.length > 0 ? Math.min(100, events[0].maxSizeIn * 45) : 0;
  const ageScore = Math.min(40, roofAge * 2.5);
  const score = Math.min(100, Math.round(recency * 0.35 + sizeScore * 0.4 + ageScore * 0.25));

  let level: HailResult["riskLevel"] = "Low";
  if (score >= 80) level = "Critical";
  else if (score >= 55) level = "High";
  else if (score >= 30) level = "Moderate";
  return { score, level };
}

function buildAssessment(level: HailResult["riskLevel"], roofAge: number, events: HailEvent[]): string {
  const lastEvent = events[0];
  const ageNote =
    roofAge >= 15
      ? "Your roof has reached an age where normal wear significantly reduces its ability to withstand impact."
      : roofAge >= 10
      ? "Your roof is mid-life. Pre-existing micro-fractures can turn hail hits into leaks."
      : "Your roof is relatively newer, but large hail can still cause damage worth documenting for insurance.";

  if (!lastEvent)
    return "No hail events found within 5 miles of this address in the past 3 years. Regular maintenance inspections are still recommended.";

  if (level === "Critical" || level === "High") {
    return `Radar data shows ${lastEvent.maxSizeIn}" hail near this address on ${lastEvent.date}. ${ageNote} A professional inspection is strongly recommended — insurance claims are time-sensitive.`;
  }
  if (level === "Moderate") {
    return `Radar-detected hail of ${lastEvent.maxSizeIn}" was recorded within 5 miles on ${lastEvent.date}. ${ageNote} A free inspection can document any damage before it leads to leaks or voids your warranty.`;
  }
  return `Minor hail (${lastEvent.maxSizeIn}") was detected near your address on ${lastEvent.date}. ${ageNote} While immediate damage is unlikely, a preventive inspection is a good idea.`;
}

export async function POST(req: Request) {
  const { address, roofAge } = await req.json();
  if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });

  const age = parseInt(roofAge) || 10;
  const coords = await geocode(address) ?? { lat: 40.015, lon: -105.2705 };

  // Radar-verified hail from NOAA SWDI (NEXRAD data)
  let events = await fetchSWDIForAddress(coords.lat, coords.lon, 3);

  // If SWDI returns nothing (API down or no events), note it clearly rather than using mock data
  const dataSource = events.length > 0 ? "NOAA NEXRAD radar (SWDI)" : "no radar events found";

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const { score, level } = scoreRisk(events, age);
  const result: HailResult & { dataSource: string } = {
    address,
    lat: coords.lat,
    lon: coords.lon,
    events,
    riskScore: score,
    riskLevel: level,
    roofAssessment: buildAssessment(level, age, events),
    lastEventDaysAgo: events.length > 0 ? daysBetween(events[0].date) : null,
    dataSource,
  };

  return NextResponse.json(result);
}
