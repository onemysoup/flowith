import { getCurrentWindow } from "@tauri-apps/api/window";
import GridCanvas from "./components/GridCanvas";

export default function App() {
  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (err) {
      console.error("Failed to minimize:", err);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Failed to close:", err);
    }
  };

  return (
    <main className="px-4 py-6 md:px-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="section-title text-4xl">flowith</h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--cf-muted)]">
            校园生活效率伴侣：管理任务、归档思考、追踪目标，把握学生时代的节奏。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMinimize}
            className="rounded-lg bg-[var(--cf-bg)] px-3 py-2 text-sm font-medium text-[var(--cf-text)] hover:bg-[var(--cf-panel)] transition-colors"
            title="最小化到托盘"
          >
            −
          </button>
          <button
            onClick={handleClose}
            className="rounded-lg bg-[var(--cf-bg)] px-3 py-2 text-sm font-medium text-[var(--cf-text)] hover:bg-[var(--cf-panel)] transition-colors"
            title="关闭"
          >
            ✕
          </button>
        </div>
      </header>

      <GridCanvas />
    </main>
  );
}
