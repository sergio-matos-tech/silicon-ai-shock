import { state, GEN_COLORS, genShort } from "./state.js";
import { initPCP } from "./pcp.js";
import { initScatter } from "./scatter.js";
import { initHeatmap } from "./heatmap.js";
import { initDumbbell } from "./dumbbell.js";
import { initTimeline } from "./timeline.js";
import { initIndexed } from "./indexed.js";
import { initValue } from "./value.js";
import { initInspector } from "./inspector.js";

// Interactive generation legend (click to filter by generation)
const legendItems = d3
  .select("#legend")
  .selectAll("span")
  .data(Object.entries(GEN_COLORS))
  .join("span")
  .attr("class", "legend-item")
  .html(([name, color]) => `<i style="background:${color}"></i>${name}`)
  .on("click", (_, [name]) => state.toggleGen(name));

// Layout switcher (1: Base 3 painéis, 2: Coluna direita, 3: Narrativa no topo)
const dash = d3.select("#dashboard");
const setLayout = (mode) => {
  dash
    .classed("layout-rightsplit", mode === "rightsplit")
    .classed("layout-storyfirst", mode === "storyfirst");
  d3.selectAll(".layout-switch button").classed("active", function () {
    return this.dataset.layout === mode;
  });
};
d3.selectAll(".layout-switch button").on("click", function () {
  setLayout(this.dataset.layout);
});
if (location.search.includes("rightsplit")) setLayout("rightsplit");
if (location.search.includes("storyfirst")) setLayout("storyfirst");

d3.json("data/processed_data.json")
  .then((data) => {
    state.init(data);

    initPCP(document.querySelector("#view-pcp"));
    initInspector(document.querySelector("#details"));
    initScatter(document.querySelector("#view-scatter"));
    initHeatmap(document.querySelector("#view-heatmap"));
    initDumbbell(document.querySelector("#view-dumbbell"));
    initTimeline(document.querySelector("#view-timeline"));
    initIndexed(document.querySelector("#view-indexed"));
    initValue(document.querySelector("#view-value"));

    const counter = d3.select("#count");
    const chipsBox = d3.select("#active-filters");
    const resetBtn = d3.select("#btn-reset").on("click", () => state.reset());

    const renderChips = () => {
      const chips = [];
      if (state.gen) chips.push({ label: genShort(state.gen), clear: () => state.toggleGen(state.gen) });
      if (state.half) chips.push({ label: state.half, clear: () => state.toggleHalf(state.half) });
      if (state.cell) {
        chips.push({
          label: `${genShort(state.cell.generation)} · ${state.cell.half}`,
          clear: () => state.toggleCell(state.cell),
        });
      }
      if (state.usage) chips.push({ label: state.usage, clear: () => state.toggleUsage(state.usage) });
      if (state.box) chips.push({ label: "Janela B", clear: () => state.setBox(null) });
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
      counter.text(`${state.selected.size} / ${state.data.length} kits selecionados`);
      resetBtn.property("disabled", !state.hasFilters() && state.pinnedId === null);
      const activeGen = state.gen || state.cell?.generation || null;
      legendItems.classed("dimmed", ([name]) => activeGen !== null && name !== activeGen);
      renderChips();
    };
    state.on("filter", updateHeader);
    state.on("hover", updateHeader);
    updateHeader();
  })
  .catch((err) => {
    console.error(err);
    d3.select("#count").text("Erro ao carregar os dados. Abra via servidor HTTP (python -m http.server).");
  });
