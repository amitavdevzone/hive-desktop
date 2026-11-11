use std::{fs, path::{Path, PathBuf}};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::{auth, db::{self, Db}};

#[derive(Default, Serialize, Deserialize)]
struct Settings {
    base_url: Option<String>,
    /// None = never set = auto.
    auto_sync: Option<bool>,
    /// Global reminder-notification switch. None = never set = on.
    notifications: Option<bool>,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

fn load(path: &Path) -> Settings {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(path: &Path, settings: &Settings) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

/// Only http(s) URLs with a host; trailing slash dropped.
fn normalize_url(input: &str) -> Result<String, String> {
    let url = reqwest::Url::parse(input.trim()).map_err(|_| "Enter a valid URL".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("URL must start with http:// or https://".into());
    }
    Ok(url.as_str().trim_end_matches('/').to_string())
}

/// Persist the URL; returns true when it differs from the stored one.
fn store_base_url(path: &Path, input: &str) -> Result<bool, String> {
    let url = normalize_url(input)?;
    let mut settings = load(path);
    let changed = settings.base_url.as_deref() != Some(url.as_str());
    if changed {
        settings.base_url = Some(url);
        save(path, &settings)?;
    }
    Ok(changed)
}

pub fn read_base_url(app: &AppHandle) -> Result<Option<String>, String> {
    Ok(load(&settings_path(app)?).base_url)
}

#[tauri::command]
pub fn get_base_url(app: AppHandle) -> Result<Option<String>, String> {
    read_base_url(&app)
}

/// A different API means a different account: drop the old token and the
/// notes cached from the old server.
#[tauri::command]
pub fn set_base_url(app: AppHandle, db: State<Db>, url: String) -> Result<(), String> {
    if store_base_url(&settings_path(&app)?, &url)? {
        auth::delete_token()?;
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::clear(&conn).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_auto_sync(app: AppHandle) -> Result<bool, String> {
    Ok(load(&settings_path(&app)?).auto_sync.unwrap_or(true))
}

#[tauri::command]
pub fn set_auto_sync(app: AppHandle, enabled: bool) -> Result<(), String> {
    let path = settings_path(&app)?;
    let mut settings = load(&path);
    settings.auto_sync = Some(enabled);
    save(&path, &settings)
}

pub fn notifications_enabled(app: &AppHandle) -> bool {
    settings_path(app).map(|p| load(&p).notifications.unwrap_or(true)).unwrap_or(true)
}

pub fn set_notifications(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let path = settings_path(app)?;
    let mut settings = load(&path);
    settings.notifications = Some(enabled);
    save(&path, &settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_and_rejects() {
        assert_eq!(normalize_url(" https://hive-be.test/ ").unwrap(), "https://hive-be.test");
        assert_eq!(normalize_url("http://localhost:8000").unwrap(), "http://localhost:8000");
        assert!(normalize_url("ftp://x.test").is_err());
        assert!(normalize_url("garbage").is_err());
        assert!(normalize_url("").is_err());
    }

    #[test]
    fn reports_change_only_when_url_differs() {
        let path = std::env::temp_dir().join(format!("hive-settings-{}.json", std::process::id()));
        let _ = fs::remove_file(&path);
        assert!(store_base_url(&path, "https://a.test").unwrap());
        assert!(!store_base_url(&path, "https://a.test/").unwrap());
        assert!(store_base_url(&path, "https://b.test").unwrap());
        assert_eq!(load(&path).base_url.as_deref(), Some("https://b.test"));
        assert!(store_base_url(&path, "nope").is_err());

        // changing the URL must keep other settings
        let mut s = load(&path);
        s.auto_sync = Some(false);
        save(&path, &s).unwrap();
        store_base_url(&path, "https://c.test").unwrap();
        assert_eq!(load(&path).auto_sync, Some(false));
        let _ = fs::remove_file(&path);
    }
}
