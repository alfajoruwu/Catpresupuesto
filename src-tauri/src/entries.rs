use rusqlite::{Connection, OptionalExtension};

use crate::accounts::require_active_account;
use crate::auth::equity_account;
use crate::categories::require_active_category;
use crate::error::{AppError, fail};
use crate::ledger::{NewEntry, post_entry, replace_lines};
use crate::models::{
    CategoryKind, Entry, EntryKind, EntryLine, LedgerType, ReceiptMeta, entry_kind_as_str,
    parse_date, parse_entry_kind, parse_month,
};

fn ledger_type_of(s: &str) -> LedgerType {
    match s {
        "asset" => LedgerType::Asset,
        "income" => LedgerType::Income,
        "expense" => LedgerType::Expense,
        _ => LedgerType::Equity,
    }
}

/// Cabecera de un asiento: (date, kind, description, recurring_id, occurrence_date, is_bonus, receipt_json).
type EntryHead = (
    String,
    String,
    String,
    Option<i64>,
    Option<String>,
    i64,
    Option<String>,
);

/// Reconstruye la vista `Entry` desde un id, verificando pertenencia al usuario.
pub fn get_entry(conn: &Connection, user_id: i64, entry_id: i64) -> Result<Entry, AppError> {
    let head: Option<EntryHead> =
        conn.query_row(
            "SELECT date, kind, description, recurring_id, occurrence_date, is_bonus, receipt_json
             FROM entries WHERE id = ? AND user_id = ?",
            rusqlite::params![entry_id, user_id],
            |r| {
                Ok((
                    r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?,
                    r.get(6)?,
                ))
            },
        )
        .optional()?;
    let (date, kind_s, description, recurring_id, _occurrence, is_bonus, receipt_json) =
        head.ok_or_else(|| AppError("Movimiento no encontrado".to_string()))?;
    let kind = parse_entry_kind(&kind_s).unwrap_or(EntryKind::Adjustment);

    let mut stmt = conn.prepare(
        "SELECT l.ledger_account_id, a.name, a.type, l.debit, l.credit
         FROM entry_lines l JOIN ledger_accounts a ON a.id = l.ledger_account_id
         WHERE l.entry_id = ? ORDER BY l.id",
    )?;
    let lines: Vec<EntryLine> = stmt
        .query_map([entry_id], |r| {
            Ok(EntryLine {
                ledger_account_id: r.get(0)?,
                ledger_account_name: r.get(1)?,
                ledger_account_type: ledger_type_of(&r.get::<_, String>(2)?),
                debit: r.get(3)?,
                credit: r.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    let amount: i64 = lines.iter().map(|l| l.debit).sum();

    let debit_asset = lines
        .iter()
        .find(|l| l.ledger_account_type == LedgerType::Asset && l.debit > 0);
    let credit_asset = lines
        .iter()
        .find(|l| l.ledger_account_type == LedgerType::Asset && l.credit > 0);
    let income_line = lines
        .iter()
        .find(|l| l.ledger_account_type == LedgerType::Income);
    let expense_line = lines
        .iter()
        .find(|l| l.ledger_account_type == LedgerType::Expense);

    let (category_id, category_name, category_color) = match kind {
        EntryKind::Income => income_line
            .map(|l| {
                (
                    Some(l.ledger_account_id),
                    Some(l.ledger_account_name.clone()),
                    color_of(conn, l.ledger_account_id),
                )
            })
            .unwrap_or((None, None, None)),
        EntryKind::Expense => expense_line
            .map(|l| {
                (
                    Some(l.ledger_account_id),
                    Some(l.ledger_account_name.clone()),
                    color_of(conn, l.ledger_account_id),
                )
            })
            .unwrap_or((None, None, None)),
        _ => (None, None, None),
    };
    let (account_id, account_name, to_account_id, to_account_name) = match kind {
        EntryKind::Income => (
            debit_asset.map(|l| l.ledger_account_id),
            debit_asset.map(|l| l.ledger_account_name.clone()),
            None,
            None,
        ),
        EntryKind::Expense => (
            credit_asset.map(|l| l.ledger_account_id),
            credit_asset.map(|l| l.ledger_account_name.clone()),
            None,
            None,
        ),
        EntryKind::Transfer => (
            credit_asset.map(|l| l.ledger_account_id),
            credit_asset.map(|l| l.ledger_account_name.clone()),
            debit_asset.map(|l| l.ledger_account_id),
            debit_asset.map(|l| l.ledger_account_name.clone()),
        ),
        EntryKind::Opening | EntryKind::Adjustment => (
            debit_asset
                .or(credit_asset)
                .map(|l| l.ledger_account_id),
            debit_asset
                .or(credit_asset)
                .map(|l| l.ledger_account_name.clone()),
            None,
            None,
        ),
    };
    let receipt = receipt_json
        .as_deref()
        .map(serde_json::from_str::<ReceiptMeta>)
        .transpose()
        .map_err(|_| AppError("No se pudo leer el comprobante".to_string()))?;

    Ok(Entry {
        id: entry_id,
        date,
        kind,
        description,
        amount,
        category_id,
        category_name,
        category_color,
        account_id,
        account_name,
        to_account_id,
        to_account_name,
        recurring_id,
        is_bonus: is_bonus != 0,
        receipt,
        lines,
    })
}

fn color_of(conn: &Connection, ledger_id: i64) -> Option<String> {
    conn.query_row(
        "SELECT color FROM ledger_accounts WHERE id = ?",
        [ledger_id],
        |r| r.get(0),
    )
    .unwrap_or(None)
}

pub fn create_transfer(
    conn: &mut Connection,
    user_id: i64,
    from: i64,
    to: i64,
    amount: i64,
    date: &str,
    description: &str,
) -> Result<Entry, AppError> {
    if from == to {
        return fail("Elige dos cuentas distintas");
    }
    crate::models::check_amount(amount)?;
    parse_date(date)?;
    require_active_account(conn, user_id, from)?;
    require_active_account(conn, user_id, to)?;
    let tx = conn.transaction()?;
    let id = post_entry(
        &tx,
        user_id,
        NewEntry {
            date,
            kind: "transfer",
            description,
            recurring_id: None,
            occurrence_date: None,
            is_bonus: false,
            receipt_json: None,
            lines: &[(to, amount, 0), (from, 0, amount)],
        },
    )?;
    tx.commit()?;
    get_entry(conn, user_id, id)
}

pub fn create_income(
    conn: &mut Connection,
    user_id: i64,
    amount: i64,
    date: &str,
    category_id: i64,
    account_id: i64,
    description: &str,
) -> Result<Entry, AppError> {
    crate::models::check_amount(amount)?;
    parse_date(date)?;
    require_active_category(conn, user_id, category_id, CategoryKind::Income)?;
    require_active_account(conn, user_id, account_id)?;
    let tx = conn.transaction()?;
    let id = post_entry(
        &tx,
        user_id,
        NewEntry {
            date,
            kind: "income",
            description,
            recurring_id: None,
            occurrence_date: None,
            is_bonus: false,
            receipt_json: None,
            lines: &[(account_id, amount, 0), (category_id, 0, amount)],
        },
    )?;
    tx.commit()?;
    get_entry(conn, user_id, id)
}

/// Los 8 parámetros responden al contrato del comando `create_expense`.
#[allow(clippy::too_many_arguments)]
pub fn create_expense(
    conn: &mut Connection,
    user_id: i64,
    amount: i64,
    date: &str,
    category_id: i64,
    account_id: i64,
    description: &str,
    receipt: Option<&ReceiptMeta>,
) -> Result<Entry, AppError> {
    crate::models::check_amount(amount)?;
    parse_date(date)?;
    require_active_category(conn, user_id, category_id, CategoryKind::Expense)?;
    require_active_account(conn, user_id, account_id)?;
    let receipt_json;
    let receipt_ref = match receipt {
        Some(r) => {
            receipt_json = serde_json::to_string(r)
                .map_err(|_| AppError("No se pudo guardar el comprobante".to_string()))?;
            Some(receipt_json.as_str())
        }
        None => None,
    };
    // El equity no interviene, pero se verifica que el usuario exista vía sus ledgers.
    let _ = equity_account(conn, user_id).ok();
    let tx = conn.transaction()?;
    let id = post_entry(
        &tx,
        user_id,
        NewEntry {
            date,
            kind: "expense",
            description,
            recurring_id: None,
            occurrence_date: None,
            is_bonus: false,
            receipt_json: receipt_ref,
            lines: &[(category_id, amount, 0), (account_id, 0, amount)],
        },
    )?;
    tx.commit()?;
    get_entry(conn, user_id, id)
}

/// Solo income/expense. Sustituye líneas conservando recurring_id/occurrence_date.
/// Los 8 parámetros responden al contrato del comando `update_entry`.
#[allow(clippy::too_many_arguments)]
pub fn update_entry(
    conn: &mut Connection,
    user_id: i64,
    id: i64,
    amount: i64,
    date: &str,
    category_id: i64,
    account_id: i64,
    description: &str,
) -> Result<Entry, AppError> {
    crate::models::check_amount(amount)?;
    parse_date(date)?;
    let current = get_entry(conn, user_id, id)?;
    let lines: Vec<(i64, i64, i64)> = match current.kind {
        EntryKind::Income => {
            require_active_category(conn, user_id, category_id, CategoryKind::Income)?;
            require_active_account(conn, user_id, account_id)?;
            vec![(account_id, amount, 0), (category_id, 0, amount)]
        }
        EntryKind::Expense => {
            require_active_category(conn, user_id, category_id, CategoryKind::Expense)?;
            require_active_account(conn, user_id, account_id)?;
            vec![(category_id, amount, 0), (account_id, 0, amount)]
        }
        _ => return fail("Solo se pueden editar ingresos y gastos"),
    };
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE entries SET date = ?, description = ? WHERE id = ?",
        rusqlite::params![date, description, id],
    )?;
    replace_lines(&tx, user_id, id, &lines)?;
    tx.commit()?;
    get_entry(conn, user_id, id)
}

pub fn delete_entry(conn: &mut Connection, user_id: i64, id: i64) -> Result<(), AppError> {
    let row: Option<(Option<i64>, Option<String>, i64)> = conn
        .query_row(
            "SELECT recurring_id, occurrence_date, is_bonus FROM entries WHERE id = ? AND user_id = ?",
            rusqlite::params![id, user_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let Some((recurring_id, occurrence_date, is_bonus)) = row else {
        return fail("Movimiento no encontrado");
    };
    let tx = conn.transaction()?;
    if let (Some(rid), Some(occ)) = (recurring_id, occurrence_date) {
        tx.execute(
            "INSERT OR IGNORE INTO recurring_skips (recurring_id, occurrence_date, is_bonus) VALUES (?, ?, ?)",
            rusqlite::params![rid, occ, is_bonus],
        )?;
    }
    let n = tx.execute(
        "DELETE FROM entries WHERE id = ? AND user_id = ?",
        rusqlite::params![id, user_id],
    )?;
    if n == 0 {
        return fail("Movimiento no encontrado");
    }
    tx.commit()?;
    Ok(())
}

pub struct EntryFilter<'a> {
    pub month: Option<&'a str>,
    pub kind: Option<EntryKind>,
    pub category_id: Option<i64>,
    pub account_id: Option<i64>,
    pub limit: Option<i64>,
}

pub fn list_entries(
    conn: &Connection,
    user_id: i64,
    f: EntryFilter<'_>,
) -> Result<Vec<Entry>, AppError> {
    if let Some(m) = f.month {
        parse_month(m)?;
    }
    let mut sql = String::from(
        "SELECT DISTINCT e.id FROM entries e
         LEFT JOIN entry_lines l ON l.entry_id = e.id
         WHERE e.user_id = ?",
    );
    if f.month.is_some() {
        sql.push_str(" AND e.date LIKE ? || '%'");
    }
    if f.kind.is_some() {
        sql.push_str(" AND e.kind = ?");
    }
    if f.category_id.is_some() {
        sql.push_str(" AND e.id IN (SELECT entry_id FROM entry_lines WHERE ledger_account_id = ?)");
    }
    if f.account_id.is_some() {
        sql.push_str(" AND l.ledger_account_id = ?");
    }
    sql.push_str(" ORDER BY e.date DESC, e.id DESC");
    if f.limit.is_some() {
        sql.push_str(" LIMIT ?");
    }
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    params.push(Box::new(user_id));
    if let Some(m) = f.month {
        params.push(Box::new(format!("{m}-")));
    }
    if let Some(k) = f.kind {
        params.push(Box::new(entry_kind_as_str(k).to_string()));
    }
    if let Some(c) = f.category_id {
        params.push(Box::new(c));
    }
    if let Some(a) = f.account_id {
        params.push(Box::new(a));
    }
    if let Some(l) = f.limit {
        params.push(Box::new(l));
    }
    let mut stmt = conn.prepare(&sql)?;
    let ids: Vec<i64> = stmt
        .query_map(
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
            |r| r.get(0),
        )?
        .collect::<rusqlite::Result<_>>()?;
    ids.into_iter()
        .map(|id| get_entry(conn, user_id, id))
        .collect()
}
