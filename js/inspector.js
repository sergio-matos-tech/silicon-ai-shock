/** Details card: a plain HTML table with every field of the hovered or pinned kit. */
import { state, GEN_COLORS } from "./state.js";

const f = (digits) => d3.format(`,.${digits}f`);

const FIELDS = [
  ["Kit", (d) => d.kit_id],
  ["Marca", (d) => d.brand],
  ["Data", (d) => d.timestamp],
  ["Região", (d) => d.region],
  ["Segmento", (d) => d.market_segment],
  ["Uso", (d) => d.recommended_usage],
  ["Die", (d) => d.die_manufacturer],
  ["Capacidade", (d) => `${d.capacity_gb} GB`],
  ["Velocidade", (d) => `${f(0)(d.speed_mts)} MT/s`],
  ["Latência real", (d) => `${f(1)(d.true_latency_ns)} ns`],
  ["Preço por GB", (d) => `US$ ${f(2)(d.price_per_gb)}`],
  ["Preço total", (d) => `US$ ${f(2)(d.price_usd)}`],
  ["Banda por US$", (d) => f(1)(d.bandwidth_per_dollar)],
  ["Prêmio veloc.", (d) => `${f(2)(d.speed_premium_ratio)}×`],
  ["Estoque global", (d) => `${f(1)(d.global_inventory_weeks)} sem.`],
  ["Uso das fabs", (d) => d3.format(".1%")(d.fab_utilization_rate)],
  ["HBM de GPU", (d) => `${f(0)(d.gpu_hbm_trend_gb)} GB`],
];

export function initInspector(container) {
  const root = d3.select(container);
  let shown = null;

  const render = () => {
    const id = state.inspectedId();
    if (id) shown = state.byId.get(id);
    if (!shown) {
      root.html(`<p class="empty-msg">Passe o mouse sobre uma linha ou ponto para ver os detalhes do kit.</p>`);
      return;
    }
    const pinned = state.pinnedId === shown.kit_id;
    root.html(`
      <div class="card-title" style="border-left-color:${GEN_COLORS[shown.generation]}">
        <strong>${shown.model_name}</strong>
        <span>${shown.generation}${pinned ? " · 📌 fixado (clique para soltar)" : ""}</span>
      </div>
      <table class="details-table">
        ${FIELDS.map(([label, value]) => `<tr><td>${label}</td><td>${value(shown)}</td></tr>`).join("")}
      </table>`);
  };

  state.on("hover", render);
  render();
}
