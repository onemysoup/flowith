import { useCallback, useEffect, useRef, useState } from "react";
import { quickLinkApi } from "../lib/tauri";
import { useContentMinSize } from "../lib/useContentMinSize";
import type { QuickLink } from "../types";

interface Props {
  gridCols?: number;
  gridContainerWidth?: number;
  onMinSizeChange?: (key: string, w: number, h: number) => void;
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
    const cleanUrl = url.trim();
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
    <article className="flex h-full flex-col p-5 cq-narrow:p-3" ref={contentRef}>
      <h2 className="section-title text-2xl cq-narrow:text-sm cq-short:text-sm">快速入口</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 cq-narrow:mt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="网站名称"
          className="min-w-[80px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="min-w-[100px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm"
        />
        <button onClick={() => void addLink()} className="rounded-lg bg-[var(--cf-accent-sage)] px-3 py-2 text-sm text-white">
          添加
        </button>
      </div>

      <div
        className="mt-3 grid flex-1 gap-2 overflow-y-auto cq-short:overflow-y-auto"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}
      >
        {links.map((link) => {
          const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=64`;
          return (
            <div key={link.id} className="rounded-2xl border border-[var(--cf-border)] p-2 text-center">
              <a href={link.url} target="_blank" rel="noreferrer" className="no-underline">
                <img
                  src={favicon}
                  alt={link.name}
                  className="mx-auto h-5 w-5 cq-narrow:h-4 cq-narrow:w-4"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                <span className="mt-1 block font-serif text-sm text-[var(--cf-accent-terracotta)] cq-narrow:text-xs cq-short:line-clamp-1">
                  {link.name.charAt(0).toUpperCase()}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--cf-text)] cq-short:line-clamp-1 cq-narrow:truncate">
                  {link.name}
                </span>
              </a>
              <button
                onClick={() => void remove(link.id)}
                className="mt-1 text-xs text-[var(--cf-muted)] hover:text-[var(--cf-accent-terracotta)] cq-short:hidden"
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
