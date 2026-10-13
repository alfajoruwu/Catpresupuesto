use rusqlite::{Connection, OptionalExtension};

use crate::error::{AppError, fail};
use crate::ledger::{NewEntry, asset_balance, post_entry};
use crate::models::{
    Account, AccountKind, Entry, account_kind_as_str, clean_name, parse_account_kind, parse_date,
};

pub fn list_accounts(
    conn: &Connection,
    user_id: i64,
    include_archived: bool,
) -> Result<Vec<Account>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, COALESCE(subtype, 'corriente'), archived
         FROM ledger_accounts
         WHERE user_id = ? AND type = 'asset' AND (? = 1 OR archived = 0)
         ORDER BY name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map(
        rusqlite::params![user_id, include_archived as i64],
        |r| {
            let subtype: String = r.get(2)?;
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                subtype,
                r.get::<_, i64>(3)?,
            ))
        },
    )?;
    let mut out = Vec::new();
    for row in rows {
        let (id, name, subtype, archived) = row?;
        let kind = parse_account_kind(&subtype).unwrap_or(AccountKind::Corriente);
        out.push(Account {
            id,
            name,
            kind,
            balance: asset_balance(conn, id)?,
            archived: archived != 0,
        });
    }
    Ok(out)
}

pub fn get_account(conn: &Connection, user_id: i64, id: i64) -> Result<Account, AppError> {
    let row: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT name, COALESCE(subtype, 'corriente'), archived FROM ledger_accounts WHERE id = ? AND user_id = ? AND type = 'asset'",
            rusqlite::params![id, user_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    match row {
        Some((name, subtype, archived)) => Ok(Account {
            id,
            name,
            kind: parse_account_kind(&subtype).unwrap_or(AccountKind::Corriente),
            balance: asset_balance(conn, id)?,
            archived: archived != 0,
        }),
        None => fail("Cuenta no encontrada"),
    }
}

/// Activo del usuario y no archivado (para movimientos nuevos).
pub fn require_active_account(
    conn: &Connection,
    user_id: i64,
    account_id: i64,
) -> Result<(), AppError> {
    let ok: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM ledger_accounts WHERE id = ? AND user_id = ? AND type = 'asset' AND archived = 0",
            rusqlite::params![account_id, user_id],
            |_| Ok(1),
        )
        .optional()?;
    if ok.is_none() {
        return fail("Cuenta no encontrada");
    }
    Ok(())
}

pub fn create_account(
    conn: &mut Connection,
    user_id: i64,
    name: &str,
    kind: AccountKind,
    opening_balance: i64,
    date: &str,
) -> Result<Account, AppError> {
    let name = clean_name(name)?;
    parse_date(date)?;
    if opening_balance < 0 {
        return fail("El monto debe ser mayor a 0");
    }
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO ledger_accounts (user_id, name, type, subtype) VALUES (?, ?, 'asset', ?)",
        rusqlite::params![user_id, name, account_kind_as_str(kind)],
    )
    .map_err(|e| {
        if crate::error::is_unique_violation(&e) {
            AppError("Ya existe una cuenta con ese nombre".to_string())
        } else {
            AppError::from(e)
        }
    })?;
    let account_id = tx.last_insert_rowid();
    if opening_balance > 0 {
        let equity = equity_account_tx(&tx, user_id)?;
        post_entry(
            &tx,
            user_id,
            NewEntry {
                date,
                kind: "opening",
                description: "Saldo inicial",
                recurring_id: None,
                occurrence_date: None,
                is_bonus: false,
                receipt_json: None,
                lines: &[(account_id, opening_balance, 0), (equity, 0, opening_balance)],
            },
        )?;
    }
    tx.commit()?;
    get_account(conn, user_id, account_id)
}

fn equity_account_tx(
    tx: &rusqlite::Transaction<'_>,
    user_id: i64,
) -> Result<i64, AppError> {
    tx.query_row(
        "SELECT id FROM ledger_accounts WHERE user_id = ? AND type = 'equity' AND is_system = 1",
        [user_id],
        |r| r.get(0),
    )
    .map_err(|_| AppError("No se encontró el patrimonio inicial".to_string()))
}

pub fn update_account(
    conn: &Connection,
    user_id: i64,
    id: i64,
    name: &str,
    kind: AccountKind,
) -> Result<Account, AppError> {
    let name = clean_name(name)?;
    // Debe existir y ser del usuario (aunque esté archivada se permite renombrar).
    let exists: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM ledger_accounts WHERE id = ? AND user_id = ? AND type = 'asset'",
            rusqlite::params![id, user_id],
            |_| Ok(1),
        )
        .optional()?;
    if exists.is_none() {
        return fail("Cuenta no encontrada");
    }
    let r = conn.execute(
        "UPDATE ledger_accounts SET name = ?, subtype = ? WHERE id = ?",
        rusqlite::params![name, account_kind_as_str(kind), id],
    );
    match r {
        Ok(_) => get_account(conn, user_id, id),
        Err(e) if crate::error::is_unique_violation(&e) => {
            fail("Ya existe una cuenta con ese nombre")
        }
        Err(e) => Err(AppError::from(e)),
    }
}

pub fn archive_account(conn: &Connection, user_id: i64, id: i64) -> Result<(), AppError> {
    let acc = get_account(conn, user_id, id)?;
    if acc.balance != 0 {
        return fail("La cuenta tiene saldo. Transfiere o ajusta el saldo a 0 antes de archivarla.");
    }
    conn.execute(
        "UPDATE ledger_accounts SET archived = 1 WHERE id = ?",
        [id],
    )?;
    Ok(())
}

/// Ajusta el saldo al valor pedido. Sin diferencia devuelve `Ok(None)`.
pub fn adjust_account_balance(
    conn: &mut Connection,
    user_id: i64,
    id: i64,
    new_balance: i64,
    date: &str,
) -> Result<Option<Entry>, AppError> {
    parse_date(date)?;
    let acc = get_account(conn, user_id, id)?;
    if acc.archived {
        return fail("Cuenta no encontrada");
    }
    let d = new_balance - acc.balance;
    if d == 0 {
        return Ok(None);
    }
    let tx = conn.transaction()?;
    let equity = equity_account_tx(&tx, user_id)?;
    let lines: [(i64, i64, i64); 2] = if d > 0 {
        [(id, d, 0), (equity, 0, d)]
    } else {
        let m = -d;
        [(equity, m, 0), (id, 0, m)]
    };
    let entry_id = post_entry(
        &tx,
        user_id,
        NewEntry {
            date,
            kind: "adjustment",
            description: "Ajuste de saldo",
            recurring_id: None,
            occurrence_date: None,
            is_bonus: false,
            receipt_json: None,
            lines: &lines,
        },
    )?;
    tx.commit()?;
    Ok(Some(crate::entries::get_entry(conn, user_id, entry_id)?))
}

