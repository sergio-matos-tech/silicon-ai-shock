/**
 * Shared state for brushing & linking between the four views.
 *
 * Four independent filters, combined with AND:
 *   pcp   - value range per axis, set by the brushes on the parallel coordinates
 *   box   - 2D rectangle (weeks x price/GB), set by the scatter plot brush
 *   cell  - one heatmap cell (generation + segment + half-year)
 *   usage - one recommended_usage row, set by clicking the dumbbell chart
 * `selected` holds the kit_ids that pass all filters; every view dims the rest.
 * `hoverId` / `pinnedId` choose which kit the details card shows.
 */

export const GEN_COLORS = {
  DDR4: "#2563eb",
  DDR5: "#0d9488",
  "DDR6 (Preview)": "#d97706",
};

export const SEGMENTS = ["Consumer", "Enterprise/AI"];

export const HALVES = ["2024-H1", "2024-H2", "2025-H1", "2025-H2", "2026-H1", "2026-H2"];

export const USAGES = [
  "AI / Data Science",
  "Content Creation",
  "Gaming (AAA)",
  "Basic Productivity",
];

/** "2025-09-15" -> "2025-H2" */
export const halfOf = (d) => `${d.timestamp.slice(0, 4)}-H${+d.timestamp.slice(5, 7) <= 6 ? 1 : 2}`;
export const genShort = (g) => g.replace(" (Preview)", "");

const listeners = { filter: [], hover: [] };

export const state = {
  data: [],
  byId: new Map(),
  selected: new Set(),
  pcp: {}, // { axisKey: [min, max] }
  box: null, // { x: [min, max], y: [min, max] }
  cell: null, // { generation, market_segment, half }
  usage: null, // string (recommended_usage)
  hoverId: null,
  pinnedId: null,

  init(data) {
    this.data = data;
    this.byId = new Map(data.map((d) => [d.kit_id, d]));
    this.refresh();
  },

  on(type, fn) {
    listeners[type].push(fn);
  },

  /**
   * Does record d pass the filters?
   * `opts` may be `true` (shorthand for ignoreCell) or `{ ignoreCell, ignoreHalf, ignoreUsage }`.
   */
  matches(d, opts = {}) {
    const { ignoreCell = false, ignoreHalf = false, ignoreUsage = false } =
      opts === true ? { ignoreCell: true } : opts;

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
      if (d.generation !== c.generation || d.market_segment !== c.market_segment) return false;
      if (!ignoreHalf && halfOf(d) !== c.half) return false;
    }
    if (this.usage && !ignoreUsage && d.recommended_usage !== this.usage) return false;
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

  /** "Limpar filtros": clears every filter and the pinned kit. */
  reset() {
    this.pcp = {};
    this.box = null;
    this.cell = null;
    this.usage = null;
    this.pinnedId = null;
    this.refresh();
    listeners.hover.forEach((fn) => fn());
  },

  hasFilters() {
    return (
      Object.keys(this.pcp).length > 0 ||
      this.box !== null ||
      this.cell !== null ||
      this.usage !== null
    );
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
