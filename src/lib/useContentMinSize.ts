import { useLayoutEffect, useRef } from "react";
import { GRID_MARGIN, GRID_ROW_HEIGHT } from "./layout";

/**
 * Monitors a panel's content and reports the minimum grid height (h)
 * required to display all content without clipping.
 *
 * Width is NOT reported — it's grid-controlled and reporting it
 * would create a feedback loop.
 *
 * Uses a hidden off-screen clone for measurement so the live element
 * is NEVER touched (avoiding fights with react-grid-layout's inline styles).
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

    const measure = () => {
      // Clone the live element into a hidden off-screen container.
      // This NEVER modifies the live element's inline styles,
      // so it doesn't fight with react-grid-layout's width/height control.
      const minWidthPx = Math.max(200, (containerWidth / cols) * 2);

      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "position:fixed;left:-99999px;top:-99999px;visibility:hidden;" +
        "overflow:visible;height:auto;";

      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.cssText =
        "display:flex;flex-direction:column;" +
        `width:${minWidthPx}px;min-width:${minWidthPx}px;` +
        "height:auto;min-height:0;max-height:none;" +
        "overflow:visible;flex:none;";

      // Let all children size naturally
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

      // Convert pixels → grid units (height only)
      const minH = Math.max(2, Math.ceil((naturalH + paddingY * 2 + GRID_MARGIN[1]) / (unitH + GRID_MARGIN[1])));

      // Only fire callback when minimum height actually increases
      if (minH > lastReportedH.current) {
        lastReportedH.current = minH;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          onMinSizeChange(panelKey, 0, minH); // 0 = don't touch width
        }, 80);
      }
    };

    // Observe content area for size changes
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);

    // Watch for DOM changes (adding/removing items, text input)
    const mutObserver = new MutationObserver(() => measure());
    mutObserver.observe(el, { childList: true, subtree: true, characterData: true });

    measure();

    return () => {
      observer.disconnect();
      mutObserver.disconnect();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [contentRef, panelKey, cols, containerWidth, paddingY, enabled, onMinSizeChange]);
}
