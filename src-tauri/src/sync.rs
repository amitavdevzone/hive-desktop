//! Pull half of notes sync: server -> SQLite. Local wins: a pull never
//! touches a row that isn't `synced`.
use rusqlite::Connection;
use serde_json::Value;
use tauri::AppHandle;

use crate::{
    db::{self, Note},
    http::{ApiError, send_authed},
};

/// Tags may arrive as `"name"` or `{"name": "..."}`.
fn tag_names(v: &Value) -> Vec<String> {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|t| t.as_str().or_else(|| t.get("name").and_then(Value::as_str)))
                .map(String::from)
                .collect()
        })
        .unwrap_or_default()
}

/// Upsert one page of server notes (`data` items).
pub fn upsert_page(conn: &Connection, items: &[Value]) -> rusqlite::Result<()> {
    for n in items {
        let Some(remote_id) = n.get("id").and_then(Value::as_i64) else { continue };
        let s = |k: &str| n.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
        let tags = serde_json::to_string(&tag_names(&n["tags"])).unwrap_or_else(|_| "[]".into());
        // The WHERE keeps dirty/deleted rows untouched.
        conn.execute(
            "INSERT INTO notes (remote_id, title, text, format, tags, status, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'synced', strftime('%Y-%m-%dT%H:%M:%SZ', ?6))
             ON CONFLICT(remote_id) DO UPDATE SET
               title = excluded.title, text = excluded.text, format = excluded.format,
               tags = excluded.tags, updated_at = excluded.updated_at, last_error = NULL
             WHERE notes.status = 'synced'",
            (remote_id, s("title"), s("text"), s("format"), tags, s("updated_at")),
        )?;
    }
    Ok(())
}

/// Remove synced rows the server no longer has.
pub fn prune(conn: &Connection, seen: &[i64]) -> rusqlite::Result<()> {
    let ids = serde_json::to_string(seen).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "DELETE FROM notes WHERE status = 'synced' AND remote_id IS NOT NULL
         AND remote_id NOT IN (SELECT value FROM json_each(?1))",
        [ids],
    )?;
    Ok(())
}

fn lock(conn: &std::sync::Mutex<Connection>) -> Result<std::sync::MutexGuard<'_, Connection>, ApiError> {
    conn.lock().map_err(|_| ApiError::msg("Database busy"))
}

/// Server's message plus the first field error (Laravel 422).
fn error_text(e: &ApiError) -> String {
    let field = e.errors.as_ref().and_then(|m| m.values().next()?.first().cloned());
    match field {
        Some(f) if f != e.message => format!("{} {f}", e.message),
        _ => e.message.clone(),
    }
}

/// Push local changes, one request per note. A network error or 401 stops the
/// run (no retry loop); any other rejection is stored on the note and skipped.
pub async fn push(app: &AppHandle, conn: &std::sync::Mutex<Connection>) -> Result<(), ApiError> {
    let queue = {
        let c = lock(conn)?;
        db::pending(&c).map_err(|e| ApiError::msg(&e.to_string()))?
    };
    for n in queue {
        let res = push_one(app, &n).await;
        let c = lock(conn)?;
        let db_result = match &res {
            Ok(_) if n.status == "deleted" => db::drop_deleted(&c, n.id),
            Ok(remote_id) => db::mark_pushed(&c, n.id, *remote_id, &n.updated_at),
            // 401: send_authed already routed to login; keep the edit untouched.
            Err(e) if e.status == Some(401) => Ok(()),
            Err(e) => db::mark_failed(&c, n.id, &error_text(e)),
        };
        db_result.map_err(|e| ApiError::msg(&e.to_string()))?;
        if let Err(e) = res
            && (e.status.is_none() || e.status == Some(401))
        {
            return Err(e);
        }
    }
    Ok(())
}

