//! Reminders cache: server -> SQLite mirror. `last_fired_at` is local-only.
use rusqlite::Connection;
use serde_json::Value;
use tauri::AppHandle;

use crate::http::{ApiError, send_authed};

/// Upsert server reminders. Changing `remind_at`/`interval_minutes` clears
/// `last_fired_at` so the new schedule starts fresh.
pub fn upsert(conn: &Connection, items: &[Value]) -> rusqlite::Result<()> {
    for r in items {
        let Some(id) = r.get("id").and_then(Value::as_i64) else { continue };
        let s = |k: &str| r.get(k).and_then(Value::as_str).map(String::from);
        conn.execute(
            "INSERT INTO reminders (remote_id, title, notes, type, remind_at, interval_minutes, is_active, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
             ON CONFLICT(remote_id) DO UPDATE SET
               title = excluded.title, notes = excluded.notes, type = excluded.type,
               created_at = excluded.created_at,
               last_fired_at = CASE WHEN remind_at IS excluded.remind_at
                 AND interval_minutes IS excluded.interval_minutes THEN last_fired_at END,
               remind_at = excluded.remind_at, interval_minutes = excluded.interval_minutes",
            (
                id,
                s("title").unwrap_or_default(),
                s("notes"),
                s("type").unwrap_or_default(),
                s("remind_at"),
                r.get("interval_minutes").and_then(Value::as_i64),
                s("created_at").unwrap_or_default(),
            ),
        )?;
    }
    Ok(())
}

/// Remove rows the server no longer lists as active.
pub fn prune(conn: &Connection, seen: &[i64]) -> rusqlite::Result<()> {
    let ids = serde_json::to_string(seen).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "DELETE FROM reminders WHERE remote_id NOT IN (SELECT value FROM json_each(?1))",
        [ids],
    )
    .map(|_| ())
}

/// Walk every page of active reminders, then apply under one lock.
pub async fn pull_reminders(app: &AppHandle, conn: &std::sync::Mutex<Connection>) -> Result<(), ApiError> {
    let mut items: Vec<Value> = vec![];
    let mut page = 1;
    loop {
        let res = send_authed(app, "GET", &format!("/api/reminders?active=1&page={page}"), None).await?;
        if let Some(d) = res.get("data").and_then(Value::as_array) {
            items.extend(d.iter().cloned());
        }
        let last = res.pointer("/meta/last_page").and_then(Value::as_i64).unwrap_or(1);
        if page >= last {
            break;
        }
        page += 1;
    }
    let seen: Vec<i64> = items.iter().filter_map(|r| r.get("id")?.as_i64()).collect();
    let conn = conn.lock().map_err(|_| ApiError::msg("Database busy"))?;
    upsert(&conn, &items)
        .and_then(|_| prune(&conn, &seen))
        .map_err(|e| ApiError::msg(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::SCHEMA;
    use serde_json::json;

    fn fired(c: &Connection, id: i64) -> Option<String> {
        c.query_row("SELECT last_fired_at FROM reminders WHERE remote_id=?1", [id], |r| r.get(0)).unwrap()
    }

    #[test]
    fn upsert_keeps_fired_state_until_schedule_changes_and_prunes() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(SCHEMA).unwrap();
        let once = |at: &str| json!({"id": 1, "title": "A", "type": "once", "remind_at": at, "created_at": "2026-01-01T00:00:00Z"});
        upsert(&c, &[once("2026-12-01T14:00:00+05:30"), json!({"id": 2, "title": "B", "type": "recurring", "interval_minutes": 30, "created_at": "x"})]).unwrap();
        c.execute("UPDATE reminders SET last_fired_at='t'", []).unwrap();

        upsert(&c, &[once("2026-12-01T14:00:00+05:30")]).unwrap();
        assert_eq!(fired(&c, 1).as_deref(), Some("t"));
        upsert(&c, &[once("2026-12-02T14:00:00+05:30")]).unwrap();
        assert_eq!(fired(&c, 1), None);
        assert_eq!(fired(&c, 2).as_deref(), Some("t"));

        prune(&c, &[1]).unwrap();
        let n: i64 = c.query_row("SELECT COUNT(*) FROM reminders", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 1);
    }
}
