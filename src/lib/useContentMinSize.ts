import { useLayoutEffect, useRef } from "react";
import { GRID_MARGIN, GRID_ROW_HEIGHT } from "./layout";

/**
 * Monitors a panel's content and reports the minimum grid height (h)
 * required to display all content without clipping.
 *
 * Uses a hidden off-screen clone for measurement — the live element
 * is NEVER touched (no fights with react-grid-layout inline styles).
 *
 * Reports BOTH increases AND decreases in required height, so the panel
 * can shrink when content is removed (not just grow).
 */

const unitH = GRID_ROW_HEIGHT;

export function useContentMinSize(
  contentRef: React.RefObject<HTMLElement | null>,
  opts: {
    panelKey: string;
    cols: number;
    containerWidth: number;
    paddingY: number;
    enabled: boolean;
    onMinSizeChange: (key: string, w: number, h: number) => void;
  }
) {
  const {
    panelKey,
    cols,
    containerWidth,
    paddingY,
    enabled,
    onMinSizeChange,
  } = opts;

  const lastReportedH = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || !enabled || containerWidth <= 0) return;

    // Reset so the first measurement after deps change always reports
    lastReportedH.current = 0;

    const measure = () => {
      const measureWidth = Math.max(200, el.clientWidth);

      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "position:fixed;left:-99999px;top:-99999px;visibility:hidden;" +
        "overflow:visible;height:auto;";

      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.cssText =
        "display:flex;flex-direction:column;" +
        `width:${measureWidth}px;min-width:${measureWidth}px;` +
        "height:auto;min-height:0;max-height:none;" +
        "overflow:visible;flex:none;";

      clone.querySelectorAll<HTMLElement>("*").forEach((child) => {
        child.style.height = "auto";
        child.style.maxHeight = "none";
        child.style.flex = "0 0 auto";
        child.style.overflow = "visible";
      });

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const naturalH = clone.scrollHeight;

      document.body.removeChild(wrapper);

      const minH = Math.max(2, Math.ceil((naturalH + paddingY * 2 + GRID_MARGIN[1]) / (unitH + GRID_MARGIN[1])));

      if (minH !== lastReportedH.current) {
        lastReportedH.current = minH;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          onMinSizeChange(panelKey, 0, minH);
        }, 120);
      }
    };

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);

    const mutObserver = new MutationObserver(() => measure());
    mutObserver.observe(el, { childList: true, subtree: true, characterData: true });

    // Synchronous initial measurement — grid has already applied layout
    measure();

    return () => {
      observer.disconnect();
      mutObserver.disconnect();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [contentRef, panelKey, cols, containerWidth, paddingY, enabled, onMinSizeChange]);
}
