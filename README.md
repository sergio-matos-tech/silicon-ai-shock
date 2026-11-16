# SiliconAIShock — DRAM Memory Shortage Crisis (2024–2026)

[![D3.js v7](https://img.shields.io/badge/D3.js-v7-F9A03C?logo=d3.js&logoColor=white)](https://d3js.org/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**SiliconAIShock** is an interactive, single-screen visual analytics dashboard built with **D3.js v7** to explore the 2024–2026 global DRAM supply shortage driven by AI accelerator (HBM) wafer reallocation.

Through **four coordinated views** and a **live kit inspector**, the application enables multi-dimensional brushing and linking across fab utilization, global inventory weeks, memory generations (`DDR4`, `DDR5`, `DDR6 Preview`), market segments (`Consumer`, `Enterprise/AI`), and end-user workloads.

---

## ✨ Key Features

- **4 Coordinated D3.js Views with Bidirectional Brushing & Linking:**
  - **A. Parallel Coordinates Plot (`js/pcp.js`):** 6 vertical axes (*Fab Utilization %*, *Global Inventory Weeks*, *Speed MT/s*, *True Latency ns*, *Log Price US$/GB*, and *Log Bandwidth per US$*) with independent vertical range brushes (`d3.brushY`) and `8px` invisible hit-target overlays for smooth line hovering and pinning.
  - **B. Supply vs. Price Scatter Plot (`js/scatter.js`):** Maps *Global Inventory Weeks* against *Log Price per GB*, encoding kit capacity (`8 GB`–`512 GB`) via square-root circle area (`d3.scaleSqrt`), annotated with a **Critical Shortage Zone (`< 8 weeks`)**, and equipped with a 2D rectangular brush (`d3.brush`).
  - **C. Temporal & Segment Impact Heatmap (`js/heatmap.js`):** Tracks median `US$/GB` across 6 half-year periods (`2024-H1` to `2026-H2`) and 6 `Generation × Market Segment` rows using a logarithmic `YlOrRd` sequential color scale and dynamic contrast-aware cell labels.
  - **D. Pre-Crisis (2024) → Peak Shortage (2026) Dumbbell Chart (`js/dumbbell.js`):** Compares median price jumps (`~3.3×` across segments) by `recommended_usage` (*AI / Data Science*, *Content Creation*, *Gaming (AAA)*, *Basic Productivity*), featuring dynamic X-axis rescaling and baseline ghost connectors for context.
- **Details-on-Demand & Kit Pinning (`js/inspector.js`):** Hover over any polyline or scatter point to preview all 17 kit attributes, or **click to pin (📌)** a kit in the inspector table while continuing to explore the dashboard.
- **Live Dual-Layout Switcher:** Toggle instantly in the header between **Layout 1 (`Base 3 painéis`)** and **Layout 2 (`Coluna direita dividida`)**—powered by CSS Grid and `ResizeObserver` so all SVG views resize and preserve active brush selections without page reloads.
- **Stratified Data Pipeline (`scripts/preprocess.py`):** Deterministically cleans and downsamples the raw 10,000-row dataset into 300 representative kits across all `(generation, market_segment, capacity_gb)` strata and timestamps.

---

## 🗂️ Project Structure

```text
silicon-ai-shock/
├── index.html                  # Single-screen dashboard shell & topbar controls
├── css/
│   └── style.css               # 100vh 20-column CSS Grid & view styling
├── js/
│   ├── main.js                 # App bootstrap, legend, layout switcher & data loader
│   ├── state.js                # Reactive store for AND-composed filters & hover/pin state
│   ├── common.js               # ResizeObserver SVG mounter & viewport-aware tooltip
│   ├── pcp.js                  # View A: 6-axis Parallel Coordinates Plot
│   ├── scatter.js              # View B: Inventory Weeks × Price/GB Scatter Plot
│   ├── heatmap.js              # View C: Generation/Segment × Semester Heatmap
│   ├── dumbbell.js             # View D: 2024 → 2026 Price Jump Dumbbell Chart
│   └── inspector.js            # Kit Details HTML table card (hover & pin)
├── data/
│   ├── processed_data.json     # 300 stratified DRAM kit records loaded by D3
│   └── raw/
│       └── Ultimate_Memory_Shortage_Crisis_Dataset_10k.csv
├── scripts/
│   └── preprocess.py           # Stratified two-stage downsampling script
├── lib/
│   └── d3.v7.min.js            # Vendored D3.js v7 bundle (offline-ready)
├── docs/
│   ├── architecture.md         # State management, visual encodings & layout design
│   ├── data-pipeline.md        # Dataset cleaning, stratified sampling & schema
│   └── user-guide.md           # Interactive controls & analytical walkthroughs
├── requirements.txt            # Python dependencies for data preprocessing
└── LICENSE                     # MIT License
```

---

## 🚀 Quick Start

### 1. Run the Visualization Dashboard

Because the app uses native ES modules (`<script type="module">`) and `fetch` (`d3.json`), serve the root directory over any local HTTP server:

```bash
# Using Python's built-in HTTP server
python -m http.server 8000
```

Then open **[http://localhost:8000](http://localhost:8000)** in your browser (or **[http://localhost:8000/?rightsplit](http://localhost:8000/?rightsplit)** to start directly in Layout 2).

> **Note:** D3.js v7 is vendored locally in [`lib/d3.v7.min.js`](lib/d3.v7.min.js) and [`data/processed_data.json`](data/processed_data.json) is pre-built, so no internet connection or build step is required to run the dashboard.

### 2. Re-run the Data Preprocessing Pipeline (Optional)

To regenerate [`data/processed_data.json`](data/processed_data.json) from the raw 10,000-row CSV:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
python scripts/preprocess.py
```

---

## 📚 Documentation

Detailed technical and analytical documentation is available in the [`docs/`](docs/) directory:

- **[Architecture & Coordinated Views (`docs/architecture.md`)](docs/architecture.md):** Reactive state machine (`state.js`), cross-filtering exclusions (`ignoreCell`, `ignoreUsage`, `ignoreHalf`), logarithmic/area scales, and responsive SVG mounting.
- **[Data Pipeline & Stratified Sampling (`docs/data-pipeline.md`)](docs/data-pipeline.md):** Cleaning rules, two-stage quota allocation algorithm (`allocate()`), heatmap cell coverage, and the 19-field JSON schema.
- **[User Guide & Analytical Workflows (`docs/user-guide.md`)](docs/user-guide.md):** Complete reference of mouse interactions and step-by-step walkthroughs for investigating the 2024–2026 DRAM shortage.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
