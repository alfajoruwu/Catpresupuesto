use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, fail};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CategoryKind {
    Income,
    Expense,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountKind {
    Corriente,
    Vista,
    Ahorro,
    DepositoPlazo,
    Efectivo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Opening,
    Income,
    Expense,
    Transfer,
    Adjustment,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LedgerType {
    Asset,
    Income,
    Expense,
    Equity,
}

impl CategoryKind {
    pub fn ledger_type(self) -> &'static str {
        match self {
            CategoryKind::Income => "income",
            CategoryKind::Expense => "expense",
        }
    }
}

pub fn parse_account_kind(s: &str) -> Option<AccountKind> {
    match s {
        "corriente" => Some(AccountKind::Corriente),
        "vista" => Some(AccountKind::Vista),
        "ahorro" => Some(AccountKind::Ahorro),
        "deposito_plazo" => Some(AccountKind::DepositoPlazo),
        "efectivo" => Some(AccountKind::Efectivo),
        _ => None,
    }
}

pub fn account_kind_as_str(k: AccountKind) -> &'static str {
    match k {
        AccountKind::Corriente => "corriente",
        AccountKind::Vista => "vista",
        AccountKind::Ahorro => "ahorro",
        AccountKind::DepositoPlazo => "deposito_plazo",
        AccountKind::Efectivo => "efectivo",
    }
}

pub fn parse_entry_kind(s: &str) -> Option<EntryKind> {
    match s {
        "opening" => Some(EntryKind::Opening),
        "income" => Some(EntryKind::Income),
        "expense" => Some(EntryKind::Expense),
        "transfer" => Some(EntryKind::Transfer),
        "adjustment" => Some(EntryKind::Adjustment),
        _ => None,
    }
}

pub fn entry_kind_as_str(k: EntryKind) -> &'static str {
    match k {
        EntryKind::Opening => "opening",
        EntryKind::Income => "income",
        EntryKind::Expense => "expense",
        EntryKind::Transfer => "transfer",
        EntryKind::Adjustment => "adjustment",
    }
}

