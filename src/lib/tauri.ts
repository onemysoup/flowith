import { invoke } from "@tauri-apps/api/core";
import type {
  CampusNotice,
  CountdownItem,
  NoticeSourceConfig,
  QuickLink,
  ThoughtDraft,
  TodoItem
} from "../types";

export const todoApi = {
  getAll: () => invoke<TodoItem[]>("get_todos"),
  add: (title: string, remindAt?: string) =>
    invoke<TodoItem>("add_todo", { title, remindAt: remindAt ?? null }),
  toggle: (id: string) => invoke<TodoItem>("toggle_todo", { id }),
  remove: (id: string) => invoke<string>("delete_todo", { id })
};

export const thoughtApi = {
  save: (draft: ThoughtDraft, customDir?: string) =>
    invoke<string>("save_thought", {
      date: draft.date,
      reflection: draft.reflection,
      highlight: draft.highlight,
      customDir: customDir ?? null
    })
};

export const noticeApi = {
  getConfig: () => invoke<NoticeSourceConfig>("get_notice_source_config"),
  saveConfig: (config: NoticeSourceConfig) => invoke<void>("save_notice_source_config", { config }),
  fetch: (config?: NoticeSourceConfig) => invoke<CampusNotice[]>("fetch_notices", { config: config ?? null })
};

export const quickLinkApi = {
  getAll: () => invoke<QuickLink[]>("get_quick_links"),
  add: (name: string, url: string) => invoke<QuickLink>("add_quick_link", { name, url }),
  remove: (id: string) => invoke<string>("delete_quick_link", { id })
};

export const countdownApi = {
  getAll: () => invoke<CountdownItem[]>("get_countdowns"),
  upsert: (item: CountdownItem) =>
    invoke<CountdownItem>("upsert_countdown", {
      id: item.id,
      title: item.title,
      targetDate: item.targetDate
    }),
  remove: (id: string) => invoke<string>("delete_countdown", { id })
};

export const openUrl = (url: string) => invoke<void>("open_url", { url });
