#!/usr/bin/env python3
"""
Download recent NEXRAD Level-II files from the NOAA public S3 bucket, process
dual-polarization fields (Z, ZDR, CC), and output confirmed hail detections as
GeoJSON.

This is what separates commercial services like HailPoint from IEM spotter data:
  - Reflectivity (Z) > 45 dBZ at the storm top → large convective updraft
  - Differential Reflectivity (ZDR) < 2 dB   → tumbling hail (not oriented raindrops)
  - Correlation Coefficient (CC) < 0.97        → mixed-phase hydrometeors (hail + rain)

All three together = high-confidence hail signature.

Usage:
    pip install arm-pyart numpy shapely
    python scripts/nexrad_dualpol.py [--hours 2] [--out out/dualpol-hail.json]

Output: GeoJSON FeatureCollection of hail centroid points with properties:
    radar_id, validTime, z_max_dbz, zdr_min_db, cc_min, est_size_in, confidence
"""

import argparse
import gzip
import io
import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np

try:
    import pyart
    PYART_OK = True
except ImportError:
    PYART_OK = False
    print("arm-pyart not installed — run: pip install arm-pyart", file=sys.stderr)

try:
    from shapely.geometry import mapping, MultiPoint
    from shapely.ops import unary_union
    SHAPELY_OK = True
except ImportError:
    SHAPELY_OK = False

# WSR-88D sites that cover Colorado
CO_RADARS = [
    "KBOU",  # Denver / Boulder (primary)
    "KPUX",  # Pueblo
    "KGJX",  # Grand Junction
    "KCYS",  # Cheyenne (covers NE CO)
    "KFTG",  # Denver East (Front Range backup)
]

NEXRAD_S3 = "https://noaa-nexrad-level2.s3.amazonaws.com"
NEXRAD_S3_LIST = "https://noaa-nexrad-level2.s3.amazonaws.com/?delimiter=/&prefix={prefix}"

# Dual-pol hail thresholds (well-established in operational meteorology)
Z_THRESHOLD   = 45.0   # dBZ  — convective core with hail potential
ZDR_THRESHOLD =  2.0   # dB   — tumbling / irregular hydrometeors
CC_THRESHOLD  =  0.97  # —    — mixed-phase region (hail + melting)

# Grid resolution for clustering nearby detections (~1 km)
CLUSTER_DEG = 0.01


def list_s3_keys(prefix: str) -> list[str]:
    """List S3 keys under a given prefix using the XML listing API (no credentials needed)."""
    url = NEXRAD_S3_LIST.format(prefix=prefix)
    try:
        resp = urllib.request.urlopen(url, timeout=30).read().decode()
        return re.findall(r"<Key>([^<]+)</Key>", resp)
    except Exception as e:
        print(f"  S3 list error for {prefix}: {e}", file=sys.stderr)
        return []


def latest_level2_key(radar_id: str, dt: datetime) -> Optional[str]:
    """Return the S3 key of the most recent Level-II file for the given radar and UTC date."""
    prefix = f"{dt.year}/{dt.month:02d}/{dt.day:02d}/{radar_id}/"
    keys = list_s3_keys(prefix)
    # Filter to real-time scan files (V06 format, no MDM/SDM auxiliary files)
    scan_keys = [k for k in keys if re.search(r"_V0[68]$", k)]
    return scan_keys[-1] if scan_keys else None


def download_level2(key: str) -> Optional[bytes]:
    url = f"{NEXRAD_S3}/{key}"
    print(f"  Downloading {url}", file=sys.stderr)
    try:
        return urllib.request.urlopen(url, timeout=120).read()
    except Exception as e:
        print(f"  Download error: {e}", file=sys.stderr)
        return None


