import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import GridCanvas from "./components/GridCanvas";

export default function App() {
  const [resetTick, setResetTick] = useState(0);

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

  const handleReset = () => {
    setResetTick((t) => t + 1);
  };

  return (
    <main className="px-6 py-8 md:px-10">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="section-title text-3xl tracking-wide">flowith</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--cf-muted)]" style={{ lineHeight: 1.6 }}>
            校园生活效率伴侣
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleReset}
            className="text-xs text-[var(--cf-muted)] transition-colors hover:text-[var(--cf-text)]"
            title="重置为默认布局"
          >
            重置布局
          </button>
          <button
            onClick={handleMinimize}
            className="text-sm text-[var(--cf-muted)] transition-colors hover:text-[var(--cf-text)]"
            title="最小化到托盘"
          >
            −
          </button>
          <button
            onClick={handleClose}
            className="text-sm text-[var(--cf-muted)] transition-colors hover:text-[var(--cf-text)]"
            title="关闭"
          >
            ✕
          </button>
        </div>
      </header>

      <GridCanvas resetTick={resetTick} />
    </main>
  );
}
