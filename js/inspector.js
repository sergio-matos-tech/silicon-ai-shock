/**
 * Details card: visual kit inspector with inline micro-bars when a kit is hovered/pinned,
 * or a live visual cohort summary when no individual kit is active.
 */
import { state, GEN_COLORS, genShort } from "./state.js";

const f = (digits) => d3.format(`,.${digits}f`);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function metricBar(label, valText, ratio, color, subText = "") {
  const pct = (clamp01(ratio) * 100).toFixed(1);
  return `
    <div class="insp-metric">
      <div class="insp-metric-head">
        <span>${label}</span>
        <strong>${valText}</strong>
      </div>
      <div class="insp-bar-track">
        <div class="insp-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      ${subText ? `<div class="insp-metric-sub">${subText}</div>` : ""}
    </div>`;
}

export function initInspector(container) {
  const root = d3.select(container);
  const [pMin, pMax] = d3.extent(state.data, (d) => d.price_per_gb);
  const [bMin, bMax] = d3.extent(state.data, (d) => d.bandwidth_per_dollar);
  const logRatio = (v, lo, hi) => Math.log(v / lo) / Math.log(hi / lo);

  const render = () => {
    const id = state.inspectedId();
    const d = id ? state.byId.get(id) : null;

    if (!d) {
      // Live visual cohort summary when no single kit is hovered/pinned
      const active = state.data.filter((r) => state.selected.has(r.kit_id));
      if (!active.length) {
        root.html(`<p class="empty-msg">Nenhum kit corresponde aos filtros atuais.</p>`);
        return;
      }
      const medPrice = d3.median(active, (r) => r.price_per_gb);
      const medInv = d3.median(active, (r) => r.global_inventory_weeks);
      const medFab = d3.median(active, (r) => r.fab_utilization_rate);
      const medBw = d3.median(active, (r) => r.bandwidth_per_dollar);
      const p24 = active.filter((r) => r.timestamp.startsWith("2024"));
      const p26 = active.filter((r) => r.timestamp.startsWith("2026"));
      const jump = p24.length && p26.length
        ? `${(d3.median(p26, (r) => r.price_per_gb) / d3.median(p24, (r) => r.price_per_gb)).toFixed(1)}×`
        : "—";
      const invCrit = medInv < 8;

      root.html(`
        <div class="card-title" style="border-left-color:#2563eb">
          <strong>Resumo da Seleção (${active.length} kits)</strong>
          <span>Passe o mouse ou clique em um kit (A/B) para fixar 📌</span>
        </div>
        <div class="insp-gauges">
          ${metricBar("Preço Mediano / GB", `US$ ${f(2)(medPrice)}`, logRatio(medPrice, pMin, pMax), "#2563eb", `Salto 2024→2026: ${jump}`)}
          ${metricBar("Estoque Global Med.", `${f(1)(medInv)} sem.`, medInv / 16, invCrit ? "#dc2626" : "#0d9488", invCrit ? "⚠ Abaixo do limite crítico (8 sem.)" : "Acima do limite crítico (8 sem.)")}
          ${metricBar("Uso Mediano das Fabs", d3.format(".1%")(medFab), (medFab - 0.5) / 0.5, "#6366f1")}
          ${metricBar("Banda por US$ Med.", `${f(1)(medBw)} MB/s`, logRatio(medBw, bMin, bMax), "#0f172a")}
        </div>`);
      return;
    }

    const pinned = state.pinnedId === d.kit_id;
    const genColor = GEN_COLORS[d.generation];
    const invCrit = d.global_inventory_weeks < 8;

    root.html(`
      <div class="card-title" style="border-left-color:${genColor}">
        <strong>${d.model_name}</strong>
        <span><b style="color:${genColor}">${genShort(d.generation)}</b> · ${d.timestamp}${pinned ? " · 📌 fixado" : ""}</span>
      </div>
      <div class="insp-gauges">
        ${metricBar("Preço por GB", `US$ ${f(2)(d.price_per_gb)}`, logRatio(d.price_per_gb, pMin, pMax), genColor, `Total kit: US$ ${f(2)(d.price_usd)} · Prêmio: ${f(2)(d.speed_premium_ratio)}×`)}
        ${metricBar("Estoque Global", `${f(1)(d.global_inventory_weeks)} sem.`, d.global_inventory_weeks / 16, invCrit ? "#dc2626" : "#0d9488", invCrit ? "⚠ Zona Crítica (< 8 semanas)" : "Estoque normal (≥ 8 semanas)")}
        ${metricBar("Uso das Fabs", d3.format(".1%")(d.fab_utilization_rate), (d.fab_utilization_rate - 0.5) / 0.5, "#6366f1", `Demanda HBM GPU: ${f(0)(d.gpu_hbm_trend_gb)} GB`)}
        ${metricBar("Banda por US$", `${f(1)(d.bandwidth_per_dollar)} MB/s`, logRatio(d.bandwidth_per_dollar, bMin, bMax), "#0f172a")}
      </div>
      <table class="details-table">
        <tr><td>ID / Marca</td><td>${d.kit_id} · ${d.brand}</td></tr>
        <tr><td>Capacidade / Vel.</td><td>${d.capacity_gb} GB · ${f(0)(d.speed_mts)} MT/s</td></tr>
        <tr><td>Latência / Die</td><td>${f(1)(d.true_latency_ns)} ns · ${d.die_manufacturer}</td></tr>
        <tr><td>Segmento / Região</td><td>${d.market_segment} · ${d.region}</td></tr>
        <tr><td>Uso recomendado</td><td>${d.recommended_usage}</td></tr>
      </table>`);
  };

  state.on("hover", render);
  state.on("filter", render);
  render();
}
