use rusqlite::Connection;

use crate::budget::{list_budget, total_expense, total_income};
use crate::error::AppError;
use crate::models::{MonthSummary, parse_month};
use crate::recurring::pending_in_month;
use crate::models::CategoryKind;

pub fn month_summary(
    conn: &Connection,
    user_id: i64,
    month: &str,
    today: &str,
) -> Result<MonthSummary, AppError> {
    parse_month(month)?;
    crate::models::parse_date(today)?;
    let income_actual = total_income(conn, user_id, month)?;
    let expense_actual = total_expense(conn, user_id, month)?;
    let mut income_projected = income_actual;
    let mut expense_projected = expense_actual;
    for (_, kind, amount) in pending_in_month(conn, user_id, month, today)? {
        match kind {
            CategoryKind::Income => income_projected += amount,
            CategoryKind::Expense => expense_projected += amount,
        }
    }
    let b = list_budget(conn, user_id, month)?;
    let total_balance: i64 = conn.query_row(
        "SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM entry_lines l
         JOIN ledger_accounts a ON a.id = l.ledger_account_id
         JOIN entries e ON e.id = l.entry_id
         WHERE a.user_id = ? AND a.type = 'asset' AND a.archived = 0 AND e.user_id = ?",
        rusqlite::params![user_id, user_id],
        |r| r.get(0),
    )?;
    Ok(MonthSummary {
        month: month.to_string(),
        income_actual,
        income_projected,
        expense_actual,
        expense_projected,
        budget_total: b.total_budget,
        budget_spent: b.total_spent,
        unbudgeted_spent: b.unbudgeted_spent,
        total_balance,
    })
}