// ---------- Salida ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i64,
    pub username: String,
    pub onboarding_done: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub has_users: bool,
    pub user: Option<User>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub kind: CategoryKind,
    pub color: String,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub name: String,
    pub kind: AccountKind,
    pub balance: i64,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptMeta {
    pub merchant: Option<String>,
    pub tax_id: Option<String>,
    pub doc_type: Option<String>,
    pub folio: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryLine {
    pub ledger_account_id: i64,
    pub ledger_account_name: String,
    pub ledger_account_type: LedgerType,
    pub debit: i64,
    pub credit: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: i64,
    pub date: String,
    pub kind: EntryKind,
    pub description: String,
    pub amount: i64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub account_id: Option<i64>,
    pub account_name: Option<String>,
    pub to_account_id: Option<i64>,
    pub to_account_name: Option<String>,
    pub recurring_id: Option<i64>,
    pub is_bonus: bool,
    pub receipt: Option<ReceiptMeta>,
    pub lines: Vec<EntryLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringRule {
    pub id: i64,
    pub kind: CategoryKind,
    pub name: String,
    pub amount: i64,
    pub category_id: i64,
    pub category_name: String,
    pub account_id: i64,
    pub account_name: String,
    pub interval_months: i64,
    pub day_of_month: i64,
    pub start_date: String,
    pub end_date: Option<String>,
    pub bonus_every_months: Option<i64>,
    pub bonus_percent: Option<f64>,
    pub next_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetLine {
    pub category_id: i64,
    pub category_name: String,
    pub color: String,
    pub account_id: Option<i64>,
    pub account_name: Option<String>,
    pub amount: i64,
    pub spent: i64,
    pub remaining: i64,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetMonth {
    pub month: String,
    pub lines: Vec<BudgetLine>,
    pub total_budget: i64,
    pub total_spent: i64,
    pub unbudgeted_spent: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthSummary {
    pub month: String,
    pub income_actual: i64,
    pub income_projected: i64,
    pub expense_actual: i64,
    pub expense_projected: i64,
    pub budget_total: i64,
    pub budget_spent: i64,
    pub unbudgeted_spent: i64,
    pub total_balance: i64,
}

// ---------- Entrada ----------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetOnboardingDoneInput {
    pub done: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesInput {
    #[serde(default)]
    pub kind: Option<CategoryKind>,
    #[serde(default)]
    pub include_archived: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryInput {
    pub name: String,
    pub kind: CategoryKind,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryInput {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveCategoryInput {
    pub id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAccountsInput {
    #[serde(default)]
    pub include_archived: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountInput {
    pub name: String,
    pub kind: AccountKind,
    #[serde(default)]
    pub opening_balance: i64,
    pub date: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountInput {
    pub id: i64,
    pub name: String,
    pub kind: AccountKind,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveAccountInput {
    pub id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustAccountBalanceInput {
    pub id: i64,
    pub new_balance: i64,
    pub date: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransferInput {
    pub from_account_id: i64,
    pub to_account_id: i64,
    pub amount: i64,
    pub date: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIncomeInput {
    pub amount: i64,
    pub date: String,
    pub category_id: i64,
    pub account_id: i64,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExpenseInput {
    pub amount: i64,
    pub date: String,
    pub category_id: i64,
    pub account_id: i64,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub receipt: Option<ReceiptMeta>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntryInput {
    pub id: i64,
    pub amount: i64,
    pub date: String,
    pub category_id: i64,
    pub account_id: i64,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntryInput {
    pub id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntriesInput {
    #[serde(default)]
    pub month: Option<String>,
    #[serde(default)]
    pub kind: Option<EntryKind>,
    #[serde(default)]
    pub category_id: Option<i64>,
    #[serde(default)]
    pub account_id: Option<i64>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRecurringInput {
    #[serde(default)]
    pub kind: Option<CategoryKind>,
    pub today: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecurringInput {
    pub kind: CategoryKind,
    pub name: String,
    pub amount: i64,
    pub category_id: i64,
    pub account_id: i64,
    pub interval_months: i64,
    pub day_of_month: i64,
    pub start_date: String,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub bonus_every_months: Option<i64>,
    #[serde(default)]
    pub bonus_percent: Option<f64>,
    pub today: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecurringInput {
    pub id: i64,
    pub kind: CategoryKind,
    pub name: String,
    pub amount: i64,
    pub category_id: i64,
    pub account_id: i64,
    pub interval_months: i64,
    pub day_of_month: i64,
    pub start_date: String,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub bonus_every_months: Option<i64>,
    #[serde(default)]
    pub bonus_percent: Option<f64>,
    pub today: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecurringInput {
    pub id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostDueRecurringInput {
    pub today: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBudgetInput {
    pub month: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetBudgetInput {
    pub category_id: i64,
    #[serde(default)]
    pub account_id: Option<i64>,
    pub amount: i64,
    pub from_month: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthSummaryInput {
    pub month: String,
    pub today: String,
}

// ---------- Validaciones compartidas ----------

/// Nombre recortado de 1 a 40 caracteres.
pub fn clean_name(s: &str) -> Result<String, AppError> {
    let t = s.trim();
    let n = t.chars().count();
    if n == 0 || n > 40 {
        return fail("El nombre es obligatorio");
    }
    Ok(t.to_string())
}

pub fn check_amount(amount: i64) -> Result<(), AppError> {
    if amount <= 0 {
        return fail("El monto debe ser mayor a 0");
    }
    Ok(())
}

/// Fecha estricta 'YYYY-MM-DD' con día de calendario válido.
pub fn parse_date(s: &str) -> Result<NaiveDate, AppError> {
    let b = s.as_bytes();
    if s.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return fail("Fecha inválida");
    }
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| AppError("Fecha inválida".to_string()))
}

/// Mes estricto 'YYYY-MM'; devuelve (año, mes).
pub fn parse_month(s: &str) -> Result<(i32, u32), AppError> {
    let b = s.as_bytes();
    if s.len() != 7 || b[4] != b'-' {
        return fail("Fecha inválida");
    }
    let year: i32 = s[..4].parse().map_err(|_| AppError("Fecha inválida".to_string()))?;
    let month: u32 = s[5..7].parse().map_err(|_| AppError("Fecha inválida".to_string()))?;
    if !(1..=12).contains(&month) {
        return fail("Fecha inválida");
    }
    // Año de 4 dígitos ya garantizado por len == 7 y parse de s[..4].
    let _ = year;
    Ok((year, month))
}

pub fn check_color(s: &str) -> Result<String, AppError> {
    let b = s.as_bytes();
    let ok = s.len() == 7 && b[0] == b'#' && b[1..].iter().all(|c| c.is_ascii_hexdigit());
    if !ok {
        return fail("El color debe tener formato #RRGGBB");
    }
    Ok(s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contrato_serializa_camel_case_y_enums_string() {
        let e = Entry {
            id: 1,
            date: "2026-03-05".into(),
            kind: EntryKind::Transfer,
            description: "".into(),
            amount: 100,
            category_id: None,
            category_name: None,
            category_color: None,
            account_id: Some(2),
            account_name: Some("Vista".into()),
            to_account_id: Some(3),
            to_account_name: Some("Ahorro".into()),
            recurring_id: None,
            is_bonus: false,
            receipt: Some(ReceiptMeta {
                merchant: None,
                tax_id: None,
                doc_type: None,
                folio: Some("1".into()),
            }),
            lines: vec![],
        };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["kind"], "transfer");
        assert_eq!(v["accountId"], 2);
        assert_eq!(v["toAccountId"], 3);
        assert_eq!(v["isBonus"], false);
        assert_eq!(v["categoryId"], serde_json::Value::Null);
        assert_eq!(v["receipt"]["folio"], "1");
        assert_eq!(v["receipt"]["merchant"], serde_json::Value::Null);
        assert_eq!(serde_json::to_value(AccountKind::DepositoPlazo).unwrap(), "deposito_plazo");
        assert_eq!(serde_json::to_value(CategoryKind::Expense).unwrap(), "expense");
        // Input con campos opcionales ausentes usa defaults.
        let inc: CreateIncomeInput = serde_json::from_value(serde_json::json!({
            "amount": 5, "date": "2026-01-01", "categoryId": 1, "accountId": 2
        }))
        .unwrap();
        assert_eq!(inc.description, "");
    }
}
