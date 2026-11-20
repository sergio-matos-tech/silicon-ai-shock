/**
 * K9 - Guided Story Mode (Martini-Glass Narrative Stepper).
 * Six narrative acts that configure coordinated filters across all views,
 * highlight the key analytical finding, and hand control back for free exploration.
 */
import { state, CRITICAL_WEEKS } from "./state.js";

export const STORY_ACTS = [
  {
    id: "overview",
    badge: "0",
    short: "Visão Geral",
    title: "Panorama Completo (2024–2026): Da Estabilidade ao Choque Global de Silício",
    narrative:
      "A realocação de wafers para memória HBM de GPUs de IA (50 → 279 GB) drena o estoque global de 14,5 para 3,5 semanas e multiplica o preço mediano por GB em 5,6× (US$ 12,32 → US$ 68,47). Clique nos atos ao lado ou interaja diretamente nos gráficos.",
    kpiTag: "300 kits · 12 trimestres",
    filters: {},
  },
  {
    id: "act1",
    badge: "1",
    short: "A Causa (2024)",
    title: "Ato 1 · A Pressão Silenciosa: IA Absorve HBM, mas o Estoque Ainda Amortecia",
    narrative:
      "Em 2024-H1, o estoque global confortável (14,0 sem.) mantém 100% dos wafers de mercado com preço normal (~US$ 12,5/GB), mesmo enquanto a demanda HBM por GPU começa a escalar nas fábricas.",
    kpiTag: "0% inflado · Estoque 14 sem.",
    filters: { half: "2024-H1" },
  },
  {
    id: "act2",
    badge: "2",
    short: "O Gatilho (25-T1)",
    title: "Ato 2 · A Quebra de Regime (2025-T1): 67% do Mercado Entra em Escassez",
    narrative:
      "No 1º trimestre de 2025, a ocupação das fabs atinge 67% e o preço mediano salta +43% em um único trimestre (US$ 13,81 → US$ 19,75/GB). Dois terços das listagens passam ao status Shortage-Inflated.",
    kpiTag: "+43% em 1 trimestre",
    filters: { quarter: "2025Q1" },
  },
  {
    id: "act3",
    badge: "3",
    short: "Ruptura (< 8 sem.)",
    title: "Ato 3 · Cruzando a Reserva Morta (< 8 Semanas de Estoque Global)",
    narrative:
      "A partir de 2025-H2, o estoque cai abaixo do limiar crítico de 8 semanas. Observe nos Wafers (F) e no Scatter (B): 100% dos dies ficam vermelhos (Shortage-Inflated) e o preço mediano supera US$ 44/GB.",
    kpiTag: "100% contágio (< 8 sem.)",
    filters: { pcp: { global_inventory_weeks: [0, CRITICAL_WEEKS] } },
  },
  {
    id: "act4",
    badge: "4",
    short: "A Conta DDR5",
    title: "Ato 4 · O Choque no Bolso: Kit DDR5 salta 4,6× e Ágio Chega a 8,2× JEDEC",
    narrative:
      "Dominando 70% do mercado, o DDR5 sofre tanto no segmento Enterprise/AI quanto no Consumer: um kit DDR5 32 GB Consumer salta de US$ 242 (2024) para US$ 1.112 (2026).",
    kpiTag: "DDR5 32GB: $242 → $1.112",
    filters: { gen: "DDR5" },
  },
  {
    id: "act5",
    badge: "5",
    short: "Colapso IA & Valor",
    title: "Ato 5 · Erosão de Custo-Benefício: Workloads de IA Pagam 5,2× Mais por GB",
    narrative:
      "Nos kits voltados a IA / Data Science, a largura de banda por dólar desaba 79% enquanto a deformação nos Glifos Estelares (G) revela explosão de preço e colapso simultâneo de estoque.",
    kpiTag: "Banda/US$ −79%",
    filters: { usage: "AI / Data Science" },
  },
];

export function initStory(stepperContainer, bannerContainer) {
  let currentId = "overview";
  let internalChange = false;

  const stepper = d3.select(stepperContainer);
  const banner = d3.select(bannerContainer);

  const buttons = stepper
    .selectAll("button.story-step")
    .data(STORY_ACTS)
    .join("button")
    .attr("type", "button")
    .attr("class", "story-step")
    .on("click", (_, act) => activate(act.id));

  buttons
    .append("span")
    .attr("class", "story-step-num")
    .text((d) => d.badge);
  buttons
    .append("span")
    .attr("class", "story-step-lbl")
    .text((d) => d.short);

  const bannerLeft = banner.append("div").attr("class", "story-banner-body");
  const titleEl = bannerLeft.append("div").attr("class", "story-banner-title");
  const textEl = bannerLeft.append("div").attr("class", "story-banner-text");

  const bannerRight = banner.append("div").attr("class", "story-banner-controls");
  const tagEl = bannerRight.append("span").attr("class", "story-banner-tag");
  const prevBtn = bannerRight
    .append("button")
    .attr("type", "button")
    .attr("class", "story-nav-btn")
    .text("◀ Anterior")
    .on("click", () => stepBy(-1));
  const nextBtn = bannerRight
    .append("button")
    .attr("type", "button")
    .attr("class", "story-nav-btn story-nav-primary")
    .text("Próximo ato ▶")
    .on("click", () => stepBy(1));

  function activate(id) {
    const act = STORY_ACTS.find((a) => a.id === id) || STORY_ACTS[0];
    currentId = act.id;
    internalChange = true;
    // Clone filters so mutations don't touch STORY_ACTS
    const f = JSON.parse(JSON.stringify(act.filters));
    state.setFilters(f);
    internalChange = false;
    render();
  }

  function stepBy(delta) {
    const idx = STORY_ACTS.findIndex((a) => a.id === currentId);
    const nextIdx = (idx + delta + STORY_ACTS.length) % STORY_ACTS.length;
    activate(STORY_ACTS[nextIdx].id);
  }

  function render() {
    const act = STORY_ACTS.find((a) => a.id === currentId) || STORY_ACTS[0];
    buttons.classed("active", (d) => d.id === currentId);
    titleEl.text(act.title);
    textEl.text(act.narrative);
    tagEl.text(act.kpiTag);
    const idx = STORY_ACTS.findIndex((a) => a.id === currentId);
    prevBtn.property("disabled", idx <= 0);
  }

  state.on("filter", () => {
    if (internalChange) return;
    if (!state.hasFilters()) {
      currentId = "overview";
    }
    render();
  });

  render();
}
