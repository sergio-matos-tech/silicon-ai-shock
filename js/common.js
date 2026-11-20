/** Helpers shared by the views: responsive SVG mounting, tooltip and formatting. */
import { INFLATED, genShort, GEN_COLORS } from "./state.js";

/**
 * Fills `container` with an SVG and calls draw(svg, width, height) now and
 * again whenever the container is resized, so every view fits its grid cell.
 */
export function mountSvg(container, draw) {
  const svg = d3.select(container).append("svg");
  let lastW = 0;
  let lastH = 0;
  const render = () => {
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0 || (width === lastW && height === lastH)) return;
    lastW = width;
    lastH = height;
    svg.attr("width", width).attr("height", height).selectAll("*").remove();
    draw(svg, width, height);
  };
  render();
  new ResizeObserver(render).observe(container);
}

const tip = () => d3.select("#tooltip");

export function showTooltip(event, html) {
  const t = tip().classed("hidden", false).html(html);
  const { width, height } = t.node().getBoundingClientRect();
  const x = event.clientX + 14 + width > innerWidth ? event.clientX - width - 14 : event.clientX + 14;
  const y = event.clientY + 14 + height > innerHeight ? event.clientY - height - 14 : event.clientY + 14;
  t.style("left", `${x}px`).style("top", `${y}px`);
}

export function hideTooltip() {
  tip().classed("hidden", true);
}

export const statusBadge = (status) =>
  status === INFLATED
    ? `<span class="status-badge inflated">Inflado pela escassez</span>`
    : `<span class="status-badge normal">Preço normal</span>`;

export function kitTooltip(d) {
  return `
    <div class="tip-title"><i class="tip-swatch" style="background:${GEN_COLORS[d.generation]}"></i>${d.model_name}</div>
    <div class="tip-row"><span>Data</span><span>${d.timestamp}</span></div>
    <div class="tip-row"><span>Geração · Capacidade</span><span>${genShort(d.generation)} · ${d.capacity_gb} GB</span></div>
    <div class="tip-row"><span>Estoque global</span><span>${d.global_inventory_weeks.toFixed(1)} sem.</span></div>
    <div class="tip-row"><span>Preço por GB</span><span>US$ ${d.price_per_gb.toFixed(2)}</span></div>
    <div class="tip-foot">${statusBadge(d.price_status)}</div>`;
}

/** "US$ 1.234,56"-style helpers (pt-BR decimal comma, thin and readable). */
export const ptBR = d3.formatLocale({ decimal: ",", thousands: ".", grouping: [3], currency: ["US$ ", ""] });
export const fmtNum = (digits) => ptBR.format(`,.${digits}f`);
export const fmtPct = (digits = 0) => ptBR.format(`.${digits}%`);
