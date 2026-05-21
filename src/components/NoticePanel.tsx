import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CampusNotice, NoticeSourceConfig } from "../types";
import { noticeApi, openUrl } from "../lib/tauri";

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

const defaultConfig: NoticeSourceConfig = {
  sourceName: "学校通知源",
  listUrl: "https://one.cau.edu.cn/tp_up/view?m=up",
  itemSelector: "#allPimListDiv .tz-body-list",
  titleSelector: "a.tit",
  departmentSelector: ".tz-tit-info",
  timeSelector: ".tz-tit-info",
  linkSelector: "a.tit",
  contentSelector: ".tz-note",
  authMode: "none"
};

interface Props {
  refreshTick?: number;
}

function formatNoticeTime(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleString();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; error?: unknown; cause?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return maybe.message;
    }
    if (typeof maybe.error === "string" && maybe.error.trim()) {
      return maybe.error;
    }
    if (typeof maybe.cause === "string" && maybe.cause.trim()) {
      return maybe.cause;
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {}
  }
  return "通知抓取失败（未返回具体原因）";
}

function NoticeDetail({
  selected,
  onClose,
}: {
  selected: CampusNotice | null;
  onClose: () => void;
}) {
  return createPortal(
    <aside
      className={`fixed right-0 top-0 z-20 h-full w-full max-w-lg border-l border-[var(--cf-border)] bg-[var(--cf-panel)] p-6 shadow-soft transition-transform duration-500 ${
        selected ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="section-title text-xl">通知详情</h3>
        <button onClick={onClose} className="text-sm text-[var(--cf-muted)]">关闭</button>
      </div>
      {selected && (
        <div className="mt-4 space-y-3 text-sm leading-7">
          <p className="m-0 font-medium">{selected.title}</p>
          <p className="m-0 text-xs text-[var(--cf-muted)]">{selected.department} · {formatNoticeTime(selected.publishedAt)}</p>
          <p className="m-0 whitespace-pre-wrap">{selected.content || "暂无正文，点击原文查看。"}</p>
          {selected.link && (
            <button onClick={() => void openUrl(normalizeUrl(selected.link!))} className="text-[var(--cf-accent-indigo)] transition-colors hover:text-[var(--cf-accent-terracotta)]">打开原文链接</button>
          )}
        </div>
      )}
    </aside>,
    document.body
  );
}

export default function NoticePanel({
  refreshTick = 0,
}: Props) {
  const [config, setConfig] = useState<NoticeSourceConfig>(defaultConfig);
  const [editing, setEditing] = useState(false);
  const [notices, setNotices] = useState<CampusNotice[]>([]);
  const [selected, setSelected] = useState<CampusNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const brief = useMemo(() => notices.slice(0, 8), [notices]);

  const fetchWithTimeout = async (cfg: NoticeSourceConfig) => {
    return await Promise.race([
      noticeApi.fetch(cfg),
      new Promise<CampusNotice[]>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("抓取超时（20秒）：请检查校内网络/VPN、登录参数或 Cookie 是否有效"));
        }, 20_000);
      })
    ]);
  };

  const load = async (override?: NoticeSourceConfig) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWithTimeout(override ?? config);
      setNotices(data);
    } catch (e) {
      setError(toErrorMessage(e));
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
    try {
      await noticeApi.saveConfig(config);
      setEditing(false);
      await load(config);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  return (
    <article className="flex h-full flex-col p-6 cq-narrow:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title text-lg cq-narrow:text-sm cq-short:text-sm">校园通知</h2>
        <div className="flex gap-3">
          <button
            onClick={() => void load()}
            className="text-xs text-[var(--cf-muted)] transition-colors hover:text-[var(--cf-text)]"
          >
            刷新
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-[var(--cf-muted)] transition-colors hover:text-[var(--cf-text)]"
          >
            抓取配置
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-[var(--cf-card-bg)] p-4 text-xs cq-narrow:mt-2">
          <input value={config.sourceName} onChange={(e) => setConfig((p) => ({ ...p, sourceName: e.target.value }))} placeholder="来源名称" className="min-w-[100px] flex-1 px-3 py-2" />
          <input value={config.listUrl} onChange={(e) => setConfig((p) => ({ ...p, listUrl: e.target.value }))} placeholder="列表 URL" className="min-w-[100px] flex-1 px-3 py-2" />
          <select
            value={config.authMode ?? "none"}
            onChange={(e) => setConfig((p) => ({ ...p, authMode: e.target.value as NoticeSourceConfig["authMode"] }))}
            className="min-w-[120px] flex-1 px-3 py-2"
          >
            <option value="none">无需认证</option>
            <option value="cookie">Cookie 认证</option>
            <option value="form">账号密码登录</option>
          </select>

          {config.authMode === "cookie" && (
            <input
              value={config.cookie ?? ""}
              onChange={(e) => setConfig((p) => ({ ...p, cookie: e.target.value }))}
              placeholder="Cookie（例如：JSESSIONID=...; route=...）"
              className="min-w-[160px] flex-[2] px-3 py-2"
            />
          )}

          {config.authMode === "form" && (
            <>
              <input
                value={config.loginUrl ?? ""}
                onChange={(e) => setConfig((p) => ({ ...p, loginUrl: e.target.value }))}
                placeholder="登录 URL"
                className="min-w-[120px] flex-1 px-3 py-2"
              />
              <input
                value={config.username ?? ""}
                onChange={(e) => setConfig((p) => ({ ...p, username: e.target.value }))}
                placeholder="账号"
                className="min-w-[100px] flex-1 px-3 py-2"
              />
              <input
                type="password"
                value={config.password ?? ""}
                onChange={(e) => setConfig((p) => ({ ...p, password: e.target.value }))}
                placeholder="密码"
                className="min-w-[100px] flex-1 px-3 py-2"
              />
              <input
                value={config.usernameField ?? "username"}
                onChange={(e) => setConfig((p) => ({ ...p, usernameField: e.target.value }))}
                placeholder="账号字段名（默认 username）"
                className="min-w-[120px] flex-1 px-3 py-2"
              />
              <input
                value={config.passwordField ?? "password"}
                onChange={(e) => setConfig((p) => ({ ...p, passwordField: e.target.value }))}
                placeholder="密码字段名（默认 password）"
                className="min-w-[120px] flex-1 px-3 py-2"
              />
              <input
                value={config.loginExtraBody ?? ""}
                onChange={(e) => setConfig((p) => ({ ...p, loginExtraBody: e.target.value }))}
                placeholder="额外表单参数（k=v&k2=v2）可选"
                className="min-w-[160px] flex-[2] px-3 py-2"
              />
            </>
          )}

          <input value={config.itemSelector} onChange={(e) => setConfig((p) => ({ ...p, itemSelector: e.target.value }))} placeholder="itemSelector" className="min-w-[80px] flex-1 px-3 py-2" />
          <input value={config.titleSelector} onChange={(e) => setConfig((p) => ({ ...p, titleSelector: e.target.value }))} placeholder="titleSelector" className="min-w-[80px] flex-1 px-3 py-2" />
          <input value={config.departmentSelector} onChange={(e) => setConfig((p) => ({ ...p, departmentSelector: e.target.value }))} placeholder="departmentSelector" className="min-w-[80px] flex-1 px-3 py-2" />
          <input value={config.timeSelector} onChange={(e) => setConfig((p) => ({ ...p, timeSelector: e.target.value }))} placeholder="timeSelector" className="min-w-[80px] flex-1 px-3 py-2" />
          <input value={config.linkSelector ?? ""} onChange={(e) => setConfig((p) => ({ ...p, linkSelector: e.target.value }))} placeholder="linkSelector 可选" className="min-w-[80px] flex-1 px-3 py-2" />
          <input value={config.contentSelector ?? ""} onChange={(e) => setConfig((p) => ({ ...p, contentSelector: e.target.value }))} placeholder="contentSelector 可选" className="min-w-[80px] flex-1 px-3 py-2" />
          <button onClick={() => void saveConfig()} className="w-full rounded-xl bg-[var(--cf-accent-indigo)] px-4 py-2.5 text-white transition-opacity hover:opacity-85">
            保存并抓取
          </button>
        </div>
      )}

      <ul className="mt-4 flex-1 space-y-1 overflow-y-auto cq-short:mt-2">
        {brief.map((notice) => (
          <li
            key={notice.id}
            onClick={() => setSelected(notice)}
            className="cursor-pointer rounded-xl px-4 py-3 transition-colors hover:bg-[var(--cf-card-bg)] cq-short:py-2"
          >
            <p className="m-0 truncate text-sm font-medium cq-short:line-clamp-1">{notice.title}</p>
            <p className="m-0 mt-1 text-xs text-[var(--cf-muted)] cq-narrow:truncate cq-short:hidden">
              {notice.department} · {formatNoticeTime(notice.publishedAt)}
            </p>
          </li>
        ))}
      </ul>

      {loading && <p className="mt-3 text-xs text-[var(--cf-muted)] cq-short:hidden">正在抓取通知...</p>}
      {error && <p className="mt-3 text-xs text-[var(--cf-accent-terracotta)] cq-short:hidden">{error}</p>}

      <NoticeDetail selected={selected} onClose={() => setSelected(null)} />
    </article>
  );
}
