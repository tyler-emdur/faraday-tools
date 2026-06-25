#!/usr/bin/env python3
"""
Pull the latest NOAA MRMS MESH_Max_1440min product (24-hour maximum estimated
hail size, gridded ~1km nationwide), clip it to Colorado, and polygonize it into
hail-size "swath" bands as GeoJSON. This is the same class of gridded radar data
the commercial hail-map services sell — it's free from NOAA.

Output: out/mesh-colorado.json (a GeoJSON FeatureCollection of severity bands).
"""
import gzip
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

import numpy as np
import pygrib
from rasterio.transform import from_origin
from rasterio.features import shapes
from shapely.geometry import shape, mapping

BASE = "https://mrms.ncep.noaa.gov/2D/MESH_Max_1440min/"
# Colorado bounds (lon in standard -180..180)
CO = dict(min_lat=36.95, max_lat=41.05, min_lon=-109.06, max_lon=-102.04)

# inches -> severity class. 0 is dropped.
BANDS = [
    (0.75, 1.00, 1, "0.75–1\""),
    (1.00, 1.50, 2, "1–1.5\""),
    (1.50, 2.00, 3, "1.5–2\""),
    (2.00, 99.0, 4, "≥2\""),
]


def latest_file_url():
    html = urllib.request.urlopen(BASE, timeout=60).read().decode("utf-8", "ignore")
    files = sorted(set(re.findall(r"MRMS_MESH_Max_1440min_[^\"']+\.grib2\.gz", html)))
    if not files:
        raise RuntimeError("No MESH files found at " + BASE)
    return BASE + files[-1], files[-1]


def parse_valid_time(name: str) -> str:
    m = re.search(r"(\d{8})-(\d{6})", name)
    if not m:
        return ""
    dt = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    return dt.isoformat()


def classify(inches: np.ndarray) -> np.ndarray:
    out = np.zeros(inches.shape, dtype=np.int32)
    for lo, hi, cls, _ in BANDS:
        out[(inches >= lo) & (inches < hi)] = cls
    return out


def main():
    url, name = latest_file_url()
    print(f"Downloading {url}", file=sys.stderr)
    raw = urllib.request.urlopen(url, timeout=180).read()
    grib_bytes = gzip.decompress(raw)
    with open("/tmp/mesh.grib2", "wb") as f:
        f.write(grib_bytes)

    grbs = pygrib.open("/tmp/mesh.grib2")
    grb = grbs[1]

    # MRMS lons are 0..360; CO is ~251..258 in that convention.
    data, lats, lons = grb.data(
        lat1=CO["min_lat"], lat2=CO["max_lat"],
        lon1=CO["min_lon"] + 360, lon2=CO["max_lon"] + 360,
    )
    data = np.asarray(data, dtype=float)
    lats = np.asarray(lats, dtype=float)
    lons = np.asarray(lons, dtype=float)
    lons = np.where(lons > 180, lons - 360, lons)

    # Ensure row 0 = north (descending latitude) for a clean north-up transform.
    if lats[0, 0] < lats[-1, 0]:
        data = np.flipud(data); lats = np.flipud(lats); lons = np.flipud(lons)

    # MESH is in mm; negatives are missing / no-coverage.
    data = np.where(data < 0, 0.0, data)
    inches = data / 25.4
    sev = classify(inches)

    dx = abs(float(lons[0, 1] - lons[0, 0]))
    dy = abs(float(lats[0, 0] - lats[1, 0]))
    west = float(lons[0, 0]) - dx / 2
    north = float(lats[0, 0]) + dy / 2
    transform = from_origin(west, north, dx, dy)

    features = []
    label_for = {cls: lbl for _, _, cls, lbl in BANDS}
    for geom, val in shapes(sev.astype(np.int32), mask=sev > 0, transform=transform, connectivity=8):
        cls = int(val)
        poly = shape(geom).simplify(0.008, preserve_topology=True)
        if poly.is_empty or poly.area < 1e-5:
            continue
        # round coords to keep the file small
        def r(coords):
            return [[round(x, 4), round(y, 4)] for x, y in coords]
        g = mapping(poly)
        if g["type"] == "Polygon":
            g["coordinates"] = [r(ring) for ring in g["coordinates"]]
        elif g["type"] == "MultiPolygon":
            g["coordinates"] = [[r(ring) for ring in p] for p in g["coordinates"]]
        features.append({
            "type": "Feature",
            "properties": {"sev": cls, "label": label_for[cls]},
            "geometry": g,
        })

    max_in = round(float(inches.max()), 2) if inches.size else 0.0
    out = {
        "type": "FeatureCollection",
        "generated": datetime.now(timezone.utc).isoformat(),
        "validTime": parse_valid_time(name),
        "source": "NOAA MRMS MESH_Max_1440min (24-hr max estimated hail size)",
        "maxInch": max_in,
        "features": features,
    }
    os.makedirs("out", exist_ok=True)
    with open("out/mesh-colorado.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(features)} bands, max {max_in}\" valid {out['validTime']}", file=sys.stderr)


if __name__ == "__main__":
    main()
