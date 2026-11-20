/** Helpers shared by the views: responsive SVG mounting and the tooltip. */

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

export function kitTooltip(d) {
  return `
    <div class="tip-title">${d.model_name}</div>
    <div class="tip-row"><span>Data</span><span>${d.timestamp}</span></div>
    <div class="tip-row"><span>Capacidade</span><span>${d.capacity_gb} GB</span></div>
    <div class="tip-row"><span>Estoque global</span><span>${d.global_inventory_weeks.toFixed(1)} sem.</span></div>
    <div class="tip-row"><span>Preço por GB</span><span>US$ ${d.price_per_gb.toFixed(2)}</span></div>`;
}

/**
 * Separates vertically crowded label positions ({ y }) by at least `minGap` pixels
 * while staying within [minY, maxY]. Returns a Map from item to adjusted y.
 */
export function deoverlapY(items, minGap = 14, minY = 0, maxY = Infinity) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < minGap) {
      sorted[i].y = sorted[i - 1].y + minGap;
    }
  }
  if (sorted.length && sorted[sorted.length - 1].y > maxY) {
    sorted[sorted.length - 1].y = maxY;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i + 1].y - sorted[i].y < minGap) {
        sorted[i].y = sorted[i + 1].y - minGap;
      }
    }
  }
  if (sorted.length && sorted[0].y < minY) sorted[0].y = minY;
  return new Map(sorted.map((d) => [d.key, d.y]));
}
