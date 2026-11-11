//! Local SQLite store for notes. Owned by Rust; the frontend never sees SQL.
use std::sync::Mutex;

use rusqlite::{Connection, Row};
use serde::Serialize;

pub struct Db(pub Mutex<Connection>);

/// status: 'synced' | 'dirty' | 'deleted'. Timestamps are UTC `YYYY-MM-DDTHH:MM:SSZ`.
pub const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    remote_id  INTEGER UNIQUE,
    title      TEXT NOT NULL,
    text       TEXT NOT NULL DEFAULT '',
    format     TEXT NOT NULL DEFAULT 'plain',
    tags       TEXT NOT NULL DEFAULT '[]',
    status     TEXT NOT NULL DEFAULT 'dirty',
    last_error TEXT,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
    remote_id        INTEGER PRIMARY KEY,
    title            TEXT NOT NULL,
    notes            TEXT,
    type             TEXT NOT NULL,
    remind_at        TEXT,
    interval_minutes INTEGER,
    is_active        INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL,
    last_fired_at    TEXT
);";

pub fn open(path: &std::path::Path) -> Result<Db, String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
    Ok(Db(Mutex::new(conn)))
}

#[derive(Debug, Serialize)]
pub struct Note {
    pub id: i64,
    pub remote_id: Option<i64>,
    pub title: String,
    pub text: String,
    pub format: String,
    pub tags: Vec<String>,
    pub status: String,
    pub last_error: Option<String>,
    pub updated_at: String,
}

const COLS: &str = "id, remote_id, title, text, format, tags, status, last_error, updated_at";

fn from_row(r: &Row) -> rusqlite::Result<Note> {
    let tags: String = r.get(5)?;
    Ok(Note {
        id: r.get(0)?,
        remote_id: r.get(1)?,
        title: r.get(2)?,
        text: r.get(3)?,
        format: r.get(4)?,
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        status: r.get(6)?,
        last_error: r.get(7)?,
        updated_at: r.get(8)?,
    })
}

/// Newest updated first; locally deleted rows are hidden.
pub fn list_notes(conn: &Connection) -> rusqlite::Result<Vec<Note>> {
    conn.prepare(&format!(
        "SELECT {COLS} FROM notes WHERE status != 'deleted' ORDER BY updated_at DESC, id DESC"
    ))?
    .query_map([], from_row)?
    .collect()
}

pub fn get_note(conn: &Connection, id: i64) -> rusqlite::Result<Option<Note>> {
    let mut stmt = conn.prepare(&format!("SELECT {COLS} FROM notes WHERE id = ?1"))?;
    let mut rows = stmt.query_map([id], from_row)?;
    rows.next().transpose()
}

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

/// Trim, lowercase, drop empties/duplicates, keep order.
pub fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut out: Vec<String> = vec![];
    for t in tags {
        let t = t.trim().to_lowercase();
        if !t.is_empty() && t.chars().count() <= 50 && !out.contains(&t) {
            out.push(t);
        }
    }
    out
}

pub fn create_note(conn: &Connection) -> Result<Note, String> {
    conn.execute(
        &format!("INSERT INTO notes (title, updated_at) VALUES ('Untitled', {NOW})"),
        [],
    )
    .map_err(|e| e.to_string())?;
    get_note(conn, conn.last_insert_rowid())
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Note not found".into())
}

/// Save locally and mark dirty; the server push happens in sync.
pub fn save_note(
    conn: &Connection,
    id: i64,
    title: &str,
    text: &str,
    format: &str,
    tags: &[String],
) -> Result<Note, String> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > 255 {
        return Err("Title is required (max 255 characters)".into());
    }
    if !matches!(format, "plain" | "markdown") {
        return Err("Format must be plain or markdown".into());
    }
    let tags = serde_json::to_string(&normalize_tags(tags)).map_err(|e| e.to_string())?;
    let n = conn
        .execute(
            &format!(
                "UPDATE notes SET title=?1, text=?2, format=?3, tags=?4, status='dirty',
                 last_error=NULL, updated_at={NOW} WHERE id=?5 AND status != 'deleted'"
            ),
            (title, text, format, tags, id),
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Note not found".into());
    }
    get_note(conn, id).map_err(|e| e.to_string())?.ok_or_else(|| "Note not found".into())
}

