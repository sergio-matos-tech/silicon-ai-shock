# User Guide & Analytical Workflows

This guide explains how to interact with **SiliconAIShock** and walks through key analytical scenarios exploring the 2024–2026 DRAM memory shortage crisis.

---

## 1. Interactive Controls Summary

| Control / View | Action | Effect |
| :--- | :--- | :--- |
| **A. Parallel Coordinates** | **Drag vertically** along any of the 6 axes | Filters kits to the brushed axis range (multiple axes combine with `AND`). |
| **A. Parallel Coordinates** | **Click** inside an active axis brush strip outside the selection | Clears that axis's filter. |
| **B. Scatter Plot** | **Drag a rectangle** on empty canvas space | Filters kits by a 2D window of `Global Inventory Weeks × Price/GB`. |
| **A & B (Lines & Dots)** | **Hover** over a line or circle | Highlights the kit in both views, shows a floating tooltip, and previews its 17 fields in the **Details Card**. |
| **A & B (Lines & Dots)** | **Click** a line or circle | **Pins (📌)** that kit in the Details Card so you can inspect it while moving the mouse elsewhere. Click again to unpin. |
| **C. Period Heatmap** | **Click** a cell (`Generation + Segment × Semester`) | Filters all views to that exact market segment and semester. Click the active cell again to clear. |
| **D. Dumbbell Chart** | **Click** a usage row (`AI / Data Science`, `Gaming (AAA)`, etc.) | Filters all views to that `recommended_usage` tier. Click the active row again to clear. |
| **Topbar: Layout Switch** | Click **`1 · Base 3 painéis`** or **`2 · Coluna direita dividida`** | Dynamically rearranges the 5-panel grid without losing active filters or pinned kits (`?rightsplit` URL query also supported). |
| **Topbar: `Limpar filtros`** | Click button (enabled whenever any filter or pin is active) | Resets all brushes, heatmap/dumbbell selections, and pinned kits back to `300 / 300 kits`. |

---

## 2. Analytical Walkthroughs

### Scenario 1: Investigating the Critical Shortage Zone (`< 8 Weeks` Inventory)
1. Look at **View B (Scatter Plot)**: the red-shaded region on the left marks the **Critical Shortage Zone (`< 8 weeks` of global inventory)**.
2. Drag a 2D brush across the left side of the Scatter Plot (`0` to `8` weeks).
3. **Observation:**
   - **View A (PCP)** immediately highlights high fab utilization rates (`> 80%`) and elevated unit prices.
   - **View C (Heatmap)** shows that critical inventory depletion occurs exclusively from **`2025-H2` through `2026-H2`**, where median prices across all segments surge.

### Scenario 2: Comparing Enterprise AI Demand vs. Consumer Gaming
1. Click the **`IA / Data Science`** row in **View D (Dumbbell Chart)**.
2. Notice in **View B (Scatter Plot)** that the remaining points are predominantly large circles (`128 GB`–`512 GB` kits) in the `Enterprise/AI` segment.
3. Now click **`Gaming (AAA)`** in **View D** instead:
   - **View A (PCP)** shifts toward higher `Bandwidth per US$` and lower total kit capacities (`16 GB`–`32 GB`).
   - Compare the grey baseline ghost lines in **View D** against filtered subsets when brushing high-speed kits (`> 7200 MT/s`) on the PCP.

### Scenario 3: Evaluating the DDR6 (Preview) Early-Adopter Premium
1. In **View C (Heatmap)**, observe the bottom two rows (`DDR6 Consumer` and `DDR6 Enterprise/AI`), which progress from `~$29–$51/GB` in `2024-H1` to `~$95–$140+/GB` by `2026-H2`.
2. Click any **`DDR6 Enterprise/AI`** cell in `2026-H2`.
3. Notice how **View D (Dumbbell Chart)** automatically rescales its horizontal axis to accommodate the higher DDR6 price range while keeping the overall dataset's 2024→2026 jump visible as a light grey reference bar underneath.
4. Click an individual amber polyline in **View A** or circle in **View B** to pin (📌) the kit and inspect its exact `die_manufacturer`, `gpu_hbm_trend_gb`, and `speed_premium_ratio` in the **Details Card**.
