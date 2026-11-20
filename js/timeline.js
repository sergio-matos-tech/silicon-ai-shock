/**
 * View E - Causal Timeline (Small-Multiples by Semester).
 * Top strip: AI GPU HBM demand (GB, left axis) & fab utilization (%, right axis).
 * Bottom strip: Global DRAM inventory weeks with the < 8 weeks critical shortage zone.
 * Click a semester column to filter all views by that half-year period.
 */
import { state, HALVES, halfOf } from "./state.js";
import { mountSvg, showTooltip, hideTooltip } from "./common.js";

const MARGIN = { top: 24, right: 46, bottom: 26, left: 46 };
const STRIP_GAP = 22;
const CRITICAL_WEEKS = 8;

function halfStats(records) {
  const byHalf = d3.rollup(
    records,
    (v) => ({
      n: v.length,
      hbm: d3.median(v, (d) => d.gpu_hbm_trend_gb),
      fab: d3.median(v, (d) => d.fab_utilization_rate),
      inv: d3.median(v, (d) => d.global_inventory_weeks),
    }),
    halfOf
  );
  return HALVES.map((half) => ({ half, ...(byHalf.get(half) || { n: 0, hbm: null, fab: null, inv: null }) }));
}

export function initTimeline(container) {
  let update = () => {};

  mountSvg(container, (svg, W, H) => {
    const w = W - MARGIN.left - MARGIN.right;
    const h = H - MARGIN.top - MARGIN.bottom;
    if (w <= 40 || h <= 60) return;

    const stripH = (h - STRIP_GAP) / 2;
    const topY0 = 0;
    const botY0 = stripH + STRIP_GAP;

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    const x = d3.scalePoint().domain(HALVES).range([0, w]).padding(0.45);
    const stepW = HALVES.length > 1 ? x(HALVES[1]) - x(HALVES[0]) : w;

    const base = halfStats(state.data);
    const hbmMax = Math.max(300, d3.max(base, (d) => d.hbm) * 1.1);

    const yHbm = d3.scaleLinear().domain([0, hbmMax]).range([stripH, 0]).nice();
    const yFab = d3.scaleLinear().domain([0.4, 1.0]).range([stripH, 0]);
    const yInv = d3.scaleLinear().domain([0, 16]).range([stripH, 0]);

    // Clickable semester highlight columns spanning both strips
    const cols = g
      .append("g")
      .attr("class", "tl-cols")
      .selectAll("g.tl-col")
      .data(HALVES)
      .join("g")
      .attr("class", "tl-col")
      .attr("transform", (half) => `translate(${x(half) - stepW / 2},0)`);
    cols.append("rect").attr("class", "tl-col-bg").attr("width", stepW).attr("height", h).attr("rx", 4);

    // Synchronized vertical inflection marker at 2025-H2 (when inventory drops < 8 weeks)
    const splitX = (x("2025-H1") + x("2025-H2")) / 2;
    g.append("line")
      .attr("class", "inflection-line")
      .attr("x1", splitX).attr("x2", splitX)
      .attr("y1", 0).attr("y2", h);
    g.append("text")
      .attr("class", "inflection-label")
      .attr("x", splitX + 4).attr("y", 9)
      .text("▸ Ruptura 2025-H2");

    // --- Top Strip: AI HBM Demand & Fab Utilization ---
    const topG = g.append("g").attr("transform", `translate(0,${topY0})`);
    topG.append("g").attr("class", "tl-grid").selectAll("line").data(yHbm.ticks(4)).join("line")
      .attr("x1", 0).attr("x2", w).attr("y1", (d) => yHbm(d)).attr("y2", (d) => yHbm(d));

    topG.append("g").attr("class", "axis tl-axis-hbm").call(d3.axisLeft(yHbm).ticks(4).tickFormat((d) => `${d}G`));
    topG.append("g").attr("class", "axis tl-axis-fab").attr("transform", `translate(${w},0)`)
      .call(d3.axisRight(yFab).ticks(3).tickFormat(d3.format(".0%")));

    const legTop = topG.append("g").attr("transform", "translate(0,-10)");
    legTop.append("line").attr("x1", 0).attr("x2", 14).attr("y1", -3).attr("y2", -3).attr("class", "tl-hbm-line");
    legTop.append("text").attr("class", "legend-text").attr("x", 18).attr("y", 0).text("HBM GPU (GB)");
    legTop.append("line").attr("x1", 108).attr("x2", 122).attr("y1", -3).attr("y2", -3).attr("class", "tl-fab-line");
    legTop.append("text").attr("class", "legend-text").attr("x", 126).attr("y", 0).text("Uso Fabs (%)");

    const hbmAreaGen = d3.area().defined((d) => d.hbm != null).x((d) => x(d.half)).y0(stripH).y1((d) => yHbm(d.hbm));
    const hbmLineGen = d3.line().defined((d) => d.hbm != null).x((d) => x(d.half)).y((d) => yHbm(d.hbm));
    const fabLineGen = d3.line().defined((d) => d.fab != null).x((d) => x(d.half)).y((d) => yFab(d.fab));

    topG.append("path").datum(base).attr("class", "tl-ghost-line").attr("d", hbmLineGen);
    const hbmArea = topG.append("path").attr("class", "tl-hbm-area");
    const hbmPath = topG.append("path").attr("class", "tl-hbm-line");
    const fabPath = topG.append("path").attr("class", "tl-fab-line");
    const hbmDots = topG.selectAll("circle.tl-hbm-dot").data(HALVES).join("circle").attr("class", "tl-hbm-dot").attr("r", 3.5);
    const fabDots = topG.selectAll("circle.tl-fab-dot").data(HALVES).join("circle").attr("class", "tl-fab-dot").attr("r", 3);

    // --- Bottom Strip: Global Inventory Weeks ---
    const botG = g.append("g").attr("transform", `translate(0,${botY0})`);
    botG.append("rect").attr("class", "critical-zone").attr("y", yInv(CRITICAL_WEEKS))
      .attr("width", w).attr("height", stripH - yInv(CRITICAL_WEEKS));
    botG.append("line").attr("class", "critical-line").attr("x1", 0).attr("x2", w)
      .attr("y1", yInv(CRITICAL_WEEKS)).attr("y2", yInv(CRITICAL_WEEKS));
    botG.append("text").attr("class", "critical-label").attr("x", w - 4).attr("y", yInv(CRITICAL_WEEKS) - 4)
      .attr("text-anchor", "end").text("Zona Crítica < 8 sem.");

    botG.append("g").attr("class", "axis").call(d3.axisLeft(yInv).ticks(4).tickFormat((d) => `${d}s`));
    botG.append("g").attr("class", "axis").attr("transform", `translate(0,${stripH})`).call(d3.axisBottom(x).tickSize(3));
    botG.append("text").attr("class", "legend-text").attr("x", 0).attr("y", -7).text("Estoque Global (semanas)");

    const invLineGen = d3.line().defined((d) => d.inv != null).x((d) => x(d.half)).y((d) => yInv(d.inv));
    botG.append("path").datum(base).attr("class", "tl-ghost-line").attr("d", invLineGen);
    const invPath = botG.append("path").attr("class", "tl-inv-line");
    const invDots = botG.selectAll("circle.tl-inv-dot").data(HALVES).join("circle").attr("class", "tl-inv-dot").attr("r", 3.8);

    // Hit overlay on top for smooth semester hover & click
    let statsMap = new Map();
    const hits = g.append("g").selectAll("rect.tl-hit").data(HALVES).join("rect")
      .attr("class", "tl-hit")
      .attr("x", (half) => x(half) - stepW / 2)
      .attr("y", 0)
      .attr("width", stepW)
      .attr("height", h)
      .on("click", (_, half) => {
        if (statsMap.get(half)?.n) state.toggleHalf(half);
      })
      .on("mousemove", (event, half) => {
        const s = statsMap.get(half);
        showTooltip(
          event,
          `<div class="tip-title">${half}</div>` +
            (s && s.n
              ? `<div class="tip-row"><span>HBM de GPU (med.)</span><span>${s.hbm.toFixed(0)} GB</span></div>
                 <div class="tip-row"><span>Uso das fabs (med.)</span><span>${(s.fab * 100).toFixed(1)}%</span></div>
                 <div class="tip-row"><span>Estoque global (med.)</span><span>${s.inv.toFixed(1)} sem.</span></div>
                 <div class="tip-row"><span>Kits no filtro</span><span>${s.n}</span></div>`
              : `<div class="tip-row"><span>Nenhum kit com os filtros atuais</span></div>`)
        );
      })
      .on("mouseleave", hideTooltip);

    update = () => {
      const subset = state.data.filter((d) => state.matches(d, { ignoreHalf: true }));
      const stats = halfStats(subset);
      statsMap = new Map(stats.map((s) => [s.half, s]));

      const activeHalf = state.half || state.cell?.half || null;
      cols
        .classed("active", (half) => half === activeHalf)
        .classed("dimmed", (half) => activeHalf !== null && half !== activeHalf);
      hits.style("cursor", (half) => (statsMap.get(half)?.n ? "pointer" : "default"));

      hbmArea.datum(stats).attr("d", hbmAreaGen);
      hbmPath.datum(stats).attr("d", hbmLineGen);
      fabPath.datum(stats).attr("d", fabLineGen);
      invPath.datum(stats).attr("d", invLineGen);

      hbmDots
        .attr("display", (half) => (statsMap.get(half)?.hbm != null ? null : "none"))
        .attr("cx", (half) => x(half))
        .attr("cy", (half) => yHbm(statsMap.get(half)?.hbm || 0));

      fabDots
        .attr("display", (half) => (statsMap.get(half)?.fab != null ? null : "none"))
        .attr("cx", (half) => x(half))
        .attr("cy", (half) => yFab(statsMap.get(half)?.fab || 0));

      invDots
        .attr("display", (half) => (statsMap.get(half)?.inv != null ? null : "none"))
        .attr("cx", (half) => x(half))
        .attr("cy", (half) => yInv(statsMap.get(half)?.inv || 0))
        .classed("critical", (half) => (statsMap.get(half)?.inv ?? 99) < CRITICAL_WEEKS);
    };

    update();
  });

  state.on("filter", () => update());
}
