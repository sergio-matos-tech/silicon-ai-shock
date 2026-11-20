/**
 * View F - K2 Silicon "Wafer Yield Map" Small Multiples (6 Semesters: 2024-H1..2026-H2).
 *
 * Metaphor:
 *   Semiconductor wafer yield inspection maps. Each half-year is a circular silicon wafer
 *   with a flat alignment notch at 6 o'clock. Every die on the wafer is one DRAM kit from
 *   the 300-kit sample, arranged on a circular die lattice.
 *
 * Modes (toggle in top-right of canvas):
 *   - "status" : Normal (emerald) vs. Shortage-Inflated (crimson) — shows contagion hitting 100%
 *   - "price"  : Log price_per_gb (YlOrRd)
 *   - "gen"    : Memory generation (DDR4 / DDR5 / DDR6)
 *
 * Interactions:
 *   - Hover a die -> highlights the kit in PCP, Scatter, and Inspector + tooltip
 *   - Click a die -> pins the kit in Inspector
 *   - Click a wafer header or rim -> filters all views by that half-year
 */
import {
  state,
  HALVES,
  GEN_COLORS,
  INFLATED,
  halfOf,
  halfOfQuarter,
} from "./state.js";
import { mountSvg, showTooltip, hideTooltip, kitTooltip, fmtNum, fmtPct } from "./common.js";

const CANDIDATE_GRID = [];
for (let iy = -4; iy <= 4; iy++) {
  for (let ix = -4; ix <= 4; ix++) {
    CANDIDATE_GRID.push({ ix, iy, d2: ix * ix + iy * iy });
  }
}
CANDIDATE_GRID.sort((a, b) => a.d2 - b.d2 || a.iy - b.iy || a.ix - b.ix);

/** Pick the N lattice cells closest to the wafer center, ordered top-to-bottom, left-to-right. */
function waferLattice(n) {
  return CANDIDATE_GRID.slice(0, n)
    .slice()
    .sort((a, b) => a.iy - b.iy || a.ix - b.ix);
}

const GEN_ORDER = { DDR4: 0, DDR5: 1, "DDR6 (Preview)": 2 };