/// Returns the note's remote id (unchanged for deletes).
async fn push_one(app: &AppHandle, n: &Note) -> Result<i64, ApiError> {
    let body = serde_json::json!({
        "title": n.title, "text": n.text, "format": n.format, "tags": n.tags,
    });
    match (n.status.as_str(), n.remote_id) {
        ("deleted", Some(id)) => {
            match send_authed(app, "DELETE", &format!("/api/notes/{id}"), None).await {
                Err(e) if e.status != Some(404) => Err(e),
                _ => Ok(id), // already gone on the server counts as deleted
            }
        }
        (_, Some(id)) => {
            send_authed(app, "PUT", &format!("/api/notes/{id}"), Some(body)).await?;
            Ok(id)
        }
        _ => {
            let res = send_authed(app, "POST", "/api/notes", Some(body)).await?;
            res.pointer("/data/id")
                .or_else(|| res.get("id"))
                .and_then(Value::as_i64)
                .ok_or_else(|| ApiError::msg("Unexpected response from server"))
        }
    }
}

/// Walk every page of `/api/notes`, then apply under one lock.
pub async fn pull(app: &AppHandle, conn: &std::sync::Mutex<Connection>) -> Result<(), ApiError> {
    let mut items: Vec<Value> = vec![];
    let mut page = 1;
    loop {
        let res = send_authed(app, "GET", &format!("/api/notes?page={page}"), None).await?;
        if let Some(d) = res.get("data").and_then(Value::as_array) {
            items.extend(d.iter().cloned());
        }
        // Un-paginated responses have no meta; stop after the first page.
        let last = res.pointer("/meta/last_page").and_then(Value::as_i64).unwrap_or(1);
        if page >= last {
            break;
        }
        page += 1;
    }
    let seen: Vec<i64> = items.iter().filter_map(|n| n.get("id")?.as_i64()).collect();
    let conn = conn.lock().map_err(|_| ApiError::msg("Database busy"))?;
    upsert_page(&conn, &items)
        .and_then(|_| prune(&conn, &seen))
        .map_err(|e| ApiError::msg(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{SCHEMA, list_notes};
    use serde_json::json;

    fn mem() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(SCHEMA).unwrap();
        c
    }

    #[test]
    fn pull_upserts_and_never_overwrites_dirty() {
        let c = mem();
        let page = [
            json!({"id": 1, "title": "A", "text": "a", "format": "plain", "tags": ["x", {"name": "y"}], "updated_at": "2026-01-01T10:00:00.000000Z"}),
            json!({"id": 2, "title": "B", "text": "b", "format": "markdown", "tags": [], "updated_at": "2026-01-02T10:00:00Z"}),
        ];
        upsert_page(&c, &page).unwrap();
        let notes = list_notes(&c).unwrap();
        assert_eq!(notes[0].title, "B");
        assert_eq!(notes[1].tags, ["x", "y"]);
        assert_eq!(notes[1].updated_at, "2026-01-01T10:00:00Z");

        c.execute("UPDATE notes SET status='dirty', title='local' WHERE remote_id=1", []).unwrap();
        upsert_page(&c, &[json!({"id": 1, "title": "server", "updated_at": "2026-02-01T00:00:00Z"})]).unwrap();
        let n = list_notes(&c).unwrap().into_iter().find(|n| n.remote_id == Some(1)).unwrap();
        assert_eq!((n.title.as_str(), n.status.as_str()), ("local", "dirty"));
    }

    #[test]
    fn prune_removes_only_synced_missing_rows() {
        let c = mem();
        upsert_page(&c, &[
            json!({"id": 1, "title": "keep", "updated_at": "2026-01-01T00:00:00Z"}),
            json!({"id": 2, "title": "drop", "updated_at": "2026-01-01T00:00:00Z"}),
            json!({"id": 3, "title": "dirty", "updated_at": "2026-01-01T00:00:00Z"}),
        ]).unwrap();
        c.execute("UPDATE notes SET status='dirty' WHERE remote_id=3", []).unwrap();
        prune(&c, &[1]).unwrap();
        let titles: Vec<_> = list_notes(&c).unwrap().into_iter().map(|n| n.title).collect();
        assert_eq!(titles.len(), 2);
        assert!(!titles.contains(&"drop".to_string()));
    }
}
