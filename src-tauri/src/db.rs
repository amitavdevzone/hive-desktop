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
}
