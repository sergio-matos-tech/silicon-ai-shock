/**
 * Shared state for brushing & linking between all coordinated views.
 *
 * Independent filters, combined with AND:
 *   pcp     - value range per axis, set by the brushes on the parallel coordinates
 *   box     - 2D rectangle (weeks x price/GB), set by the scatter plot brush
 *   cell    - one heatmap cell (generation + segment + half-year)
 *   usage   - one recommended_usage row, set by clicking the dumbbell chart
 *   half    - one half-year period ("2024-H1".."2026-H2"), set by clicking a wafer
 *   quarter - one quarter ("2024Q1".."2026Q4"), set by the crisis clock hand
 *   gen     - one memory generation, set by the legend / heatmap brackets / glyphs
 *   segment - one market segment, set together with `gen` by the star glyphs
 * `selected` holds the kit_ids that pass all filters; every view dims the rest.
 * `hoverId` / `pinnedId` choose which kit the details card shows.
 * `agg` holds market-wide quarterly medians computed on the full dataset.
 */

export const GEN_COLORS = {
  DDR4: "#2563eb",
  DDR5: "#0d9488",
  "DDR6 (Preview)": "#d97706",
};

export const SEGMENTS = ["Consumer", "Enterprise/AI"];

export const HALVES = ["2024-H1", "2024-H2", "2025-H1", "2025-H2", "2026-H1", "2026-H2"];

export const QUARTERS = [2024, 2025, 2026].flatMap((y) => [1, 2, 3, 4].map((q) => `${y}Q${q}`));

export const USAGES = [
  "AI / Data Science",
  "Content Creation",
  "Gaming (AAA)",
  "Basic Productivity",
];

export const CRITICAL_WEEKS = 8;
export const INFLATED = "Shortage-Inflated";

/** "2025-09-15" -> "2025-H2" */
export const halfOf = (d) => `${d.timestamp.slice(0, 4)}-H${+d.timestamp.slice(5, 7) <= 6 ? 1 : 2}`;
/** "2025-09-15" -> "2025Q3" */
export const quarterOf = (d) => `${d.timestamp.slice(0, 4)}Q${Math.ceil(+d.timestamp.slice(5, 7) / 3)}`;
/** "2025Q3" -> "2025-H2" */
export const halfOfQuarter = (q) => `${q.slice(0, 4)}-H${+q.slice(5) <= 2 ? 1 : 2}`;
/** "2025Q3" -> "T3 2025" (Portuguese: trimestre) */
export const quarterLabel = (q) => `T${q.slice(5)} ${q.slice(0, 4)}`;
export const genShort = (g) => g.replace(" (Preview)", "");
export const segShort = (s) => (s === "Enterprise/AI" ? "Enterprise" : s);

const listeners = { filter: [], hover: [] };

const EMPTY_FILTERS = () => ({
  pcp: {},
  box: null,
  cell: null,
  usage: null,
  half: null,
  quarter: null,
  gen: null,
  segment: null,
});

