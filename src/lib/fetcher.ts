import type { CampusNotice, NoticeSourceConfig } from "../types";
import { noticeApi } from "./tauri";

export type FetcherConfig = NoticeSourceConfig;

export interface NoticeFetcher {
  fetchLatest: (config: FetcherConfig) => Promise<CampusNotice[]>;
}

export const createTauriFetcher = (): NoticeFetcher => {
  return {
    async fetchLatest(config) {
      return noticeApi.fetch(config);
    }
  };
};

export const createMockFetcher = (): NoticeFetcher => {
  return {
    async fetchLatest(config) {
      const now = new Date().toISOString();
      return [
        {
          id: "demo-1",
          title: `示例通知：请在此接入 ${config.sourceName} 的真实规则`,
          department: "教务处",
          publishedAt: now,
          content: "后续你只需把 listUrl 和 selector 替换为学校站点的真实值。"
        }
      ];
    }
  };
};
