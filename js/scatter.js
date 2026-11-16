/**
 * View B - Continuous scatter plot.
 * X = global_inventory_weeks, Y = price_per_gb (log), radius = capacity_gb, color = generation.
 * Layer order (bottom to top): scarcity zone, axes, <g class="brush">, <g class="dots">.
 * The brush sits under the dots, so hovering/clicking a dot reaches the dot,
 * while dragging on empty space draws the 2D brush.
 */
import { state, GEN_COLORS } from "./state.js";
import { mountSvg, showTooltip, hideTooltip, kitTooltip } from "./common.js";

const MARGIN = { top: 14, right: 16, bottom: 40, left: 54 };
const CRITICAL_WEEKS = 8;

export function initScatter(container) {
  let update = () => {};
  let updateHover = () => {};

  mountSvg(container, (svg, W, H) => {
    const w = W - MARGIN.left - MARGIN.right;
    const h = H - MARGIN.top - MARGIN.bottom;
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3.scaleLinear().domain([0, 16]).range([0, w]);
    const [pMin, pMax] = d3.extent(state.data, (d) => d.price_per_gb);
    const y = d3.scaleLog().domain([pMin * 0.8, pMax * 1.2]).range([h, 0]); // small margin so dots are not cut
    const r = d3.scaleSqrt().domain([8, 512]).range([4, 11]);

    // Scarcity zone (< 8 weeks) and dashed threshold line
    g.append("rect").attr("class", "critical-zone").attr("width", x(CRITICAL_WEEKS)).attr("height", h);
    g.append("line").attr("class", "critical-line")
      .attr("x1", x(CRITICAL_WEEKS)).attr("x2", x(CRITICAL_WEEKS)).attr("y1", 0).attr("y2", h);
    g.append("text").attr("class", "critical-label")
      .attr("x", x(CRITICAL_WEEKS) - 6).attr("y", 12).attr("text-anchor", "end")
      .text("Zona Crítica de Escassez < 8 semanas");

    // Axes
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(8));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6, "~g"));
    g.append("text").attr("class", "axis-title").attr("x", w / 2).attr("y", h + 34)
      .attr("text-anchor", "middle").text("Semanas de Estoque Global");
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", -h / 2).attr("y", -40).attr("text-anchor", "middle").text("Preço por GB (US$, escala log)");

    // 2D brush, drawn BEFORE the dots so it stays underneath them
    const brush = d3
      .brush()
      .extent([[0, 0], [w, h]])
      .on("brush end", ({ selection, sourceEvent }) => {
        if (!sourceEvent) return; // ignore programmatic moves
        if (!selection) return state.setBox(null);
        const [[x0, y0], [x1, y1]] = selection;
        state.setBox({ x: [x.invert(x0), x.invert(x1)], y: [y.invert(y1), y.invert(y0)] });
      });
    const brushG = g.append("g").attr("class", "brush").call(brush);
    if (state.box) { // keep the brush after a window resize
      const { x: bx, y: by } = state.box;
      brushG.call(brush.move, [[x(bx[0]), y(by[1])], [x(bx[1]), y(by[0])]]);
    }

    // Dots on top. Big circles first so the small ones stay visible on top of them.
    const dots = g
      .append("g")
      .attr("class", "dots")
      .selectAll("circle")
      .data([...state.data].sort((a, b) => b.capacity_gb - a.capacity_gb))
      .join("circle")
      .attr("class", "dot")
      .attr("cx", (d) => x(d.global_inventory_weeks))
      .attr("cy", (d) => y(d.price_per_gb))
      .attr("r", (d) => r(d.capacity_gb))
      .attr("fill", (d) => GEN_COLORS[d.generation])
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

    update = () => {
      dots.classed("out", (d) => !state.selected.has(d.kit_id));
      dots.filter((d) => state.selected.has(d.kit_id)).raise();
      // "Limpar filtros" has to remove the brush rectangle too
      if (!state.box && d3.brushSelection(brushG.node())) brushG.call(brush.move, null);
      updateHover();
    };

    updateHover = () => {
      dots.classed("hover", (d) => state.isHighlighted(d.kit_id));
      dots.filter(".hover").raise();
    };

    update();
  });

  state.on("filter", () => update());
  state.on("hover", () => updateHover());
}
