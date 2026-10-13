use chrono::{Datelike, NaiveDate};
use rusqlite::{Connection, OptionalExtension};

use crate::accounts::require_active_account;
use crate::categories::require_active_category;
#[cfg(test)]
use crate::entries::get_entry;
use crate::error::{AppError, fail};
use crate::ledger::{NewEntry, post_entry};
use crate::models::{CategoryKind, RecurringRule, clean_name, parse_date};
#[cfg(test)]
use crate::models::Entry;

pub struct RuleInput<'a> {
    pub kind: CategoryKind,
    pub name: &'a str,
    pub amount: i64,
    pub category_id: i64,
    pub account_id: i64,
    pub interval_months: i64,
    pub day_of_month: i64,
    pub start_date: &'a str,
    pub end_date: Option<&'a str>,
    pub bonus_every_months: Option<i64>,
    pub bonus_percent: Option<f64>,
}

struct RuleRow {
    id: i64,
    kind: CategoryKind,
    name: String,
    amount: i64,
    category_id: i64,
    account_id: i64,
    interval_months: i64,
    day_of_month: i64,
    start_date: String,
    end_date: Option<String>,
    bonus_every_months: Option<i64>,
    bonus_percent: Option<f64>,
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let (ny, nm) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    NaiveDate::from_ymd_opt(ny, nm, 1)
        .unwrap()
        .pred_opt()
        .unwrap()
        .day()
}

/// Meses entre el mes de inicio y el de la ocurrencia (0-based).
/// Ocurrencias normales: mes inicio + k*intervalo, día recortado al mes.
pub fn occurrences(
    start: NaiveDate,
    interval_months: i64,
    day_of_month: u32,
    end_limit: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
) -> Vec<(NaiveDate, i64)> {
    let mut out = Vec::new();
    let mut k: i64 = 0;
    loop {
        let shift = k * interval_months;
        let total = (start.month0() as i64) + shift;
        let year = start.year() + (total.div_euclid(12)) as i32;
        let month = (total.rem_euclid(12) + 1) as u32;
        let day = day_of_month.min(days_in_month(year, month));
        let d = NaiveDate::from_ymd_opt(year, month, day).unwrap();
        if d < start {
            k += 1;
            continue;
        }
        if let Some(lim) = end_limit {
            if d > lim {
                break;
            }
        }
        if let Some(end) = end_date {
            if d > end {
                break;
            }
        }
        let m = (year - start.year()) * 12 + (month as i32 - start.month() as i32);
        out.push((d, m as i64));
        k += 1;
        if k > 1200 {
            break;
        }
    }
    out
}

fn validate_rule(conn: &Connection, user_id: i64, r: &RuleInput<'_>) -> Result<(), AppError> {
    let name = clean_name(r.name)?;
    if name.is_empty() {
        return fail("El nombre es obligatorio");
    }
    crate::models::check_amount(r.amount)?;
    if !(1..=60).contains(&r.interval_months) {
        return fail("El intervalo debe estar entre 1 y 60 meses");
    }
    if !(1..=31).contains(&r.day_of_month) {
        return fail("El día del mes debe estar entre 1 y 31");
    }
    let start = parse_date(r.start_date)?;
    if let Some(e) = r.end_date {
        let end = parse_date(e)?;
        if end < start {
            return fail("La fecha de término debe ser posterior al inicio");
        }
    }
    require_active_category(
        conn,
        user_id,
        r.category_id,
        if r.kind == CategoryKind::Income {
            CategoryKind::Income
        } else {
            CategoryKind::Expense
        },
    )?;
    require_active_account(conn, user_id, r.account_id)?;
    match (r.bonus_every_months, r.bonus_percent) {
        (None, None) => Ok(()),
        (Some(n), Some(p)) => {
            if r.kind != CategoryKind::Income {
                return fail("La bonificación solo aplica a ingresos");
            }
            if n < 1 || p <= 0.0 {
                return fail("Completa cada cuántos meses y el porcentaje");
            }
            Ok(())
        }
        _ => {
            if r.kind != CategoryKind::Income {
                return fail("La bonificación solo aplica a ingresos");
            }
            fail("Completa cada cuántos meses y el porcentaje")
        }
    }
}

/// Monto bonus redondeado: round(amount * p / 100).
pub fn bonus_amount(amount: i64, percent: f64) -> i64 {
    (amount as f64 * percent / 100.0).round() as i64
}

