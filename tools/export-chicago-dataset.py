#!/usr/bin/env python3
"""
Export three small tables from the Van Doren et al. 2021 McCormick Place dataset.

Source: Mendeley Data, DOI 10.17632/mjvt3yxdkv.2, licensed CC BY 4.0
(see docs/data-sources.md and docs/data-profile.md for how the authors coded the data).

The raw files are large and stay outside the repo. This script reads the extracted files and
writes plain CSV tables that tools/build-replay-nights.ts turns into the committed replay file.

Setup (outside the repo):  python3 -m venv .venv && .venv/bin/pip install pandas openpyxl
Usage:
  python3 tools/export-chicago-dataset.py --raw ~/Documents/Development/layover-data/raw/extracted/data/final_analysis \
      --radar ~/Documents/Development/layover-data/raw/radar/data_2020-12-21_complete.csv \
      --out ~/Documents/Development/layover-data/derived

Output tables:
  collisions_daily.csv  survey_date, total_birds, lit_share
  radar_scans.csv       time_utc, birds_km3
  isd_hourly.csv        time_utc, wind_from_degrees, wind_speed_mps, ceiling_m, visibility_km

Assumptions (also recorded in the committed file):
  - A window bay counts as lit only for lighting code YN. QN is left out of the share.
  - Radar: local bird density within 32 km, all land and lake, scans where at most half of the
    area was masked as weather.
  - Weather: Chicago Midway hourly routine reports (FM-15) with passing quality codes.
"""
import argparse
import glob
from pathlib import Path

import pandas as pd

GOOD_QUALITY = {"0", "1", "4", "5"}
MAX_WEATHER_MASK = 0.5
RADAR_RADIUS_KM = 32
FIRST_YEAR = 2000
ISD_COLUMNS = {
    "date": (15, 23),
    "time": (23, 27),
    "type_code": (41, 46),
    "wind_direction": (60, 63),
    "wind_direction_quality": (63, 64),
    "wind_speed": (65, 69),
    "wind_speed_quality": (69, 70),
    "ceiling_height": (70, 75),
    "ceiling_height_quality": (75, 76),
    "visibility_distance": (78, 84),
    "visibility_distance_quality": (84, 85),
}


def window_weights(raw: Path) -> dict:
    meta = pd.read_excel(raw / "collisions" / "window_metadata.xlsx")
    meta = meta[~meta["window"].isin(["B16", "B17"])]
    return dict(zip(meta["window"], meta["window_length_ft"]))


def lit_flag(code) -> float:
    """1 for YN, missing for QN, otherwise 0 (see docs/data-profile.md)."""
    text = str(code).strip().upper()
    if text == "QN":
        return float("nan")
    return 1.0 if text == "YN" else 0.0


def export_collisions(raw: Path, out: Path) -> None:
    table = pd.read_excel(raw / "collisions" / "MCP_lights_collisions.xlsx", sheet_name="Sheet4")
    table = table.rename(columns={"DATE": "date"})
    table["date"] = pd.to_datetime(table["date"])
    table = table[table["date"] > f"{FIRST_YEAR}-01-01"]
    bird_columns = [c for c in table.columns if str(c).startswith("N")]
    table["total_birds"] = table[bird_columns].apply(pd.to_numeric, errors="coerce").sum(axis=1)
    # Authors' cleaning: one likely entry error, then duplicate dates removed.
    table = table[~((table["date"] == "2000-05-09") & (table["total_birds"] == 14))]
    table = table.drop_duplicates(subset="date", keep=False)
    weights = window_weights(raw)
    lit = pd.DataFrame(index=table.index)
    for window in weights:
        if window == "B16.5":
            lit[window] = table[["L16", "L17"]].apply(lambda row: pd.Series([lit_flag(v) for v in row]).max(), axis=1)
        else:
            lit[window] = table[f"L{window[1:]}"].map(lit_flag)
    weight_series = pd.Series(weights)
    known = lit.notna()
    table["lit_share"] = (lit.fillna(0) * weight_series).sum(axis=1) / (known * weight_series).sum(axis=1)
    result = table[["date", "total_birds", "lit_share"]].rename(columns={"date": "survey_date"})
    result["survey_date"] = result["survey_date"].dt.strftime("%Y-%m-%d")
    result.round({"lit_share": 4}).to_csv(out / "collisions_daily.csv", index=False)
    print(f"collisions_daily.csv: {len(result)} survey days")


def export_radar(radar_file: Path, out: Path) -> None:
    table = pd.read_csv(radar_file)
    table = table[(table["radius"] == RADAR_RADIUS_KM) & (table["coverage"] == "ALL")]
    table = table[table["prop.weather.mask"] <= MAX_WEATHER_MASK]
    times = pd.to_datetime(table["file"].str[4:19], format="%Y%m%d_%H%M%S", utc=True)
    result = pd.DataFrame(
        {"time_utc": times.dt.strftime("%Y-%m-%dT%H:%M:%SZ"), "birds_km3": table["mean.birds.km3"].round(4)}
    ).sort_values("time_utc")
    result.to_csv(out / "radar_scans.csv", index=False)
    print(f"radar_scans.csv: {len(result)} scans")


def read_isd_file(path: str) -> pd.DataFrame:
    spans = list(ISD_COLUMNS.values())
    table = pd.read_fwf(path, colspecs=spans, names=list(ISD_COLUMNS), header=None, dtype=str)
    return table[table["type_code"].str.strip() == "FM-15"]


def clean_isd(table: pd.DataFrame) -> pd.DataFrame:
    def number(column, missing, quality):
        values = pd.to_numeric(table[column], errors="coerce")
        values = values.where(values != missing)
        return values.where(table[quality].isin(GOOD_QUALITY))

    speed = number("wind_speed", 9999, "wind_speed_quality") / 10
    direction = number("wind_direction", 999, "wind_direction_quality")
    direction = direction.where(speed > 0)  # calm wind has no direction
    time = pd.to_datetime(table["date"] + table["time"], format="%Y%m%d%H%M", utc=True)
    return pd.DataFrame(
        {
            "time_utc": time.dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "wind_from_degrees": direction,
            "wind_speed_mps": speed,
            "ceiling_m": number("ceiling_height", 99999, "ceiling_height_quality"),
            "visibility_km": number("visibility_distance", 999999, "visibility_distance_quality") / 1000,
        }
    )


def export_weather(raw: Path, out: Path) -> None:
    files = sorted(glob.glob(str(raw / "weather" / "isd" / "direct" / "725340-14819-*")))
    parts = [clean_isd(read_isd_file(path)) for path in files]
    result = pd.concat(parts).sort_values("time_utc")
    result.to_csv(out / "isd_hourly.csv", index=False)
    print(f"isd_hourly.csv: {len(result)} hourly reports from {len(files)} files")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", required=True, type=Path, help="extracted data/final_analysis folder")
    parser.add_argument("--radar", required=True, type=Path, help="data_2020-12-21_complete.csv")
    parser.add_argument("--out", required=True, type=Path, help="folder for the exported tables")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    export_collisions(args.raw, args.out)
    export_radar(args.radar, args.out)
    export_weather(args.raw, args.out)


if __name__ == "__main__":
    main()
