use tauri::{AppHandle, State};

use crate::{db::Db, http::ApiError, reminders};

/// Re-pull active reminders into the local cache.
#[tauri::command]
pub async fn refresh_reminders(app: AppHandle, db: State<'_, Db>) -> Result<(), ApiError> {
    reminders::pull_reminders(&app, &db.0).await
}
