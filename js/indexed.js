/**
 * View F - Indexed Price Growth by Generation (2024 baseline = 1.0x).
 * Reveals proportional shock across DDR4, DDR5, and DDR6 (Preview) without log compression.
 * Click a generation curve or label to filter the dashboard.
 */
import { state, GEN_COLORS, HALVES, halfOf, genShort } from "./state.js";
import { mountSvg, showTooltip, hideTooltip, deoverlapY } from "./common.js";

const MARGIN = { top: 22, right: 92, bottom: 26, left: 44 };
const GENS = Object.keys(GEN_COLORS);

function baseline2024(records) {
  const byGen = d3.rollup(
    records.filter((d) => d.timestamp.startsWith("2024")),
    (v) => d3.median(v, (d) => d.price_per_gb),
    (d) => d.generation
  );
  return byGen;
}

function genSeries(records, base24) {
  const grouped = d3.rollup(
    records,
    (v) => ({ n: v.length, med: d3.median(v, (d) => d.price_per_gb) }),
    (d) => d.generation,
    halfOf
  );
  return GENS.map((gen) => {
    const b = base24.get(gen);
    const halfMap = grouped.get(gen) || new Map();
    const pts = HALVES.map((half) => {
      const s = halfMap.get(half);
      return {
        gen,
        half,
        n: s ? s.n : 0,
        med: s ? s.med : null,
        mult: s && b ? s.med / b : null,
        base: b,
      };
    });
    return { gen, pts };
  });
}

