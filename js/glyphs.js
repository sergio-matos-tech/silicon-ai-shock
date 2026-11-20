/**
 * View G - K5 "Market Health" Star Glyphs (2024 Baseline vs. 2026 / Active Selection).
 *
 * Metaphor:
 *   Multidimensional star/radar glyphs (6 cohorts = 3 Generations × 2 Market Segments).
 *   Five normalized radial axes (0..1):
 *     - Top / Right (Crisis stress): Preço/GB (log), Ágio Vel. (×), Uso Fabs (%)
 *     - Bottom-Left / Top-Left (Market health): Estoque (sem.), Banda/US$ (log)
 *   The dashed outline shows the 2024 pre-crisis shape; the filled polygon shows the
 *   2026 peak (or active time selection), revealing how every segment deforms under the shock.
 *
 * Interaction:
 *   Click any glyph card to filter the entire dashboard by (generation, market_segment).
 */
import {
  state,
  GEN_COLORS,
  SEGMENTS,
  genShort,
  segShort,
} from "./state.js";
import { mountSvg, showTooltip, hideTooltip, fmtNum, fmtPct } from "./common.js";

const AXES = [
  { key: "price_per_gb", short: "$/GB", label: "Preço / GB", log: true, fmt: (v) => `US$ ${fmtNum(2)(v)}` },
  { key: "speed_premium_ratio", short: "Ágio", label: "Ágio Veloc.", log: false, fmt: (v) => `${fmtNum(1)(v)}×` },
  { key: "fab_utilization_rate", short: "Fabs", label: "Uso das Fabs", log: false, fmt: (v) => fmtPct(0)(v) },
  { key: "global_inventory_weeks", short: "Estq", label: "Estoque Global", log: false, fmt: (v) => `${fmtNum(1)(v)}s` },
  { key: "bandwidth_per_dollar", short: "B/$", label: "Banda / US$", log: true, fmt: (v) => `${fmtNum(1)(v)}` },
];

const GROUPS = SEGMENTS.flatMap((segment, row) =>
  Object.keys(GEN_COLORS).map((generation, col) => ({
    generation,
    segment,
    row,
    col,
    id: `${generation}|${segment}`,
    title: `${genShort(generation)} · ${segShort(segment)}`,
  }))
);