/// Never-pushed notes vanish; pushed ones are tombstoned until sync deletes them remotely.
pub fn delete_note(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE id=?1 AND remote_id IS NULL", [id])
        .map_err(|e| e.to_string())?;
    conn.execute(
        &format!("UPDATE notes SET status='deleted', updated_at={NOW} WHERE id=?1"),
        [id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Drop every note (the server changed, so the cache is someone else's data).
pub fn clear(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM notes", []).map(|_| ())
}

/// Rows waiting to be pushed, oldest first.
pub fn pending(conn: &Connection) -> rusqlite::Result<Vec<Note>> {
    conn.prepare(&format!(
        "SELECT {COLS} FROM notes WHERE status IN ('dirty','deleted') ORDER BY id"
    ))?
    .query_map([], from_row)?
    .collect()
}

/// After a successful push. If the note was edited while the request was in
/// flight (`updated_at` moved), it stays dirty so the newer edit is pushed next.
pub fn mark_pushed(conn: &Connection, id: i64, remote_id: i64, pushed_at: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE notes SET remote_id=?1, last_error=NULL,
         status = CASE WHEN updated_at=?3 THEN 'synced' ELSE 'dirty' END WHERE id=?2",
        (remote_id, id, pushed_at),
    )
    .map(|_| ())
}

/// A pushed delete: the tombstone goes, unless it was somehow revived.
pub fn drop_deleted(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM notes WHERE id=?1 AND status='deleted'", [id]).map(|_| ())
}

pub fn mark_failed(conn: &Connection, id: i64, msg: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE notes SET last_error=?1 WHERE id=?2", (msg, id)).map(|_| ())
}

pub fn list_tag_names(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    conn.prepare(
        "SELECT DISTINCT j.value FROM notes, json_each(notes.tags) j
         WHERE notes.status != 'deleted' ORDER BY j.value",
    )?
    .query_map([], |r| r.get(0))?
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn mem() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(SCHEMA).unwrap();
        c
    }

    #[test]
    fn lists_newest_first_and_hides_deleted() {
        let c = mem();
        for (t, s, u) in [
            ("old", "synced", "2026-01-01T00:00:00Z"),
            ("new", "dirty", "2026-02-01T00:00:00Z"),
            ("gone", "deleted", "2026-03-01T00:00:00Z"),
        ] {
            c.execute("INSERT INTO notes (title, status, updated_at) VALUES (?1, ?2, ?3)", (t, s, u))
                .unwrap();
        }
        let titles: Vec<_> = list_notes(&c).unwrap().into_iter().map(|n| n.title).collect();
        assert_eq!(titles, ["new", "old"]);
        assert!(get_note(&c, 1).unwrap().is_some());
        assert!(get_note(&c, 99).unwrap().is_none());
    }

    #[test]
    fn save_marks_dirty_and_validates() {
        let c = mem();
        let id = create_note(&c).unwrap().id;
        c.execute("UPDATE notes SET status='synced', remote_id=7 WHERE id=?1", [id]).unwrap();
        let tags = ["  Server ".to_string(), "server".into(), "".into(), "Office".into()];
        let n = save_note(&c, id, " Hi ", "body", "markdown", &tags).unwrap();
        assert_eq!((n.title.as_str(), n.status.as_str()), ("Hi", "dirty"));
        assert_eq!(n.tags, ["server", "office"]);
        assert!(save_note(&c, id, "  ", "", "plain", &[]).is_err());
        assert!(save_note(&c, id, "t", "", "html", &[]).is_err());
        assert!(save_note(&c, 99, "t", "", "plain", &[]).is_err());
        assert_eq!(list_tag_names(&c).unwrap(), ["office", "server"]);
    }

    #[test]
    fn editing_an_older_note_moves_it_to_the_top() {
        let c = mem();
        c.execute("INSERT INTO notes (title, updated_at) VALUES ('old', '2020-01-01T00:00:00Z')", []).unwrap();
        c.execute("INSERT INTO notes (title, updated_at) VALUES ('newer', '2021-01-01T00:00:00Z')", []).unwrap();
        save_note(&c, 1, "old", "edited", "plain", &[]).unwrap();
        assert_eq!(list_notes(&c).unwrap()[0].title, "old");
    }

    #[test]
    fn push_bookkeeping() {
        let c = mem();
        let a = create_note(&c).unwrap();
        let b = create_note(&c).unwrap();
        assert_eq!(pending(&c).unwrap().len(), 2);

        mark_pushed(&c, a.id, 10, &a.updated_at).unwrap();
        let a2 = get_note(&c, a.id).unwrap().unwrap();
        assert_eq!((a2.status.as_str(), a2.remote_id), ("synced", Some(10)));

        // edited during the request: remote_id recorded, still dirty
        mark_pushed(&c, b.id, 11, "1999-01-01T00:00:00Z").unwrap();
        assert_eq!(get_note(&c, b.id).unwrap().unwrap().status, "dirty");

        mark_failed(&c, b.id, "The tags field is required.").unwrap();
        assert_eq!(
            get_note(&c, b.id).unwrap().unwrap().last_error.as_deref(),
            Some("The tags field is required.")
        );

        delete_note(&c, a.id).unwrap();
        assert_eq!(pending(&c).unwrap().len(), 2);
        drop_deleted(&c, a.id).unwrap();
        assert!(get_note(&c, a.id).unwrap().is_none());
        clear(&c).unwrap();
        assert!(pending(&c).unwrap().is_empty());
    }

    #[test]
    fn delete_removes_unpushed_and_tombstones_pushed() {
        let c = mem();
        let local = create_note(&c).unwrap().id;
        let pushed = create_note(&c).unwrap().id;
        c.execute("UPDATE notes SET status='synced', remote_id=7 WHERE id=?1", [pushed]).unwrap();
        delete_note(&c, local).unwrap();
        delete_note(&c, pushed).unwrap();
        assert!(get_note(&c, local).unwrap().is_none());
        assert_eq!(get_note(&c, pushed).unwrap().unwrap().status, "deleted");
        assert!(list_notes(&c).unwrap().is_empty());
        assert!(list_tag_names(&c).unwrap().is_empty());
    }
}
