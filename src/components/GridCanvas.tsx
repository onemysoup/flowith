import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout/legacy";
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_MARGIN,
  GRID_ROW_HEIGHT,
  PANELS,
  loadLayouts,
  resetLayouts,
  saveLayouts,
} from "../lib/layout";
import CountdownPanel from "./CountdownPanel";
import NoticePanel from "./NoticePanel";
import QuickLinksPanel from "./QuickLinksPanel";
import ThoughtPanel from "./ThoughtPanel";
import TodoPanel from "./TodoPanel";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGrid = WidthProvider(Responsive);

/* eslint-disable @typescript-eslint/no-explicit-any */
const PANEL_MAP: Record<string, React.ComponentType<any>> = {
  countdown: CountdownPanel,
  todo: TodoPanel,
  thought: ThoughtPanel,
  notice: NoticePanel,
  quicklinks: QuickLinksPanel,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Props {
  /** Increment this counter to trigger a full layout reset */
  resetTick?: number;
}

export default function GridCanvas({ resetTick = 0 }: Props) {
  const [layouts, setLayouts] = useState(loadLayouts);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const [containerWidth, setContainerWidth] = useState(1200);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Reset valve: blocks dynamic min-size callbacks during reset ──
  const isResetting = useRef(false);

  // Track container width for min-size calculations
  const handleWidthChange = useCallback((width: number) => {
    setContainerWidth(width);
  }, []);

  const handleBreakpointChange = useCallback((bp: string) => {
    setCurrentBreakpoint(bp);
  }, []);

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      // Ignore layout changes while resetting (prevents stale saves)
      if (isResetting.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveLayouts(allLayouts);
      }, 500);
      setLayouts(allLayouts);
    },
    []
  );

  // ── Dynamic min-size callback from panels ──
  const handleMinSizeChange = useCallback(
    (key: string, minW: number, minH: number) => {
      // Block during reset to prevent state write-back conflicts
      if (isResetting.current) return;

      setLayouts((prev) => {
        const bp = currentBreakpoint;
        const bpLayout = prev[bp];
        if (!bpLayout) return prev;

        let changed = false;
        const newBpLayout = bpLayout.map((item: LayoutItem) => {
          if (item.i !== key) return item;

          const staticMin = PANELS.find((p) => p.key === key)?.minSize[bp as "lg" | "md" | "sm"];
          const staticMinW = staticMin?.w ?? 2;
          const staticMinH = staticMin?.h ?? 2;

          // minW=0 means "don't touch width"; minH=0 means "don't touch height"
          const effectiveMinW = minW > 0 ? Math.max(minW, staticMinW) : staticMinW;
          const effectiveMinH = minH > 0 ? Math.max(minH, staticMinH) : (item.minH ?? staticMinH);

          if (effectiveMinW === (item.minW ?? 0) && effectiveMinH === (item.minH ?? 0)) return item;

          changed = true;
          const newItem = { ...item };
          newItem.minW = effectiveMinW;
          newItem.minH = effectiveMinH;
          // Ensure current size respects new minimums
          if (newItem.w < effectiveMinW) newItem.w = effectiveMinW;
          if (newItem.h < effectiveMinH) newItem.h = effectiveMinH;
          return newItem;
        });

        if (!changed) return prev;
        return { ...prev, [bp]: newBpLayout };
      });
    },
    [currentBreakpoint]
  );

  // ── Global layout reset state machine ──
  const prevResetTick = useRef(resetTick);
  useEffect(() => {
    if (resetTick === prevResetTick.current) return;
    prevResetTick.current = resetTick;

    // 1. Open valve: block all dynamic min-size callbacks and layout saves
    isResetting.current = true;

    // 2. Purge localStorage + get deep copy of initial defaults
    const defaults = resetLayouts();

    // 3. Atomic state overwrite — forces full re-render
    setLayouts(defaults);

    // 4. Close valve in next frame after React commits the reset
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isResetting.current = false;
      });
    });
  }, [resetTick]);

  const panelKeys = useMemo(() => Object.keys(PANEL_MAP), []);

  // Global body-level text selection guard during drag/resize
  const handleInteractionStart = useCallback(
    (_layout: unknown, _oldItem: unknown, _newItem: unknown, _placeholder: unknown, event: Event) => {
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      document.body.classList.add("resize-no-select");
    },
    []
  );

  const handleInteractionStop = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    document.body.classList.remove("resize-no-select");
  }, []);

  // Resolve current breakpoint's column count
  const currentCols = GRID_COLS[currentBreakpoint as keyof typeof GRID_COLS] ?? 12;

  return (
    <div className="grid-canvas" ref={canvasRef}>
      <ResponsiveGrid
        layouts={layouts}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={GRID_MARGIN}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange}
        onWidthChange={handleWidthChange}
        onBreakpointChange={handleBreakpointChange}
        draggableHandle=".grid-drag-handle"
        resizeHandles={["se"]}
        onDragStart={handleInteractionStart}
        onDragStop={handleInteractionStop}
        onResizeStart={handleInteractionStart}
        onResizeStop={handleInteractionStop}
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms
      >
        {panelKeys.map((key) => {
          const Panel = PANEL_MAP[key];
          return (
            <div key={key} className="grid-item">
              <div className="grid-item-inner paper-card">
                <div className="grid-drag-handle" title="拖拽移动">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.3">
                    <circle cx="4" cy="3" r="1.5" />
                    <circle cx="12" cy="3" r="1.5" />
                    <circle cx="4" cy="8" r="1.5" />
                    <circle cx="12" cy="8" r="1.5" />
                    <circle cx="4" cy="13" r="1.5" />
                    <circle cx="12" cy="13" r="1.5" />
                  </svg>
                </div>
                <Panel
                  gridCols={currentCols}
                  gridContainerWidth={containerWidth}
                  onMinSizeChange={handleMinSizeChange}
                />
              </div>
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}
