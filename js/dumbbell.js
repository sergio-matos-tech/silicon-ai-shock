/**
 * View D - Dumbbell chart: Pre-Crisis (2024) vs. Peak Shortage (2026) median US$/GB by usage.
 * Click a row to filter the other views by recommended_usage.
 */
import { state, USAGES } from "./state.js";
import { mountSvg, showTooltip, hideTooltip } from "./common.js";

const LABELS = {
  "AI / Data Science": "IA / Data Science",
  "Content Creation": "Criação Conteúdo",
  "Gaming (AAA)": "Gaming (AAA)",
  "Basic Productivity": "Produtividade",
};

const MARGIN = { top: 28, right: 64, bottom: 34, left: 118 };

/** Compute 2024 and 2026 median price_per_gb per usage category for the given record list. */
function usageStats(records) {
  return d3.rollup(
    records,
    (v) => {
      const p24 = v.filter((d) => d.timestamp.startsWith("2024"));
      const p26 = v.filter((d) => d.timestamp.startsWith("2026"));
      const m24 = p24.length ? d3.median(p24, (d) => d.price_per_gb) : null;
      const m26 = p26.length ? d3.median(p26, (d) => d.price_per_gb) : null;
      return {
        n: v.length,
        m24,
        m26,
        mult: m24 && m26 ? m26 / m24 : null,
      };
    },
    (d) => d.recommended_usage
  );
}

