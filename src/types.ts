export interface CampusNotice {
  id: string;
  title: string;
  department: string;
  publishedAt: string;
  link?: string;
  content?: string;
}

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  remindAt?: string | null;
}

export interface ThoughtDraft {
  date: string;
  reflection: string;
  highlight: string;
}

export interface QuickLink {
  id: string;
  name: string;
  url: string;
}

export interface CountdownItem {
  id: string;
  title: string;
  targetDate: string;
}

export interface NoticeSourceConfig {
  sourceName: string;
  listUrl: string;
  itemSelector: string;
  titleSelector: string;
  departmentSelector: string;
  timeSelector: string;
  linkSelector?: string;
  contentSelector?: string;
  authMode?: "none" | "cookie" | "form";
  cookie?: string;
  loginUrl?: string;
  username?: string;
  password?: string;
  usernameField?: string;
  passwordField?: string;
  loginExtraBody?: string;
}
