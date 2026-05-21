use chrono::Local;
use reqwest::Url;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
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
    #[serde(default = "default_notice_auth_mode")]
    auth_mode: String,
    cookie: Option<String>,
    login_url: Option<String>,
    username: Option<String>,
    password: Option<String>,
    username_field: Option<String>,
    password_field: Option<String>,
    login_extra_body: Option<String>,
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
        list_url: "https://one.cau.edu.cn/tp_up/view?m=up".to_string(),
        item_selector: "#allPimListDiv .tz-body-list".to_string(),
        title_selector: "a.tit".to_string(),
        department_selector: ".tz-tit-info".to_string(),
        time_selector: ".tz-tit-info".to_string(),
        link_selector: Some("a.tit".to_string()),
        content_selector: Some(".tz-note".to_string()),
        auth_mode: default_notice_auth_mode(),
        cookie: None,
        login_url: None,
        username: None,
        password: None,
        username_field: None,
        password_field: None,
        login_extra_body: None,
    }
}

fn default_notice_auth_mode() -> String {
    "none".to_string()
}

fn parse_kv_pairs(raw: &str) -> Vec<(String, String)> {
    raw.split('&')
        .filter_map(|part| {
            let trimmed = part.trim();
            if trimmed.is_empty() {
                return None;
            }

            let mut split = trimmed.splitn(2, '=');
            let key = split.next()?.trim();
            if key.is_empty() {
                return None;
            }

            let value = split.next().unwrap_or("").trim();
            Some((key.to_string(), value.to_string()))
        })
        .collect()
}

fn normalize_cookie_header(raw: &str) -> String {
    let cleaned = raw.replace('；', ";");
    let mut pairs: Vec<String> = Vec::new();

    for line in cleaned.lines() {
        let mut part = line.trim();
        if part.is_empty() {
            continue;
        }

        let lower = part.to_ascii_lowercase();
        if lower.starts_with("cookie:") {
            part = part[7..].trim();
        } else if lower.starts_with("set-cookie:") {
            part = part[11..].trim();
            if let Some(first_pair) = part.split(';').next() {
                let first_pair = first_pair.trim();
                if !first_pair.is_empty() && first_pair.contains('=') {
                    pairs.push(first_pair.to_string());
                }
            }
            continue;
        }

        if !part.contains(';') {
            if part.contains('=') {
                pairs.push(part.to_string());
            } else {
                pairs.push(format!("JSESSIONID={part}"));
            }
            continue;
        }

        for seg in part.split(';') {
            let seg = seg.trim();
            if seg.is_empty() || !seg.contains('=') {
                continue;
            }

            let key = seg
                .splitn(2, '=')
                .next()
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase();

            if matches!(
                key.as_str(),
                "path"
                    | "domain"
                    | "expires"
                    | "max-age"
                    | "samesite"
                    | "priority"
                    | "secure"
                    | "httponly"
                    | "partitioned"
            ) {
                continue;
            }

            pairs.push(seg.to_string());
        }
    }

    if pairs.is_empty() {
        let compact = cleaned.trim().trim_end_matches(';').to_string();
        if compact.is_empty() {
            return compact;
        }
        if compact.contains('=') {
            return compact;
        }
        return format!("JSESSIONID={compact}");
    }

    let mut seen = HashSet::new();
    let mut deduped = Vec::new();
    for pair in pairs {
        let key = pair
            .splitn(2, '=')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        if key.is_empty() {
            continue;
        }
        if seen.insert(key) {
            deduped.push(pair);
        }
    }

    deduped.join("; ")
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

fn strip_url_fragment(raw: &str) -> String {
    if let Ok(mut url) = Url::parse(raw) {
        url.set_fragment(None);
        return url.to_string();
    }

    raw.split('#').next().unwrap_or(raw).trim().to_string()
}

fn derived_notice_list_url(raw: &str) -> Option<String> {
    let url = Url::parse(raw).ok()?;
    let fragment = url.fragment()?.to_string();
    let act = fragment
        .split('&')
        .find_map(|part| part.strip_prefix("act="))?
        .trim()
        .trim_matches('/')
        .to_string();

    if act.is_empty() {
        return None;
    }

    let mut next = url;
    next.set_fragment(None);

    let mut path = next.path().trim_end_matches('/').to_string();
    if path.ends_with("/view") {
        path.truncate(path.len().saturating_sub("/view".len()));
    }
    if !path.ends_with('/') {
        path.push('/');
    }
    path.push_str(&act);
    if !path.ends_with('/') {
        path.push('/');
    }
    path.push_str("getAllPimList");
    next.set_path(&path);
    Some(next.to_string())
}

fn derived_notice_list_params(raw: &str) -> Vec<(String, String)> {
    let mut params = Vec::new();
    let Some(url) = Url::parse(raw).ok() else {
        return params;
    };

    let Some(fragment) = url.fragment() else {
        return params;
    };

    for part in fragment.split('&') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut split = trimmed.splitn(2, '=');
        let Some(key) = split.next() else {
            continue;
        };
        if key.trim() == "act" {
            continue;
        }
        let value = split.next().unwrap_or("");
        params.push((key.trim().to_string(), value.trim().to_string()));
    }

    params
}

