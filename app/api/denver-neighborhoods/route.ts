import { NextResponse } from "next/server";

// Opportunity scores based on neighborhood home age and average roof size.
// opportunityScore: 1–10. Higher = older homes with larger footprints = better canvassing yield.
const NEIGHBORHOOD_OPPORTUNITY: Record<string, {
  opportunityScore: number;
  medianBuildYear: number;
  avgSqFt: number;
  notes: string;
}> = {
  "CHERRY HILLS VILLAGE": { opportunityScore: 9, medianBuildYear: 1958, avgSqFt: 3800, notes: "Estate homes — very high claim value" },
  "UNIVERSITY HILLS":     { opportunityScore: 9, medianBuildYear: 1958, avgSqFt: 2200, notes: "1950s–60s large ranch homes" },
  "BELCARO":              { opportunityScore: 9, medianBuildYear: 1950, avgSqFt: 3000, notes: "Upscale 1940s–50s large homes" },
  "HILLTOP":              { opportunityScore: 9, medianBuildYear: 1945, avgSqFt: 2800, notes: "1930s–50s estate homes, aging roofs" },
  "WASHINGTON PARK":      { opportunityScore: 8, medianBuildYear: 1930, avgSqFt: 1900, notes: "1920s–50s homes, high-value area" },
  "UNIVERSITY PARK":      { opportunityScore: 8, medianBuildYear: 1952, avgSqFt: 1900, notes: "Mid-century homes near DU" },
  "SOUTH PARK HILL":      { opportunityScore: 8, medianBuildYear: 1938, avgSqFt: 1900, notes: "1920s–40s craftsman and Tudor" },
  "MONTCLAIR":            { opportunityScore: 8, medianBuildYear: 1932, avgSqFt: 1800, notes: "1920s–40s historic homes" },
  "HARVEY PARK SOUTH":    { opportunityScore: 8, medianBuildYear: 1960, avgSqFt: 1650, notes: "1950s–60s ranch homes on large lots" },
  "HARVEY PARK":          { opportunityScore: 8, medianBuildYear: 1956, avgSqFt: 1700, notes: "1950s ranch homes, large lots" },
  "PARK HILL":            { opportunityScore: 8, medianBuildYear: 1935, avgSqFt: 1800, notes: "Historic 1920s–40s homes" },
  "NORTH PARK HILL":      { opportunityScore: 7, medianBuildYear: 1940, avgSqFt: 1600, notes: "1920s–40s bungalows, aging roofs" },
  "HALE":                 { opportunityScore: 7, medianBuildYear: 1950, avgSqFt: 1500, notes: "1940s–50s bungalows and ranches" },
  "VIRGINIA VILLAGE":     { opportunityScore: 7, medianBuildYear: 1955, avgSqFt: 1550, notes: "1950s suburban ranch homes" },
  "CONGRESS PARK":        { opportunityScore: 7, medianBuildYear: 1928, avgSqFt: 1500, notes: "1920s–30s craftsman bungalows" },
  "WASHINGTON PARK WEST": { opportunityScore: 7, medianBuildYear: 1928, avgSqFt: 1600, notes: "1910s–30s bungalows" },
  "PLATTE PARK":          { opportunityScore: 7, medianBuildYear: 1925, avgSqFt: 1400, notes: "1910s–20s older homes" },
  "HAMPDEN HEIGHTS":      { opportunityScore: 6, medianBuildYear: 1968, avgSqFt: 1700, notes: "1960s–70s suburban" },
  "HAMPDEN SOUTH":        { opportunityScore: 6, medianBuildYear: 1972, avgSqFt: 1700, notes: "1970s suburban homes" },
  "BEAR VALLEY":          { opportunityScore: 6, medianBuildYear: 1965, avgSqFt: 1600, notes: "1960s–70s ranch homes" },
  "RUBY HILL":            { opportunityScore: 6, medianBuildYear: 1955, avgSqFt: 1400, notes: "1950s smaller ranch homes" },
  "MONTBELLO":            { opportunityScore: 6, medianBuildYear: 1975, avgSqFt: 1600, notes: "1970s–80s suburban" },
  "GREEN VALLEY RANCH":   { opportunityScore: 5, medianBuildYear: 1995, avgSqFt: 2100, notes: "1990s–2000s larger homes" },
  "MARSTON":              { opportunityScore: 6, medianBuildYear: 1988, avgSqFt: 2000, notes: "1980s–90s larger suburban homes" },
  "STAPLETON":            { opportunityScore: 4, medianBuildYear: 2005, avgSqFt: 2200, notes: "2000s new construction (low priority)" },
  "CENTRAL PARK":         { opportunityScore: 4, medianBuildYear: 2008, avgSqFt: 2300, notes: "New construction (low priority)" },
};

function getNeighborhoodData(name: string) {
  const upper = name.toUpperCase();
  // Match longest key first to avoid "HARVEY PARK" matching before "HARVEY PARK SOUTH"
  const keys = Object.keys(NEIGHBORHOOD_OPPORTUNITY).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (upper.includes(key)) return NEIGHBORHOOD_OPPORTUNITY[key];
  }
  return { opportunityScore: 5, medianBuildYear: 1970, avgSqFt: 1650, notes: "Denver residential" };
}

export async function GET() {
  try {
    const res = await fetch(
      "https://www.denvergov.org/media/gis/DataCatalog/statistical_neighborhoods/geojson/statistical_neighborhoods.geojson",
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();
    if (!Array.isArray(geojson.features)) throw new Error("Invalid GeoJSON");

    const enriched = {
      ...geojson,
      features: geojson.features.map((feature: any) => {
        const name: string = feature.properties?.NBHD_NAME || feature.properties?.name || "";
        const data = getNeighborhoodData(name);
        return {
          ...feature,
          properties: { ...feature.properties, name, ...data },
        };
      }),
    };

    return NextResponse.json(enriched, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Neighborhood data unavailable" }, { status: 500 });
  }
}
