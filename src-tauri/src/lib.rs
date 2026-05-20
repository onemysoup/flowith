use chrono::Local;
use reqwest::Url;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde::de::DeserializeOwned;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoItem {
    id: String,
    title: String,
    completed: bool,
    created_at: String,
    remind_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuickLink {
    id: String,
    name: String,
    url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CountdownItem {
    id: String,
    title: String,
    target_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NoticeSourceConfig {
    source_name: String,
    list_url: String,
    item_selector: String,
    title_selector: String,
    department_selector: String,
    time_selector: String,
    link_selector: Option<String>,
    content_selector: Option<String>,
}

impl Default for NoticeSourceConfig {
    fn default() -> Self {
        default_notice_source_config()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CampusNotice {
    id: String,
    title: String,
    department: String,
    published_at: String,
    link: Option<String>,
    content: Option<String>,
}

fn default_notice_source_config() -> NoticeSourceConfig {
    NoticeSourceConfig {
        source_name: "学校通知源".to_string(),
        list_url: "https://example.edu/news".to_string(),
        item_selector: ".notice-item".to_string(),
        title_selector: ".title".to_string(),
        department_selector: ".dept".to_string(),
        time_selector: ".time".to_string(),
        link_selector: Some("a".to_string()),
        content_selector: Some("article".to_string()),
    }
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法获取应用目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建应用目录: {e}"))?;
    Ok(dir)
}

fn app_data_file(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(file_name))
}

fn read_json_or_default<T>(path: &PathBuf) -> Result<T, String>
where
    T: DeserializeOwned + Default,
{
    if !path.exists() {
        return Ok(T::default());
    }

    let raw = fs::read_to_string(path).map_err(|e| format!("读取本地数据失败: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(T::default());
    }

    serde_json::from_str(&raw).map_err(|e| format!("解析本地数据失败: {e}"))
}

fn write_json<T>(path: &PathBuf, value: &T) -> Result<(), String>
where
    T: Serialize + ?Sized,
{
    let raw = serde_json::to_string_pretty(value).map_err(|e| format!("序列化本地数据失败: {e}"))?;
    fs::write(path, raw).map_err(|e| format!("写入本地数据失败: {e}"))
}

fn read_todos(path: &PathBuf) -> Result<Vec<TodoItem>, String> {
    read_json_or_default(path)
}

fn write_todos(path: &PathBuf, todos: &[TodoItem]) -> Result<(), String> {
    write_json(path, todos)
}

#[tauri::command]
fn get_todos(app: tauri::AppHandle) -> Result<Vec<TodoItem>, String> {
    let path = app_data_file(&app, "todos.json")?;
    read_todos(&path)
}

#[tauri::command(rename_all = "camelCase")]
fn add_todo(app: tauri::AppHandle, title: String, remind_at: Option<String>) -> Result<TodoItem, String> {
    let path = app_data_file(&app, "todos.json")?;
    let mut todos = read_todos(&path)?;

    let item = TodoItem {
        id: format!("todo-{}", Local::now().timestamp_millis()),
        title,
        completed: false,
        created_at: Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
        remind_at,
    };

    todos.insert(0, item.clone());
    write_todos(&path, &todos)?;
    Ok(item)
}

#[tauri::command]
fn toggle_todo(app: tauri::AppHandle, id: String) -> Result<TodoItem, String> {
    let path = app_data_file(&app, "todos.json")?;
    let mut todos = read_todos(&path)?;

    let mut updated: Option<TodoItem> = None;
    for todo in &mut todos {
        if todo.id == id {
            todo.completed = !todo.completed;
            updated = Some(todo.clone());
            break;
        }
    }

    write_todos(&path, &todos)?;
    updated.ok_or_else(|| "未找到待办项".to_string())
}

#[tauri::command]
fn delete_todo(app: tauri::AppHandle, id: String) -> Result<String, String> {
    let path = app_data_file(&app, "todos.json")?;
    let mut todos = read_todos(&path)?;
    let before = todos.len();
    todos.retain(|todo| todo.id != id);
    if todos.len() == before {
        return Err("未找到待办项".to_string());
    }
    write_todos(&path, &todos)?;
    Ok(id)
}

fn default_quick_links() -> Vec<QuickLink> {
    vec![
        QuickLink {
            id: "link-lib".to_string(),
            name: "图书馆".to_string(),
            url: "https://lib.example.edu".to_string(),
        },
        QuickLink {
            id: "link-jw".to_string(),
            name: "教务系统".to_string(),
            url: "https://jw.example.edu".to_string(),
        },
        QuickLink {
            id: "link-cnki".to_string(),
            name: "知网".to_string(),
            url: "https://www.cnki.net".to_string(),
        },
    ]
}

#[tauri::command]
fn get_quick_links(app: tauri::AppHandle) -> Result<Vec<QuickLink>, String> {
    let path = app_data_file(&app, "quick_links.json")?;
    if !path.exists() {
        let seed = default_quick_links();
        write_json(&path, &seed)?;
        return Ok(seed);
    }
    read_json_or_default(&path)
}

#[tauri::command]
fn add_quick_link(app: tauri::AppHandle, name: String, url: String) -> Result<QuickLink, String> {
    let path = app_data_file(&app, "quick_links.json")?;
    let mut links: Vec<QuickLink> = if path.exists() {
        read_json_or_default(&path)?
    } else {
        default_quick_links()
    };

    let item = QuickLink {
        id: format!("link-{}", Local::now().timestamp_millis()),
        name,
        url,
    };
    links.insert(0, item.clone());
    write_json(&path, &links)?;
    Ok(item)
}

#[tauri::command]
fn delete_quick_link(app: tauri::AppHandle, id: String) -> Result<String, String> {
    let path = app_data_file(&app, "quick_links.json")?;
    let mut links: Vec<QuickLink> = read_json_or_default(&path)?;
    let before = links.len();
    links.retain(|item| item.id != id);
    if before == links.len() {
        return Err("未找到快速入口".to_string());
    }
    write_json(&path, &links)?;
    Ok(id)
}

fn default_countdowns() -> Vec<CountdownItem> {
    vec![
        CountdownItem {
            id: "count-cet".to_string(),
            title: "四六级".to_string(),
            target_date: "2026-06-13".to_string(),
        },
        CountdownItem {
            id: "count-final".to_string(),
            title: "期末考试".to_string(),
            target_date: "2026-07-08".to_string(),
        },
    ]
}

#[tauri::command]
fn get_countdowns(app: tauri::AppHandle) -> Result<Vec<CountdownItem>, String> {
    let path = app_data_file(&app, "countdowns.json")?;
    if !path.exists() {
        let seed = default_countdowns();
        write_json(&path, &seed)?;
        return Ok(seed);
    }
    read_json_or_default(&path)
}

#[tauri::command(rename_all = "camelCase")]
fn upsert_countdown(
    app: tauri::AppHandle,
    id: String,
    title: String,
    target_date: String,
) -> Result<CountdownItem, String> {
    let path = app_data_file(&app, "countdowns.json")?;
    let mut rows: Vec<CountdownItem> = if path.exists() {
        read_json_or_default(&path)?
    } else {
        default_countdowns()
    };

    let mut output = CountdownItem {
        id,
        title,
        target_date,
    };

    if let Some(existing) = rows.iter_mut().find(|item| item.id == output.id) {
        existing.title = output.title.clone();
        existing.target_date = output.target_date.clone();
        output = existing.clone();
    } else {
        rows.push(output.clone());
    }

    write_json(&path, &rows)?;
    Ok(output)
}

#[tauri::command]
fn delete_countdown(app: tauri::AppHandle, id: String) -> Result<String, String> {
    let path = app_data_file(&app, "countdowns.json")?;
    let mut rows: Vec<CountdownItem> = read_json_or_default(&path)?;
    let before = rows.len();
    rows.retain(|item| item.id != id);
    if before == rows.len() {
        return Err("未找到倒计时".to_string());
    }
    write_json(&path, &rows)?;
    Ok(id)
}

#[tauri::command]
fn get_notice_source_config(app: tauri::AppHandle) -> Result<NoticeSourceConfig, String> {
    let path = app_data_file(&app, "notice_source.json")?;
    if !path.exists() {
        let seed = default_notice_source_config();
        write_json(&path, &seed)?;
        return Ok(seed);
    }
    read_json_or_default(&path)
}

#[tauri::command]
fn save_notice_source_config(app: tauri::AppHandle, config: NoticeSourceConfig) -> Result<(), String> {
    let path = app_data_file(&app, "notice_source.json")?;
    write_json(&path, &config)
}

fn selector(input: &str) -> Result<Selector, String> {
    Selector::parse(input).map_err(|_| format!("Selector 无法解析: {input}"))
}

fn inner_text_by_selector(node: &scraper::ElementRef<'_>, s: &Selector) -> String {
    node.select(s)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .unwrap_or_else(|| "".to_string())
}

#[tauri::command]
async fn fetch_notices(
    app: tauri::AppHandle,
    config: Option<NoticeSourceConfig>,
) -> Result<Vec<CampusNotice>, String> {
    #[derive(Clone)]
    struct ParsedNoticeRow {
        title: String,
        department: String,
        published_at: String,
        link: Option<String>,
    }

    let cfg = if let Some(c) = config {
        c
    } else {
        get_notice_source_config(app.clone())?
    };

    let item_selector = selector(&cfg.item_selector)?;
    let title_selector = selector(&cfg.title_selector)?;
    let dept_selector = selector(&cfg.department_selector)?;
    let time_selector = selector(&cfg.time_selector)?;
    let link_selector = match cfg.link_selector.clone() {
        Some(v) if !v.trim().is_empty() => Some(selector(&v)?),
        _ => None,
    };
    let content_selector = match cfg.content_selector.clone() {
        Some(v) if !v.trim().is_empty() => Some(selector(&v)?),
        _ => None,
    };

    let client = reqwest::Client::builder()
        .user_agent("CampusFlow/0.1")
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))?;

    let list_html = client
        .get(&cfg.list_url)
        .send()
        .await
        .map_err(|e| format!("抓取列表失败: {e}"))?
        .text()
        .await
        .map_err(|e| format!("读取列表响应失败: {e}"))?;

    let base_url = Url::parse(&cfg.list_url).map_err(|e| format!("列表 URL 无效: {e}"))?;
    let parsed_rows: Vec<ParsedNoticeRow> = {
        let doc = Html::parse_document(&list_html);
        let mut rows = Vec::new();

        for item in doc.select(&item_selector).take(20) {
            let title = inner_text_by_selector(&item, &title_selector);
            if title.is_empty() {
                continue;
            }

            let department = {
                let v = inner_text_by_selector(&item, &dept_selector);
                if v.is_empty() { "未知部门".to_string() } else { v }
            };
            let published_at = {
                let v = inner_text_by_selector(&item, &time_selector);
                if v.is_empty() {
                    Local::now().format("%Y-%m-%d %H:%M").to_string()
                } else {
                    v
                }
            };

            let link = if let Some(ls) = &link_selector {
                item.select(ls)
                    .next()
                    .and_then(|anchor| anchor.value().attr("href"))
                    .and_then(|href| base_url.join(href).ok().map(|u| u.to_string()))
            } else {
                None
            };

            rows.push(ParsedNoticeRow {
                title,
                department,
                published_at,
                link,
            });
        }

        rows
    };

    let mut notices = Vec::new();
    for (idx, row) in parsed_rows.into_iter().enumerate() {
        let mut content: Option<String> = None;
        if let (Some(cs), Some(link_url)) = (&content_selector, &row.link) {
            if let Ok(resp) = client.get(link_url).send().await {
                if let Ok(ok_resp) = resp.error_for_status() {
                    if let Ok(detail_html) = ok_resp.text().await {
                        let detail_doc = Html::parse_document(&detail_html);
                        content = detail_doc
                            .select(cs)
                            .next()
                            .map(|el| el.text().collect::<String>().trim().to_string());
                    }
                }
            }
        }

        notices.push(CampusNotice {
            id: format!("notice-{}-{}", Local::now().timestamp_millis(), idx),
            title: row.title,
            department: row.department,
            published_at: row.published_at,
            link: row.link,
            content,
        });
    }

    Ok(notices)
}

fn resolve_thoughts_dir(custom_dir: Option<String>) -> Result<PathBuf, String> {
    if let Some(dir) = custom_dir {
        if !dir.trim().is_empty() {
            if let Some(rest) = dir.strip_prefix("~/") {
                let home = dirs::home_dir().ok_or_else(|| "无法解析用户目录".to_string())?;
                return Ok(home.join(rest));
            }
            return Ok(PathBuf::from(dir));
        }
    }

    let home = dirs::home_dir().ok_or_else(|| "无法解析用户目录".to_string())?;
    Ok(home.join("Documents").join("CampusFlow").join("Thoughts"))
}

#[tauri::command(rename_all = "camelCase")]
fn save_thought(
    date: String,
    reflection: String,
    highlight: String,
    custom_dir: Option<String>,
) -> Result<String, String> {
    let dir = resolve_thoughts_dir(custom_dir)?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {e}"))?;

    let file_name = format!("{}_学习体会.md", date);
    let file_path = dir.join(file_name);

    let markdown = format!(
        "# 学习体会 - {date}\n\n## 日期\n{date}\n\n## 今日感悟\n{reflection}\n\n## 今日闪光点\n{highlight}\n"
    );

    fs::write(&file_path, markdown).map_err(|e| format!("写入 Markdown 失败: {e}"))?;
    Ok(file_path.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_todos,
            add_todo,
            toggle_todo,
            delete_todo,
            get_quick_links,
            add_quick_link,
            delete_quick_link,
            get_countdowns,
            upsert_countdown,
            delete_countdown,
            get_notice_source_config,
            save_notice_source_config,
            fetch_notices,
            save_thought
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
