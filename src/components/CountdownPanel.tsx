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

  const handleMinSizeChange = useCallback(
    (key: string, w: number, h: number) => { onMinSizeChange?.(key, w, h); },
    [onMinSizeChange]
  );
  useContentMinSize(contentRef, {
    panelKey: "countdown", cols: gridCols, containerWidth: gridContainerWidth,
    paddingY: 24, enabled: true, onMinSizeChange: handleMinSizeChange,
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
    <section className="flex h-full flex-col gap-5 p-6 cq-narrow:p-4" ref={contentRef}>
      {/* Countdown cards: paper blocks on card-bg */}
      <div className="flex flex-wrap gap-4 cq-narrow:gap-3">
        {rows.slice(0, 2).map((card) => (
          <article
            key={card.id}
            className="min-w-[120px] flex-1 rounded-2xl bg-[var(--cf-card-bg)] p-5 cq-narrow:p-4"
          >
            <p className="m-0 text-xs font-medium uppercase tracking-wider text-[var(--cf-muted)]">
              {card.title}
            </p>
            <p className="m-0 mt-2 font-serif text-5xl font-semibold tracking-tight text-[var(--cf-accent-indigo)] cq-narrow:text-4xl">
              {card.left}
            </p>
            <p className="m-0 text-xs text-[var(--cf-muted)]">天</p>
          </article>
        ))}
      </div>

      {/* Management section */}
      <article className="flex flex-1 flex-col">
        <h2 className="section-title text-lg cq-narrow:text-sm cq-short:text-sm">倒计时管理</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3 cq-narrow:mt-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：毕业答辩"
            className="min-w-[100px] flex-1 px-4 py-2.5"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-4 py-2.5"
          />
          <button
            onClick={() => void add()}
            className="rounded-xl bg-[var(--cf-accent-indigo)] px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-85"
          >
            添加
          </button>
        </div>

        <ul className="mt-4 flex-1 space-y-1.5 overflow-y-auto cq-short:mt-2">
          {rows.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-[var(--cf-card-bg)] cq-short:py-2"
            >
              <p className="m-0 min-w-0 flex-1 truncate text-sm cq-narrow:text-xs">
                {item.title}
                <span className="ml-2 text-[var(--cf-muted)]">{item.left} 天</span>
              </p>
              <button
                onClick={() => void remove(item.id)}
                className="ml-3 flex-shrink-0 text-xs text-[var(--cf-muted)] transition-colors hover:text-[var(--cf-accent-terracotta)] cq-short:hidden"
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