export function initDumbbell(container) {
  let update = () => {};

  mountSvg(container, (svg, W, H) => {
    const w = W - MARGIN.left - MARGIN.right;
    const h = H - MARGIN.top - MARGIN.bottom;
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const baseStats = usageStats(state.data);
    const baseMax = d3.max(USAGES, (u) => baseStats.get(u)?.m26 || 80);

    const x = d3.scaleLinear().domain([0, baseMax * 1.15]).range([0, w]).nice();
    const y = d3.scaleBand().domain(USAGES).range([0, h]).padding(0.28);

    // Subtle vertical grid lines
    g.append("g")
      .attr("class", "db-grid")
      .selectAll("line")
      .data(x.ticks(5))
      .join("line")
      .attr("x1", (d) => x(d))
      .attr("x2", (d) => x(d))
      .attr("y1", 0)
      .attr("y2", h);

    // Axes
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `$${d}`));
    g.append("g")
      .attr("class", "axis db-yaxis")
      .call(d3.axisLeft(y).tickSize(0).tickPadding(22).tickFormat((u) => LABELS[u] || u))
      .select(".domain")
      .remove();
    g.append("text")
      .attr("class", "axis-title")
      .attr("x", w / 2)
      .attr("y", h + 30)
      .attr("text-anchor", "middle")
      .text("Preço Mediano (US$/GB)");

    // Blue (2024) -> Red (2026) gradient (userSpaceOnUse so horizontal y1===y2 lines render)
    const grad = svg.append("defs").append("linearGradient").attr("id", "db-grad")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("x2", w).attr("y1", 0).attr("y2", 0);
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#dc2626");

    // Top inline legend (2024 -> 2026)
    const leg = g.append("g").attr("transform", "translate(0,-12)");
    leg.append("circle").attr("cx", 5).attr("cy", -3).attr("r", 4.5).attr("class", "db-dot-24");
    leg.append("text").attr("class", "legend-text").attr("x", 13).attr("y", 0).text("2024 (Pré-crise)");
    leg.append("circle").attr("cx", 110).attr("cy", -3).attr("r", 5).attr("class", "db-dot-26");
    leg.append("text").attr("class", "legend-text").attr("x", 119).attr("y", 0).text("2026 (Pico)");

    // One <g class="db-row"> per usage category
    const rows = g
      .selectAll("g.db-row")
      .data(USAGES)
      .join("g")
      .attr("class", "db-row")
      .attr("transform", (u) => `translate(0,${y(u)})`);

    const cy = y.bandwidth() / 2;

    // Clickable row background pill
    rows
      .append("rect")
      .attr("class", "db-row-bg")
      .attr("x", -MARGIN.left + 6)
      .attr("width", W - 12)
      .attr("height", y.bandwidth())
      .attr("rx", 4);

    // Baseline ghost connector (shows overall 2024->2026 jump behind filtered subset)
    rows
      .append("line")
      .attr("class", "db-ghost-line")
      .attr("y1", cy)
      .attr("y2", cy)
      .attr("x1", (u) => x(baseStats.get(u).m24))
      .attr("x2", (u) => x(baseStats.get(u).m26));

    // Active connector line + dots + labels
    const conn = rows.append("line").attr("class", "db-line").attr("y1", cy).attr("y2", cy);
    const dot24 = rows.append("circle").attr("class", "db-dot-24").attr("cy", cy).attr("r", 5.5);
    const dot26 = rows.append("circle").attr("class", "db-dot-26").attr("cy", cy).attr("r", 6.5);
    const lbl24 = rows.append("text").attr("class", "db-lbl-24").attr("y", cy).attr("dy", "0.35em").attr("text-anchor", "end");
    const lbl26 = rows.append("text").attr("class", "db-lbl-26").attr("y", cy).attr("dy", "0.35em");

    let stats = baseStats;
    rows
      .on("click", (_, u) => state.toggleUsage(u))
      .on("mousemove", (event, u) => {
        const s = stats.get(u) || { n: 0, m24: null, m26: null, mult: null };
        showTooltip(
          event,
          `<div class="tip-title">${u}</div>
           <div class="tip-row"><span>2024 (Pré-crise)</span><span>${s.m24 != null ? `US$ ${s.m24.toFixed(2)}/GB` : "—"}</span></div>
           <div class="tip-row"><span>2026 (Pico)</span><span>${s.m26 != null ? `US$ ${s.m26.toFixed(2)}/GB` : "—"}</span></div>
           <div class="tip-row"><span>Salto 2024→2026</span><span>${s.mult ? `${s.mult.toFixed(1)}×` : "—"}</span></div>
           <div class="tip-row"><span>Kits no filtro</span><span>${s.n}</span></div>`
        );
      })
      .on("mouseleave", hideTooltip);

    update = () => {
      const subset = state.data.filter((d) => state.matches(d, { ignoreUsage: true, ignoreHalf: true }));
      stats = usageStats(subset);

      // Rescale X domain if a selected segment (e.g. DDR6) has higher prices than the overall median
      const curMax = d3.max(USAGES, (u) => Math.max(stats.get(u)?.m26 || 0, baseStats.get(u)?.m26 || 0));
      x.domain([0, (curMax || baseMax) * 1.18]).nice();
      g.select(".axis").call(d3.axisBottom(x).ticks(5).tickFormat((d) => `$${d}`));
      g.select(".db-grid")
        .selectAll("line")
        .data(x.ticks(5))
        .join("line")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", 0)
        .attr("y2", h);
      rows
        .select(".db-ghost-line")
        .attr("x1", (u) => x(baseStats.get(u).m24))
        .attr("x2", (u) => x(baseStats.get(u).m26));

      rows
        .classed("active", (u) => state.usage === u)
        .classed("dimmed", (u) => state.usage !== null && state.usage !== u)
        .classed("empty", (u) => !stats.get(u)?.n);

      conn
        .attr("display", (u) => (stats.get(u)?.m24 != null && stats.get(u)?.m26 != null ? null : "none"))
        .attr("x1", (u) => x(stats.get(u)?.m24 || 0))
        .attr("x2", (u) => x(stats.get(u)?.m26 || 0));

      dot24
        .attr("display", (u) => (stats.get(u)?.m24 != null ? null : "none"))
        .attr("cx", (u) => x(stats.get(u)?.m24 || 0));

      dot26
        .attr("display", (u) => (stats.get(u)?.m26 != null ? null : "none"))
        .attr("cx", (u) => x(stats.get(u)?.m26 || 0));

      lbl24
        .attr("display", (u) => (stats.get(u)?.m24 != null ? null : "none"))
        .attr("x", (u) => x(stats.get(u)?.m24 || 0) - 8)
        .text((u) => (stats.get(u)?.m24 != null ? `$${stats.get(u).m24.toFixed(0)}` : ""));

      lbl26
        .attr("display", (u) => (stats.get(u)?.m26 != null ? null : "none"))
        .attr("x", (u) => x(stats.get(u)?.m26 || 0) + 9)
        .text((u) => {
          const s = stats.get(u);
          if (!s || s.m26 == null) return "";
          return s.mult ? `$${s.m26.toFixed(0)} (${s.mult.toFixed(1)}×)` : `$${s.m26.toFixed(0)}`;
        });
    };

    update();
  });

  state.on("filter", () => update());
}