fn read_rule(conn: &Connection, user_id: i64, id: i64) -> Result<RuleRow, AppError> {
    conn.query_row(
        "SELECT id, kind, name, amount, category_id, account_id, interval_months, day_of_month,
                start_date, end_date, bonus_every_months, bonus_percent
         FROM recurring_rules WHERE id = ? AND user_id = ?",
        rusqlite::params![id, user_id],
        |r| {
            let k: String = r.get(1)?;
            Ok(RuleRow {
                id: r.get(0)?,
                kind: if k == "income" {
                    CategoryKind::Income
                } else {
                    CategoryKind::Expense
                },
                name: r.get(2)?,
                amount: r.get(3)?,
                category_id: r.get(4)?,
                account_id: r.get(5)?,
                interval_months: r.get(6)?,
                day_of_month: r.get(7)?,
                start_date: r.get(8)?,
                end_date: r.get(9)?,
                bonus_every_months: r.get(10)?,
                bonus_percent: r.get(11)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError("Regla no encontrada".to_string()))
}

fn rule_view(conn: &Connection, row: &RuleRow, today: &str) -> Result<RecurringRule, AppError> {
    let today_d = parse_date(today)?;
    let start = parse_date(&row.start_date)?;
    let end = row.end_date.as_deref().map(parse_date).transpose()?;
    let occ = occurrences(start, row.interval_months, row.day_of_month as u32, None, end);
    let next_date = occ
        .iter()
        .map(|(d, _)| *d)
        .find(|d| *d > today_d)
        .map(|d| d.format("%Y-%m-%d").to_string());
    let category_name: String = conn
        .query_row(
            "SELECT name FROM ledger_accounts WHERE id = ?",
            [row.category_id],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "?".to_string());
    let account_name: String = conn
        .query_row(
            "SELECT name FROM ledger_accounts WHERE id = ?",
            [row.account_id],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "?".to_string());
    Ok(RecurringRule {
        id: row.id,
        kind: row.kind,
        name: row.name.clone(),
        amount: row.amount,
        category_id: row.category_id,
        category_name,
        account_id: row.account_id,
        account_name,
        interval_months: row.interval_months,
        day_of_month: row.day_of_month,
        start_date: row.start_date.clone(),
        end_date: row.end_date.clone(),
        bonus_every_months: row.bonus_every_months,
        bonus_percent: row.bonus_percent,
        next_date,
    })
}

pub fn list_recurring(
    conn: &Connection,
    user_id: i64,
    kind: Option<CategoryKind>,
    today: &str,
) -> Result<Vec<RecurringRule>, AppError> {
    parse_date(today)?;
    let filter = kind.map(|k| match k {
        CategoryKind::Income => "income",
        CategoryKind::Expense => "expense",
    });
    let mut stmt = conn.prepare(
        "SELECT id FROM recurring_rules WHERE user_id = ? AND (? IS NULL OR kind = ?) ORDER BY name COLLATE NOCASE",
    )?;
    let ids: Vec<i64> = stmt
        .query_map(rusqlite::params![user_id, filter], |r| r.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    ids.into_iter()
        .map(|id| rule_view(conn, &read_rule(conn, user_id, id)?, today))
        .collect()
}

/// Inserta los asientos pendientes de una regla hasta `today` (dentro de tx abierta).
/// Devuelve cuántos asientos creó.
fn post_due_rule_tx(
    tx: &rusqlite::Transaction<'_>,
    user_id: i64,
    row: &RuleRow,
    today: NaiveDate,
) -> Result<i64, AppError> {
    let start = parse_date(&row.start_date)?;
    let end = row.end_date.as_deref().map(parse_date).transpose()?;
    let occ = occurrences(start, row.interval_months, row.day_of_month as u32, Some(today), end);
    let mut created = 0;
    for (date, m) in occ {
        let ds = date.format("%Y-%m-%d").to_string();
        created += post_one_tx(tx, user_id, row, &ds, false, row.amount, &row.name)?;
        // Bonus: (m + 1) % n == 0.
        if let (Some(n), Some(p)) = (row.bonus_every_months, row.bonus_percent) {
            if row.kind == CategoryKind::Income && (m + 1) % n == 0 {
                let b = bonus_amount(row.amount, p);
                if b > 0 {
                    let desc = format!("Bonificación · {}", row.name);
                    created += post_one_tx(tx, user_id, row, &ds, true, b, &desc)?;
                }
            }
        }
    }
    Ok(created)
}

#[allow(clippy::too_many_arguments)]
fn post_one_tx(
    tx: &rusqlite::Transaction<'_>,
    user_id: i64,
    row: &RuleRow,
    date: &str,
    is_bonus: bool,
    amount: i64,
    description: &str,
) -> Result<i64, AppError> {
    let exists: Option<i64> = tx
        .query_row(
            "SELECT 1 FROM entries WHERE recurring_id = ? AND occurrence_date = ? AND is_bonus = ?",
            rusqlite::params![row.id, date, i64::from(is_bonus)],
            |_| Ok(1),
        )
        .optional()
        .map_err(AppError::from)?;
    if exists.is_some() {
        return Ok(0);
    }
    let skipped: Option<i64> = tx
        .query_row(
            "SELECT 1 FROM recurring_skips WHERE recurring_id = ? AND occurrence_date = ? AND is_bonus = ?",
            rusqlite::params![row.id, date, i64::from(is_bonus)],
            |_| Ok(1),
        )
        .optional()
        .map_err(AppError::from)?;
    if skipped.is_some() {
        return Ok(0);
    }
    let (kind_s, lines) = match row.kind {
        CategoryKind::Income => (
            "income",
            vec![(row.account_id, amount, 0), (row.category_id, 0, amount)],
        ),
        CategoryKind::Expense => (
            "expense",
            vec![(row.category_id, amount, 0), (row.account_id, 0, amount)],
        ),
    };
    post_entry(
        tx,
        user_id,
        NewEntry {
            date,
            kind: kind_s,
            description,
            recurring_id: Some(row.id),
            occurrence_date: Some(date),
            is_bonus,
            receipt_json: None,
            lines: &lines,
        },
    )?;
    Ok(1)
}

/// Genera todos los asientos vencidos (<= today) de todas las reglas. Idempotente.
pub fn post_due_recurring(
    conn: &mut Connection,
    user_id: i64,
    today: &str,
) -> Result<i64, AppError> {
    let today_d = parse_date(today)?;
    let tx = conn.transaction()?;
    let ids: Vec<i64> = {
        let mut stmt = tx.prepare("SELECT id FROM recurring_rules WHERE user_id = ?")?;
        let ids: Vec<i64> = stmt
            .query_map([user_id], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()
            .map_err(AppError::from)?;
        ids
    };
    let mut total = 0;
    for id in ids {
        // Lee la regla dentro de la tx.
        let row: RuleRow = tx
            .query_row(
                "SELECT id, kind, name, amount, category_id, account_id, interval_months, day_of_month,
                        start_date, end_date, bonus_every_months, bonus_percent
                 FROM recurring_rules WHERE id = ?",
                [id],
                |r| {
                    let k: String = r.get(1)?;
                    Ok(RuleRow {
                        id: r.get(0)?,
                        kind: if k == "income" {
                            CategoryKind::Income
                        } else {
                            CategoryKind::Expense
                        },
                        name: r.get(2)?,
                        amount: r.get(3)?,
                        category_id: r.get(4)?,
                        account_id: r.get(5)?,
                        interval_months: r.get(6)?,
                        day_of_month: r.get(7)?,
                        start_date: r.get(8)?,
                        end_date: r.get(9)?,
                        bonus_every_months: r.get(10)?,
                        bonus_percent: r.get(11)?,
                    })
                },
            )
            .map_err(AppError::from)?;
        total += post_due_rule_tx(&tx, user_id, &row, today_d)?;
    }
    tx.commit()?;
    Ok(total)
}

pub fn create_recurring(
    conn: &mut Connection,
    user_id: i64,
    r: RuleInput<'_>,
    today: &str,
) -> Result<RecurringRule, AppError> {
    parse_date(today)?;
    validate_rule(conn, user_id, &r)?;
    let name = clean_name(r.name)?;
    let kind_s = match r.kind {
        CategoryKind::Income => "income",
        CategoryKind::Expense => "expense",
    };
    conn.execute(
        "INSERT INTO recurring_rules (user_id, kind, name, amount, category_id, account_id, interval_months, day_of_month, start_date, end_date, bonus_every_months, bonus_percent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            user_id, kind_s, name, r.amount, r.category_id, r.account_id,
            r.interval_months, r.day_of_month, r.start_date, r.end_date,
            r.bonus_every_months, r.bonus_percent,
        ],
    )?;
    let id = conn.last_insert_rowid();
    post_due_recurring(conn, user_id, today)?;
    rule_view(conn, &read_rule(conn, user_id, id)?, today)
}

pub fn update_recurring(
    conn: &mut Connection,
    user_id: i64,
    id: i64,
    r: RuleInput<'_>,
    today: &str,
) -> Result<RecurringRule, AppError> {
    parse_date(today)?;
    // La regla debe existir y ser del usuario.
    read_rule(conn, user_id, id)?;
    validate_rule(conn, user_id, &r)?;
    let name = clean_name(r.name)?;
    let kind_s = match r.kind {
        CategoryKind::Income => "income",
        CategoryKind::Expense => "expense",
    };
    conn.execute(
        "UPDATE recurring_rules SET kind = ?, name = ?, amount = ?, category_id = ?, account_id = ?,
                interval_months = ?, day_of_month = ?, start_date = ?, end_date = ?,
                bonus_every_months = ?, bonus_percent = ? WHERE id = ? AND user_id = ?",
        rusqlite::params![
            kind_s, name, r.amount, r.category_id, r.account_id,
            r.interval_months, r.day_of_month, r.start_date, r.end_date,
            r.bonus_every_months, r.bonus_percent, id, user_id,
        ],
    )?;
    post_due_recurring(conn, user_id, today)?;
    rule_view(conn, &read_rule(conn, user_id, id)?, today)
}

pub fn delete_recurring(conn: &Connection, user_id: i64, id: i64) -> Result<(), AppError> {
    let n = conn.execute(
        "DELETE FROM recurring_rules WHERE id = ? AND user_id = ?",
        rusqlite::params![id, user_id],
    )?;
    if n == 0 {
        return fail("Regla no encontrada");
    }
    Ok(())
}

/// Ocurrencias pendientes dentro del mes (fecha > today, no generadas ni omitidas).
/// Devuelve (fecha, kind, amount, is_bonus).
pub fn pending_in_month(
    conn: &Connection,
    user_id: i64,
    month: &str,
    today: &str,
) -> Result<Vec<(String, CategoryKind, i64)>, AppError> {
    let today_d = parse_date(today)?;
    let (y, m) = crate::models::parse_month(month)?;
    let first = NaiveDate::from_ymd_opt(y, m, 1).unwrap();
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    let last = NaiveDate::from_ymd_opt(ny, nm, 1).unwrap().pred_opt().unwrap();
    let ids: Vec<i64> = conn
        .prepare("SELECT id FROM recurring_rules WHERE user_id = ?")?
        .query_map([user_id], |r| r.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    let mut out = Vec::new();
    for id in ids {
        let row = read_rule(conn, user_id, id)?;
        let start = parse_date(&row.start_date)?;
        let end = row.end_date.as_deref().map(parse_date).transpose()?;
        for (d, mm) in occurrences(start, row.interval_months, row.day_of_month as u32, Some(last), end) {
            let ds = d.format("%Y-%m-%d").to_string();
            if d < first || d <= today_d {
                continue;
            }
            if generated_or_skipped(conn, row.id, &ds, false)? {
                continue;
            }
            out.push((ds.clone(), row.kind, row.amount));
            if let (Some(n), Some(p)) = (row.bonus_every_months, row.bonus_percent) {
                if row.kind == CategoryKind::Income && (mm + 1) % n == 0 {
                    let b = bonus_amount(row.amount, p);
                    if b > 0 && !generated_or_skipped(conn, row.id, &ds, true)? {
                        out.push((ds, row.kind, b));
                    }
                }
            }
        }
    }
    Ok(out)
}

fn generated_or_skipped(conn: &Connection, rule_id: i64, date: &str, is_bonus: bool) -> Result<bool, AppError> {
    let b = i64::from(is_bonus);
    let gen: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM entries WHERE recurring_id = ? AND occurrence_date = ? AND is_bonus = ?",
            rusqlite::params![rule_id, date, b],
            |_| Ok(1),
        )
        .optional()?;
    if gen.is_some() {
        return Ok(true);
    }
    let sk: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM recurring_skips WHERE recurring_id = ? AND occurrence_date = ? AND is_bonus = ?",
            rusqlite::params![rule_id, date, b],
            |_| Ok(1),
        )
        .optional()?;
    Ok(sk.is_some())
}

/// Detalle de un asiento generado por regla (para tests).
#[cfg(test)]
pub fn entry_of(conn: &Connection, rule_id: i64, date: &str, is_bonus: bool) -> Option<Entry> {
    let id: Option<i64> = conn
        .query_row(
            "SELECT id FROM entries WHERE recurring_id = ? AND occurrence_date = ? AND is_bonus = ?",
            rusqlite::params![rule_id, date, i64::from(is_bonus)],
            |r| r.get(0),
        )
        .optional()
        .unwrap();
    id.map(|i| {
        let uid: i64 = conn
            .query_row("SELECT user_id FROM entries WHERE id = ?", [i], |r| r.get(0))
            .unwrap();
        get_entry(conn, uid, i).unwrap()
    })
}
