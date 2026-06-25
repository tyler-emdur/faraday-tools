#!/usr/bin/env python3
"""
Pull NOAA MRMS MESH products, clip to Colorado, and polygonize into hail-size
swath bands as GeoJSON.

Produces two outputs:
  out/mesh-colorado.json  — MESH_Max_1440min (24-hr max); bias-corrected toward
                            ground truth (same class of data commercial services sell)
  out/mesh-nowcast.json   — MESH_Max_60min  (1-hr max); near-real-time, no bias
                            correction (updated every 30 min by the GitHub Action)
"""
import gzip
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

BASE = "https://mrms.ncep.noaa.gov/2D/"
CO = dict(min_lat=36.95, max_lat=41.05, min_lon=-109.06, max_lon=-102.04)

# MRMS MESH over-estimates vs ground truth; nudge toward observed sizes.
# 0.85 is conservative — keeps big events visible while reducing phantom 4" reports.
MESH_BIAS = float(os.environ.get("MESH_BIAS", "0.85"))

BANDS = [
    (0.75, 1.00, 1, "0.75–1\""),
    (1.00, 1.50, 2, "1–1.5\""),
    (1.50, 2.00, 3, "1.5–2\""),
    (2.00, 99.0, 4, "≥2\""),
]


def latest_file_url(product: str) -> tuple[str, str]:
    url = f"{BASE}{product}/"
    html = urllib.request.urlopen(url, timeout=60).read().decode("utf-8", "ignore")
    pattern = rf"MRMS_{re.escape(product)}_[^\"']+\.grib2\.gz"
    files = sorted(set(re.findall(pattern, html)))
    if not files:
        raise RuntimeError(f"No files found for product {product} at {url}")
    return url + files[-1], files[-1]


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


def round_ring(coords):
    return [[round(x, 4), round(y, 4)] for x, y in coords]


def process_product(product: str, output_path: str, bias: float = 1.0) -> None:
    """Download, process, and write one MRMS MESH product to output_path."""
    url, name = latest_file_url(product)
    print(f"[{product}] Downloading {url}", file=sys.stderr)
    raw = urllib.request.urlopen(url, timeout=180).read()
    grib_bytes = gzip.decompress(raw)

    tmp = f"/tmp/mesh_{product}.grib2"
    with open(tmp, "wb") as f:
        f.write(grib_bytes)

    grbs = pygrib.open(tmp)
    grb = grbs[1]

    # MRMS lons are 0..360; CO sits at ~251..258 in that convention.
    data, lats, lons = grb.data(
        lat1=CO["min_lat"], lat2=CO["max_lat"],
        lon1=CO["min_lon"] + 360, lon2=CO["max_lon"] + 360,
    )
    data = np.asarray(data, dtype=float)
    lats = np.asarray(lats, dtype=float)
    lons = np.asarray(lons, dtype=float)
    lons = np.where(lons > 180, lons - 360, lons)

    # Ensure row 0 = north for a correct north-up raster transform.
    if lats[0, 0] < lats[-1, 0]:
        data = np.flipud(data)
        lats = np.flipud(lats)
        lons = np.flipud(lons)

    # MESH is in mm; negatives are missing / no-coverage.
    data = np.where(data < 0, 0.0, data)
    inches_raw = data / 25.4
    inches = inches_raw * bias
    sev = classify(inches)

    dx = abs(float(lons[0, 1] - lons[0, 0]))
    dy = abs(float(lats[0, 0] - lats[1, 0]))
    west = float(lons[0, 0]) - dx / 2
    north = float(lats[0, 0]) + dy / 2
    transform = from_origin(west, north, dx, dy)

    label_for = {cls: lbl for _, _, cls, lbl in BANDS}
    features = []
    for geom_dict, val in shapes(sev.astype(np.int32), mask=sev > 0, transform=transform, connectivity=8):
        cls = int(val)
        poly = shape(geom_dict).simplify(0.008, preserve_topology=True)
        if poly.is_empty or poly.area < 1e-5:
            continue
        g = mapping(poly)
        if g["type"] == "Polygon":
            g = {**g, "coordinates": [round_ring(ring) for ring in g["coordinates"]]}
        elif g["type"] == "MultiPolygon":
            g = {**g, "coordinates": [[round_ring(ring) for ring in p] for p in g["coordinates"]]}
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
        "product": product,
        "bias": bias,
        "maxInch": max_in,
        "features": features,
    }
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(
        f"[{product}] Wrote {len(features)} bands, max {max_in}\" valid {out['validTime']}",
        file=sys.stderr,
    )


def main():
    errors = []

    # 24-hour max — bias-corrected reference layer
    try:
        process_product("MESH_Max_1440min", "out/mesh-colorado.json", bias=MESH_BIAS)
    except Exception as e:
        print(f"[MESH_Max_1440min] FAILED: {e}", file=sys.stderr)
        errors.append(e)

    # 1-hour max — near-real-time nowcast layer (no bias correction; fresher data)
    try:
        process_product("MESH_Max_60min", "out/mesh-nowcast.json", bias=1.0)
    except Exception as e:
        print(f"[MESH_Max_60min] FAILED: {e}", file=sys.stderr)
        errors.append(e)

    if len(errors) == 2:
        raise errors[0]


if __name__ == "__main__":
    main()
