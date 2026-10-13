use std::fmt;

/// Error de aplicación con mensaje en español para el frontend.
#[derive(Debug)]
pub struct AppError(pub String);

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError(format!("Error de base de datos: {e}"))
    }
}

pub fn fail<T>(msg: &str) -> Result<T, AppError> {
    Err(AppError(msg.to_string()))
}

/// `true` si el error es una violación de restricción UNIQUE.
pub fn is_unique_violation(e: &rusqlite::Error) -> bool {
    matches!(
        e,
        rusqlite::Error::SqliteFailure(err, _)
            if err.code == rusqlite::ErrorCode::ConstraintViolation
    )
}
