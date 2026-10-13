use rusqlite::{Connection, OptionalExtension};

use crate::error::{AppError, fail, is_unique_violation};
use crate::models::{Category, CategoryKind, clean_name, check_color};

pub fn list_categories(
    conn: &Connection,
    user_id: i64,
    kind: Option<CategoryKind>,
    include_archived: bool,
) -> Result<Vec<Category>, AppError> {
    let filter = kind.map(|k| k.ledger_type());
    let sql = "SELECT id, name, type, COALESCE(color, '#000000'), archived
         FROM ledger_accounts
         WHERE user_id = ? AND type IN ('income', 'expense')
           AND (? IS NULL OR type = ?)
           AND (? = 1 OR archived = 0)
         ORDER BY name COLLATE NOCASE"
        .to_string();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![user_id, filter, include_archived as i64],
        |r| {
            let t: String = r.get(2)?;
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                kind: if t == "income" {
                    CategoryKind::Income
                } else {
                    CategoryKind::Expense
                },
                color: r.get(3)?,
                archived: r.get::<_, i64>(4)? != 0,
            })
        },
    )?;
    rows.collect::<rusqlite::Result<_>>().map_err(AppError::from)
}

pub fn create_category(
    conn: &Connection,
    user_id: i64,
    name: &str,
    kind: CategoryKind,
    color: &str,
) -> Result<Category, AppError> {
    let name = clean_name(name)?;
    let color = check_color(color)?;
    let r = conn.execute(
        "INSERT INTO ledger_accounts (user_id, name, type, color) VALUES (?, ?, ?, ?)",
        rusqlite::params![user_id, name, kind.ledger_type(), color],
    );
    match r {
        Ok(_) => get_category(conn, user_id, conn.last_insert_rowid()),
        Err(e) if is_unique_violation(&e) => fail("Ya existe una categoría con ese nombre"),
        Err(e) => Err(AppError::from(e)),
    }
}

pub fn update_category(
    conn: &Connection,
    user_id: i64,
    id: i64,
    name: &str,
    color: &str,
) -> Result<Category, AppError> {
    let name = clean_name(name)?;
    let color = check_color(color)?;
    let n = conn.execute(
        "UPDATE ledger_accounts SET name = ?, color = ? WHERE id = ? AND user_id = ? AND type IN ('income', 'expense')",
        rusqlite::params![name, color, id, user_id],
    )?;
    if n == 0 {
        return fail("Categoría no encontrada");
    }
    match get_category(conn, user_id, id) {
        Ok(c) => Ok(c),
        Err(_) => fail("Ya existe una categoría con ese nombre"),
    }
}

pub fn archive_category(conn: &Connection, user_id: i64, id: i64) -> Result<(), AppError> {
    let n = conn.execute(
        "UPDATE ledger_accounts SET archived = 1 WHERE id = ? AND user_id = ? AND type IN ('income', 'expense')",
        rusqlite::params![id, user_id],
    )?;
    if n == 0 {
        return fail("Categoría no encontrada");
    }
    Ok(())
}

fn get_category(conn: &Connection, user_id: i64, id: i64) -> Result<Category, AppError> {
    conn.query_row(
        "SELECT id, name, type, COALESCE(color, '#000000'), archived
         FROM ledger_accounts WHERE id = ? AND user_id = ? AND type IN ('income', 'expense')",
        rusqlite::params![id, user_id],
        |r| {
            let t: String = r.get(2)?;
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                kind: if t == "income" {
                    CategoryKind::Income
                } else {
                    CategoryKind::Expense
                },
                color: r.get(3)?,
                archived: r.get::<_, i64>(4)? != 0,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError("Categoría no encontrada".to_string()))
}

/// Categoría del usuario, del tipo pedido y no archivada (para movimientos nuevos).
pub fn require_active_category(
    conn: &Connection,
    user_id: i64,
    category_id: i64,
    kind: CategoryKind,
) -> Result<(), AppError> {
    let row: Option<(String, i64)> = conn
        .query_row(
            "SELECT type, archived FROM ledger_accounts WHERE id = ? AND user_id = ?",
            rusqlite::params![category_id, user_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    match row {
        Some((t, archived)) if t == kind.ledger_type() && archived == 0 => Ok(()),
        _ => fail(if kind == CategoryKind::Expense {
            "La categoría no es de gastos"
        } else {
            "La categoría no es de ingresos"
        }),
    }
}