fn build_notice_list_request_url(raw: &str, extra_params: &[(String, String)]) -> Result<String, String> {
    let mut url = Url::parse(raw).map_err(|e| format!("列表 URL 无效: {e}"))?;
    {
        let mut pairs = url.query_pairs_mut();
        for (key, value) in extra_params {
            pairs.append_pair(key, value);
        }
    }
    Ok(url.to_string())
}

fn notice_request_builder(
    client: &reqwest::Client,
    request_url: &str,
    auth_cookie: Option<&String>,
) -> reqwest::RequestBuilder {
    let mut builder = client
        .get(request_url)
        .header(reqwest::header::ACCEPT, "application/json, text/javascript, */*; q=0.01")
        .header(reqwest::header::REFERER, "https://one.cau.edu.cn/tp_up/view?m=up")
        .header(reqwest::header::HeaderName::from_static("x-requested-with"), "XMLHttpRequest");

    if let Some(cookie) = auth_cookie {
        builder = builder.header(reqwest::header::COOKIE, cookie);
    }

    builder
}

fn json_string_value(item: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(value) = item.get(*key) {
            if let Some(text) = value.as_str() {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            } else if let Some(number) = value.as_i64() {
                return number.to_string();
            } else if let Some(number) = value.as_u64() {
                return number.to_string();
            } else if let Some(number) = value.as_f64() {
                return number.to_string();
            }
        }
    }

    String::new()
}

fn json_time_value(item: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(value) = item.get(*key) {
            if let Some(text) = value.as_str() {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }

            if let Some(number) = value.as_i64() {
                let milliseconds = if number > 1_000_000_000_000 {
                    number
                } else {
                    number.saturating_mul(1000)
                };

                if let Some(dt) = chrono::DateTime::from_timestamp_millis(milliseconds) {
                    return dt.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string();
                }

                return number.to_string();
            }

            if let Some(number) = value.as_u64() {
                let milliseconds = if number > 1_000_000_000_000 {
                    number as i64
                } else {
                    (number as i64).saturating_mul(1000)
                };

                if let Some(dt) = chrono::DateTime::from_timestamp_millis(milliseconds) {
                    return dt.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string();
                }

                return number.to_string();
            }
        }
    }

    String::new()
}

fn parsed_rows_from_json(body: &str, base_url: &Url) -> Option<Vec<(String, String, String, Option<String>)>> {
    let value: Value = serde_json::from_str(body).ok()?;
    let items = value.get("list")?.as_array()?;
    let mut rows = Vec::new();

    for item in items {
        if !item.is_object() {
            continue;
        }

        let title = json_string_value(
            item,
            &[
                "TITLE",
                "RESOURCE_TITLE",
                "RESOURCE_NAME",
                "PIM_TITLE",
                "PIM_NAME",
                "NOTICE_TITLE",
                "NEWS_TITLE",
                "NAME",
                "title",
                "name",
                "resourceTitle",
                "resourceName",
            ],
        );
        if title.is_empty() {
            continue;
        }

        let department = {
            let value = json_string_value(
                item,
                &[
                    "BELONG_UNIT_NAME",
                    "UNIT_NAME",
                    "ORG_NAME",
                    "PUBLISH_DEPT",
                    "DEPT_NAME",
                    "DEPARTMENT",
                    "belongUnitName",
                    "unitName",
                    "deptName",
                    "department",
                    "BELONG_UNIT_ID",
                ],
            );
            if value.is_empty() {
                "未知部门".to_string()
            } else {
                value
            }
        };

        let published_at = {
            let value = json_time_value(
                item,
                &[
                    "END_TOP_TIME",
                    "PUBLISH_TIME",
                    "CREATE_TIME",
                    "CREATE_DATE",
                    "PUBLISH_DATE",
                    "START_TIME",
                    "UPDATE_TIME",
                    "endTopTime",
                    "publishTime",
                    "createTime",
                    "time",
                    "date",
                ],
            );
            if value.is_empty() {
                Local::now().format("%Y-%m-%d %H:%M").to_string()
            } else {
                value
            }
        };

        let link = {
            let value = json_string_value(
                item,
                &[
                    "URL",
                    "LINK",
                    "DETAIL_URL",
                    "VIEW_URL",
                    "HREF",
                    "RESOURCE_URL",
                    "url",
                    "link",
                    "detailUrl",
                    "viewUrl",
                    "href",
                ],
            );

            if value.is_empty() {
                None
            } else {
                base_url
                    .join(&value)
                    .ok()
                    .map(|u| u.to_string())
                    .or_else(|| Some(value))
            }
        };

        rows.push((title, department, published_at, link));
    }

    if rows.is_empty() {
        None
    } else {
        Some(rows)
    }
}

