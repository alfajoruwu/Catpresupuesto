use rusqlite::{Connection, OptionalExtension, Transaction};

use crate::error::{AppError, fail};

/// Una línea de asiento: (ledger_account_id, debe, haber).
pub type RawLine = (i64, i64, i64);

pub struct NewEntry<'a> {
    pub date: &'a str,
    pub kind: &'static str,
    pub description: &'a str,
    pub recurring_id: Option<i64>,
    pub occurrence_date: Option<&'a str>,
    pub is_bonus: bool,
    pub receipt_json: Option<&'a str>,
    pub lines: &'a [RawLine],
}

fn ledgers_belong_to_user(
    tx: &Transaction<'_>,
    user_id: i64,
    lines: &[RawLine],
) -> Result<(), AppError> {
    for (ledger_id, _, _) in lines {
        let ok: Option<i64> = tx
            .query_row(
                "SELECT 1 FROM ledger_accounts WHERE id = ? AND user_id = ?",
                rusqlite::params![ledger_id, user_id],
                |_| Ok(1),
            )
            .optional()
            .map_err(AppError::from)?;
        if ok.is_none() {
            return fail("Cuenta no encontrada");
        }
    }
    Ok(())
}

fn validate_lines(lines: &[RawLine]) -> Result<(i64, i64), AppError> {
    if lines.len() < 2 {
        return fail("El asiento debe tener al menos 2 líneas");
    }
    let mut debit_sum: i64 = 0;
    let mut credit_sum: i64 = 0;
    for (_, debit, credit) in lines {
        let exactly_one = (*debit > 0) ^ (*credit > 0);
        if !exactly_one {
            return fail("Cada línea debe tener debe o haber mayor a 0");
        }
        debit_sum += debit;
        credit_sum += credit;
    }
    if debit_sum <= 0 || debit_sum != credit_sum {
        return fail("El asiento está descuadrado");
    }
    Ok((debit_sum, credit_sum))
}

/// Único punto que inserta en entries/entry_lines. Devuelve el id del asiento.
pub fn post_entry(
    tx: &Transaction<'_>,
    user_id: i64,
    e: NewEntry<'_>,
) -> Result<i64, AppError> {
    validate_lines(e.lines)?;
    ledgers_belong_to_user(tx, user_id, e.lines)?;
    tx.execute(
        "INSERT INTO entries (user_id, date, kind, description, recurring_id, occurrence_date, is_bonus, receipt_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            user_id,
            e.date,
            e.kind,
            e.description,
            e.recurring_id,
            e.occurrence_date,
            i64::from(e.is_bonus),
            e.receipt_json,
        ],
    )?;
    let entry_id = tx.last_insert_rowid();
    for (ledger_id, debit, credit) in e.lines {
        tx.execute(
            "INSERT INTO entry_lines (entry_id, ledger_account_id, debit, credit) VALUES (?, ?, ?, ?)",
            rusqlite::params![entry_id, ledger_id, debit, credit],
        )?;
    }
    Ok(entry_id)
}

/// Sustituye las líneas de un asiento ya existente.
pub fn replace_lines(
    tx: &Transaction<'_>,
    user_id: i64,
    entry_id: i64,
    lines: &[RawLine],
) -> Result<(), AppError> {
    validate_lines(lines)?;
    ledgers_belong_to_user(tx, user_id, lines)?;
    tx.execute("DELETE FROM entry_lines WHERE entry_id = ?", [entry_id])?;
    for (ledger_id, debit, credit) in lines {
        tx.execute(
            "INSERT INTO entry_lines (entry_id, ledger_account_id, debit, credit) VALUES (?, ?, ?, ?)",
            rusqlite::params![entry_id, ledger_id, debit, credit],
        )?;
    }
    Ok(())
}

