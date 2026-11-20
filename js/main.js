import { state, GEN_COLORS, genShort, segShort, quarterLabel } from "./state.js";
import { initKPIs } from "./kpi.js";
import { initClock } from "./clock.js";
import { initWafer } from "./wafer.js";
import { initGlyphs } from "./glyphs.js";
import { initPCP } from "./pcp.js";
import { initScatter } from "./scatter.js";
import { initHeatmap } from "./heatmap.js";
import { initDumbbell } from "./dumbbell.js";
import { initInspector } from "./inspector.js";

// Interactive generation legend (click to filter by generation)
const legendItems = d3
  .select("#legend")
  .selectAll("span")
  .data(Object.entries(GEN_COLORS))
  .join("span")
  .attr("class", "legend-item")
  .html(([name, color]) => `<i style="background:${color}"></i>${genShort(name)}`)
  .on("click", (_, [name]) => state.toggleGen(name));

Promise.all([d3.json("data/processed_data.json"), d3.json("data/aggregates.json")])
  .then(([data, agg]) => {
    state.init(data, agg);

    initKPIs(document.querySelector("#kpi-strip"));
    initClock(document.querySelector("#view-timeline"));
    initWafer(document.querySelector("#view-indexed"));
    initGlyphs(document.querySelector("#view-value"));
    initPCP(document.querySelector("#view-pcp"));
    initInspector(document.querySelector("#details"));
    initScatter(document.querySelector("#view-scatter"));
    initHeatmap(document.querySelector("#view-heatmap"));
    initDumbbell(document.querySelector("#view-dumbbell"));

    const counter = d3.select("#count");
    const chipsBox = d3.select("#active-filters");
    const resetBtn = d3.select("#btn-reset").on("click", () => state.reset());

    const renderChips = () => {
      const chips = [];
      if (state.gen) {
        chips.push({ label: genShort(state.gen), clear: () => state.toggleGen(state.gen) });
      }
      if (state.segment) {
        chips.push({
          label: segShort(state.segment),
          clear: () => {
            state.segment = null;
            state.refresh();
          },
        });
      }
      if (state.quarter) {
        chips.push({ label: quarterLabel(state.quarter), clear: () => state.setQuarter(null) });
      }
      if (state.half) {
        chips.push({ label: state.half, clear: () => state.toggleHalf(state.half) });
      }
      if (state.cell) {
        chips.push({
          label: `${genShort(state.cell.generation)} · ${state.cell.half}`,
          clear: () => state.toggleCell(state.cell),
        });
      }
      if (state.usage) {
        chips.push({ label: state.usage, clear: () => state.toggleUsage(state.usage) });
      }
      if (state.box) {
        chips.push({ label: "Janela B", clear: () => state.setBox(null) });
      }
      const pcpKeys = Object.keys(state.pcp);
      if (pcpKeys.length) {
        chips.push({
          label: `PCP (${pcpKeys.length})`,
          clear: () => pcpKeys.forEach((k) => state.setPcp(k, null)),
        });
      }
      chipsBox
        .selectAll("button.filter-chip")
        .data(chips, (c) => c.label)
        .join("button")
        .attr("type", "button")
        .attr("class", "filter-chip")
        .text((c) => `${c.label} ×`)
        .on("click", (_, c) => c.clear());
    };

    const updateHeader = () => {
      counter.text(`${state.selected.size} / ${state.data.length} kits`);
      resetBtn.property("disabled", !state.hasFilters() && state.pinnedId === null);
      const activeGen = state.gen || state.cell?.generation || null;
      legendItems
        .classed("active", ([name]) => activeGen === name)
        .classed("dimmed", ([name]) => activeGen !== null && name !== activeGen);
      renderChips();
    };
    state.on("filter", updateHeader);
    state.on("hover", updateHeader);
    updateHeader();
  })
  .catch((err) => {
    console.error(err);
    d3.select("#count").text("Erro ao carregar dados. Sirva via HTTP (python -m http.server).");
  });
