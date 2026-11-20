/**
 * View G - Value Erosion Slope Chart: Bandwidth per US$ (2024 vs. 2026) by Generation.
 * Contrasts with View F: as price/GB surges, hardware value per dollar collapses 66%-86%.
 * Click a generation slope or label to filter the dashboard.
 */
import { state, GEN_COLORS, genShort } from "./state.js";
import { mountSvg, showTooltip, hideTooltip, deoverlapY } from "./common.js";

const MARGIN = { top: 26, right: 112, bottom: 26, left: 68 };
const GENS = Object.keys(GEN_COLORS);

function valueStats(records) {
  return d3.rollup(
    records,
    (v) => {
      const p24 = v.filter((d) => d.timestamp.startsWith("2024"));
      const p26 = v.filter((d) => d.timestamp.startsWith("2026"));
      const v24 = p24.length ? d3.median(p24, (d) => d.bandwidth_per_dollar) : null;
      const v26 = p26.length ? d3.median(p26, (d) => d.bandwidth_per_dollar) : null;
      const pct = v24 && v26 ? ((v26 - v24) / v24) * 100 : null;
      return { n: v.length, v24, v26, pct };
    },
    (d) => d.generation
  );
}

export function initValue(container) {
  let update = () => {};

  mountSvg(container, (svg, W, H) => {
    const w = W - MARGIN.left - MARGIN.right;
    const h = H - MARGIN.top - MARGIN.bottom;
    if (w <= 40 || h <= 40) return;

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    const baseStats = valueStats(state.data);
    const baseMax = d3.max(GENS, (gen) => baseStats.get(gen)?.v24 || 0) || 180;

    const x24 = 0;
    const x26 = w;
    const y = d3.scaleLinear().domain([0, baseMax * 1.1]).range([h, 0]).nice();

    // Two vertical column guides + header labels
    for (const [xpos, title] of [[x24, "2024 (Pré-crise)"], [x26, "2026 (Pico)"]]) {
      g.append("line").attr("class", "val-axis-line").attr("x1", xpos).attr("x2", xpos).attr("y1", 0).attr("y2", h);
      g.append("text").attr("class", "axis-title").attr("x", xpos).attr("y", -10).attr("text-anchor", "middle").text(title);
    }

    // Ghost baseline slopes
    const ghosts = g.append("g").selectAll("line.val-ghost").data(GENS).join("line")
      .attr("class", "val-ghost")
      .attr("x1", x24).attr("x2", x26)
      .attr("y1", (gen) => y(baseStats.get(gen)?.v24 || 0))
      .attr("y2", (gen) => y(baseStats.get(gen)?.v26 || 0));

    // Active generation slope rows
    const rows = g.selectAll("g.val-row").data(GENS).join("g").attr("class", "val-row")
      .on("click", (_, gen) => state.toggleGen(gen));

    const lines = rows.append("line").attr("class", "val-line").attr("x1", x24).attr("x2", x26)
      .attr("stroke", (gen) => GEN_COLORS[gen]);
    const hits = rows.append("line").attr("class", "val-hit").attr("x1", x24).attr("x2", x26);
    const dot24 = rows.append("circle").attr("class", "val-dot").attr("cx", x24).attr("r", 4.5)
      .attr("fill", (gen) => GEN_COLORS[gen]);
    const dot26 = rows.append("circle").attr("class", "val-dot").attr("cx", x26).attr("r", 5)
      .attr("fill", (gen) => GEN_COLORS[gen]);
    const lbl24 = rows.append("text").attr("class", "val-lbl-left").attr("x", x24 - 8)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .attr("fill", (gen) => GEN_COLORS[gen]);
    const lbl26 = rows.append("text").attr("class", "val-lbl-right").attr("x", x26 + 8)
      .attr("text-anchor", "start").attr("dominant-baseline", "middle")
      .attr("fill", (gen) => GEN_COLORS[gen]);

    let stats = baseStats;
    rows
      .on("mousemove", (event, gen) => {
        const s = stats.get(gen) || { n: 0, v24: null, v26: null, pct: null };
        showTooltip(
          event,
          `<div class="tip-title">${gen}</div>
           <div class="tip-row"><span>2024 (Pré-crise)</span><span>${s.v24 != null ? `${s.v24.toFixed(1)} MB/s/$` : "—"}</span></div>
           <div class="tip-row"><span>2026 (Pico)</span><span>${s.v26 != null ? `${s.v26.toFixed(1)} MB/s/$` : "—"}</span></div>
           <div class="tip-row"><span>Perda de valor</span><span>${s.pct != null ? `${s.pct.toFixed(0)}%` : "—"}</span></div>
           <div class="tip-row"><span>Kits no filtro</span><span>${s.n}</span></div>`
        );
      })
      .on("mouseleave", hideTooltip);

    update = () => {
      const subset = state.data.filter((d) => state.matches(d, { ignoreGen: true, ignoreHalf: true }));
      stats = valueStats(subset);

      const curMax = d3.max(GENS, (gen) => Math.max(stats.get(gen)?.v24 || 0, baseStats.get(gen)?.v24 || 0));
      y.domain([0, (curMax || baseMax) * 1.1]).nice();

      ghosts
        .attr("y1", (gen) => y(baseStats.get(gen)?.v24 || 0))
        .attr("y2", (gen) => y(baseStats.get(gen)?.v26 || 0));

      const activeGen = state.gen || state.cell?.generation || null;
      rows
        .classed("dimmed", (gen) => activeGen !== null && activeGen !== gen)
        .classed("empty", (gen) => !stats.get(gen)?.n);

      const hasBoth = (gen) => stats.get(gen)?.v24 != null && stats.get(gen)?.v26 != null;

      lines
        .attr("display", (gen) => (hasBoth(gen) ? null : "none"))
        .attr("y1", (gen) => y(stats.get(gen)?.v24 || 0))
        .attr("y2", (gen) => y(stats.get(gen)?.v26 || 0));
      hits
        .attr("display", (gen) => (hasBoth(gen) ? null : "none"))
        .attr("y1", (gen) => y(stats.get(gen)?.v24 || 0))
        .attr("y2", (gen) => y(stats.get(gen)?.v26 || 0));

      dot24
        .attr("display", (gen) => (stats.get(gen)?.v24 != null ? null : "none"))
        .attr("cy", (gen) => y(stats.get(gen)?.v24 || 0));
      dot26
        .attr("display", (gen) => (stats.get(gen)?.v26 != null ? null : "none"))
        .attr("cy", (gen) => y(stats.get(gen)?.v26 || 0));

      const leftPos = deoverlapY(
        GENS.filter((gen) => stats.get(gen)?.v24 != null).map((gen) => ({ key: gen, y: y(stats.get(gen).v24) })),
        14, 6, h - 6
      );
      const rightPos = deoverlapY(
        GENS.filter((gen) => stats.get(gen)?.v26 != null).map((gen) => ({ key: gen, y: y(stats.get(gen).v26) })),
        15, 6, h - 6
      );

      lbl24
        .attr("display", (gen) => (leftPos.has(gen) ? null : "none"))
        .attr("y", (gen) => leftPos.get(gen) ?? 0)
        .text((gen) => (stats.get(gen)?.v24 != null ? `${stats.get(gen).v24.toFixed(0)} MB/s` : ""));

      lbl26
        .attr("display", (gen) => (rightPos.has(gen) ? null : "none"))
        .attr("y", (gen) => rightPos.get(gen) ?? 0)
        .text((gen) => {
          const s = stats.get(gen);
          if (!s || s.v26 == null) return "";
          const pct = s.pct != null ? ` (${s.pct.toFixed(0)}%)` : "";
          return `${genShort(gen)}: ${s.v26.toFixed(0)}${pct}`;
        });
    };

    update();
  });

  state.on("filter", () => update());
}
