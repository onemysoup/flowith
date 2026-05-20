import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CampusNotice, NoticeSourceConfig } from "../types";
import { noticeApi } from "../lib/tauri";
import { useContentMinSize } from "../lib/useContentMinSize";

const defaultConfig: NoticeSourceConfig = {
  sourceName: "学校通知源",
  listUrl: "https://example.edu/news",
  itemSelector: ".notice-item",
  titleSelector: ".title",
  departmentSelector: ".dept",
  timeSelector: ".time",
  linkSelector: "a",
  contentSelector: "article"
};

interface Props {
  refreshTick?: number;
  gridCols?: number;
  gridContainerWidth?: number;
  onMinSizeChange?: (key: string, w: number, h: number) => void;
}

function formatNoticeTime(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleString();
}

export default function NoticePanel({
  refreshTick = 0,
  gridCols = 12,
  gridContainerWidth = 1200,
  onMinSizeChange,
}: Props) {
  const [config, setConfig] = useState<NoticeSourceConfig>(defaultConfig);
  const [editing, setEditing] = useState(false);
  const [notices, setNotices] = useState<CampusNotice[]>([]);
  const [selected, setSelected] = useState<CampusNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const brief = useMemo(() => notices.slice(0, 8), [notices]);

  // ── Dynamic min-size observer ──
  const handleMinSizeChange = useCallback(
    (key: string, w: number, h: number) => { onMinSizeChange?.(key, w, h); },
    [onMinSizeChange]
  );
  useContentMinSize(contentRef, {
    panelKey: "notice", cols: gridCols, containerWidth: gridContainerWidth,
    paddingY: 20, enabled: true, onMinSizeChange: handleMinSizeChange,
  });

  const load = async (override?: NoticeSourceConfig) => {
    setLoading(true);
    setError("");
    try {
      const data = await noticeApi.fetch(override ?? config);
      setNotices(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通知抓取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void noticeApi
      .getConfig()
      .then((cfg) => { setConfig(cfg); return load(cfg); })
      .catch(() => void load(defaultConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshTick > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const saveConfig = async () => {
    await noticeApi.saveConfig(config);
    setEditing(false);
    await load(config);
  };

  return (
    <>
      <article className="flex h-full flex-col p-5 cq-narrow:p-3" ref={contentRef}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title text-2xl cq-narrow:text-sm cq-short:text-sm">校园通知</h2>
          <div className="flex gap-2">
            <button
              onClick={() => void load()}
              className="rounded-lg border border-[var(--cf-border)] px-3 py-1 text-xs hover:bg-[rgba(126,145,117,0.12)]"
            >
              刷新
            </button>
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-lg border border-[var(--cf-border)] px-3 py-1 text-xs hover:bg-[rgba(47,63,91,0.1)]"
            >
              抓取配置
            </button>
          </div>
        </div>

        {editing && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-lg border border-[var(--cf-border)] p-3 text-xs cq-narrow:mt-1">
            <input value={config.sourceName} onChange={(e) => setConfig((p) => ({ ...p, sourceName: e.target.value }))} placeholder="来源名称" className="min-w-[100px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <input value={config.listUrl} onChange={(e) => setConfig((p) => ({ ...p, listUrl: e.target.value }))} placeholder="列表 URL" className="min-w-[100px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <input value={config.itemSelector} onChange={(e) => setConfig((p) => ({ ...p, itemSelector: e.target.value }))} placeholder="itemSelector" className="min-w-[80px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <input value={config.titleSelector} onChange={(e) => setConfig((p) => ({ ...p, titleSelector: e.target.value }))} placeholder="titleSelector" className="min-w-[80px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <input value={config.departmentSelector} onChange={(e) => setConfig((p) => ({ ...p, departmentSelector: e.target.value }))} placeholder="departmentSelector" className="min-w-[80px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <input value={config.timeSelector} onChange={(e) => setConfig((p) => ({ ...p, timeSelector: e.target.value }))} placeholder="timeSelector" className="min-w-[80px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <input value={config.linkSelector ?? ""} onChange={(e) => setConfig((p) => ({ ...p, linkSelector: e.target.value }))} placeholder="linkSelector 可选" className="min-w-[80px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <input value={config.contentSelector ?? ""} onChange={(e) => setConfig((p) => ({ ...p, contentSelector: e.target.value }))} placeholder="contentSelector 可选" className="min-w-[80px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2" />
            <button onClick={() => void saveConfig()} className="w-full rounded-lg bg-[var(--cf-accent-indigo)] px-3 py-2 text-white">
              保存并抓取
            </button>
          </div>
        )}

        {/* Notice list: flex-1 fills remaining space, scrollable */}
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto cq-short:mt-1 cq-short:space-y-1">
          {brief.map((notice) => (
            <li
              key={notice.id}
              onClick={() => setSelected(notice)}
              className="cursor-pointer rounded-lg border border-[var(--cf-border)] p-3 transition-colors hover:bg-[rgba(126,145,117,0.08)] cq-short:p-2"
            >
              <p className="m-0 truncate text-sm font-medium cq-short:line-clamp-1">{notice.title}</p>
              <p className="m-0 mt-1 text-xs text-[var(--cf-muted)] cq-narrow:truncate cq-short:hidden">
                {notice.department} · {formatNoticeTime(notice.publishedAt)}
              </p>
            </li>
          ))}
        </ul>

        {loading && <p className="mt-2 text-xs text-[var(--cf-muted)] cq-short:hidden">正在抓取通知...</p>}
        {error && <p className="mt-2 text-xs text-[var(--cf-accent-terracotta)] cq-short:hidden">{error}</p>}
      </article>

      <aside
        className={`fixed right-0 top-0 z-20 h-full w-full max-w-lg border-l border-[var(--cf-border)] bg-[var(--cf-panel)] p-6 shadow-soft transition-transform duration-500 ${
          selected ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="section-title text-xl">通知详情</h3>
          <button onClick={() => setSelected(null)} className="text-sm text-[var(--cf-muted)]">关闭</button>
        </div>
        {selected && (
          <div className="mt-4 space-y-3 text-sm leading-7">
            <p className="m-0 font-medium">{selected.title}</p>
            <p className="m-0 text-xs text-[var(--cf-muted)]">{selected.department} · {formatNoticeTime(selected.publishedAt)}</p>
            <p className="m-0 whitespace-pre-wrap">{selected.content || "暂无正文，点击原文查看。"}</p>
            {selected.link && (
              <a href={selected.link} target="_blank" rel="noreferrer" className="text-[var(--cf-accent-indigo)]">打开原文链接</a>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
