"""
Pre-processing for SiliconAIShock.

Reads the raw 10,000-row CSV and writes data/processed_data.json with
at most 300 representative records:
  1. drop rows with price_status == "Listing-Error" (noise) and the 5 rows
     dated 2027-01-01 (outside the 2024-2026 window)
  2. stratified downsampling in two levels
       - (generation, market_segment) groups get at least MIN_PER_GROUP records,
         so small groups such as DDR6 stay readable; the rest is proportional
       - inside a group, each capacity_gb stratum gets a share, and its records
         are picked evenly spaced along the timeline
  3. keep only the columns the views use (no derived columns)

It also writes data/aggregates.json: quarterly market medians and a few
narrative facts computed on the FULL cleaned dataset (KPI strip, crisis clock,
story mode).

Run from the project root:
  .venv\\Scripts\\python.exe scripts\\preprocess.py
"""

from pathlib import Path
import json

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_FILE = ROOT / "data" / "raw" / "Ultimate_Memory_Shortage_Crisis_Dataset_10k.csv"
OUT_FILE = ROOT / "data" / "processed_data.json"

MAX_RECORDS = 300
MIN_PER_GROUP = 25          # floor for every (generation, market_segment) group
GROUP = ["generation", "market_segment"]

AGG_FILE = ROOT / "data" / "aggregates.json"

COLUMNS = [
    "kit_id", "brand", "model_name", "timestamp", "region", "generation",
    "market_segment", "recommended_usage", "die_manufacturer",
    "capacity_gb", "speed_mts", "true_latency_ns",
    "price_per_gb", "price_usd", "bandwidth_per_dollar", "speed_premium_ratio",
    "global_inventory_weeks", "fab_utilization_rate", "gpu_hbm_trend_gb",
    "price_status",
]

INFLATED = "Shortage-Inflated"
CRITICAL_WEEKS = 8


def build_aggregates(df):
    """Market-wide quarterly medians and narrative facts, computed on the FULL
    cleaned dataset (not the 300-kit sample), for the KPI strip, the crisis
    clock and the story mode."""
    df = df.assign(quarter=df["timestamp"].dt.year.astype(str) + "Q" + df["timestamp"].dt.quarter.astype(str))
    year = df["timestamp"].dt.year

    quarters = (
        df.groupby("quarter")
        .agg(
            n=("kit_id", "size"),
            price_per_gb=("price_per_gb", "median"),
            global_inventory_weeks=("global_inventory_weeks", "median"),
            fab_utilization_rate=("fab_utilization_rate", "median"),
            gpu_hbm_trend_gb=("gpu_hbm_trend_gb", "median"),
            bandwidth_per_dollar=("bandwidth_per_dollar", "median"),
            speed_premium_ratio=("speed_premium_ratio", "median"),
            inflated_share=("price_status", lambda s: (s == INFLATED).mean()),
        )
        .reset_index()
        .sort_values("quarter")
    )

    # Reference kit: DDR5 32 GB consumer kit, median total price per year
    ref = df[(df["generation"] == "DDR5") & (df["capacity_gb"] == 32) & (df["market_segment"] == "Consumer")]
    ref_price = ref.groupby(ref["timestamp"].dt.year)["price_usd"].median()

    # Regional spread: (max - min) / median of the regional medians, worst year
    reg = df.groupby([year, "region"])["price_per_gb"].median().unstack()
    region_spread = ((reg.max(axis=1) - reg.min(axis=1)) / reg.median(axis=1)).max()

    gen_share = df.groupby(year)["generation"].value_counts(normalize=True).unstack()

    facts = {
        "rows": int(len(df)),
        "regions": int(df["region"].nunique()),
        "brands": int(df["brand"].nunique()),
        "die_makers": int(df["die_manufacturer"].nunique()),
        "ref_kit": {"label": "DDR5 32 GB Consumer", "y2024": float(ref_price.get(2024)), "y2026": float(ref_price.get(2026))},
        "price_above_critical": float(df.loc[df["global_inventory_weeks"] >= CRITICAL_WEEKS + 2, "price_per_gb"].median()),
        "price_below_critical": float(df.loc[df["global_inventory_weeks"] < CRITICAL_WEEKS, "price_per_gb"].median()),
        "region_spread": float(region_spread),
        "ddr5_share": {"y2024": float(gen_share.loc[2024, "DDR5"]), "y2026": float(gen_share.loc[2026, "DDR5"])},
    }
    return {"quarters": quarters.round(4).to_dict(orient="records"), "facts": facts}