def detect_hail_in_scan(data: bytes, radar_id: str) -> list[dict]:
    """
    Process one Level-II file and return a list of hail detection dicts.
    Each dict: {lat, lng, z_max_dbz, zdr_min_db, cc_min, valid_time, radar_id}
    """
    if not PYART_OK:
        return []

    with tempfile.NamedTemporaryFile(suffix=".ar2v", delete=False) as f:
        f.write(data)
        tmp_path = f.name

    try:
        radar = pyart.io.read_nexrad_archive(tmp_path)
    except Exception as e:
        print(f"  Parse error ({radar_id}): {e}", file=sys.stderr)
        os.unlink(tmp_path)
        return []
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # Collect available dual-pol field names (vary by VCP/volume coverage pattern)
    avail = set(radar.fields.keys())
    z_key   = next((k for k in ["reflectivity", "REF"] if k in avail), None)
    zdr_key = next((k for k in ["differential_reflectivity", "ZDR"] if k in avail), None)
    cc_key  = next((k for k in ["cross_correlation_ratio", "RHO"] if k in avail), None)

    if not z_key:
        print(f"  {radar_id}: reflectivity field not found in {avail}", file=sys.stderr)
        return []

    valid_time = datetime.utcfromtimestamp(radar.time["data"][0]).replace(tzinfo=timezone.utc)

    detections = []

    # Process each elevation sweep
    for sweep_idx in range(radar.nsweeps):
        try:
            sweep = radar.extract_sweeps([sweep_idx])
        except Exception:
            continue

        z   = sweep.fields[z_key]["data"]
        zdr = sweep.fields[zdr_key]["data"] if zdr_key else None
        cc  = sweep.fields[cc_key]["data"]  if cc_key  else None

        # Build hail mask: high Z is required; dual-pol fields refine if available
        mask = np.ma.filled(z, 0) >= Z_THRESHOLD
        if zdr is not None:
            mask &= np.ma.filled(zdr, 99) < ZDR_THRESHOLD
        if cc is not None:
            mask &= np.ma.filled(cc, 1.0) < CC_THRESHOLD

        if not mask.any():
            continue

        # Convert polar coords to lat/lng
        gate_lats, gate_lons, _ = radar.get_gate_lat_lon_alt(sweep_idx)
        hit_lats  = gate_lats[mask]
        hit_lons  = gate_lons[mask]
        hit_z     = np.ma.filled(z, 0)[mask]
        hit_zdr   = np.ma.filled(zdr, 99)[mask] if zdr is not None else np.full(hit_z.shape, np.nan)
        hit_cc    = np.ma.filled(cc, 1.0)[mask] if cc is not None else np.full(hit_z.shape, np.nan)

        # Cluster into ~1km grid cells; keep max Z per cell
        grid: dict[tuple, dict] = {}
        for la, lo, zv, zdrv, ccv in zip(hit_lats, hit_lons, hit_z, hit_zdr, hit_cc):
            k = (round(float(la) / CLUSTER_DEG) * CLUSTER_DEG,
                 round(float(lo) / CLUSTER_DEG) * CLUSTER_DEG)
            cur = grid.get(k)
            if cur is None or float(zv) > cur["z"]:
                grid[k] = {"lat": float(la), "lng": float(lo),
                            "z": float(zv), "zdr": float(zdrv), "cc": float(ccv)}

        detections.extend(
            {**v, "valid_time": valid_time.isoformat(), "radar_id": radar_id}
            for v in grid.values()
        )

    return detections


def estimate_size(z_dbz: float) -> float:
    """
    Rough empirical hail diameter estimate from Z (in dBZ).
    Based on Waldvogel et al. (1979) and NEXRAD operational guidelines.
    This is intentionally conservative — dual-pol context already filters out rain.
    """
    if z_dbz >= 65: return 2.0
    if z_dbz >= 55: return 1.5
    if z_dbz >= 50: return 1.0
    if z_dbz >= 45: return 0.75
    return 0.5


def confidence(has_zdr: bool, has_cc: bool) -> str:
    if has_zdr and has_cc:  return "high"    # full dual-pol confirmation
    if has_zdr or has_cc:   return "medium"  # partial dual-pol
    return "low"                              # Z only


def main():
    parser = argparse.ArgumentParser(description="NEXRAD dual-pol hail detector")
    parser.add_argument("--hours", type=int, default=2,
                        help="Look back this many hours (default: 2)")
    parser.add_argument("--out", default="out/dualpol-hail.json",
                        help="Output GeoJSON path")
    args = parser.parse_args()

    if not PYART_OK:
        sys.exit(1)

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=args.hours)

    all_detections: list[dict] = []

    for radar_id in CO_RADARS:
        print(f"\n{radar_id}:", file=sys.stderr)
        # Check today and (if look-back crosses midnight) yesterday
        dates = {now.date()}
        if cutoff.date() < now.date():
            dates.add(cutoff.date())

        for d in sorted(dates, reverse=True):
            key = latest_level2_key(radar_id, datetime(d.year, d.month, d.day))
            if not key:
                print(f"  No Level-II files found for {d}", file=sys.stderr)
                continue
            data = download_level2(key)
            if not data:
                continue
            hits = detect_hail_in_scan(data, radar_id)
            print(f"  {len(hits)} hail gates detected", file=sys.stderr)
            all_detections.extend(hits)

    # Merge overlapping detections across radars: keep max Z in each grid cell
    merged: dict[tuple, dict] = {}
    for d in all_detections:
        k = (round(d["lat"] / CLUSTER_DEG) * CLUSTER_DEG,
             round(d["lng"] / CLUSTER_DEG) * CLUSTER_DEG)
        cur = merged.get(k)
        if cur is None or d["z"] > cur["z"]:
            merged[k] = d

    features = []
    for d in merged.values():
        has_zdr = not np.isnan(d["zdr"])
        has_cc  = not np.isnan(d["cc"])
        est_in  = estimate_size(d["z"])
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(d["lng"], 4), round(d["lat"], 4)]},
            "properties": {
                "radar_id":   d["radar_id"],
                "validTime":  d["valid_time"],
                "z_max_dbz":  round(d["z"], 1),
                "zdr_min_db": round(d["zdr"], 2) if has_zdr else None,
                "cc_min":     round(d["cc"], 3)  if has_cc  else None,
                "est_size_in": est_in,
                "confidence": confidence(has_zdr, has_cc),
            },
        })

    out = {
        "type": "FeatureCollection",
        "generated": now.isoformat(),
        "lookbackHours": args.hours,
        "radarCount": len(CO_RADARS),
        "features": features,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"\nWrote {len(features)} dual-pol hail detections → {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
