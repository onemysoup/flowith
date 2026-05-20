import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout/legacy";

const STORAGE_KEY = "flowith-grid-layout";

export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const GRID_ROW_HEIGHT = 60;
export const GRID_MARGIN: [number, number] = [24, 24];

export interface PanelDef {
  key: string;
  title: string;
  /** Intrinsic minimum size in grid units per breakpoint */
  minSize: Record<"lg" | "md" | "sm", { w: number; h: number }>;
}

/**
 * Intrinsic minimum sizes calculated from each panel's actual content:
 *
 * - countdown: title (32) + countdown cards (~120) + management inputs (~116) + padding (48) ≈ 316px → 4h
 *   Width: two cards side-by-side need ~480px → 6w (lg), 6w (md), full (sm)
 *
 * - todo: title (32) + input row (~44) + ~4 items × 40px + padding (48) ≈ 280px → 4h
 *   Width: 3-col input (title/date/button) needs ~480px → 6w (lg), 5w (md), full (sm)
 *
 * - thought: title (32) + 2-col inputs (~44) + textarea min (120) + button (40) + padding (48) ≈ 284px → 4h
 *   Width: textarea needs readable width ~400px → 5w (lg), 5w (md), full (sm)
 *
 * - notice: title (32) + 2-col URL/selector (~44) + config fields (~44) + button (40) + ~2 notices × 52px + padding (48) ≈ 316px → 4h
 *   Width: config inputs need ~480px → 6w (lg), 6w (md), full (sm)
 *
 * - quicklinks: title (32) + 2-col inputs (~44) + 1 bookmark tile (~90) + padding (48) ≈ 214px → 3h
 *   Width: 3-col bookmark grid needs ~360px → 5w (lg), 5w (md), full (sm)
 */
export const PANELS: PanelDef[] = [
  {
    key: "countdown",
    title: "倒计时",
    minSize: { lg: { w: 6, h: 4 }, md: { w: 6, h: 4 }, sm: { w: 6, h: 4 } },
  },
  {
    key: "todo",
    title: "待办事项",
    minSize: { lg: { w: 6, h: 5 }, md: { w: 5, h: 5 }, sm: { w: 6, h: 5 } },
  },
  {
    key: "thought",
    title: "每日学习体会",
    minSize: { lg: { w: 5, h: 5 }, md: { w: 5, h: 5 }, sm: { w: 6, h: 5 } },
  },
  {
    key: "notice",
    title: "校园通知",
    minSize: { lg: { w: 6, h: 5 }, md: { w: 6, h: 5 }, sm: { w: 6, h: 5 } },
  },
  {
    key: "quicklinks",
    title: "快速入口",
    minSize: { lg: { w: 5, h: 3 }, md: { w: 5, h: 3 }, sm: { w: 6, h: 3 } },
  },
];

/** Immutable initial layout constant — the single source of truth for reset. */
export const INITIAL_DEFAULT_LAYOUT: ResponsiveLayouts = Object.freeze({
  lg: [
    { i: "countdown", x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 4 },
    { i: "todo", x: 0, y: 4, w: 6, h: 7, minW: 6, minH: 5 },
    { i: "thought", x: 6, y: 4, w: 6, h: 7, minW: 5, minH: 5 },
    { i: "notice", x: 0, y: 11, w: 6, h: 7, minW: 6, minH: 5 },
    { i: "quicklinks", x: 6, y: 11, w: 6, h: 7, minW: 5, minH: 3 },
  ],
  md: [
    { i: "countdown", x: 0, y: 0, w: 10, h: 4, minW: 6, minH: 4 },
    { i: "todo", x: 0, y: 4, w: 5, h: 7, minW: 5, minH: 5 },
    { i: "thought", x: 5, y: 4, w: 5, h: 7, minW: 5, minH: 5 },
    { i: "notice", x: 0, y: 11, w: 5, h: 7, minW: 6, minH: 5 },
    { i: "quicklinks", x: 5, y: 11, w: 5, h: 7, minW: 5, minH: 3 },
  ],
  sm: [
    { i: "countdown", x: 0, y: 0, w: 6, h: 4, minW: 6, minH: 4 },
    { i: "todo", x: 0, y: 4, w: 6, h: 6, minW: 6, minH: 5 },
    { i: "thought", x: 0, y: 10, w: 6, h: 6, minW: 6, minH: 5 },
    { i: "notice", x: 0, y: 16, w: 6, h: 6, minW: 6, minH: 5 },
    { i: "quicklinks", x: 0, y: 22, w: 6, h: 6, minW: 6, minH: 3 },
  ],
} as ResponsiveLayouts);

export function loadLayouts(): ResponsiveLayouts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ResponsiveLayouts;
      // Validate that all expected keys exist and min constraints are respected
      for (const panel of PANELS) {
        for (const bp of Object.keys(INITIAL_DEFAULT_LAYOUT) as Array<"lg" | "md" | "sm">) {
          const item = parsed[bp]?.find((l: LayoutItem) => l.i === panel.key);
          if (!item) return INITIAL_DEFAULT_LAYOUT;
          // Reset minW/minH to static defaults on load.
          // Dynamic min sizes are recalculated at runtime by useContentMinSize.
          // This prevents stale inflated values from old hook bugs from persisting.
          const size = panel.minSize[bp];
          item.minW = size.w;
          item.minH = size.h;
          item.w = Math.max(item.w, item.minW);
          item.h = Math.max(item.h, item.minH);
        }
      }
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return INITIAL_DEFAULT_LAYOUT;
}

export function saveLayouts(layouts: ResponsiveLayouts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Atomic reset: purge persisted layout from localStorage and return
 * a deep copy of INITIAL_DEFAULT_LAYOUT for immediate state replacement.
 */
export function resetLayouts(): ResponsiveLayouts {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  return JSON.parse(JSON.stringify(INITIAL_DEFAULT_LAYOUT)) as ResponsiveLayouts;
}