async fn send_notice_list_request(
    client: &reqwest::Client,
    request_list_url: &str,
    extra_params: &[(String, String)],
    auth_cookie: Option<&String>,
) -> Result<reqwest::Response, String> {
    let request_url = build_notice_list_request_url(request_list_url, extra_params)?;

    let get_req = notice_request_builder(client, &request_url, auth_cookie);

    match get_req.send().await {
        Ok(resp) if resp.status() != reqwest::StatusCode::METHOD_NOT_ALLOWED => Ok(resp),
        Ok(_) | Err(_) => {
            let mut json_payload = serde_json::Map::new();
            json_payload.insert("pageNum".to_string(), serde_json::json!(1));
            json_payload.insert("pageSize".to_string(), serde_json::json!(20));
            json_payload.insert("m".to_string(), serde_json::json!("up"));

            for (key, value) in extra_params {
                json_payload.insert(key.clone(), serde_json::json!(value));
            }

            let mut post_json_req = client
                .post(&request_url)
                .header(reqwest::header::ACCEPT, "application/json, text/javascript, */*; q=0.01")
                .header(reqwest::header::REFERER, "https://one.cau.edu.cn/tp_up/view?m=up")
                .header(reqwest::header::HeaderName::from_static("x-requested-with"), "XMLHttpRequest")
                .json(&json_payload);
            if let Some(cookie) = auth_cookie {
                post_json_req = post_json_req.header(reqwest::header::COOKIE, cookie);
            }

            match post_json_req.send().await {
                Ok(resp) => Ok(resp),
                Err(post_err) => Err(format!(
                    "抓取列表失败：GET 返回 405 或 GET 发送失败，JSON POST 失败({post_err})，请确认列表地址/请求方法/登录态是否正确"
                )),
            }
        }
    }
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
        .cookie_store(true)
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))?;

    let auth_mode = cfg.auth_mode.trim().to_lowercase();
    let mut auth_cookie: Option<String> = None;
    match auth_mode.as_str() {
        "cookie" => {
            let cookie = normalize_cookie_header(&cfg.cookie.clone().unwrap_or_default());
            if cookie.is_empty() {
                return Err("已选择 Cookie 认证，但 Cookie 为空".to_string());
            }
            auth_cookie = Some(cookie);
        }
        "form" => {
            let login_url = cfg
                .login_url
                .clone()
                .ok_or_else(|| "已选择账号密码登录，但未填写登录 URL".to_string())?;
            let username = cfg.username.clone().unwrap_or_default();
            let password = cfg.password.clone().unwrap_or_default();

            if username.trim().is_empty() || password.trim().is_empty() {
                return Err("已选择账号密码登录，但账号或密码为空".to_string());
            }

            let username_field = cfg.username_field.clone().unwrap_or_else(|| "username".to_string());
            let password_field = cfg.password_field.clone().unwrap_or_else(|| "password".to_string());

            let mut form_fields = vec![(username_field, username), (password_field, password)];
            if let Some(extra) = &cfg.login_extra_body {
                form_fields.extend(parse_kv_pairs(extra));
            }

            client
                .post(login_url)
                .form(&form_fields)
                .send()
                .await
                .map_err(|e| format!("登录请求失败: {e}"))?
                .error_for_status()
                .map_err(|e| format!("登录失败，请检查账号密码或登录参数: {e}"))?;
        }
        _ => {}
    }

    let request_list_url = derived_notice_list_url(&cfg.list_url).unwrap_or_else(|| strip_url_fragment(&cfg.list_url));
    let request_list_params = derived_notice_list_params(&cfg.list_url);
    let list_resp = send_notice_list_request(
        &client,
        &request_list_url,
        &request_list_params,
        auth_cookie.as_ref(),
    )
        .await
        .map_err(|e| format!("抓取列表失败: {e}"))?;

    let list_status = list_resp.status();
    let final_url = list_resp.url().to_string();
    let list_html = list_resp
        .text()
        .await
        .map_err(|e| format!("读取列表响应失败: {e}"))?;

    if !list_status.is_success() {
        return Err(format!("列表请求返回异常状态: {}（最终地址: {final_url}）", list_status));
    }

    let base_url = Url::parse(&request_list_url).map_err(|e| format!("列表 URL 无效: {e}"))?;
    let mut parsed_rows: Vec<ParsedNoticeRow> = {
        if list_html.trim_start().starts_with('{') || list_html.trim_start().starts_with('[') {
            if let Some(json_rows) = parsed_rows_from_json(&list_html, &base_url) {
                json_rows
                    .into_iter()
                    .map(|(title, department, published_at, link)| ParsedNoticeRow {
                        title,
                        department,
                        published_at,
                        link,
                    })
                    .collect()
            } else {
                Vec::new()
            }
        } else {
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
        }
    };

    if parsed_rows.is_empty() {
        let fallback_item_selector = selector("#allPimListDiv .tz-body-list").ok();
        let fallback_title_selector = selector("a.tit").ok();
        let fallback_dept_selector = selector(".tz-tit-info").ok();
        let fallback_time_selector = selector(".tz-tit-info").ok();
        let fallback_link_selector = selector("a.tit").ok();

        if let (Some(fi), Some(ft), Some(fd), Some(ftm), Some(fl)) = (
            fallback_item_selector,
            fallback_title_selector,
            fallback_dept_selector,
            fallback_time_selector,
            fallback_link_selector,
        ) {
            let doc = Html::parse_document(&list_html);
            for item in doc.select(&fi).take(20) {
                let title = inner_text_by_selector(&item, &ft);
                if title.is_empty() {
                    continue;
                }

                let department = {
                    let v = inner_text_by_selector(&item, &fd);
                    if v.is_empty() { "未知部门".to_string() } else { v }
                };
                let published_at = {
                    let v = inner_text_by_selector(&item, &ftm);
                    if v.is_empty() {
                        Local::now().format("%Y-%m-%d %H:%M").to_string()
                    } else {
                        v
                    }
                };

                let link = item
                    .select(&fl)
                    .next()
                    .and_then(|anchor| anchor.value().attr("href"))
                    .and_then(|href| base_url.join(href).ok().map(|u| u.to_string()));

                parsed_rows.push(ParsedNoticeRow {
                    title,
                    department,
                    published_at,
                    link,
                });
            }
        }
    }

    if parsed_rows.is_empty() {
        let hint_html = list_html.to_lowercase();
        if hint_html.contains("统一身份认证")
            || hint_html.contains("cas")
            || hint_html.contains("login")
            || hint_html.contains("用户名")
            || hint_html.contains("password")
        {
            if auth_mode == "none" {
                return Err(format!(
                    "抓取到的是登录页（最终地址: {final_url}）。当前认证模式是“无需认证”，请切换到“Cookie 认证”，并粘贴完整 Cookie（key=value; key2=value2）。"
                ));
            }
            return Err(format!(
                "抓取到的是登录页（最终地址: {final_url}），Cookie 可能失效或不完整。请在浏览器重新登录 one.cau.edu.cn 后复制请求头里的整段 Cookie 再试。"
            ));
        }
        return Err("未抓到通知条目：请检查列表 URL 和选择器。建议 itemSelector 使用 #allPimListDiv .tz-body-list，titleSelector 使用 a.tit。".to_string());
    }

    let mut notices = Vec::new();
    for (idx, row) in parsed_rows.into_iter().enumerate() {
        let mut content: Option<String> = None;
        if let (Some(cs), Some(link_url)) = (&content_selector, &row.link) {
            let mut detail_req = client.get(link_url);
            if let Some(cookie) = &auth_cookie {
                detail_req = detail_req.header(reqwest::header::COOKIE, cookie);
            }

            if let Ok(resp) = detail_req.send().await {
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

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let normalized = if url.starts_with("http://") || url.starts_with("https://") {
        url
    } else {
        format!("https://{url}")
    };
    open::that(&normalized).map_err(|e| format!("Failed to open URL: {e}"))
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
            save_thought,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
