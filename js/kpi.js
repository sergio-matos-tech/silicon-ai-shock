/**
 * K0 - "Vital Signs" KPI Strip.
 * Six telemetry cards with D3 12-quarter micro-sparklines, threshold bands,
 * current-quarter beacon dots, and click-to-toggle analytical filter lenses.
 */
import {
  state,
  QUARTERS,
  CRITICAL_WEEKS,
  INFLATED,
  quarterOf,
  quarterLabel,
} from "./state.js";
import { showTooltip, hideTooltip, fmtNum, fmtPct } from "./common.js";

const CARDS = [
  {
    id: "price",
    title: "Preço Mediano / GB",
    unit: "US$",
    color: "#dc2626",
    tone: "danger",
    key: "price_per_gb",
    fmt: (v) => `US$ ${fmtNum(2)(v)}`,
    deltaFmt: (v, b) => `${fmtNum(1)(v / b)}× vs 24T1`,
    sub: () => "Limiar pré-crise: ~US$ 13/GB",
    lensLabel: "Pico ≥ US$ 45/GB",
    isLensActive: () => state.pcp.price_per_gb?.[0] >= 44,
    toggleLens: () => {
      const on = state.pcp.price_per_gb?.[0] >= 44;
      state.setPcp("price_per_gb", on ? null : [45, 300]);
    },
  },
  {
    id: "inventory",
    title: "Cobertura de Estoque",
    unit: "sem.",
    color: "#0d9488",
    alertColor: "#dc2626",
    tone: "warning",
    key: "global_inventory_weeks",
    threshold: CRITICAL_WEEKS,
    thresholdBelow: true,
    fmt: (v) => `${fmtNum(1)(v)} sem.`,
    deltaFmt: (v, b) => `${fmtPct(0)((v - b) / b)} vs 24T1`,
    sub: (v) => (v < CRITICAL_WEEKS ? "⚠ Zona crítica (< 8 sem.)" : "Estoque seguro (≥ 8 sem.)"),
    lensLabel: "Filtro < 8 sem.",
    isLensActive: () => state.pcp.global_inventory_weeks?.[1] <= CRITICAL_WEEKS,
    toggleLens: () => {
      const on = state.pcp.global_inventory_weeks?.[1] <= CRITICAL_WEEKS;
      state.setPcp("global_inventory_weeks", on ? null : [0, CRITICAL_WEEKS]);
    },
  },
  {
    id: "inflated",
    title: "Listagens Infladas",
    unit: "%",
    color: "#e11d48",
    tone: "danger",
    key: "inflated_share",
    fmt: (v) => fmtPct(0)(v),
    deltaFmt: (v) => (v >= 0.99 ? "100% contágio" : `${fmtPct(0)(v)} do mercado`),
    sub: () => "Status: Shortage-Inflated",
    lensLabel: "Pós-ruptura 2025-H2",
    isLensActive: () => state.half === "2025-H2",
    toggleLens: () => state.toggleHalf("2025-H2"),
  },
  {
    id: "fab",
    title: "Saturação das Fabs",
    unit: "%",
    color: "#6366f1",
    tone: "info",
    key: "fab_utilization_rate",
    fmt: (v) => fmtPct(1)(v),
    deltaFmt: (_, __, qRow) => `HBM GPU: ${fmtNum(0)(qRow?.gpu_hbm_trend_gb ?? 279)} GB`,
    sub: () => "Realocação de wafers p/ HBM",
    lensLabel: "Fabs ≥ 80%",
    isLensActive: () => state.pcp.fab_utilization_rate?.[0] >= 0.79,
    toggleLens: () => {
      const on = state.pcp.fab_utilization_rate?.[0] >= 0.79;
      state.setPcp("fab_utilization_rate", on ? null : [0.8, 1.0]);
    },
  },
  {
    id: "value",
    title: "Banda por Dólar",
    unit: "MB/s/$",
    color: "#0284c7",
    tone: "info",
    key: "bandwidth_per_dollar",
    fmt: (v) => `${fmtNum(1)(v)} MB/s`,
    deltaFmt: (v, b) => `${fmtPct(0)((v - b) / b)} vs 24T1`,
    sub: () => "Erosão de custo-benefício",
    lensLabel: "Alta eficiência",
    isLensActive: () => state.pcp.bandwidth_per_dollar?.[0] >= 30,
    toggleLens: () => {
      const on = state.pcp.bandwidth_per_dollar?.[0] >= 30;
      state.setPcp("bandwidth_per_dollar", on ? null : [30, 500]);
    },
  },
  {
    id: "kit32",
    title: "Ágio de Velocidade",
    unit: "×",
    color: "#d97706",
    tone: "warning",
    key: "speed_premium_ratio",
    fmt: (v) => `${fmtNum(1)(v)}× JEDEC`,
    deltaFmt: () => {
      const ref = state.agg?.facts?.ref_kit;
      return ref ? `32GB: $${Math.round(ref.y2024)}→$${Math.round(ref.y2026)}` : "+455% vs 24T1";
    },
    sub: () => "Kit DDR5 32GB Consumer: 4,6×",
    lensLabel: "Foco DDR5",
    isLensActive: () => state.gen === "DDR5",
    toggleLens: () => state.toggleGen("DDR5"),
  },
];

