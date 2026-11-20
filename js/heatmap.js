/**
 * View C - Categorical impact heatmap.
 * Rows = generation + market segment, columns = half-year period,
 * cell color and label = median price_per_gb. Click a cell to filter the other views.
 */
import { state, GEN_COLORS, SEGMENTS, HALVES, halfOf, halfOfQuarter, genShort } from "./state.js";
import { mountSvg, showTooltip, hideTooltip } from "./common.js";

const MARGIN = { top: 36, right: 16, bottom: 40, left: 118 };

const ROWS = Object.keys(GEN_COLORS).flatMap((generation) =>
  SEGMENTS.map((market_segment) => ({
    generation,
    market_segment,
    shortSeg: market_segment === "Enterprise/AI" ? "Enterprise" : "Consumer",
    label: `${genShort(generation)} ${market_segment}`,
  }))
);

const cellKey = (generation, segment, half) => `${generation}|${segment}|${half}`;
const keyOfRecord = (d) => cellKey(d.generation, d.market_segment, halfOf(d));

/** Median price per GB and record count for each cell, keeping context across periods/generations. */
function cellStats() {
  return d3.rollup(
    state.data.filter((d) =>
      state.matches(d, { ignoreCell: true, ignoreHalf: true, ignoreGen: true, ignoreSegment: true })
    ),
    (v) => ({ n: v.length, median: d3.median(v, (d) => d.price_per_gb) }),
    keyOfRecord
  );
}

