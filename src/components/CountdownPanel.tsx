import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countdownApi } from "../lib/tauri";
import { useContentMinSize } from "../lib/useContentMinSize";
import type { CountdownItem } from "../types";

function leftDays(targetDate: string) {
  const now = new Date();
  const target = new Date(targetDate);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

interface Props {
  gridCols?: number;
  gridContainerWidth?: number;
  onMinSizeChange?: (key: string, w: number, h: number) => void;
}

export default function CountdownPanel({
  gridCols = 12,
  gridContainerWidth = 1200,
  onMinSizeChange,
}: Props) {
  const [items, setItems] = useState<CountdownItem[]>([]);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Dynamic min-size observer ──
  const handleMinSizeChange = useCallback(
    (key: string, w: number, h: number) => { onMinSizeChange?.(key, w, h); },
    [onMinSizeChange]
  );
  useContentMinSize(contentRef, {
    panelKey: "countdown", cols: gridCols, containerWidth: gridContainerWidth,
    paddingY: 20, enabled: true, onMinSizeChange: handleMinSizeChange,
  });

  useEffect(() => {
    void countdownApi.getAll().then(setItems).catch(console.error);
  }, []);

  const rows = useMemo(() => {
    return items
      .map((item) => ({ ...item, left: leftDays(item.targetDate) }))
      .sort((a, b) => a.left - b.left);
  }, [items]);

  const add = async () => {
    if (!title.trim() || !targetDate) return;
    const created = await countdownApi.upsert({
      id: `count-${Date.now()}`,
      title: title.trim(),
      targetDate
    });
    setItems((prev) => [created, ...prev]);
    setTitle("");
    setTargetDate("");
  };

  const remove = async (id: string) => {
    await countdownApi.remove(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <section className="flex h-full flex-col gap-3 p-5 cq-narrow:p-3" ref={contentRef}>
      {/* Countdown cards: flex-wrap for fluid reflow */}
      <div className="flex flex-wrap gap-3 cq-narrow:gap-2">
        {rows.slice(0, 2).map((card) => (
          <article key={card.id} className="min-w-[120px] flex-1 rounded-xl border border-[var(--cf-border)] p-4 cq-narrow:p-3">
            <p className="m-0 truncate text-sm text-[var(--cf-muted)] cq-narrow:text-xs">{card.title}</p>
            <p className="m-0 mt-1 font-serif text-4xl text-[var(--cf-accent-indigo)] cq-narrow:text-3xl">{card.left}</p>
            <p className="m-0 text-sm text-[var(--cf-muted)] cq-narrow:text-xs">天</p>
          </article>
        ))}
      </div>

      {/* Management section: flex-1 fills remaining space */}
      <article className="flex flex-1 flex-col rounded-xl border border-[var(--cf-border)] p-4 cq-narrow:p-3">
        <h2 className="section-title text-xl cq-narrow:text-sm cq-short:text-sm">倒计时管理</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 cq-narrow:mt-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：毕业答辩"
            className="min-w-[100px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm"
          />
          <button onClick={() => void add()} className="rounded-lg bg-[var(--cf-accent-indigo)] px-3 py-2 text-sm text-white">
            添加
          </button>
        </div>

        <ul className="mt-3 flex-1 space-y-1 overflow-y-auto cq-short:mt-1">
          {rows.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--cf-border)] px-3 py-2 cq-short:py-1">
              <p className="m-0 min-w-0 flex-1 truncate text-sm cq-narrow:text-xs">
                {item.title} · <span className="text-[var(--cf-muted)]">{item.left} 天</span>
              </p>
              <button
                onClick={() => void remove(item.id)}
                className="ml-2 flex-shrink-0 text-xs text-[var(--cf-accent-terracotta)] hover:opacity-80 cq-short:hidden"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