export function initIndexed(container) {
  let update = () => {};

  mountSvg(container, (svg, W, H) => {
    const w = W - MARGIN.left - MARGIN.right;
    const h = H - MARGIN.top - MARGIN.bottom;
    if (w <= 40 || h <= 40) return;

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    const base24 = baseline2024(state.data);
    const baseSeries = genSeries(state.data, base24);
    const baseMax = d3.max(baseSeries, (s) => d3.max(s.pts, (p) => p.mult)) || 8;

    const x = d3.scalePoint().domain(HALVES).range([0, w]).padding(0.18);
    const y = d3.scaleLinear().domain([0, Math.ceil(baseMax * 1.1)]).range([h, 0]).nice();

    const gridG = g.append("g").attr("class", "tl-grid");

    // Shaded shortage regime (2025-H2..2026-H2) & synchronized inflection line
    const splitX = (x("2025-H1") + x("2025-H2")) / 2;
    g.append("rect")
      .attr("class", "idx-regime-bg")
      .attr("x", splitX).attr("y", 0)
      .attr("width", w - splitX).attr("height", h);
    g.append("line")
      .attr("class", "inflection-line")
      .attr("x1", splitX).attr("x2", splitX)
      .attr("y1", 0).attr("y2", h);
    g.append("text")
      .attr("class", "inflection-label")
      .attr("x", splitX + 5).attr("y", 11)
      .text("▸ Escassez (2025-H2+)");

    const yAxisG = g.append("g").attr("class", "axis");
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickSize(3));
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", -h / 2).attr("y", -32).attr("text-anchor", "middle").text("Múltiplo vs. 2024 (×)");

    // Baseline 1.0x reference line (label on the open right side)
    const refLine = g.append("line").attr("class", "idx-ref-line").attr("x1", 0).attr("x2", w);
    const refLabel = g.append("text").attr("class", "idx-ref-label").attr("x", w).attr("text-anchor", "end")
      .text("Base 2024 (1,0×)");

    const lineGen = d3.line().defined((p) => p.mult != null).x((p) => x(p.half)).y((p) => y(p.mult));

    // Ghost unfiltered curves
    const ghosts = g.append("g").selectAll("path.idx-ghost").data(baseSeries).join("path").attr("class", "idx-ghost");

    // Active generation groups
    const genG = g.selectAll("g.idx-gen").data(GENS).join("g").attr("class", "idx-gen");
    const lines = genG.append("path").attr("class", "idx-line").attr("stroke", (gen) => GEN_COLORS[gen]);
    const hits = genG.append("path").attr("class", "idx-hit").on("click", (_, gen) => state.toggleGen(gen));
    const endLabels = genG.append("text").attr("class", "idx-end-label").attr("fill", (gen) => GEN_COLORS[gen])
      .attr("dominant-baseline", "middle").on("click", (_, gen) => state.toggleGen(gen));

    const dots = genG
      .selectAll("circle.idx-dot")
      .data((gen) => HALVES.map((half) => ({ gen, half })))
      .join("circle")
      .attr("class", "idx-dot")
      .attr("r", 3.8)
      .attr("fill", (d) => GEN_COLORS[d.gen])
      .on("click", (_, d) => state.toggleGen(d.gen));

    let lookup = new Map();
    dots
      .on("mousemove", (event, d) => {
        const p = lookup.get(`${d.gen}|${d.half}`);
        if (!p || p.mult == null) return;
        showTooltip(
          event,
          `<div class="tip-title">${genShort(d.gen)} · ${d.half}</div>
           <div class="tip-row"><span>Base 2024</span><span>US$ ${p.base.toFixed(2)}/GB</span></div>
           <div class="tip-row"><span>Mediana ${d.half}</span><span>US$ ${p.med.toFixed(2)}/GB</span></div>
           <div class="tip-row"><span>Aumento vs. 2024</span><span>${p.mult.toFixed(2)}×</span></div>
           <div class="tip-row"><span>Kits no filtro</span><span>${p.n}</span></div>`
        );
      })
      .on("mouseleave", hideTooltip);

    update = () => {
      const subset = state.data.filter((d) => state.matches(d, { ignoreGen: true, ignoreHalf: true }));
      const series = genSeries(subset, base24);
      const seriesMap = new Map(series.map((s) => [s.gen, s.pts]));

      lookup = new Map();
      series.forEach((s) => s.pts.forEach((p) => lookup.set(`${p.gen}|${p.half}`, p)));

      const curMax = d3.max(series, (s) => d3.max(s.pts, (p) => p.mult)) || 0;
      y.domain([0, Math.max(baseMax, curMax) * 1.12]).nice();

      gridG.selectAll("line").data(y.ticks(5)).join("line")
        .attr("x1", 0).attr("x2", w).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
      yAxisG.call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}×`));

      refLine.attr("y1", y(1)).attr("y2", y(1));
      refLabel.attr("y", y(1) - 4);

      ghosts.attr("d", (s) => lineGen(s.pts));

      const activeGen = state.gen || state.cell?.generation || null;
      genG.classed("dimmed", (gen) => activeGen !== null && activeGen !== gen);

      lines.attr("d", (gen) => lineGen(seriesMap.get(gen)));
      hits.attr("d", (gen) => lineGen(seriesMap.get(gen)));

      dots
        .attr("display", (d) => (lookup.get(`${d.gen}|${d.half}`)?.mult != null ? null : "none"))
        .attr("cx", (d) => x(d.half))
        .attr("cy", (d) => y(lookup.get(`${d.gen}|${d.half}`)?.mult || 0));

      // Position and de-overlap end labels at the rightmost valid point of each curve
      const labelInputs = [];
      for (const gen of GENS) {
        const last = [...seriesMap.get(gen)].reverse().find((p) => p.mult != null);
        if (last) labelInputs.push({ key: gen, last, y: y(last.mult) });
      }
      const adjusted = deoverlapY(labelInputs, 14, 8, h - 8);
      endLabels
        .attr("display", (gen) => (adjusted.has(gen) ? null : "none"))
        .attr("x", (gen) => {
          const item = labelInputs.find((d) => d.key === gen);
          return item ? x(item.last.half) + 7 : 0;
        })
        .attr("y", (gen) => adjusted.get(gen) ?? 0)
        .text((gen) => {
          const item = labelInputs.find((d) => d.key === gen);
          return item ? `${genShort(gen)} ${item.last.mult.toFixed(1)}×` : "";
        });
    };

    update();
  });

  state.on("filter", () => update());
}
