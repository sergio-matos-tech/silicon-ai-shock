import { state, GEN_COLORS } from "./state.js";
import { initPCP } from "./pcp.js";
import { initScatter } from "./scatter.js";
import { initHeatmap } from "./heatmap.js";
import { initDumbbell } from "./dumbbell.js";
import { initInspector } from "./inspector.js";

// Generation legend (same colors in the PCP and the scatter plot)
d3.select("#legend")
  .selectAll("span")
  .data(Object.entries(GEN_COLORS))
  .join("span")
  .html(([name, color]) => `<i style="background:${color}"></i>${name}`);

// Layout switcher so the two grid placements can be compared live
const dash = d3.select("#dashboard");
const setLayout = (mode) => {
  dash.classed("layout-rightsplit", mode === "rightsplit");
  d3.selectAll(".layout-switch button").classed("active", function () {
    return this.dataset.layout === mode;
  });
};
d3.selectAll(".layout-switch button").on("click", function () {
  setLayout(this.dataset.layout);
});
if (location.search.includes("rightsplit")) setLayout("rightsplit");

d3.json("data/processed_data.json")
  .then((data) => {
    state.init(data);

    initPCP(document.querySelector("#view-pcp"));
    initInspector(document.querySelector("#details"));
    initScatter(document.querySelector("#view-scatter"));
    initHeatmap(document.querySelector("#view-heatmap"));
    initDumbbell(document.querySelector("#view-dumbbell"));

    const counter = d3.select("#count");
    const resetBtn = d3.select("#btn-reset").on("click", () => state.reset());
    // "Limpar filtros" is enabled while any brush/cell/usage filter or a pinned kit exists
    const updateHeader = () => {
      counter.text(`${state.selected.size} / ${state.data.length} kits selecionados`);
      resetBtn.property("disabled", !state.hasFilters() && state.pinnedId === null);
    };
    state.on("filter", updateHeader);
    state.on("hover", updateHeader);
    updateHeader();
  })
  .catch((err) => {
    console.error(err);
    d3.select("#count").text("Erro ao carregar os dados. Abra via servidor HTTP (python -m http.server).");
  });