export function initHeatmap(container) {
  let update = () => {};

  mountSvg(container, (svg, W, H) => {
    const w = W - MARGIN.left - MARGIN.right;
    const h = H - MARGIN.top - MARGIN.bottom;
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3.scaleBand().domain(HALVES).range([0, w]).padding(0.04);
    const y = d3.scaleBand().domain(ROWS.map((r) => r.label)).range([0, h]).padding(0.04);

    // Fixed color scale (from the full data) so colors keep their meaning while filtering.
    // Log: prices span more than one order of magnitude (DDR4 ~US$10 to DDR6 ~US$140 per GB).
    const medians = [...d3.rollup(state.data, (v) => d3.median(v, (d) => d.price_per_gb), keyOfRecord).values()];
    const color = d3.scaleSequentialLog(d3.interpolateYlOrRd).domain(d3.extent(medians));
    const textColor = (bg) => (d3.lab(bg).l < 60 ? "#fff" : "#111827");

    // Axes: hierarchical generation brackets on left + segment sub-labels
    const rowByLabel = new Map(ROWS.map((r) => [r.label, r]));
    g.append("g")
      .attr("class", "axis heat-axis")
      .call(d3.axisLeft(y).tickSize(0).tickFormat((lbl) => rowByLabel.get(lbl)?.shortSeg || lbl))
      .select(".domain")
      .remove();

    Object.entries(GEN_COLORS).forEach(([gen, genColor]) => {
      const genRows = ROWS.filter((r) => r.generation === gen);
      const yTop = y(genRows[0].label);
      const yBot = y(genRows[genRows.length - 1].label) + y.bandwidth();
      const grp = g.append("g").attr("class", "heat-gen-group").on("click", () => state.toggleGen(gen));
      grp.append("rect").attr("x", -68).attr("y", yTop + 1).attr("width", 4).attr("height", yBot - yTop - 2).attr("rx", 2).attr("fill", genColor);
      grp.append("text").attr("class", "heat-gen-label").attr("x", -74).attr("y", (yTop + yBot) / 2)
        .attr("text-anchor", "end").attr("dominant-baseline", "middle").attr("fill", genColor).text(genShort(gen));
    });

    g.append("g").attr("class", "axis heat-axis").call(d3.axisTop(x).tickSize(0)).select(".domain").remove();
    g.append("text").attr("class", "axis-title").attr("x", w / 2).attr("y", h + 18)
      .attr("text-anchor", "middle").text("Período (semestre)");

    // Color bar legend, bottom right
    const [lo, hi] = color.domain();
    const legW = 130;
    const grad = svg.append("defs").append("linearGradient").attr("id", "heat-grad");
    d3.range(0, 1.01, 0.1).forEach((t) => {
      grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(lo * Math.pow(hi / lo, t)));
    });
    const leg = svg.append("g").attr("transform", `translate(${W - legW - 44},${H - 15})`);
    leg.append("rect").attr("width", legW).attr("height", 9).attr("fill", "url(#heat-grad)");
    leg.append("text").attr("class", "legend-text").attr("x", -6).attr("y", 9).attr("text-anchor", "end")
      .text(`mediana US$/GB:  $${lo.toFixed(0)}`);
    leg.append("text").attr("class", "legend-text").attr("x", legW + 6).attr("y", 9).text(`$${hi.toFixed(0)}`);

    // Cells
    const cells = ROWS.flatMap((row) =>
      HALVES.map((half) => ({ ...row, half, key: cellKey(row.generation, row.market_segment, half) }))
    );
    const cell = g
      .selectAll("g.cell")
      .data(cells)
      .join("g")
      .attr("class", "cell")
      .attr("transform", (c) => `translate(${x(c.half)},${y(c.label)})`);
    cell.append("rect").attr("width", x.bandwidth()).attr("height", y.bandwidth());
    const text = cell.append("text").attr("class", "cell-value")
      .attr("x", x.bandwidth() / 2).attr("y", y.bandwidth() / 2)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle");

    // Vertical crisis inflection divider before 2025-H2 (< 8 weeks inventory threshold)
    const splitX = (x("2025-H1") + x.bandwidth() + x("2025-H2")) / 2;
    g.append("line")
      .attr("class", "inflection-line")
      .attr("x1", splitX).attr("x2", splitX)
      .attr("y1", -18).attr("y2", h + 2);
    g.append("text")
      .attr("class", "inflection-label")
      .attr("x", splitX + 4).attr("y", -22)
      .text("▸ Escassez (<8 sem.)");

    let stats = new Map();
    cell
      .on("click", (_, c) => {
        if (stats.get(c.key)) {
          state.toggleCell({ generation: c.generation, market_segment: c.market_segment, half: c.half });
        }
      })
      .on("mousemove", (event, c) => {
        const s = stats.get(c.key);
        showTooltip(event, `<div class="tip-title">${c.label} · ${c.half}</div>` +
          (s ? `<div class="tip-row"><span>Mediana</span><span>US$ ${s.median.toFixed(2)}/GB</span></div>
                <div class="tip-row"><span>Kits</span><span>${s.n}</span></div>`
             : `<div class="tip-row"><span>Nenhum kit com os filtros atuais</span></div>`));
      })
      .on("mouseleave", hideTooltip);

    update = () => {
      stats = cellStats();
      const a = state.cell;
      const activeKey = a ? cellKey(a.generation, a.market_segment, a.half) : null;
      const filterHalf = state.half || (state.quarter ? halfOfQuarter(state.quarter) : null);
      const filterGen = state.gen;
      const filterSeg = state.segment;
      const hasSlice = activeKey !== null || filterHalf !== null || filterGen !== null || filterSeg !== null;

      const cellMatchesSlice = (c) => {
        if (activeKey) return c.key === activeKey;
        if (filterHalf && c.half !== filterHalf) return false;
        if (filterGen && c.generation !== filterGen) return false;
        if (filterSeg && c.market_segment !== filterSeg) return false;
        return true;
      };

      cell
        .classed("empty", (c) => !stats.get(c.key))
        .classed("active", (c) => c.key === activeKey || (hasSlice && !activeKey && cellMatchesSlice(c)))
        .classed("dimmed", (c) => hasSlice && !cellMatchesSlice(c));
      cell.select("rect").attr("fill", (c) => {
        const s = stats.get(c.key);
        return s ? color(s.median) : null;
      });
      text
        .attr("fill", (c) => {
          const s = stats.get(c.key);
          return s ? textColor(color(s.median)) : null;
        })
        .text((c) => {
          const s = stats.get(c.key);
          return s ? `$${s.median.toFixed(2)}` : "—";
        });
    };

    update();
  });

  state.on("filter", () => update());
}
