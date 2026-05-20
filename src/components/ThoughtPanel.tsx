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

  const handleMinSizeChange = useCallback(
    (key: string, w: number, h: number) => { onMinSizeChange?.(key, w, h); },
    [onMinSizeChange]
  );

  useContentMinSize(contentRef, {
    panelKey: "thought", cols: gridCols, containerWidth: gridContainerWidth,
    paddingY: 24, enabled: true, onMinSizeChange: handleMinSizeChange,
  });

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
    <article className="flex h-full flex-col p-6 cq-narrow:p-4" ref={contentRef}>
      <h2 className="section-title text-lg cq-narrow:text-sm cq-short:text-sm">
        每日学习体会
      </h2>

      {/* Date + dir row: capsule style, no labels */}
      <div className="mt-4 flex flex-wrap items-center gap-3 cq-narrow:mt-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-full px-4 py-2 text-xs"
        />
        <input
          value={customDir}
          onChange={(e) => setCustomDir(e.target.value)}
          placeholder="保存目录"
          className="min-w-0 flex-1 rounded-full px-4 py-2 text-xs"
        />
      </div>

      {/* Reflection textarea */}
      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="今天有什么值得沉淀的思考？"
        className="mt-5 min-h-[100px] flex-1 rounded-2xl bg-[var(--cf-card-bg)] p-5 text-sm cq-narrow:mt-3 cq-short:min-h-0"
        style={{ lineHeight: 1.6 }}
      />

      {/* Highlight textarea */}
      <textarea
        value={highlight}
        onChange={(e) => setHighlight(e.target.value)}
        placeholder="用一句话总结今天最值得记住的事。"
        className="mt-3 min-h-[44px] flex-1 rounded-2xl bg-[var(--cf-card-bg)] p-5 text-sm cq-narrow:mt-2 cq-short:min-h-0"
        style={{ lineHeight: 1.6 }}
      />

      {/* Save button row */}
      <div className="mt-4 flex items-center gap-4 cq-narrow:mt-2">
        <button
          onClick={() => void save()}
          disabled={disabled || status === "saving"}
          className="rounded-full bg-[var(--cf-accent-terracotta)] px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "saving" ? "保存中…" : "保存为 Markdown"}
        </button>
        {status === "done" && (
          <span className="text-xs text-[var(--cf-accent-sage)]">已保存</span>
        )}
        {savedPath && status !== "done" && (
          <span className="truncate text-xs text-[var(--cf-muted)]">{savedPath}</span>
        )}
      </div>
    </article>
  );
}
