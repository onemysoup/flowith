import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { todoApi } from "../lib/tauri";
import { useContentMinSize } from "../lib/useContentMinSize";
import type { TodoItem } from "../types";

const QUOTES = [
  "真正的自由不是想做什么就做什么，而是可以不做什么。- 加缪",
  "参差多态乃幸福本源。- 罗素",
  "科学是在你不停止提问时发生的。- 费曼"
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Props {
  gridCols?: number;
  gridContainerWidth?: number;
  onMinSizeChange?: (key: string, w: number, h: number) => void;
}

export default function TodoPanel({
  gridCols = 12,
  gridContainerWidth = 1200,
  onMinSizeChange,
}: Props) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Dynamic min-size observer ──
  const handleMinSizeChange = useCallback(
    (key: string, w: number, h: number) => { onMinSizeChange?.(key, w, h); },
    [onMinSizeChange]
  );
  useContentMinSize(contentRef, {
    panelKey: "todo", cols: gridCols, containerWidth: gridContainerWidth,
    paddingY: 24, enabled: true, onMinSizeChange: handleMinSizeChange,
  });

  useEffect(() => {
    void todoApi.getAll().then(setTodos).catch(console.error);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      todos.forEach((todo) => {
        if (!todo.completed && todo.remindAt) {
          const remindTime = new Date(todo.remindAt);
          const diff = remindTime.getTime() - now.getTime();
          if (diff > 0 && diff < 60_000 && !notifiedIds.has(todo.id)) {
            void (async () => {
              let permissionGranted = await isPermissionGranted();
              if (!permissionGranted) {
                const permission = await requestPermission();
                permissionGranted = permission === "granted";
              }
              if (permissionGranted) {
                sendNotification({ title: "flowith 提醒", body: todo.title });
              }
            })();
            setNotifiedIds((prev) => { const next = new Set(prev); next.add(todo.id); return next; });
          }
        }
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [notifiedIds, todos]);

  const todayTodos = useMemo(() => {
    const key = todayKey();
    return todos.filter((item) => item.createdAt.startsWith(key));
  }, [todos]);

  useEffect(() => {
    if (todayTodos.length > 0 && todayTodos.every((item) => item.completed)) {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    } else {
      setQuote(null);
    }
  }, [todayTodos]);

  useEffect(() => {
    const validIds = new Set(todos.map((todo) => todo.id));
    setNotifiedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => { if (validIds.has(id)) next.add(id); });
      return next;
    });
  }, [todos]);

  const addTodo = async () => {
    const clean = title.trim();
    if (!clean) return;
    const created = await todoApi.add(clean, remindAt || undefined);
    setTodos((prev) => [created, ...prev]);
    setTitle("");
    setRemindAt("");
  };

  const toggleTodo = async (id: string) => {
    const updated = await todoApi.toggle(id);
    setTodos((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const removeTodo = async (id: string) => {
    await todoApi.remove(id);
    setTodos((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <section className="flex h-full flex-col p-5 cq-narrow:p-3" ref={contentRef}>
      <h2 className="section-title text-2xl cq-narrow:text-sm cq-short:text-sm">待办事项</h2>
      <p className="mt-1 text-sm text-[var(--cf-muted)] cq-narrow:text-xs cq-short:hidden">
        轻量管理今天的节奏，完成后会出现一句小小回响。
      </p>

      {/* Input row: flex-wrap for fluid reflow */}
      <div className="mt-3 flex flex-wrap items-center gap-2 cq-narrow:mt-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入任务，例如：整理离散作业"
          className="min-w-[120px] flex-1 rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--cf-accent-indigo)]"
        />
        <input
          type="datetime-local"
          value={remindAt}
          onChange={(e) => setRemindAt(e.target.value)}
          className="rounded-lg border border-[var(--cf-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--cf-accent-indigo)]"
        />
        <button
          onClick={addTodo}
          className="rounded-lg bg-[var(--cf-accent-indigo)] px-3 py-2 text-sm text-white transition-opacity hover:opacity-90"
        >
          添加
        </button>
      </div>

      {/* Todo list: flex-1 fills remaining space, scrollable */}
      <ul className="mt-3 flex-1 space-y-2 overflow-y-auto cq-short:mt-1 cq-short:space-y-1">
        {todos.map((item) => (
          <li
            key={item.id}
            className={`flex items-center justify-between rounded-lg border border-[var(--cf-border)] px-3 py-2 transition-all duration-300 ${
              item.completed ? "opacity-55" : "opacity-100"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                onClick={() => void toggleTodo(item.id)}
                aria-label="toggle"
                className="h-4 w-4 flex-shrink-0 rounded-full border border-[var(--cf-accent-sage)]"
                style={{ background: item.completed ? "var(--cf-accent-sage)" : "transparent" }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="m-0 truncate text-sm transition-all duration-300 cq-short:line-clamp-1"
                  style={{ textDecoration: item.completed ? "line-through" : "none" }}
                >
                  {item.title}
                </p>
                {item.remindAt && (
                  <p className="m-0 text-xs text-[var(--cf-muted)] cq-narrow:truncate">
                    提醒：{item.remindAt}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => void removeTodo(item.id)}
              className="ml-2 flex-shrink-0 text-xs text-[var(--cf-accent-terracotta)] hover:opacity-80 cq-short:hidden"
            >
              删除
            </button>
          </li>
        ))}
      </ul>

      {quote && (
        <p className="mt-3 rounded-lg bg-[rgba(126,145,117,0.1)] p-3 text-sm italic cq-short:hidden">
          {quote}
        </p>
      )}
    </section>
  );
}
