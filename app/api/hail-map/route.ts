import { NextResponse } from "next/server";

interface IEMFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    magnitude: number;
    city: string;
    county: string;
    valid: string;
    wfo: string;
    remark?: string;
  };
}

function sizeToSeverity(sizeIn: number) {
  if (sizeIn >= 2.0) return "extreme";
  if (sizeIn >= 1.5) return "severe";
  if (sizeIn >= 1.0) return "moderate";
  return "minor";
}

export async function GET() {
  const now = new Date();
  const ets = now.toISOString().split(".")[0] + "Z";
  const sts = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split(".")[0] + "Z";

  // Colorado NWS forecast offices
  const wfos = ["BOU", "PUB", "GJT", "CYS"];

  const allFeatures: IEMFeature[] = [];

  await Promise.allSettled(
    wfos.map(async (wfo) => {
      const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?type=H&sts=${sts}&ets=${ets}&wfo=${wfo}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return;
      const data = await res.json();
      allFeatures.push(...(data.features ?? []));
    })
  );

  const seen = new Set<string>();
  const events = allFeatures
    .filter((f) => f.properties.magnitude >= 0.5)
    .map((f, i) => {
      const date = new Date(f.properties.valid);
      return {
        id: i + 1,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        city: `${f.properties.city}, ${f.properties.county} Co.`,
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isoDate: f.properties.valid,
        maxSizeIn: f.properties.magnitude,
        severity: sizeToSeverity(f.properties.magnitude),
      };
    })
    .filter((e) => {
      // deduplicate near-identical events (same city + date + size)
      const key = `${e.city}|${e.date}|${e.maxSizeIn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime())
    .slice(0, 60);

  const largest = events.reduce((max, e) => (e.maxSizeIn > (max?.maxSizeIn ?? 0) ? e : max), events[0] ?? null);

  return NextResponse.json({ events, largest, source: "NOAA Local Storm Reports via IEM" });
}