function metricFromSample(rows, key) {
  if (!rows.length) return null;
  if (key === "inflated_share") {
    return d3.mean(rows, (d) => (d.price_status === INFLATED ? 1 : 0));
  }
  return d3.median(rows, (d) => d[key]);
}

export function initKPIs(container) {
  const root = d3.select(container);
  const quarters = state.agg.quarters || [];
  const qByCode = new Map(quarters.map((q) => [q.quarter, q]));
  const baseQ = quarters[0] || {};

  const cards = root
    .selectAll("div.kpi-card")
    .data(CARDS)
    .join("div")
    .attr("class", (c) => `kpi-card tone-${c.tone}`)
    .on("click", (_, c) => c.toggleLens())
    .on("mousemove", (event, c) => {
      const fq = state.focusQuarter();
      const qRow = qByCode.get(fq) || quarters[quarters.length - 1];
      const bVal = baseQ[c.key];
      const qVal = qRow?.[c.key];
      showTooltip(
        event,
        `<div class="tip-title">${c.title} · ${quarterLabel(fq)}</div>
         <div class="tip-row"><span>Base 2024-T1 (mercado)</span><span>${bVal != null ? c.fmt(bVal) : "—"}</span></div>
         <div class="tip-row"><span>${quarterLabel(fq)} (mercado 9,8k)</span><span>${qVal != null ? c.fmt(qVal) : "—"}</span></div>
         <div class="tip-foot"><span class="tip-hint">Clique para alternar filtro: <b>${c.lensLabel}</b></span></div>`
      );
    })
    .on("mouseleave", hideTooltip);

  const head = cards.append("div").attr("class", "kpi-head");
  head.append("span").attr("class", "kpi-title").text((c) => c.title);
  head.append("span").attr("class", "kpi-lens").text((c) => c.lensLabel);

  const body = cards.append("div").attr("class", "kpi-body");
  const left = body.append("div").attr("class", "kpi-numbers");
  const valEl = left.append("div").attr("class", "kpi-value");
  const deltaEl = left.append("div").attr("class", "kpi-delta");

  const sparkWrap = body.append("div").attr("class", "kpi-spark");
  const subEl = cards.append("div").attr("class", "kpi-sub");

  // Build one D3 sparkline SVG per KPI card
  const W = 104;
  const H = 34;
  const PAD = 3;

  const sparks = new Map();
  sparkWrap.each(function (c) {
    const svg = d3
      .select(this)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("preserveAspectRatio", "none");

    const x = d3
      .scalePoint()
      .domain(QUARTERS)
      .range([PAD, W - PAD]);
    const vals = quarters.map((q) => q[c.key]);
    const [lo, hi] = d3.extent(vals);
    const y = d3
      .scaleLinear()
      .domain([Math.min(lo, c.threshold ?? lo) * 0.92, Math.max(hi, c.threshold ?? hi) * 1.05])
      .range([H - PAD, PAD]);

    if (c.threshold != null) {
      const ty = y(c.threshold);
      svg
        .append("rect")
        .attr("x", PAD)
        .attr("width", W - PAD * 2)
        .attr("y", c.thresholdBelow ? ty : PAD)
        .attr("height", Math.max(0, c.thresholdBelow ? H - PAD - ty : ty - PAD))
        .attr("fill", "#fecaca")
        .attr("fill-opacity", 0.35);
      svg
        .append("line")
        .attr("x1", PAD)
        .attr("x2", W - PAD)
        .attr("y1", ty)
        .attr("y2", ty)
        .attr("stroke", "#dc2626")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 2");
    }

    const area = d3
      .area()
      .x((d) => x(d.quarter))
      .y0(H - PAD)
      .y1((d) => y(d[c.key]))
      .curve(d3.curveMonotoneX);

    const line = d3
      .line()
      .x((d) => x(d.quarter))
      .y((d) => y(d[c.key]))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(quarters)
      .attr("d", area)
      .attr("fill", c.color)
      .attr("fill-opacity", 0.14);

    svg
      .append("path")
      .datum(quarters)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", c.color)
      .attr("stroke-width", 1.8);

    // Base dot (2024Q1)
    if (quarters.length) {
      svg
        .append("circle")
        .attr("cx", x(quarters[0].quarter))
        .attr("cy", y(quarters[0][c.key]))
        .attr("r", 2)
        .attr("fill", "#64748b");
    }

    // Active focus quarter beacon dot
    const beacon = svg
      .append("circle")
      .attr("class", "kpi-beacon")
      .attr("r", 3.4)
      .attr("fill", c.alertColor || c.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.3);

    sparks.set(c.id, { x, y, beacon });
  });

  const update = () => {
    const fq = state.focusQuarter();
    const qRow = qByCode.get(fq) || quarters[quarters.length - 1] || {};
    const hasFilter = state.hasFilters();
    const activeRows = state.data.filter((d) => state.selected.has(d.kit_id));

    cards.classed("lens-active", (c) => Boolean(c.isLensActive()));

    valEl.text((c) => {
      // When non-time filters are active, reflect the selected cohort median;
      // when only a quarter filter (or no filter) is active, show the market-wide focus quarter.
      const nonTimeFilter =
        Object.keys(state.pcp).length > 0 ||
        state.box !== null ||
        state.cell !== null ||
        state.usage !== null ||
        state.gen !== null ||
        state.segment !== null;
      const v = nonTimeFilter ? metricFromSample(activeRows, c.key) : qRow[c.key];
      return v != null ? c.fmt(v) : "—";
    });

    deltaEl.text((c) => {
      const b = baseQ[c.key];
      const v = hasFilter ? metricFromSample(activeRows, c.key) ?? qRow[c.key] : qRow[c.key];
      if (v == null || b == null) return "—";
      return c.deltaFmt(v, b, qRow);
    });

    subEl.text((c) => {
      const v = hasFilter ? metricFromSample(activeRows, c.key) ?? qRow[c.key] : qRow[c.key];
      return typeof c.sub === "function" ? c.sub(v) : c.sub;
    });

    CARDS.forEach((c) => {
      const s = sparks.get(c.id);
      if (!s || !qRow[c.key]) return;
      s.beacon.attr("cx", s.x(fq)).attr("cy", s.y(qRow[c.key]));
    });
  };

  state.on("filter", update);
  update();
}