export const state = {
  data: [],
  agg: { quarters: [], facts: {} },
  byId: new Map(),
  selected: new Set(),
  ...EMPTY_FILTERS(),
  hoverId: null,
  pinnedId: null,

  init(data, agg) {
    this.data = data;
    this.agg = agg;
    this.byId = new Map(data.map((d) => [d.kit_id, d]));
    this.refresh();
  },

  on(type, fn) {
    listeners[type].push(fn);
  },

  /**
   * Does record d pass the filters?
   * `opts` may be `true` (shorthand for ignoreCell) or
   * `{ ignoreCell, ignoreHalf, ignoreUsage, ignoreGen, ignoreSegment }`.
   * `ignoreHalf` ignores every time filter (half-year and quarter): views that
   * already lay time out on an axis use it to keep showing all periods.
   */
  matches(d, opts = {}) {
    const {
      ignoreCell = false,
      ignoreHalf = false,
      ignoreUsage = false,
      ignoreGen = false,
      ignoreSegment = false,
    } = opts === true ? { ignoreCell: true } : opts;

    for (const [key, [lo, hi]] of Object.entries(this.pcp)) {
      if (d[key] < lo || d[key] > hi) return false;
    }
    if (this.box) {
      const { x, y } = this.box;
      if (d.global_inventory_weeks < x[0] || d.global_inventory_weeks > x[1]) return false;
      if (d.price_per_gb < y[0] || d.price_per_gb > y[1]) return false;
    }
    if (this.cell && !ignoreCell) {
      const c = this.cell;
      if (!ignoreGen && d.generation !== c.generation) return false;
      if (!ignoreSegment && d.market_segment !== c.market_segment) return false;
      if (!ignoreHalf && halfOf(d) !== c.half) return false;
    }
    if (this.usage && !ignoreUsage && d.recommended_usage !== this.usage) return false;
    if (this.half && !ignoreHalf && halfOf(d) !== this.half) return false;
    if (this.quarter && !ignoreHalf && quarterOf(d) !== this.quarter) return false;
    if (this.gen && !ignoreGen && d.generation !== this.gen) return false;
    if (this.segment && !ignoreSegment && d.market_segment !== this.segment) return false;
    return true;
  },

  refresh() {
    this.selected = new Set(this.data.filter((d) => this.matches(d)).map((d) => d.kit_id));
    listeners.filter.forEach((fn) => fn());
  },

  setPcp(key, range) {
    if (range) this.pcp[key] = range;
    else delete this.pcp[key];
    this.refresh();
  },

  setBox(box) {
    this.box = box;
    this.refresh();
  },

  /** Clicking the active cell again clears it. */
  toggleCell(cell) {
    const same = this.cell && Object.keys(cell).every((k) => this.cell[k] === cell[k]);
    this.cell = same ? null : cell;
    this.refresh();
  },

  /** Clicking the active usage row again clears it. */
  toggleUsage(usage) {
    this.usage = this.usage === usage ? null : usage;
    this.refresh();
  },

  /** Clicking the active half-year again clears it. A half-year replaces a quarter filter. */
  toggleHalf(half) {
    this.half = this.half === half ? null : half;
    if (this.half) this.quarter = null;
    this.refresh();
  },

  /** Crisis clock: a quarter replaces a half-year filter; null shows every period. */
  setQuarter(quarter) {
    if (this.quarter === quarter) return;
    this.quarter = quarter;
    if (quarter) this.half = null;
    this.refresh();
  },

  /** Clicking the active generation again clears it. */
  toggleGen(gen) {
    this.gen = this.gen === gen ? null : gen;
    this.refresh();
  },

  /** Star glyphs: generation + segment together; clicking the active pair clears both. */
  toggleGroup(gen, segment) {
    const same = this.gen === gen && this.segment === segment;
    this.gen = same ? null : gen;
    this.segment = same ? null : segment;
    this.refresh();
  },

  /** Story mode: replace every filter at once (single refresh). */
  setFilters(filters = {}) {
    Object.assign(this, EMPTY_FILTERS(), filters);
    this.pinnedId = null;
    this.refresh();
    listeners.hover.forEach((fn) => fn());
  },

  /** "Limpar filtros": clears every filter and the pinned kit. */
  reset() {
    this.setFilters({});
  },

  hasFilters() {
    return (
      Object.keys(this.pcp).length > 0 ||
      this.box !== null ||
      this.cell !== null ||
      this.usage !== null ||
      this.half !== null ||
      this.quarter !== null ||
      this.gen !== null ||
      this.segment !== null
    );
  },

  /** Quarter the "as of" views (KPIs, clock, glyphs) describe: the clock quarter,
   *  the last quarter of the selected half-year, or the latest quarter. */
  focusQuarter() {
    const half = this.half || this.cell?.half;
    if (this.quarter) return this.quarter;
    if (half) return `${half.slice(0, 4)}Q${half.endsWith("1") ? 2 : 4}`;
    return QUARTERS[QUARTERS.length - 1];
  },

  setHover(id) {
    if (this.hoverId === id) return;
    this.hoverId = id;
    listeners.hover.forEach((fn) => fn());
  },

  /** Click a kit to lock it in the details card; click it again to release. */
  togglePin(id) {
    this.pinnedId = this.pinnedId === id ? null : id;
    listeners.hover.forEach((fn) => fn());
  },

  /** Highlighted in the views: the hovered kit and the pinned kit. */
  isHighlighted(id) {
    return id === this.hoverId || id === this.pinnedId;
  },

  /** Kit shown in the details card: the pinned one wins over the hovered one. */
  inspectedId() {
    return this.pinnedId ?? this.hoverId;
  },
};
