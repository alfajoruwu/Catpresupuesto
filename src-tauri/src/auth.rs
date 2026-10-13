use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand_core::OsRng;
use rusqlite::{Connection, OptionalExtension};

use crate::error::{AppError, fail, is_unique_violation};
use crate::models::{AuthStatus, User};

fn row_to_user(row: &rusqlite::Row<'_>) -> rusqlite::Result<User> {
    Ok(User {
        id: row.get(0)?,
        username: row.get(1)?,
        onboarding_done: row.get::<_, i64>(2)? != 0,
    })
}

/// Nombre de usuario recortado, 3 a 32 caracteres.
pub fn clean_username(s: &str) -> Result<String, AppError> {
    let t = s.trim();
    let n = t.chars().count();
    if !(3..=32).contains(&n) {
        return fail("El nombre de usuario debe tener entre 3 y 32 caracteres");
    }
    Ok(t.to_string())
}

fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| AppError("No se pudo registrar el usuario".to_string()))
}

fn verify_password(hash: &str, password: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// Registra un usuario, crea su 'Patrimonio inicial' y devuelve su fila.
pub fn register(conn: &Connection, username: &str, password: &str) -> Result<User, AppError> {
    let username = clean_username(username)?;
    if password.len() < 4 {
        return fail("La contraseña debe tener al menos 4 caracteres");
    }
    let hash = hash_password(password)?;
    let mut user: Option<User> = None;
    let r = (|| -> rusqlite::Result<()> {
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            rusqlite::params![username, hash],
        )?;
        let id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO ledger_accounts (user_id, name, type, is_system) VALUES (?, 'Patrimonio inicial', 'equity', 1)",
            [id],
        )?;
        user = Some(
            conn.query_row(
                "SELECT id, username, onboarding_done FROM users WHERE id = ?",
                [id],
                row_to_user,
            )?,
        );
        Ok(())
    })();
    match r {
        Ok(()) => Ok(user.expect("usuario recién insertado")),
        Err(e) if is_unique_violation(&e) => fail("Ese usuario ya existe"),
        Err(e) => Err(AppError::from(e)),
    }
}

pub fn login(conn: &Connection, username: &str, password: &str) -> Result<User, AppError> {
    let username = username.trim();
    let row: Option<(i64, String, String, i64)> = conn
        .query_row(
            "SELECT id, username, password_hash, onboarding_done FROM users WHERE username = ?",
            [username],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()?;
    match row {
        Some((id, name, hash, done)) if verify_password(&hash, password) => Ok(User {
            id,
            username: name,
            onboarding_done: done != 0,
        }),
        _ => fail("Usuario o contraseña incorrectos"),
    }
}

pub fn auth_status(conn: &Connection, session_user_id: Option<i64>) -> Result<AuthStatus, AppError> {
    let has_users: i64 =
        conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
    let user = match session_user_id {
        Some(id) => conn
            .query_row(
                "SELECT id, username, onboarding_done FROM users WHERE id = ?",
                [id],
                row_to_user,
            )
            .optional()?,
        None => None,
    };
    Ok(AuthStatus {
        has_users: has_users > 0,
        user,
    })
}

pub fn set_onboarding_done(
    conn: &Connection,
    user_id: i64,
    done: bool,
) -> Result<User, AppError> {
    conn.execute(
        "UPDATE users SET onboarding_done = ? WHERE id = ?",
        rusqlite::params![i64::from(done), user_id],
    )?;
    let user = conn.query_row(
        "SELECT id, username, onboarding_done FROM users WHERE id = ?",
        [user_id],
        row_to_user,
    )?;
    Ok(user)
}

/// Borra movimientos, reglas, presupuestos y cuentas no sistémicas del usuario.
pub fn reset_user_data(conn: &mut Connection, user_id: i64) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM entries WHERE user_id = ?", [user_id])?;
    tx.execute("DELETE FROM recurring_rules WHERE user_id = ?", [user_id])?;
    tx.execute("DELETE FROM budgets WHERE user_id = ?", [user_id])?;
    tx.execute(
        "DELETE FROM ledger_accounts WHERE user_id = ? AND is_system = 0",
        [user_id],
    )?;
    tx.commit()?;
    Ok(())
}

/// Id del ledger sistémico 'Patrimonio inicial' del usuario.
pub fn equity_account(conn: &Connection, user_id: i64) -> Result<i64, AppError> {
    conn.query_row(
        "SELECT id FROM ledger_accounts WHERE user_id = ? AND type = 'equity' AND is_system = 1",
        [user_id],
        |r| r.get(0),
    )
    .map_err(|_| AppError("No se encontró el patrimonio inicial".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::memory_db;

    #[test]
    fn login_falla_y_username_es_unico_sin_mayusculas() {
        let conn = memory_db().unwrap();
        register(&conn, "Juan", "clave1234").unwrap();
        assert!(login(&conn, "juan", "otra").is_err());
        assert!(login(&conn, "JUAN", "clave1234").is_ok());
        let dup = register(&conn, "JUAN", "clave1234");
        assert_eq!(dup.unwrap_err().0, "Ese usuario ya existe");
    }

    #[test]
    fn reset_deja_solo_patrimonio_inicial() {
        let mut conn = memory_db().unwrap();
        let uid = register(&conn, "ana", "clave1234").unwrap().id;
        conn.execute(
            "INSERT INTO ledger_accounts (user_id, name, type) VALUES (?, 'Sueldo', 'income')",
            [uid],
        )
        .unwrap();
        reset_user_data(&mut conn, uid).unwrap();
        let names: Vec<String> = conn
            .prepare("SELECT name FROM ledger_accounts WHERE user_id = ?")
            .unwrap()
            .query_map([uid], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(names, vec!["Patrimonio inicial".to_string()]);
    }
}
