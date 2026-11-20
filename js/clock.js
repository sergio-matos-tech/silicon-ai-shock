/**
 * View E - K1 "Doomsday Crisis Clock" (12 Quarters = 12 Hours to Midnight)
 *        + K3 "Draining Inventory Reservoir" (Supply Buffer Tank).
 *
 * Metaphor:
 *   - 12 quarters (2024Q1..2026Q4) map to the 12 hours of a clock face ending at Midnight (2026Q4).
 *   - Three concentric radial heatmap rings encode Price/GB (outer), Inflated Share % (middle),
 *     and Fab Utilization % (inner).
 *   - Drag the clock hand (d3.drag) or click any sector to scrub time across all views,
 *     or press "▶ Animar" to play the 2024->2026 crisis progression.
 *   - On the right, a vertical reservoir tank drains from 14.5 weeks to 3.5 weeks, crossing
 *     the 8-week "dead storage" critical line.
 */
import {
  state,
  QUARTERS,
  CRITICAL_WEEKS,
  INFLATED,
  quarterLabel,
  halfOfQuarter,
} from "./state.js";
import { mountSvg, showTooltip, hideTooltip, fmtNum, fmtPct } from "./common.js";

let playTimer = null;

export function initClock(container) {
  let update = () => {};

  mountSvg(container, (svg, W, H) => {
    if (W < 120 || H < 120) return;

    const quarters = state.agg.quarters || [];
    const qMap = new Map(quarters.map((q) => [q.quarter, q]));

    // Split canvas: Left ~58% for Radial Clock, Right ~42% for Inventory Reservoir
    const clockW = Math.floor(W * 0.58);
    const tankW = W - clockW;
    const topBand = 16;
    const botBand = 18;
    const availClockH = Math.max(80, H - topBand - botBand);
    const cx = Math.floor(clockW * 0.55);
    const cy = Math.floor(topBand + availClockH * 0.5);
    const maxR = Math.max(38, Math.min(clockW * 0.36, availClockH * 0.39));

    const rHub = Math.max(23, maxR * 0.4);
    const r1 = Math.max(rHub + 7, maxR * 0.58); // inner ring: fab utilization
    const r2 = Math.max(r1 + 7, maxR * 0.77); // middle ring: % shortage-inflated
    const r3 = Math.max(r2 + 7, maxR * 0.96); // outer ring: median price/GB

    // Scales for the 3 concentric rings
    const pExtent = d3.extent(quarters, (d) => d.price_per_gb);
    const colorPrice = d3.scaleSequentialLog(d3.interpolateYlOrRd).domain(pExtent);
    const colorInfl = d3
      .scaleLinear()
      .domain([0, 0.5, 1])
      .range(["#10b981", "#f59e0b", "#dc2626"]);
    const colorFab = d3.scaleSequential(d3.interpolatePurples).domain([0.45, 0.96]);

    // 12 quarters mapped to 1..12 o'clock (each sector is 30 deg = pi/6 rad).
    // Index i (0..11) is centered at angle (i + 1) * pi / 6, so index 11 (2026Q4) is at 2*pi (12 o'clock Midnight).
    const stepRad = (Math.PI * 2) / 12;
    const startAngleOf = (i) => (i + 1) * stepRad - stepRad / 2;
    const endAngleOf = (i) => (i + 1) * stepRad + stepRad / 2;
    const midAngleOf = (i) => (i + 1) * stepRad;

    const arcOuter = d3
      .arc()
      .innerRadius(r2 + 1.5)
      .outerRadius(r3)
      .startAngle((_, i) => startAngleOf(i))
      .endAngle((_, i) => endAngleOf(i))
      .padAngle(0.022)
      .cornerRadius(2);

    const arcMid = d3
      .arc()
      .innerRadius(r1 + 1.5)
      .outerRadius(r2)
      .startAngle((_, i) => startAngleOf(i))
      .endAngle((_, i) => endAngleOf(i))
      .padAngle(0.022)
      .cornerRadius(2);

    const arcInner = d3
      .arc()
      .innerRadius(rHub + 2)
      .outerRadius(r1)
      .startAngle((_, i) => startAngleOf(i))
      .endAngle((_, i) => endAngleOf(i))
      .padAngle(0.022)
      .cornerRadius(2);

    // Top bar inside SVG: Play/Pause button + Ring legend
    const ctrlG = svg.append("g").attr("transform", "translate(10, 8)");
    const playBtn = ctrlG
      .append("g")
      .attr("class", "clock-play-btn")
      .style("cursor", "pointer")
      .on("click", () => {
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = null;
          update();
          return;
        }
        let idx = QUARTERS.indexOf(state.quarter || QUARTERS[0]);
        if (idx < 0 || idx >= QUARTERS.length - 1) idx = 0;
        state.setQuarter(QUARTERS[idx]);
        playTimer = setInterval(() => {
          idx += 1;
          if (idx >= QUARTERS.length) {
            clearInterval(playTimer);
            playTimer = null;
            update();
            return;
          }
          state.setQuarter(QUARTERS[idx]);
        }, 850);
        update();
      });

    playBtn
      .append("rect")
      .attr("width", 66)
      .attr("height", 19)
      .attr("rx", 9.5)
      .attr("class", "clock-play-rect");
    const playTxt = playBtn
      .append("text")
      .attr("x", 33)
      .attr("y", 13)
      .attr("text-anchor", "middle")
      .attr("class", "clock-play-text")
      .text("▶ Animar");

    // Reset time button stacked neatly below Play button so 12 o'clock is unobstructed
    const allBtn = ctrlG
      .append("g")
      .attr("class", "clock-all-btn")
      .attr("transform", "translate(0, 22)")
      .style("cursor", "pointer")
      .on("click", () => {
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = null;
        }
        state.setQuarter(null);
        if (state.half) state.toggleHalf(state.half);
      });
    allBtn
      .append("rect")
      .attr("width", 66)
      .attr("height", 18)
      .attr("rx", 9)
      .attr("class", "clock-all-rect");
    allBtn
      .append("text")
      .attr("x", 33)
      .attr("y", 12.5)
      .attr("text-anchor", "middle")
      .attr("class", "clock-all-text")
      .text("Todos 24–26");

    // Clock group
    const clockG = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    // Outer subtle bezel circle
    clockG
      .append("circle")
      .attr("r", r3 + 4)
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 1);

    // Sectors
    const sectors = clockG
      .selectAll("g.clock-sector")
      .data(quarters)
      .join("g")
      .attr("class", "clock-sector")
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = null;
        }
        state.setQuarter(state.quarter === d.quarter ? null : d.quarter);
      })
      .on("mousemove", (event, d) => {
        showTooltip(
          event,
          `<div class="tip-title">Relógio da Crise · ${quarterLabel(d.quarter)}</div>
           <div class="tip-row"><span>Anel externo · Preço/GB</span><span>US$ ${fmtNum(2)(d.price_per_gb)}</span></div>
           <div class="tip-row"><span>Anel médio · Listagens infladas</span><span>${fmtPct(0)(d.inflated_share)}</span></div>
           <div class="tip-row"><span>Anel interno · Uso das fabs</span><span>${fmtPct(1)(d.fab_utilization_rate)}</span></div>
           <div class="tip-row"><span>Estoque global</span><span>${fmtNum(1)(d.global_inventory_weeks)} sem.</span></div>
           <div class="tip-row"><span>Demanda HBM GPU</span><span>${fmtNum(0)(d.gpu_hbm_trend_gb)} GB</span></div>
           <div class="tip-foot"><span class="tip-hint">Clique para filtrar ${quarterLabel(d.quarter)} ou arraste o ponteiro</span></div>`
        );
      })
      .on("mouseleave", hideTooltip);

    sectors
      .append("path")
      .attr("class", "clock-arc-outer")
      .attr("d", arcOuter)
      .attr("fill", (d) => colorPrice(d.price_per_gb));

    sectors
      .append("path")
      .attr("class", "clock-arc-mid")
      .attr("d", arcMid)
      .attr("fill", (d) => colorInfl(d.inflated_share));

    sectors
      .append("path")
      .attr("class", "clock-arc-inner")
      .attr("d", arcInner)
      .attr("fill", (d) => colorFab(d.fab_utilization_rate));

    // Quarter labels around bezel
    const lblR = r3 + 12;
    clockG
      .selectAll("text.clock-q-label")
      .data(quarters)
      .join("text")
      .attr("class", "clock-q-label")
      .attr("x", (_, i) => Math.sin(midAngleOf(i)) * lblR)
      .attr("y", (_, i) => -Math.cos(midAngleOf(i)) * lblR)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text((d, i) => (i === 11 ? "★ 26T4" : `${d.quarter.slice(2, 4)}T${d.quarter.slice(5)}`));

    // Clock hand (draggable to scrub quarters), projecting from the outer rim of the hub
    const handG = clockG.append("g").attr("class", "clock-hand-group").style("cursor", "grab");
    handG
      .append("line")
      .attr("class", "clock-hand-halo")
      .attr("x1", 0)
      .attr("y1", -(rHub - 1))
      .attr("x2", 0)
      .attr("y2", -(r3 - 2));
    handG
      .append("line")
      .attr("class", "clock-hand")
      .attr("x1", 0)
      .attr("y1", -(rHub - 1))
      .attr("x2", 0)
      .attr("y2", -(r3 - 2));
    handG
      .append("circle")
      .attr("class", "clock-hand-tip")
      .attr("cx", 0)
      .attr("cy", -(r2 + r3) / 2)
      .attr("r", 3.8);

    // Drag behavior on the clock face / hand to scrub quarters
    const angleToQuarter = (x, y) => {
      let ang = Math.atan2(x, -y); // 0 at 12 o'clock, clockwise [0..2pi]
      if (ang < 0) ang += Math.PI * 2;
      let idx = Math.round(ang / stepRad) - 1;
      if (idx < 0) idx = 11;
      if (idx > 11) idx = 11;
      return QUARTERS[idx];
    };

    const drag = d3
      .drag()
      .on("start drag", (event) => {
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = null;
        }
        const [mx, my] = d3.pointer(event, clockG.node());
        state.setQuarter(angleToQuarter(mx, my));
      });
    handG.call(drag);

    // Center hub with live readout (2 clean lines so it fits at all viewport sizes)
    const hubG = clockG
      .append("g")
      .attr("class", "clock-hub")
      .style("cursor", "pointer")
      .on("click", () => state.setQuarter(null));
    hubG.append("circle").attr("r", rHub - 1).attr("class", "clock-hub-bg");
    const hubQ = hubG
      .append("text")
      .attr("y", -3)
      .attr("text-anchor", "middle")
      .attr("class", "clock-hub-q");
    const hubPrice = hubG
      .append("text")
      .attr("y", 9)
      .attr("text-anchor", "middle")
      .attr("class", "clock-hub-price");

    // Bottom ring key under the clock
    const ringLeg = svg
      .append("g")
      .attr("transform", `translate(${cx}, ${H - 7})`)
      .attr("text-anchor", "middle")
      .attr("class", "clock-ring-legend");
    ringLeg.append("text").text("Anéis: Externo = US$/GB · Médio = % Inflado · Interno = % Fabs");

    // =========================================================================
    // RIGHT SIDE: K3 - Draining Inventory Reservoir Tank + HBM Wafer Pump
    // =========================================================================
    const tankG = svg.append("g").attr("transform", `translate(${clockW + 6}, 10)`);
    const padL = 28;
    const padR = 14;
    const tankTop = 24;
    const tankH = Math.max(70, H - 78);
    const tankInnerW = Math.max(46, tankW - padL - padR - 12);

    tankG
      .append("text")
      .attr("x", padL + tankInnerW / 2)
      .attr("y", 11)
      .attr("text-anchor", "middle")
      .attr("class", "tank-title")
      .text("Reservatório Global (sem.)");

    const yTank = d3.scaleLinear().domain([0, 16]).range([tankTop + tankH, tankTop]);

    // Clip path for the rounded cylinder tank
    const clipId = "tank-clip";
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", padL)
      .attr("y", tankTop)
      .attr("width", tankInnerW)
      .attr("height", tankH)
      .attr("rx", 8);

    // Tank glass background
    tankG
      .append("rect")
      .attr("x", padL)
      .attr("y", tankTop)
      .attr("width", tankInnerW)
      .attr("height", tankH)
      .attr("rx", 8)
      .attr("class", "tank-glass")
      .style("cursor", "pointer")
      .on("click", () => {
        const on = state.pcp.global_inventory_weeks?.[1] <= CRITICAL_WEEKS;
        state.setPcp("global_inventory_weeks", on ? null : [0, CRITICAL_WEEKS]);
      })
      .on("mousemove", (event) => {
        const fq = state.focusQuarter();
        const qRow = qMap.get(fq) || quarters[quarters.length - 1];
        showTooltip(
          event,
          `<div class="tip-title">Reservatório de Estoque · ${quarterLabel(fq)}</div>
           <div class="tip-row"><span>Nível em 2024-T1</span><span>14,5 semanas (cheio)</span></div>
           <div class="tip-row"><span>Nível em ${quarterLabel(fq)}</span><span>${fmtNum(1)(qRow.global_inventory_weeks)} semanas</span></div>
           <div class="tip-row"><span>Reserva crítica</span><span>&lt; 8,0 semanas</span></div>
           <div class="tip-row"><span>Dreno HBM de GPU</span><span>${fmtNum(0)(qRow.gpu_hbm_trend_gb)} GB / GPU</span></div>
           <div class="tip-foot"><span class="tip-hint">Clique no tanque para filtrar kits na Zona Crítica (&lt; 8 sem.)</span></div>`
        );
      })
      .on("mouseleave", hideTooltip);

    const liquidG = tankG.append("g").attr("clip-path", `url(#${clipId})`).style("pointer-events", "none");

    // 2024Q1 baseline ghost watermark inside tank
    const y24 = yTank(14.5);
    liquidG
      .append("line")
      .attr("x1", padL)
      .attr("x2", padL + tankInnerW)
      .attr("y1", y24)
      .attr("y2", y24)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2 2");
    liquidG
      .append("text")
      .attr("x", padL + 5)
      .attr("y", y24 + 10)
      .attr("class", "tank-ghost-lbl")
      .text("24T1: 14,5s");

    // Dead-storage danger tint below 8 weeks
    const yCrit = yTank(CRITICAL_WEEKS);
    liquidG
      .append("rect")
      .attr("x", padL)
      .attr("y", yCrit)
      .attr("width", tankInnerW)
      .attr("height", tankTop + tankH - yCrit)
      .attr("fill", "#fee2e2")
      .attr("fill-opacity", 0.55);

    // Liquid body + wave path
    const liquidRect = liquidG
      .append("rect")
      .attr("x", padL)
      .attr("width", tankInnerW)
      .attr("rx", 4);

    const liquidMeniscus = liquidG
      .append("ellipse")
      .attr("cx", padL + tankInnerW / 2)
      .attr("rx", tankInnerW / 2)
      .attr("ry", 3.5);

    // Critical 8-week threshold line across tank
    tankG
      .append("line")
      .attr("x1", padL - 3)
      .attr("x2", padL + tankInnerW + 3)
      .attr("y1", yCrit)
      .attr("y2", yCrit)
      .attr("class", "critical-line");
    tankG
      .append("text")
      .attr("x", padL + tankInnerW / 2)
      .attr("y", yCrit - 4)
      .attr("text-anchor", "middle")
      .attr("class", "tank-crit-lbl")
      .text("⚠ Crítico 8s");

    // Tank border and graduation ticks on left
    tankG
      .append("rect")
      .attr("x", padL)
      .attr("y", tankTop)
      .attr("width", tankInnerW)
      .attr("height", tankH)
      .attr("rx", 8)
      .attr("fill", "none")
      .attr("stroke", "#64748b")
      .attr("stroke-width", 1.5)
      .style("pointer-events", "none");

    tankG
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${padL},0)`)
      .call(d3.axisLeft(yTank).tickValues([0, 4, 8, 12, 16]).tickSize(3).tickFormat((d) => `${d}s`))
      .select(".domain")
      .remove();

    // Live value readout floating inside the tank
    const tankReadout = tankG
      .append("text")
      .attr("x", padL + tankInnerW / 2)
      .attr("text-anchor", "middle")
      .attr("class", "tank-level-text")
      .style("pointer-events", "none");

    // Bottom HBM pump meter bar under the tank
    const pumpY = tankTop + tankH + 14;
    tankG
      .append("text")
      .attr("x", padL)
      .attr("y", pumpY)
      .attr("class", "tank-pump-lbl")
      .text("Dreno HBM GPU:");
    const pumpVal = tankG
      .append("text")
      .attr("x", padL + tankInnerW)
      .attr("y", pumpY)
      .attr("text-anchor", "end")
      .attr("class", "tank-pump-val");

    tankG
      .append("rect")
      .attr("x", padL)
      .attr("y", pumpY + 4)
      .attr("width", tankInnerW)
      .attr("height", 7)
      .attr("rx", 3.5)
      .attr("fill", "#e2e8f0");
    const pumpFill = tankG
      .append("rect")
      .attr("x", padL)
      .attr("y", pumpY + 4)
      .attr("height", 7)
      .attr("rx", 3.5)
      .attr("fill", "#6366f1");

    update = () => {
      const fq = state.focusQuarter();
      const qIdx = Math.max(0, QUARTERS.indexOf(fq));
      const qRow = qMap.get(fq) || quarters[quarters.length - 1] || {};
      const activeHalf = state.half || state.cell?.half || null;

      playTxt.text(playTimer ? "⏸ Pausar" : "▶ Animar");
      allBtn.attr("opacity", state.quarter || state.half ? 1 : 0.4);

      // Highlight matching sector(s) on the clock
      sectors
        .classed("active", (d) => d.quarter === state.quarter || (activeHalf && halfOfQuarter(d.quarter) === activeHalf))
        .classed("dimmed", (d) => {
          if (state.quarter) return d.quarter !== state.quarter;
          if (activeHalf) return halfOfQuarter(d.quarter) !== activeHalf;
          return false;
        });

      d3.selectAll(container.querySelectorAll(".clock-q-label"))
        .classed("active", (d) => d.quarter === fq);

      // Rotate clock hand to focusQuarter angle (in degrees, where 12 o'clock = 0 deg)
      const deg = ((qIdx + 1) / 12) * 360;
      handG.attr("transform", `rotate(${deg})`);

      // Update center hub readout
      const activeRows = state.data.filter((d) => state.selected.has(d.kit_id));
      const hasNonTime =
        Object.keys(state.pcp).length > 0 ||
        state.box !== null ||
        state.cell !== null ||
        state.usage !== null ||
        state.gen !== null ||
        state.segment !== null;

      const dispPrice = hasNonTime && activeRows.length
        ? d3.median(activeRows, (d) => d.price_per_gb)
        : qRow.price_per_gb;
      const dispInv = hasNonTime && activeRows.length
        ? d3.median(activeRows, (d) => d.global_inventory_weeks)
        : qRow.global_inventory_weeks;
      const dispHbm = hasNonTime && activeRows.length
        ? d3.median(activeRows, (d) => d.gpu_hbm_trend_gb)
        : qRow.gpu_hbm_trend_gb;

      hubQ.text(state.quarter ? quarterLabel(state.quarter) : activeHalf || quarterLabel(fq));
      hubPrice.text(dispPrice != null ? `$${fmtNum(1)(dispPrice)}/GB` : "—");

      // Update Reservoir Tank level and color
      const inv = Math.max(0, Math.min(16, dispInv ?? 0));
      const ly = yTank(inv);
      const lh = Math.max(2, tankTop + tankH - ly);
      const liqColor = inv < CRITICAL_WEEKS ? "#dc2626" : inv < 10.5 ? "#d97706" : "#0d9488";

      liquidRect
        .attr("y", ly)
        .attr("height", lh)
        .attr("fill", liqColor)
        .attr("fill-opacity", 0.78);

      liquidMeniscus
        .attr("cy", ly)
        .attr("fill", d3.color(liqColor).brighter(0.35));

      tankReadout
        .attr("y", Math.min(tankTop + tankH - 8, Math.max(tankTop + 16, ly - 6)))
        .attr("fill", inv < CRITICAL_WEEKS ? "#991b1b" : "#0f172a")
        .text(`${fmtNum(1)(inv)} sem.`);

      // Update HBM pump bar
      const hbm = dispHbm ?? 0;
      pumpVal.text(`${fmtNum(0)(hbm)} GB`);
      pumpFill.attr("width", Math.max(4, Math.min(1, hbm / 300) * tankInnerW));
    };

    update();
  });

  state.on("filter", () => update());
}
