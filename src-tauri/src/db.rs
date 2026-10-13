use rusqlite::Connection;

use crate::error::AppError;

const SCHEMA_V1: &str = "
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    onboarding_done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ledger_accounts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'income', 'expense', 'equity')),
    subtype TEXT NULL,
    color TEXT NULL,
    is_system INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_ledger_user_type_name
    ON ledger_accounts(user_id, type, name COLLATE NOCASE);
CREATE TABLE recurring_rules (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    name TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    category_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
    account_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
    interval_months INTEGER NOT NULL CHECK (interval_months BETWEEN 1 AND 60),
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    start_date TEXT NOT NULL,
    end_date TEXT NULL,
    bonus_every_months INTEGER NULL,
    bonus_percent REAL NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE entries (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('opening', 'income', 'expense', 'transfer', 'adjustment')),
    description TEXT NOT NULL DEFAULT '',
    recurring_id INTEGER NULL REFERENCES recurring_rules(id) ON DELETE SET NULL,
    occurrence_date TEXT NULL,
    is_bonus INTEGER NOT NULL DEFAULT 0,
    receipt_json TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_entries_recurring
    ON entries(recurring_id, occurrence_date, is_bonus);
CREATE INDEX idx_entries_user_date ON entries(user_id, date);
CREATE TABLE entry_lines (
    id INTEGER PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    ledger_account_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
    debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
    CHECK ((debit = 0) <> (credit = 0))
);
CREATE INDEX idx_lines_ledger ON entry_lines(ledger_account_id);
CREATE TABLE recurring_skips (
    recurring_id INTEGER NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
    occurrence_date TEXT NOT NULL,
    is_bonus INTEGER NOT NULL,
    PRIMARY KEY (recurring_id, occurrence_date, is_bonus)
);
CREATE TABLE budgets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
    account_id INTEGER NULL REFERENCES ledger_accounts(id),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    from_month TEXT NOT NULL,
    UNIQUE (user_id, category_id, from_month)
);
";

pub fn open_database(path: &std::path::Path) -> Result<Connection, AppError> {
    let conn = Connection::open(path)?;
    configure(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
}

pub fn configure(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    Ok(())
}

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(SCHEMA_V1)?;
        conn.execute_batch("PRAGMA user_version = 1")?;
    }
    Ok(())
}

#[cfg(test)]
pub fn memory_db() -> Result<Connection, AppError> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
}

#[cfg(test)]
pub fn seed_user(conn: &Connection, username: &str) -> i64 {
    crate::auth::register(conn, username, "clave1234")
        .expect("seed user")
        .id
}
