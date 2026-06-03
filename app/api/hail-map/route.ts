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

// Denver metro bounding box
const DENVER_BBOX = { minLat: 39.45, maxLat: 40.15, minLng: -105.35, maxLng: -104.55 };

function sizeToSeverity(sizeIn: number) {
  if (sizeIn >= 2.0) return "extreme";
  if (sizeIn >= 1.5) return "severe";
  if (sizeIn >= 1.0) return "moderate";
  return "minor";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? "7")));
  const metro = searchParams.get("metro") ?? "denver";

  const now = new Date();
  const ets = now.toISOString().split(".")[0] + "Z";
  const sts = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split(".")[0] + "Z";

  // BOU = Denver/Boulder/Northern Front Range. Full CO view adds PUB, GJT, CYS.
  const wfos = metro === "denver" ? ["BOU"] : ["BOU", "PUB", "GJT", "CYS"];

  const allFeatures: IEMFeature[] = [];
  await Promise.allSettled(
    wfos.map(async (wfo) => {
      const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?type=H&sts=${sts}&ets=${ets}&wfo=${wfo}`;
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) return;
      const data = await res.json();
      allFeatures.push(...(data.features ?? []));
    })
  );

  const seen = new Set<string>();
  const bbox = metro === "denver" ? DENVER_BBOX : null;

  const events = allFeatures
    .filter((f) => {
      if (f.properties.magnitude < 0.5) return false;
      if (bbox) {
        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        if (lat < bbox.minLat || lat > bbox.maxLat || lng < bbox.minLng || lng > bbox.maxLng) return false;
      }
      return true;
    })
    .map((f) => {
      const date = new Date(f.properties.valid);
      const daysAgo = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
      return {
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        city: `${f.properties.city}, ${f.properties.county} Co.`,
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isoDate: f.properties.valid,
        maxSizeIn: f.properties.magnitude,
        severity: sizeToSeverity(f.properties.magnitude),
        daysAgo,
      };
    })
    .filter((e) => {
      const key = `${e.city}|${e.date}|${e.maxSizeIn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime())
    .slice(0, 100)
    .map((e, i) => ({ ...e, id: i + 1 }));

  const largest = events.reduce(
    (max: (typeof events)[0] | null, e) => (e.maxSizeIn > (max?.maxSizeIn ?? 0) ? e : max),
    null
  );

  return NextResponse.json({
    events,
    largest,
    source: "NOAA Local Storm Reports via IEM",
    dateRange: { from: sts, to: ets, days },
  });
}
