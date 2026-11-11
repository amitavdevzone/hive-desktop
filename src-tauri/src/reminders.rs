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

#[derive(Debug, PartialEq)]
pub enum Decision {
    Nothing,
    /// Show a notification, then set `last_fired_at = now`.
    Fire,
    /// Too stale to notify: set `last_fired_at = now` without a notification.
    MarkFired,
}

const STALE_SECS: i64 = 24 * 3600;

/// All times are unix seconds (the scheduler converts the stored ISO strings).
/// `anchor` is `created_at`: where a never-fired recurring reminder starts counting.
/// A recurring one that fires restarts its interval from `now` because the
/// caller stores `last_fired_at = now`, so downtime never causes a burst.
pub fn due(
    kind: &str,
    remind_at: Option<i64>,
    interval_minutes: Option<i64>,
    anchor: i64,
    last_fired: Option<i64>,
    now: i64,
) -> Decision {
    match kind {
        "once" => match (remind_at, last_fired) {
            (Some(at), None) if now >= at => {
                if now - at >= STALE_SECS { Decision::MarkFired } else { Decision::Fire }
            }
            _ => Decision::Nothing,
        },
        "recurring" => match interval_minutes {
            Some(m) if m > 0 && now - last_fired.unwrap_or(anchor) >= m * 60 => Decision::Fire,
            _ => Decision::Nothing,
        },
        _ => Decision::Nothing,
    }
}

/// One scheduler pass: decide for every active cached reminder, record
/// `last_fired_at`, and return the (title, notes) pairs to notify.
fn tick(conn: &Connection) -> rusqlite::Result<Vec<(String, Option<String>)>> {
    const EPOCH: &str = "CAST(strftime('%s', {}) AS INTEGER)";
    let e = |c: &str| EPOCH.replace("{}", c);
    let rows: Vec<_> = conn
        .prepare(&format!(
            "SELECT remote_id, title, notes, type, {}, interval_minutes,
                    COALESCE({}, {}), {}, {} FROM reminders WHERE is_active = 1",
            e("remind_at"), e("created_at"), e("'now'"), e("last_fired_at"), e("'now'")
        ))?
        .query_map([], |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, Option<String>>(2)?,
                r.get::<_, String>(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get::<_, i64>(8)?))
        })?
        .collect::<Result<_, _>>()?;
    let mut fire = vec![];
    for (id, title, notes, kind, at, interval, anchor, last, now) in rows {
        let d = due(&kind, at, interval, anchor, last, now);
        if d == Decision::Nothing {
            continue;
        }
        conn.execute(
            "UPDATE reminders SET last_fired_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE remote_id = ?1",
            [id],
        )?;
        if d == Decision::Fire {
            fire.push((title, notes));
        }
    }
    Ok(fire)
}

/// Background thread (not a webview timer, so it keeps running while the window is hidden).
/// Cached reminders fire even with the network down.
pub fn start(app: AppHandle) {
    use tauri::Manager;
    use tauri_plugin_notification::NotificationExt;
    std::thread::spawn(move || {
        loop {
            let fire = app
                .state::<crate::db::Db>()
                .0
                .lock()
                .ok()
                .and_then(|c| tick(&c).ok())
                .unwrap_or_default();
            for (title, notes) in fire {
                let mut n = app.notification().builder().title(title);
                if let Some(body) = notes {
                    n = n.body(body);
                }
                let _ = n.show();
            }
            std::thread::sleep(std::time::Duration::from_secs(30));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::SCHEMA;

    #[test]
    fn tick_fires_due_once_exactly_once() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(SCHEMA).unwrap();
        c.execute(
            "INSERT INTO reminders (remote_id, title, type, remind_at, created_at) VALUES
             (1, 'due', 'once', strftime('%Y-%m-%dT%H:%M:%S+05:30', 'now', '-1 minute', '+5 hours', '+30 minutes'), '2026-01-01T00:00:00Z'),
             (2, 'later', 'once', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+1 hour'), '2026-01-01T00:00:00Z'),
             (3, 'stale', 'once', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days'), '2026-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let first = tick(&c).unwrap();
        assert_eq!(first.iter().map(|f| f.0.as_str()).collect::<Vec<_>>(), ["due"]);
        assert!(tick(&c).unwrap().is_empty());
        let stale_marked: Option<String> =
            c.query_row("SELECT last_fired_at FROM reminders WHERE remote_id=3", [], |r| r.get(0)).unwrap();
        assert!(stale_marked.is_some());
    }

    const NOW: i64 = 1_000_000;
    const MIN: i64 = 60;
    const H: i64 = 3600;

    #[test]
    fn once_fires_once_then_never() {
        let d = |at, fired| due("once", at, None, 0, fired, NOW);
        assert_eq!(d(Some(NOW + MIN), None), Decision::Nothing); // not yet
        assert_eq!(d(Some(NOW - MIN), None), Decision::Fire);
        assert_eq!(d(Some(NOW - MIN), Some(NOW)), Decision::Nothing); // already fired
        assert_eq!(d(None, None), Decision::Nothing);
    }

    #[test]
    fn once_overdue_fires_but_stale_is_silent() {
        let d = |ago| due("once", Some(NOW - ago), None, 0, None, NOW);
        assert_eq!(d(3 * H), Decision::Fire);
        assert_eq!(d(24 * H - 1), Decision::Fire);
        assert_eq!(d(24 * H), Decision::MarkFired);
        assert_eq!(d(30 * H), Decision::MarkFired);
    }

    #[test]
    fn recurring_waits_for_interval_since_last_fire() {
        let d = |fired_ago: Option<i64>| due("recurring", None, Some(30), NOW - 10 * H, fired_ago.map(|a| NOW - a), NOW);
        assert_eq!(d(Some(31 * MIN)), Decision::Fire);
        assert_eq!(d(Some(30 * MIN)), Decision::Fire);
        assert_eq!(d(Some(10 * MIN)), Decision::Nothing);
        assert_eq!(d(Some(10 * H)), Decision::Fire); // overdue after downtime: one fire
        assert_eq!(d(None), Decision::Fire); // never fired, created long ago
    }

    #[test]
    fn recurring_new_reminder_counts_from_creation() {
        let d = |created_ago| due("recurring", None, Some(30), NOW - created_ago, None, NOW);
        assert_eq!(d(5 * MIN), Decision::Nothing);
        assert_eq!(d(30 * MIN), Decision::Fire);
        assert_eq!(due("recurring", None, None, 0, None, NOW), Decision::Nothing);
        assert_eq!(due("recurring", None, Some(0), 0, None, NOW), Decision::Nothing);
    }
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