def allocate(sizes, total, floor):
    """Split `total` records among strata: each gets `floor` (or its whole size if
    smaller), the rest is shared proportionally to size, never above the size."""
    quota = np.minimum(floor, sizes)
    while quota.sum() < total:
        room = sizes - quota
        if room.sum() == 0:
            break
        spare = total - quota.sum()
        share = room / room.sum() * spare
        add = np.minimum(share.astype(int), room)
        order = (share - share.astype(int)).sort_values(ascending=False).index
        for key in order[: int(spare - add.sum())]:
            if add[key] < room[key]:
                add[key] += 1
        if add.sum() == 0:
            break
        quota = quota + add
    return quota


def sample_evenly_in_time(group, k):
    """k records at evenly spaced positions of the time-sorted group."""
    group = group.sort_values("timestamp")
    positions = np.linspace(0, len(group) - 1, k).round().astype(int)
    return group.iloc[np.unique(positions)]


def main():
    df = pd.read_csv(RAW_FILE, parse_dates=["timestamp"])
    print(f"Loaded {len(df)} rows")

    df = df[df["price_status"] != "Listing-Error"]
    print(f"After removing Listing-Error: {len(df)} rows")

    # The study window is 2024-2026; the CSV has 5 rows on 2027-01-01 that would need a lone 2027-H1 column
    df = df[df["timestamp"] < "2027-01-01"]
    print(f"After keeping 2024-2026: {len(df)} rows")

    aggregates = build_aggregates(df)
    with open(AGG_FILE, "w", encoding="utf-8") as f:
        json.dump(aggregates, f, ensure_ascii=False, indent=1, allow_nan=False)
    print(f"Wrote {AGG_FILE.name}: {len(aggregates['quarters'])} quarters + narrative facts")

    group_quota = allocate(df.groupby(GROUP).size(), MAX_RECORDS, MIN_PER_GROUP)

    parts = []
    for key, rows in df.groupby(GROUP):
        capacity_sizes = rows.groupby("capacity_gb").size()
        capacity_quota = allocate(capacity_sizes, group_quota[key], floor=1)
        for capacity, stratum in rows.groupby("capacity_gb"):
            parts.append(sample_evenly_in_time(stratum, capacity_quota[capacity]))
    sample = pd.concat(parts).sort_values("timestamp")
    print(f"Sampled records: {len(sample)}")

    out = sample[COLUMNS].copy()
    out["timestamp"] = out["timestamp"].dt.strftime("%Y-%m-%d")
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(out.to_dict(orient="records"), f, separators=(",", ":"), allow_nan=False)
    print(f"Wrote {OUT_FILE.name}: {len(out)} records, {OUT_FILE.stat().st_size / 1e3:.0f} KB")

    print("\nRecords per generation / segment:")
    print(out.groupby(GROUP).size())

    # The heatmap needs every (generation, segment) x half-year cell to have data
    half = sample["timestamp"].dt.year.astype(str) + "-H" + np.where(sample["timestamp"].dt.month <= 6, "1", "2")
    cells = sample.assign(half=half).pivot_table(index=GROUP, columns="half", values="kit_id", aggfunc="count")
    print("\nRecords per heatmap cell (generation, segment x half-year):")
    print(cells.reindex(columns=sorted(cells.columns)).fillna(0).astype(int).to_string())


if __name__ == "__main__":
    main()
