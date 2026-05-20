# flowith

flowith 是一个面向大学生的轻量化桌面效率应用，采用 **Tauri + React + TailwindCSS**，默认本地优先存储。

## 为什么选 Tauri

- 体积更小: 相比 Electron 更容易控制安装包体积在 50MB 附近。
- 跨平台一致: 支持 Windows / macOS。
- 本地能力强: Rust 后端适合做本地文件写入、定时任务和后续爬虫扩展。

## 当前已实现

- Claude 风格主题系统: 暖白纸感背景、克制排版、柔和阴影与慢速过渡。
- **系统托盘支持**: 应用可最小化到系统托盘，窗口状态自动保存恢复（基于 `tauri-plugin-window-state`）。
- 核心功能 A: 待办事项
  - 新增任务
  - 设置提醒时间
  - 完成态中划线与淡化动画
  - 到点触发系统通知提醒（去重，避免同一分钟重复弹出）
  - 当天任务全部完成时显示随机名言
- 核心功能 B: 每日学习体会
  - 输入日期、感悟、闪光点
  - 保存为本地 Markdown
  - 文件名: `YYYY-MM-DD_学习体会.md`
  - 默认目录: `~/Documents/CampusFlow/Thoughts/`
- 核心功能 C: 校园通知
  - 支持配置学校通知源 URL 与 Selector
  - 支持实时抓取标题/部门/时间
  - 支持详情 Drawer 半窗阅读正文
  - 支持定时静默刷新
- 核心功能 D: 快速入口
  - 九宫格风格卡片
  - 支持自定义新增/删除
  - 本地持久化
  - 自动 favicon，失败时首字母兜底
- 核心功能 E: 倒计时
  - 支持新增/删除
  - 主界面醒目大字号展示
  - 本地持久化

## 目录结构

```text
flowith/
├─ src/
│  ├─ components/
│  │  ├─ ThoughtPanel.tsx
│  │  └─ TodoPanel.tsx
│  ├─ lib/
│  │  ├─ fetcher.ts
│  │  └─ tauri.ts
│  ├─ styles/
│  │  └─ theme.css
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ types.ts
├─ src-tauri/
│  ├─ src/
│  │  ├─ lib.rs
│  │  └─ main.rs
│  ├─ Cargo.toml
│  ├─ build.rs
│  └─ tauri.conf.json
├─ index.html
├─ package.json
├─ tailwind.config.ts
└─ README.md
```

## 启动

1. 安装 Node.js 18+ 与 Rust（含 Cargo）。
2. 在项目根目录执行:

```bash
npm install
npm run tauri dev
```

## 后续接入建议

1. 为通知抓取增加多站点配置模板与字段映射测试。
2. 将提醒从前端轮询升级为系统通知（Tauri Notification）。
3. 为日记与待办增加全文搜索和标签。
4. 增加系统托盘常驻模式。
