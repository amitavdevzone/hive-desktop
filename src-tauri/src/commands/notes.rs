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

#[tauri::command]
pub fn create_note(db: State<Db>) -> Result<Note, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::create_note(&conn)
}

#[tauri::command]
pub fn save_note(
    db: State<Db>,
    id: i64,
    title: String,
    text: String,
    format: String,
    tags: Vec<String>,
) -> Result<Note, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::save_note(&conn, id, &title, &text, &format, &tags)
}

#[tauri::command]
pub fn delete_note(db: State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_note(&conn, id)
}

#[tauri::command]
pub fn list_tag_names(db: State<Db>) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_tag_names(&conn).map_err(|e| e.to_string())
}

/// Pull from the server into SQLite, then tell the UI to reload.
#[tauri::command]
pub async fn sync_now(app: AppHandle, db: State<'_, Db>) -> Result<(), ApiError> {
    sync::pull(&app, &db.0).await?;
    let _ = app.emit("notes-changed", ());
    Ok(())
}