export function initWafer(container) {
  let colorMode = "status"; // "status" | "price" | "gen"
  let update = () => {};
  let updateHover = () => {};

  mountSvg(container, (svg, W, H) => {
    if (W < 120 || H < 120) return;

    const topBarH = 24;
    const padX = 8;
    const padY = 4;
    const availW = W - padX * 2;
    const availH = H - topBarH - padY * 2;

    const cols = 3;
    const rows = 2;
    const cellW = availW / cols;
    const cellH = availH / rows;
    const waferR = Math.max(22, Math.min(cellW * 0.37, (cellH - 24) * 0.44));
    const diePitch = (waferR * 1.72) / 9;
    const dieSize = Math.max(2.3, diePitch - 1.0);

    const [pMin, pMax] = d3.extent(state.data, (d) => d.price_per_gb);
    const colorPrice = d3.scaleSequentialLog(d3.interpolateYlOrRd).domain([pMin, pMax]);

    const dieFill = (d) => {
      if (colorMode === "status") {
        return d.price_status === INFLATED ? "#ef4444" : "#10b981";
      }
      if (colorMode === "price") {
        return colorPrice(d.price_per_gb);
      }
      return GEN_COLORS[d.generation];
    };

    // --- Top Legend & Mode Switcher inside SVG ---
    const barG = svg.append("g").attr("transform", "translate(10, 4)");

    const legendG = barG.append("g").attr("transform", "translate(0, 4)");
    const renderLegend = () => {
      legendG.selectAll("*").remove();
      if (colorMode === "status") {
        legendG.append("rect").attr("width", 9).attr("height", 9).attr("rx", 1.5).attr("fill", "#10b981");
        legendG.append("text").attr("x", 13).attr("y", 8).attr("class", "wafer-leg-txt").text("Normal");
        legendG.append("rect").attr("x", 60).attr("width", 9).attr("height", 9).attr("rx", 1.5).attr("fill", "#ef4444");
        legendG.append("text").attr("x", 73).attr("y", 8).attr("class", "wafer-leg-txt").text("Inflado pela escassez");
      } else if (colorMode === "price") {
        legendG.append("text").attr("x", 0).attr("y", 8).attr("class", "wafer-leg-txt")
          .text(`Escala log: US$ ${fmtNum(0)(pMin)} → US$ ${fmtNum(0)(pMax)}/GB`);
      } else {
        let ox = 0;
        Object.entries(GEN_COLORS).forEach(([gName, col]) => {
          const lbl = gName.replace(" (Preview)", "");
          legendG.append("rect").attr("x", ox).attr("width", 9).attr("height", 9).attr("rx", 1.5).attr("fill", col);
          legendG.append("text").attr("x", ox + 12).attr("y", 8).attr("class", "wafer-leg-txt").text(lbl);
          ox += 52;
        });
      }
    };

    const modes = [
      { id: "status", label: "Contágio" },
      { id: "price", label: "US$/GB" },
      { id: "gen", label: "Geração" },
    ];
    const modeG = svg.append("g").attr("transform", `translate(${W - 178}, 3)`);
    const modeBtns = modeG
      .selectAll("g.wafer-mode-btn")
      .data(modes)
      .join("g")
      .attr("class", "wafer-mode-btn")
      .attr("transform", (_, i) => `translate(${i * 57}, 0)`)
      .style("cursor", "pointer")
      .on("click", (_, m) => {
        colorMode = m.id;
        renderLegend();
        update();
      });
    modeBtns
      .append("rect")
      .attr("width", 54)
      .attr("height", 18)
      .attr("rx", 9)
      .attr("class", "wafer-mode-rect");
    modeBtns
      .append("text")
      .attr("x", 27)
      .attr("y", 12.5)
      .attr("text-anchor", "middle")
      .attr("class", "wafer-mode-txt")
      .text((m) => m.label);

    renderLegend();

    // Group kits by half-year and compute die positions
    const byHalf = d3.group(state.data, halfOf);
    const wafersData = HALVES.map((half, idx) => {
      const kits = (byHalf.get(half) || [])
        .slice()
        .sort(
          (a, b) =>
            GEN_ORDER[a.generation] - GEN_ORDER[b.generation] ||
            (a.price_status === INFLATED ? 1 : 0) - (b.price_status === INFLATED ? 1 : 0) ||
            a.price_per_gb - b.price_per_gb
        );
      const lattice = waferLattice(kits.length);
      const dies = kits.map((kit, i) => ({
        kit,
        ix: lattice[i].ix,
        iy: lattice[i].iy,
      }));
      return {
        half,
        col: idx % cols,
        row: Math.floor(idx / cols),
        dies,
      };
    });

    const gridG = svg.append("g").attr("transform", `translate(${padX}, ${topBarH + padY})`);

    const waferGroups = gridG
      .selectAll("g.wafer-cell")
      .data(wafersData)
      .join("g")
      .attr("class", "wafer-cell")
      .attr(
        "transform",
        (w) => `translate(${w.col * cellW + cellW / 2}, ${w.row * cellH + cellH / 2})`
      );

    // Clickable card backdrop
    waferGroups
      .append("rect")
      .attr("class", "wafer-card-bg")
      .attr("x", -cellW / 2 + 3)
      .attr("y", -cellH / 2 + 1)
      .attr("width", cellW - 6)
      .attr("height", cellH - 3)
      .attr("rx", 6)
      .on("click", (_, w) => state.toggleHalf(w.half));

    // Semester header + inflated % pill anchored to card corners above the wafer disc
    const headerY = -cellH / 2 + 13;
    const discY = 7;
    waferGroups
      .append("text")
      .attr("class", "wafer-half-title")
      .attr("x", -cellW / 2 + 10)
      .attr("y", headerY)
      .text((w) => w.half)
      .on("click", (_, w) => state.toggleHalf(w.half));

    const rateLabels = waferGroups
      .append("text")
      .attr("class", "wafer-rate-lbl")
      .attr("x", cellW / 2 - 10)
      .attr("y", headerY)
      .attr("text-anchor", "end")
      .on("click", (_, w) => state.toggleHalf(w.half));

    // Silicon wafer substrate disc + alignment flat notch at bottom
    const discG = waferGroups.append("g").attr("transform", `translate(0, ${discY})`);

    discG
      .append("circle")
      .attr("class", "wafer-disc")
      .attr("r", waferR)
      .on("click", (_, w) => state.toggleHalf(w.half));

    // Inner scribe ring
    discG
      .append("circle")
      .attr("class", "wafer-scribe")
      .attr("r", waferR - 2.5)
      .style("pointer-events", "none");

    // Wafer alignment notch at 6 o'clock
    discG
      .append("path")
      .attr("class", "wafer-notch")
      .attr("d", `M -4,${waferR - 1} L 0,${waferR - 4.5} L 4,${waferR - 1} Z`)
      .style("pointer-events", "none");

    // Dies inside each wafer
    const allDies = discG
      .append("g")
      .attr("class", "wafer-dies")
      .selectAll("rect.wafer-die")
      .data((w) => w.dies)
      .join("rect")
      .attr("class", "wafer-die")
      .attr("x", (d) => d.ix * diePitch - dieSize / 2)
      .attr("y", (d) => d.iy * diePitch - dieSize / 2)
      .attr("width", dieSize)
      .attr("height", dieSize)
      .attr("rx", 1.1)
      .on("mouseenter", (event, d) => {
        state.setHover(d.kit.kit_id);
        showTooltip(event, kitTooltip(d.kit));
      })
      .on("mousemove", (event, d) => showTooltip(event, kitTooltip(d.kit)))
      .on("mouseleave", () => {
        state.setHover(null);
        hideTooltip();
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        state.togglePin(d.kit.kit_id);
      });

    update = () => {
      modeBtns.classed("active", (m) => m.id === colorMode);

      const activeHalf =
        state.half || state.cell?.half || (state.quarter ? halfOfQuarter(state.quarter) : null);

      waferGroups
        .classed("active", (w) => w.half === activeHalf)
        .classed("dimmed", (w) => activeHalf !== null && w.half !== activeHalf);

      // Compute active stats per wafer (ignoring time filter so all 6 wafers show their stats)
      rateLabels.each(function (w) {
        const matching = w.dies.filter((d) => state.matches(d.kit, { ignoreHalf: true }));
        const el = d3.select(this);
        if (!matching.length) {
          el.text("0 kits").attr("fill", "#94a3b8");
          return;
        }
        if (colorMode === "price") {
          const med = d3.median(matching, (d) => d.kit.price_per_gb);
          el.text(`$${fmtNum(0)(med)}/GB`).attr("fill", "#b91c1c");
        } else {
          const share = d3.mean(matching, (d) => (d.kit.price_status === INFLATED ? 1 : 0));
          el.text(`${fmtPct(0)(share)} infl.`).attr(
            "fill",
            share > 0.8 ? "#dc2626" : share > 0.1 ? "#d97706" : "#059669"
          );
        }
      });

      allDies
        .attr("fill", (d) => dieFill(d.kit))
        .classed("out", (d) => !state.selected.has(d.kit.kit_id));

      updateHover();
    };

    updateHover = () => {
      allDies.classed("hover", (d) => state.isHighlighted(d.kit.kit_id));
      allDies.filter(".hover").raise();
    };

    update();
  });

  state.on("filter", () => update());
  state.on("hover", () => updateHover());
}
