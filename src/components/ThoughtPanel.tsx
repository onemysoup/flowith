import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { thoughtApi } from "../lib/tauri";
import { useContentMinSize } from "../lib/useContentMinSize";

interface Props {
  gridCols?: number;
  gridContainerWidth?: number;
  onMinSizeChange?: (key: string, w: number, h: number) => void;
}

export default function ThoughtPanel({
  gridCols = 12,
  gridContainerWidth = 1200,
  onMinSizeChange,
}: Props) {
  const today = () => new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [reflection, setReflection] = useState("");
  const [highlight, setHighlight] = useState("");
  const [customDir, setCustomDir] = useState("~/Documents/CampusFlow/Thoughts");
  const [savedPath, setSavedPath] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const contentRef = useRef<HTMLDivElement>(null);

  const disabled = useMemo(() => reflection.trim().length === 0, [reflection]);

  // ── Dynamic min-size observer ──
  const handleMinSizeChange = useCallback(
    (key: string, w: number, h: number) => {
      onMinSizeChange?.(key, w, h);
    },
    [onMinSizeChange]
  );

  useContentMinSize(contentRef, {
    panelKey: "thought",
    cols: gridCols,
    containerWidth: gridContainerWidth,
   
    paddingY: 20,
    enabled: true,
    onMinSizeChange: handleMinSizeChange,
  });

  // Reset fields when date changes
  useEffect(() => {
    setReflection("");
    setHighlight("");
  }, [date]);

  const save = async () => {
    if (disabled) return;
    setStatus("saving");
    try {
      const path = await thoughtApi.save(
        { date, reflection: reflection.trim(), highlight: highlight.trim() },
        customDir.trim() || undefined
      );
      setSavedPath(path);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      console.error("保存失败:", err);
      setStatus("idle");
    }
  };

  return (
    <article className="flex h-full flex-col p-5 cq-narrow:p-3" ref={contentRef}>
      <h2 className="section-title text-2xl cq-narrow:text-sm cq-short:text-sm">
        每日学习体会
      </h2>
      <p className="mt-1 text-sm text-[var(--cf-muted)] cq-narrow:text-xs cq-short:hidden">
        本地优先保存为 Markdown，沉淀你的学习轨迹与思辨。
      </p>

      {/* Input row: flex-wrap for fluid reflow */}
      <div className="mt-3 flex flex-wrap items-end gap-2 cq-narrow:mt-1">
        <label className="flex items-center gap-2 text-sm cq-narrow:text-xs">
          日期
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm cq-narrow:text-xs">
          保存目录
          <input
            value={customDir}
            onChange={(e) => setCustomDir(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* Reflection textarea: flex-1 fills remaining space */}
      <label className="mt-3 block text-sm text-[var(--cf-muted)] cq-narrow:mt-2 cq-short:mt-1 cq-short:text-xs">
        今日感悟
      </label>
      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="例如：今天在调优算法时，第一次意识到复杂度与可维护性的平衡。"
        className="mt-1 min-h-[80px] flex-1 resize-none rounded-lg border border-[var(--cf-border)] bg-transparent p-3 text-sm leading-relaxed cq-short:min-h-0"
      />

      {/* Highlight textarea */}
      <label className="mt-3 block text-sm text-[var(--cf-muted)] cq-narrow:mt-2 cq-short:mt-1 cq-short:text-xs">
        今日闪光点
      </label>
      <textarea
        value={highlight}
        onChange={(e) => setHighlight(e.target.value)}
        placeholder="记录一个你今天做得很好的小细节。"
        className="mt-1 min-h-[40px] flex-1 resize-none rounded-lg border border-[var(--cf-border)] bg-transparent p-3 text-sm leading-relaxed cq-short:min-h-0"
      />

      {/* Save button row */}
      <div className="mt-3 flex items-center gap-3 cq-narrow:mt-1">
        <button
          onClick={() => void save()}
          disabled={disabled || status === "saving"}
          className="rounded-lg bg-[var(--cf-accent-terracotta)] px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "saving" ? "保存中…" : "保存为 Markdown"}
        </button>
        {status === "done" && (
          <span className="text-sm text-[var(--cf-accent-sage)]">已保存</span>
        )}
        {savedPath && status !== "done" && (
          <span className="truncate text-xs text-[var(--cf-muted)]">上次：{savedPath}</span>
        )}
      </div>
    </article>
  );
}
