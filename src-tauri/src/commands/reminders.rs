use tauri::{AppHandle, State};

use crate::{db::Db, http::ApiError, reminders};

/// Re-pull active reminders into the local cache.
#[tauri::command]
pub async fn refresh_reminders(app: AppHandle, db: State<'_, Db>) -> Result<(), ApiError> {
    reminders::pull_reminders(&app, &db.0).await
}

/// `last_fired_at` per reminder id, so the UI can show when a recurring one fires next.
#[tauri::command]
pub fn reminder_last_fired(db: State<Db>) -> Result<std::collections::HashMap<i64, String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.prepare("SELECT remote_id, last_fired_at FROM reminders WHERE last_fired_at IS NOT NULL")
        .map_err(|e| e.to_string())?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())
}