export function initGlyphs(container) {
  let update = () => {};

  mountSvg(container, (svg, W, H) => {
    if (W < 120 || H < 120) return;

    const topBarH = 22;
    const padX = 8;
    const padY = 4;
    const availW = W - padX * 2;
    const availH = H - topBarH - padY * 2;

    const cols = 3;
    const rows = 2;
    const cellW = availW / cols;
    const cellH = availH / rows;
    const maxR = Math.max(15, Math.min(cellW * 0.27, (cellH - 36) * 0.36));

    // Normalization scales [0.12 .. 1.0] per axis across the full dataset
    const scales = {};
    for (const a of AXES) {
      const ext = d3.extent(state.data, (d) => d[a.key]);
      scales[a.key] = (a.log ? d3.scaleLog() : d3.scaleLinear())
        .domain(ext)
        .range([0.14, 1.0])
        .clamp(true);
    }

    const angleOf = (i) => (i * Math.PI * 2) / AXES.length;
    const pointOf = (i, normRadius) => {
      const ang = angleOf(i);
      const r = normRadius * maxR;
      return [Math.sin(ang) * r, -Math.cos(ang) * r];
    };

    const polyPoints = (metrics) => {
      if (!metrics) return "";
      return AXES.map((a, i) => pointOf(i, scales[a.key](metrics[a.key])).join(",")).join(" ");
    };

    const summarize = (records) => {
      if (!records || !records.length) return null;
      const out = { n: records.length };
      for (const a of AXES) {
        out[a.key] = d3.median(records, (d) => d[a.key]);
      }
      return out;
    };

    // Precompute 2024 baseline per group
    const base24Map = new Map();
    const full26Map = new Map();
    for (const grp of GROUPS) {
      const gRows = state.data.filter(
        (d) => d.generation === grp.generation && d.market_segment === grp.segment
      );
      base24Map.set(
        grp.id,
        summarize(gRows.filter((d) => d.timestamp.startsWith("2024")))
      );
      full26Map.set(
        grp.id,
        summarize(gRows.filter((d) => d.timestamp.startsWith("2026")))
      );
    }

    // Top legend bar
    const legG = svg.append("g").attr("transform", "translate(10, 4)");
    legG
      .append("line")
      .attr("x1", 0)
      .attr("x2", 16)
      .attr("y1", 7)
      .attr("y2", 7)
      .attr("class", "glyph-base-leg");
    legG
      .append("text")
      .attr("x", 20)
      .attr("y", 10)
      .attr("class", "wafer-leg-txt")
      .text("2024 (Pré-crise)");

    legG
      .append("rect")
      .attr("x", 112)
      .attr("y", 2)
      .attr("width", 12)
      .attr("height", 9)
      .attr("rx", 2)
      .attr("fill", "#0d9488")
      .attr("fill-opacity", 0.35)
      .attr("stroke", "#0d9488")
      .attr("stroke-width", 1.5);
    const activeLegTxt = legG
      .append("text")
      .attr("x", 128)
      .attr("y", 10)
      .attr("class", "wafer-leg-txt")
      .text("2026 (Pico da crise)");

    const gridG = svg.append("g").attr("transform", `translate(${padX}, ${topBarH + padY})`);

    const cards = gridG
      .selectAll("g.glyph-card")
      .data(GROUPS)
      .join("g")
      .attr("class", "glyph-card")
      .attr(
        "transform",
        (grp) => `translate(${grp.col * cellW + cellW / 2}, ${grp.row * cellH + cellH / 2})`
      )
      .style("cursor", "pointer")
      .on("click", (_, grp) => state.toggleGroup(grp.generation, grp.segment));

    // Card background
    cards
      .append("rect")
      .attr("class", "glyph-card-bg")
      .attr("x", -cellW / 2 + 2)
      .attr("y", -cellH / 2 + 1)
      .attr("width", cellW - 4)
      .attr("height", cellH - 3)
      .attr("rx", 6);

    // Card header (Generation + Segment + multiplier badge) at top corners
    const headY = -cellH / 2 + 13;
    cards
      .append("text")
      .attr("class", "glyph-title")
      .attr("x", -cellW / 2 + 7)
      .attr("y", headY)
      .attr("fill", (grp) => GEN_COLORS[grp.generation])
      .text((grp) => grp.title);

    const multBadges = cards
      .append("text")
      .attr("class", "glyph-mult")
      .attr("x", cellW / 2 - 7)
      .attr("y", headY)
      .attr("text-anchor", "end");

    // Shift the radar center downward so the top "$/GB" vertex never touches the card header
    const radarG = cards.append("g").attr("transform", "translate(0, 10)");

    // Concentric radar web rings (0.5 and 1.0)
    [0.5, 1.0].forEach((level) => {
      const ringPts = AXES.map((_, i) => pointOf(i, level).join(",")).join(" ");
      radarG
        .append("polygon")
        .attr("points", ringPts)
        .attr("class", "glyph-web-ring");
    });

    // Radial spokes & mini axis labels (anchored outward so labels never cross into the web)
    AXES.forEach((a, i) => {
      const [sx, sy] = pointOf(i, 1.0);
      const ang = angleOf(i);
      const labelR = maxR + (i === 0 ? 7 : 5);
      const lx = Math.sin(ang) * labelR;
      const ly = -Math.cos(ang) * labelR;
      const anchor = i === 0 ? "middle" : i <= 2 ? "start" : "end";
      radarG
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", sx)
        .attr("y2", sy)
        .attr("class", "glyph-spoke");
      radarG
        .append("text")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", anchor)
        .attr("dominant-baseline", "middle")
        .attr("class", "glyph-axis-lbl")
        .text(a.short);
    });

    // 2024 baseline polygon (dashed outline)
    radarG
      .append("polygon")
      .attr("class", "glyph-poly-base")
      .attr("points", (grp) => polyPoints(base24Map.get(grp.id)));

    // Active / 2026 polygon (filled in generation color)
    const activePolys = radarG
      .append("polygon")
      .attr("class", "glyph-poly-active")
      .attr("fill", (grp) => GEN_COLORS[grp.generation])
      .attr("stroke", (grp) => GEN_COLORS[grp.generation]);

    // Vertex dots on active polygon
    const vertexGroups = radarG.append("g").attr("class", "glyph-vertices");

    let activeStatsMap = new Map();

    cards
      .on("mousemove", (event, grp) => {
        const b = base24Map.get(grp.id);
        const cur = activeStatsMap.get(grp.id);
        const mult = b && cur ? `${fmtNum(1)(cur.price_per_gb / b.price_per_gb)}×` : "—";
        const rowsHtml = AXES.map(
          (a) =>
            `<div class="tip-row"><span>${a.label}</span><span>${b ? a.fmt(b[a.key]) : "—"} → <b>${cur ? a.fmt(cur[a.key]) : "—"}</b></span></div>`
        ).join("");
        showTooltip(
          event,
          `<div class="tip-title">${grp.generation} · ${grp.segment}</div>
           <div class="tip-row"><span>Salto Preço/GB</span><span><b>${mult}</b></span></div>
           ${rowsHtml}
           <div class="tip-foot"><span class="tip-hint">Clique para filtrar esta geração e segmento</span></div>`
        );
      })
      .on("mouseleave", hideTooltip);

    update = () => {
      const hasTimeOrOtherFilter =
        state.quarter !== null ||
        state.half !== null ||
        state.cell !== null ||
        state.usage !== null ||
        state.box !== null ||
        Object.keys(state.pcp).length > 0;

      activeLegTxt.text(
        state.quarter
          ? `Período (${state.quarter})`
          : state.half
          ? `Período (${state.half})`
          : hasTimeOrOtherFilter
          ? "Seleção filtrada"
          : "2026 (Pico da crise)"
      );

      activeStatsMap = new Map();
      for (const grp of GROUPS) {
        if (!hasTimeOrOtherFilter) {
          activeStatsMap.set(grp.id, full26Map.get(grp.id));
        } else {
          const matching = state.data.filter(
            (d) =>
              d.generation === grp.generation &&
              d.market_segment === grp.segment &&
              state.matches(d, { ignoreGen: true, ignoreSegment: true })
          );
          activeStatsMap.set(grp.id, summarize(matching));
        }
      }

      const activeGen = state.gen || state.cell?.generation || null;
      const activeSeg = state.segment || state.cell?.market_segment || null;

      cards
        .classed("active", (grp) => {
          if (!activeGen && !activeSeg) return false;
          const gOk = !activeGen || grp.generation === activeGen;
          const sOk = !activeSeg || grp.segment === activeSeg;
          return gOk && sOk;
        })
        .classed("dimmed", (grp) => {
          if (!activeGen && !activeSeg) return false;
          const gOk = !activeGen || grp.generation === activeGen;
          const sOk = !activeSeg || grp.segment === activeSeg;
          return !(gOk && sOk);
        });

      activePolys
        .attr("display", (grp) => (activeStatsMap.get(grp.id) ? null : "none"))
        .attr("points", (grp) => polyPoints(activeStatsMap.get(grp.id)));

      vertexGroups.each(function (grp) {
        const cur = activeStatsMap.get(grp.id);
        const pts = cur ? AXES.map((a, i) => pointOf(i, scales[a.key](cur[a.key]))) : [];
        d3.select(this)
          .selectAll("circle")
          .data(pts)
          .join("circle")
          .attr("cx", (p) => p[0])
          .attr("cy", (p) => p[1])
          .attr("r", 2.2)
          .attr("fill", GEN_COLORS[grp.generation])
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.9);
      });

      multBadges.text((grp) => {
        const b = base24Map.get(grp.id);
        const cur = activeStatsMap.get(grp.id);
        if (!b || !cur) return "—";
        return `${fmtNum(1)(cur.price_per_gb / b.price_per_gb)}×`;
      });
    };

    update();
  });

  state.on("filter", () => update());
}
