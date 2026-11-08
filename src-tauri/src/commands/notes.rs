use tauri::{AppHandle, Emitter, State};

use crate::{db::{self, Db, Note}, http::ApiError, sync};

#[tauri::command]
pub fn list_notes(db: State<Db>) -> Result<Vec<Note>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note(db: State<Db>, id: i64) -> Result<Option<Note>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_note(&conn, id).map_err(|e| e.to_string())
}

/// Pull from the server into SQLite, then tell the UI to reload.
#[tauri::command]
pub async fn sync_now(app: AppHandle, db: State<'_, Db>) -> Result<(), ApiError> {
    sync::pull(&app, &db.0).await?;
    let _ = app.emit("notes-changed", ());
    Ok(())
}
