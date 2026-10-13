use rusqlite::{Connection, OptionalExtension};

use crate::accounts::require_active_account;
use crate::categories::require_active_category;
use crate::error::{AppError, fail};
use crate::models::{BudgetLine, BudgetMonth, CategoryKind, parse_month};

/// Importe efectivo de una categoría en el mes M: fila con mayor from_month <= M.
pub fn effective_amount(conn: &Connection, user_id: i64, category_id: i64, month: &str) -> Result<i64, AppError> {
    Ok(conn
        .query_row(
            "SELECT amount FROM budgets WHERE user_id = ? AND category_id = ? AND from_month <= ? ORDER BY from_month DESC LIMIT 1",
            rusqlite::params![user_id, category_id, month],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or(0))
}

/// Gasto del ledger de la categoría en asientos del mes: suma(debit - credit).
pub fn category_spent(conn: &Connection, category_id: i64, month: &str) -> Result<i64, AppError> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM entry_lines l
         JOIN entries e ON e.id = l.entry_id
         WHERE l.ledger_account_id = ? AND e.date LIKE ? || '-%'",
        rusqlite::params![category_id, month],
        |r| r.get(0),
    )?)
}

/// Gasto total del mes en ledgers de gasto.
pub fn total_expense(conn: &Connection, user_id: i64, month: &str) -> Result<i64, AppError> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM entry_lines l
         JOIN entries e ON e.id = l.entry_id
         JOIN ledger_accounts a ON a.id = l.ledger_account_id
         WHERE e.user_id = ? AND a.type = 'expense' AND e.date LIKE ? || '-%'",
        rusqlite::params![user_id, month],
        |r| r.get(0),
    )?)
}

pub fn total_income(conn: &Connection, user_id: i64, month: &str) -> Result<i64, AppError> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(l.credit - l.debit), 0) FROM entry_lines l
         JOIN entries e ON e.id = l.entry_id
         JOIN ledger_accounts a ON a.id = l.ledger_account_id
         WHERE e.user_id = ? AND a.type = 'income' AND e.date LIKE ? || '-%'",
        rusqlite::params![user_id, month],
        |r| r.get(0),
    )?)
}

fn budget_account(
    conn: &Connection,
    account_id: Option<i64>,
) -> Result<(Option<i64>, Option<String>), AppError> {
    match account_id {
        None => Ok((None, None)),
        Some(a) => {
            let name: Option<String> = conn
                .query_row(
                    "SELECT name FROM ledger_accounts WHERE id = ?",
                    [a],
                    |r| r.get(0),
                )
                .optional()?;
            Ok((Some(a), name))
        }
    }
}

pub fn list_budget(conn: &Connection, user_id: i64, month: &str) -> Result<BudgetMonth, AppError> {
    parse_month(month)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, COALESCE(color, '#000000') FROM ledger_accounts
         WHERE user_id = ? AND type = 'expense' AND archived = 0 ORDER BY name COLLATE NOCASE",
    )?;
    let cats: Vec<(i64, String, String)> = stmt
        .query_map([user_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect::<rusqlite::Result<_>>()?;
    let mut lines = Vec::new();
    let mut total_budget = 0;
    let mut total_spent = 0;
    for (cat_id, cat_name, color) in cats {
        let amount = effective_amount(conn, user_id, cat_id, month)?;
        if amount <= 0 {
            continue;
        }
        let spent = category_spent(conn, cat_id, month)?;
        // Cuenta asociada: la fila vigente (mayor from_month <= M) si trae account_id.
        let account_id: Option<i64> = conn
            .query_row(
                "SELECT account_id FROM budgets WHERE user_id = ? AND category_id = ? AND from_month <= ? ORDER BY from_month DESC LIMIT 1",
                rusqlite::params![user_id, cat_id, month],
                |r| r.get(0),
            )
            .optional()?
            .flatten();
        let (account_id, account_name) = budget_account(conn, account_id)?;
        total_budget += amount;
        total_spent += spent;
        lines.push(BudgetLine {
            category_id: cat_id,
            category_name: cat_name,
            color,
            account_id,
            account_name,
            amount,
            spent,
            remaining: amount - spent,
            percent: if amount > 0 {
                spent as f64 * 100.0 / amount as f64
            } else {
                0.0
            },
        });
    }
    let unbudgeted = total_expense(conn, user_id, month)? - total_spent;
    Ok(BudgetMonth {
        month: month.to_string(),
        lines,
        total_budget,
        total_spent,
        unbudgeted_spent: unbudgeted,
    })
}

pub fn set_budget(
    conn: &Connection,
    user_id: i64,
    category_id: i64,
    account_id: Option<i64>,
    amount: i64,
    from_month: &str,
) -> Result<BudgetMonth, AppError> {
    parse_month(from_month)?;
    if amount < 0 {
        return fail("El monto debe ser mayor a 0");
    }
    // La categoría debe ser de gastos (puede estar archivada: el upsert no es movimiento).
    let ok: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM ledger_accounts WHERE id = ? AND user_id = ? AND type = 'expense'",
            rusqlite::params![category_id, user_id],
            |_| Ok(1),
        )
        .optional()?;
    if ok.is_none() {
        return fail("La categoría no es de gastos");
    }
    // Valida explícitamente el tipo para el mensaje literal.
    require_active_category(conn, user_id, category_id, CategoryKind::Expense).or_else(|e| {
        // Si está archivada, el mensaje de require_active_category no aplica al upsert;
        // se acepta igual (no es un movimiento nuevo).
        let archived: Option<i64> = conn
            .query_row(
                "SELECT archived FROM ledger_accounts WHERE id = ? AND user_id = ? AND type = 'expense'",
                rusqlite::params![category_id, user_id],
                |r| r.get(0),
            )
            .optional()?;
        match archived {
            Some(_) => Ok(()),
            None => Err(e),
        }
    })?;
    if let Some(a) = account_id {
        require_active_account(conn, user_id, a)?;
    }
    conn.execute(
        "INSERT INTO budgets (user_id, category_id, account_id, amount, from_month)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, category_id, from_month)
         DO UPDATE SET account_id = excluded.account_id, amount = excluded.amount",
        rusqlite::params![user_id, category_id, account_id, amount, from_month],
    )?;
    list_budget(conn, user_id, from_month)
}
