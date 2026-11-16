/**
 * View C - Categorical impact heatmap.
 * Rows = generation + market segment, columns = half-year period,
 * cell color and label = median price_per_gb. Click a cell to filter the other views.
 */
import { state, GEN_COLORS, SEGMENTS, HALVES, halfOf, genShort } from "./state.js";
import { mountSvg, showTooltip, hideTooltip } from "./common.js";

const MARGIN = { top: 34, right: 16, bottom: 40, left: 130 };

const ROWS = Object.keys(GEN_COLORS).flatMap((generation) =>
  SEGMENTS.map((market_segment) => ({
    generation,
    market_segment,
    label: `${genShort(generation)} ${market_segment}`,
  }))
);

const cellKey = (generation, segment, half) => `${generation}|${segment}|${half}`;
const keyOfRecord = (d) => cellKey(d.generation, d.market_segment, halfOf(d));

/** Median price per GB and record count for each cell, using the records that pass the other views' filters. */
function cellStats() {
  return d3.rollup(
    state.data.filter((d) => state.matches(d, true)),
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

    // Axes
    g.append("g").attr("class", "axis heat-axis").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
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
      cell
        .classed("empty", (c) => !stats.get(c.key))
        .classed("active", (c) => c.key === activeKey)
        .classed("dimmed", (c) => activeKey !== null && c.key !== activeKey);
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