/// Saldo de un activo: suma(debit) - suma(credit) en todas sus líneas.
pub fn asset_balance(conn: &Connection, ledger_id: i64) -> Result<i64, AppError> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) FROM entry_lines WHERE ledger_account_id = ?",
        [ledger_id],
        |r| r.get(0),
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{memory_db, seed_user};

    fn setup() -> (Connection, i64, i64, i64) {
        let conn = memory_db().unwrap();
        let uid = seed_user(&conn, "test");
        conn.execute(
            "INSERT INTO ledger_accounts (user_id, name, type) VALUES (?, 'Caja', 'asset')",
            [uid],
        )
        .unwrap();
        let asset: i64 = conn.last_insert_rowid();
        let equity: i64 = conn
            .query_row(
                "SELECT id FROM ledger_accounts WHERE user_id = ? AND type = 'equity'",
                [uid],
                |r| r.get(0),
            )
            .unwrap();
        (conn, uid, asset, equity)
    }

    #[test]
    fn post_entry_rechaza_asientos_invalidos() {
        let mut conn = setup().0;
        let (uid, asset, equity) = {
            let c = &conn;
            let a: i64 = c
                .query_row("SELECT id FROM ledger_accounts WHERE name = 'Caja'", [], |r| {
                    r.get(0)
                })
                .unwrap();
            let e: i64 = c
                .query_row(
                    "SELECT id FROM ledger_accounts WHERE type = 'equity'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            let u: i64 = c
                .query_row("SELECT id FROM users LIMIT 1", [], |r| r.get(0))
                .unwrap();
            (u, a, e)
        };
        let tx = conn.transaction().unwrap();
        // Una sola línea.
        assert!(post_entry(
            &tx,
            uid,
            NewEntry {
                date: "2026-01-01",
                kind: "opening",
                description: "",
                recurring_id: None,
                occurrence_date: None,
                is_bonus: false,
                receipt_json: None,
                lines: &[(asset, 100, 0)],
            }
        )
        .is_err());
        // Descuadrado.
        assert!(post_entry(
            &tx,
            uid,
            NewEntry {
                date: "2026-01-01",
                kind: "opening",
                description: "",
                recurring_id: None,
                occurrence_date: None,
                is_bonus: false,
                receipt_json: None,
                lines: &[(asset, 100, 0), (equity, 0, 50)],
            }
        )
        .is_err());
        // Importe 0.
        assert!(post_entry(
            &tx,
            uid,
            NewEntry {
                date: "2026-01-01",
                kind: "opening",
                description: "",
                recurring_id: None,
                occurrence_date: None,
                is_bonus: false,
                receipt_json: None,
                lines: &[(asset, 0, 0), (equity, 0, 0)],
            }
        )
        .is_err());
    }

    #[test]
    fn saldo_inicial_y_credito_en_patrimonio() {
        let mut conn = memory_db().unwrap();
        let uid = seed_user(&conn, "test");
        let tx = conn.transaction().unwrap();
        tx.execute(
            "INSERT INTO ledger_accounts (user_id, name, type) VALUES (?, 'Caja', 'asset')",
            [uid],
        )
        .unwrap();
        let asset: i64 = tx.last_insert_rowid();
        let equity: i64 = tx
            .query_row(
                "SELECT id FROM ledger_accounts WHERE user_id = ? AND type = 'equity'",
                [uid],
                |r| r.get(0),
            )
            .unwrap();
        post_entry(
            &tx,
            uid,
            NewEntry {
                date: "2026-01-01",
                kind: "opening",
                description: "Saldo inicial",
                recurring_id: None,
                occurrence_date: None,
                is_bonus: false,
                receipt_json: None,
                lines: &[(asset, 1_000_000, 0), (equity, 0, 1_000_000)],
            },
        )
        .unwrap();
        tx.commit().unwrap();
        assert_eq!(asset_balance(&conn, asset).unwrap(), 1_000_000);
        let eq: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(credit),0) - COALESCE(SUM(debit),0) FROM entry_lines WHERE ledger_account_id = ?",
                [equity],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(eq, 1_000_000);
    }
}
