/**
 * View A - Parallel Coordinates Plot.
 * One polyline per kit across 6 axes. Brushing an axis filters a value range.
 */
import { state, GEN_COLORS } from "./state.js";
import { mountSvg, showTooltip, hideTooltip, kitTooltip } from "./common.js";

const AXES = [
  { key: "fab_utilization_rate", label: "Taxa de Uso das Fabs (%)", format: d3.format(".0%") },
  { key: "global_inventory_weeks", label: "Estoque Global (semanas)", format: d3.format(".0f") },
  { key: "speed_mts", label: "Velocidade (MT/s)", format: d3.format(",.0f") },
  { key: "true_latency_ns", label: "Latência Real (ns)", format: d3.format(".0f") },
  { key: "price_per_gb", label: "Preço (US$/GB)", log: true },
  { key: "bandwidth_per_dollar", label: "Largura de Banda por US$", log: true },
];

const MARGIN = { top: 40, right: 90, bottom: 14, left: 90 }; // room for the first/last axis titles

export function initPCP(container) {
  let update = () => {};
  let updateHover = () => {};

  mountSvg(container, (svg, W, H) => {
    const w = W - MARGIN.left - MARGIN.right;
    const h = H - MARGIN.top - MARGIN.bottom;
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // One x position per axis, one y scale per axis (log for the two skewed ones)
    const x = d3.scalePoint().domain(AXES.map((a) => a.key)).range([0, w]);
    const y = {};
    for (const a of AXES) {
      y[a.key] = (a.log ? d3.scaleLog() : d3.scaleLinear())
        .domain(d3.extent(state.data, (d) => d[a.key]))
        .range([h, 0]);
      if (!a.log) y[a.key].nice();
    }

    const line = d3.line();
    const pathOf = (d) => line(AXES.map((a) => [x(a.key), y[a.key](d[a.key])]));

    // Visible lines (drawn first, underneath the axes) ...
    const lines = g
      .append("g")
      .attr("class", "pcp-lines")
      .selectAll("path")
      .data(state.data)
      .join("path")
      .attr("class", "pcp-line")
      .attr("d", pathOf)
      .attr("stroke", (d) => GEN_COLORS[d.generation]);

    // ... and invisible, thicker copies that catch the mouse between axes
    const hits = g
      .append("g")
      .attr("class", "pcp-hits")
      .selectAll("path")
      .data(state.data)
      .join("path")
      .attr("class", "pcp-hit")
      .attr("d", pathOf)
      .on("mouseenter", (event, d) => {
        state.setHover(d.kit_id);
        showTooltip(event, kitTooltip(d));
      })
      .on("mousemove", (event, d) => showTooltip(event, kitTooltip(d)))
      .on("mouseleave", () => {
        state.setHover(null);
        hideTooltip();
      })
      .on("click", (_, d) => state.togglePin(d.kit_id));

    // Axes and their 24px-wide vertical brush strips sit on top of the polylines
    const axisG = g
      .selectAll(".axis")
      .data(AXES)
      .join("g")
      .attr("class", "axis")
      .attr("transform", (a) => `translate(${x(a.key)},0)`);
    axisG.each(function (a) {
      const axis = d3.axisLeft(y[a.key]);
      if (a.log) axis.ticks(5, "~g");
      else axis.ticks(6).tickFormat(a.format);
      d3.select(this).call(axis);
    });
    axisG.append("text").attr("class", "axis-title").attr("y", -14).attr("text-anchor", "middle").text((a) => a.label);

    // One vertical brush per axis (width: 24px centered on each axis), on top of the polylines
    const brushes = {};
    const brushG = axisG
      .append("g")
      .attr("class", "axis-brush")
      .each(function (a) {
        brushes[a.key] = d3
          .brushY()
          .extent([[-12, 0], [12, h]])
          .on("brush end", ({ selection, sourceEvent }) => {
            if (!sourceEvent) return; // ignore programmatic moves
            if (!selection) state.setPcp(a.key, null);
            else state.setPcp(a.key, [y[a.key].invert(selection[1]), y[a.key].invert(selection[0])]);
          });
        d3.select(this).call(brushes[a.key]);
        const range = state.pcp[a.key]; // keep the brush after a window resize
        if (range) d3.select(this).call(brushes[a.key].move, [y[a.key](range[1]), y[a.key](range[0])]);
      });

    update = () => {
      const on = (d) => state.selected.has(d.kit_id);
      lines.classed("out", (d) => !on(d));
      hits.classed("out", (d) => !on(d));
      lines.filter(on).raise(); // selected lines above the grey context lines
      brushG.each(function (a) {
        // a "Limpar filtros" reset has to remove the brush rectangles too
        if (!state.pcp[a.key] && d3.brushSelection(this)) d3.select(this).call(brushes[a.key].move, null);
      });
      updateHover();
    };

    updateHover = () => {
      lines.classed("hover", (d) => state.isHighlighted(d.kit_id));
      lines.filter(".hover").raise();
    };

    update();
  });

  state.on("filter", () => update());
  state.on("hover", () => updateHover());
}
