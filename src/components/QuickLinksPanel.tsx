import { useCallback, useEffect, useRef, useState } from "react";
import { openUrl, quickLinkApi } from "../lib/tauri";
import { useContentMinSize } from "../lib/useContentMinSize";
import type { QuickLink } from "../types";

interface Props {
  gridCols?: number;
  gridContainerWidth?: number;
  onMinSizeChange?: (key: string, w: number, h: number) => void;
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default function QuickLinksPanel({
  gridCols = 12,
  gridContainerWidth = 1200,
  onMinSizeChange,
}: Props) {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Dynamic min-size observer ──
  const handleMinSizeChange = useCallback(
    (key: string, w: number, h: number) => { onMinSizeChange?.(key, w, h); },
    [onMinSizeChange]
  );
  useContentMinSize(contentRef, {
    panelKey: "quicklinks", cols: gridCols, containerWidth: gridContainerWidth,
    paddingY: 20, enabled: true, onMinSizeChange: handleMinSizeChange,
  });

  useEffect(() => {
    void quickLinkApi.getAll().then(setLinks).catch(console.error);
  }, []);

  const addLink = async () => {
    const cleanName = name.trim();
    const cleanUrl = normalizeUrl(url.trim());
    if (!cleanName || !cleanUrl) return;
    const created = await quickLinkApi.add(cleanName, cleanUrl);
    setLinks((prev) => [created, ...prev]);
    setName("");
    setUrl("");
  };

  const remove = async (id: string) => {
    await quickLinkApi.remove(id);
    setLinks((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <article className="flex h-full flex-col p-6 cq-narrow:p-4" ref={contentRef}>
      <h2 className="section-title text-lg cq-narrow:text-sm cq-short:text-sm">快速入口</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3 cq-narrow:mt-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="网站名称"
          className="min-w-[80px] flex-1 px-4 py-2.5"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="min-w-[100px] flex-1 px-4 py-2.5"
        />
        <button
          onClick={() => void addLink()}
          className="rounded-xl bg-[var(--cf-accent-sage)] px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-85"
        >
          添加
        </button>
      </div>

      {/* Link grid: borderless, text-link aesthetic */}
      <div className="mt-5 flex flex-1 flex-wrap content-start gap-x-6 gap-y-3 overflow-y-auto cq-short:mt-2">
        {links.map((link) => {
          const normalizedUrl = normalizeUrl(link.url);
          const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(normalizedUrl)}&sz=64`;
          return (
            <div key={link.id} className="group flex items-center gap-2">
              <img
                src={favicon}
                alt={link.name}
                className="h-4 w-4 flex-shrink-0 cq-narrow:h-3.5 cq-narrow:w-3.5"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <button
                onClick={() => void openUrl(normalizedUrl)}
                className="text-sm text-[var(--cf-accent-indigo)] transition-colors hover:text-[var(--cf-accent-terracotta)] cq-narrow:text-xs"
              >
                {link.name}
              </button>
              <button
                onClick={() => void remove(link.id)}
                className="text-xs text-[var(--cf-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--cf-accent-terracotta)] cq-short:hidden"
              >
                删除
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}
