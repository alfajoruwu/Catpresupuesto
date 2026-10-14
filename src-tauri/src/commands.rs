use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State};

use crate::accounts;
use crate::auth;
use crate::budget;
use crate::categories;
use crate::db;
use crate::entries::{self, EntryFilter};
use crate::error::AppError;
use crate::models::*;
use crate::recurring::{self, RuleInput};
use crate::summary;

pub struct AppState {
    pub conn: Mutex<Connection>,
    pub user_id: Mutex<Option<i64>>,
}

fn session(state: &State<'_, AppState>) -> Result<i64, String> {
    state
        .user_id
        .lock()
        .map_err(|_| "Sesión no iniciada".to_string())?
        .ok_or_else(|| "Sesión no iniciada".to_string())
}

fn run<T>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&mut Connection, i64) -> Result<T, AppError>,
) -> Result<T, String> {
    let uid = session(state)?;
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
    f(&mut conn, uid).map_err(|e| e.0)
}

fn run_ro<T>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&Connection, i64) -> Result<T, AppError>,
) -> Result<T, String> {
    let uid = session(state)?;
    let conn = state
        .conn
        .lock()
        .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
    f(&conn, uid).map_err(|e| e.0)
}

fn rule_input(i: &CreateRecurringInput) -> RuleInput<'_> {
    RuleInput {
        kind: i.kind,
        name: &i.name,
        amount: i.amount,
        category_id: i.category_id,
        account_id: i.account_id,
        interval_months: i.interval_months,
        day_of_month: i.day_of_month,
        start_date: &i.start_date,
        end_date: i.end_date.as_deref(),
        bonus_every_months: i.bonus_every_months,
        bonus_percent: i.bonus_percent,
    }
}

// ---------- Auth ----------

#[tauri::command]
pub async fn auth_status(app: AppHandle) -> Result<AuthStatus, String> {
    let state: State<'_, AppState> = app.state();
    let uid = *state
        .user_id
        .lock()
        .map_err(|_| "No se pudo acceder a la sesión".to_string())?;
    let conn = state
        .conn
        .lock()
        .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
    auth::auth_status(&conn, uid).map_err(|e| e.0)
}

#[tauri::command]
pub async fn register(state: State<'_, AppState>, input: RegisterInput) -> Result<User, String> {
    let user = {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
        let user = auth::register(&conn, &input.username, &input.password).map_err(|e| e.0)?;
        auth::save_session(&conn, Some(user.id)).map_err(|e| e.0)?;
        user
    };
    *state
        .user_id
        .lock()
        .map_err(|_| "No se pudo acceder a la sesión".to_string())? = Some(user.id);
    Ok(user)
}

#[tauri::command]
pub async fn login(state: State<'_, AppState>, input: LoginInput) -> Result<User, String> {
    let user = {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
        let user = auth::login(&conn, &input.username, &input.password).map_err(|e| e.0)?;
        auth::save_session(&conn, Some(user.id)).map_err(|e| e.0)?;
        user
    };
    *state
        .user_id
        .lock()
        .map_err(|_| "No se pudo acceder a la sesión".to_string())? = Some(user.id);
    Ok(user)
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
        auth::save_session(&conn, None).map_err(|e| e.0)?;
    }
    *state
        .user_id
        .lock()
        .map_err(|_| "No se pudo acceder a la sesión".to_string())? = None;
    Ok(())
}

#[tauri::command]
pub async fn set_onboarding_done(
    state: State<'_, AppState>,
    input: SetOnboardingDoneInput,
) -> Result<User, String> {
    run_ro(&state, |conn, uid| {
        auth::set_onboarding_done(conn, uid, input.done)
    })
}

#[tauri::command]
pub async fn reset_user_data(state: State<'_, AppState>) -> Result<(), String> {
    run(&state, auth::reset_user_data)
}

// ---------- Categorías ----------

#[tauri::command]
pub async fn list_categories(
    state: State<'_, AppState>,
    input: ListCategoriesInput,
) -> Result<Vec<Category>, String> {
    run_ro(&state, |conn, uid| {
        categories::list_categories(conn, uid, input.kind, input.include_archived)
    })
}

#[tauri::command]
pub async fn create_category(
    state: State<'_, AppState>,
    input: CreateCategoryInput,
) -> Result<Category, String> {
    run_ro(&state, |conn, uid| {
        categories::create_category(conn, uid, &input.name, input.kind, &input.color)
    })
}

#[tauri::command]
pub async fn update_category(
    state: State<'_, AppState>,
    input: UpdateCategoryInput,
) -> Result<Category, String> {
    run_ro(&state, |conn, uid| {
        categories::update_category(conn, uid, input.id, &input.name, &input.color)
    })
}

#[tauri::command]
pub async fn archive_category(
    state: State<'_, AppState>,
    input: ArchiveCategoryInput,
) -> Result<(), String> {
    run_ro(&state, |conn, uid| {
        categories::archive_category(conn, uid, input.id)
    })
}

// ---------- Cuentas ----------

#[tauri::command]
pub async fn list_accounts(
    state: State<'_, AppState>,
    input: ListAccountsInput,
) -> Result<Vec<Account>, String> {
    run_ro(&state, |conn, uid| {
        accounts::list_accounts(conn, uid, input.include_archived)
    })
}

#[tauri::command]
pub async fn create_account(
    state: State<'_, AppState>,
    input: CreateAccountInput,
) -> Result<Account, String> {
    run(&state, |conn, uid| {
        accounts::create_account(
            conn,
            uid,
            &input.name,
            input.kind,
            input.opening_balance,
            &input.date,
        )
    })
}

#[tauri::command]
pub async fn update_account(
    state: State<'_, AppState>,
    input: UpdateAccountInput,
) -> Result<Account, String> {
    run_ro(&state, |conn, uid| {
        accounts::update_account(conn, uid, input.id, &input.name, input.kind)
    })
}

#[tauri::command]
pub async fn archive_account(
    state: State<'_, AppState>,
    input: ArchiveAccountInput,
) -> Result<(), String> {
    run_ro(&state, |conn, uid| accounts::archive_account(conn, uid, input.id))
}

#[tauri::command]
pub async fn adjust_account_balance(
    state: State<'_, AppState>,
    input: AdjustAccountBalanceInput,
) -> Result<Option<Entry>, String> {
    run(&state, |conn, uid| {
        accounts::adjust_account_balance(conn, uid, input.id, input.new_balance, &input.date)
    })
}

#[tauri::command]
pub async fn create_transfer(
    state: State<'_, AppState>,
    input: CreateTransferInput,
) -> Result<Entry, String> {
    run(&state, |conn, uid| {
        entries::create_transfer(
            conn,
            uid,
            input.from_account_id,
            input.to_account_id,
            input.amount,
            &input.date,
            &input.description,
        )
    })
}

// ---------- Asientos ----------

#[tauri::command]
pub async fn create_income(
    state: State<'_, AppState>,
    input: CreateIncomeInput,
) -> Result<Entry, String> {
    run(&state, |conn, uid| {
        entries::create_income(
            conn,
            uid,
            input.amount,
            &input.date,
            input.category_id,
            input.account_id,
            &input.description,
        )
    })
}

#[tauri::command]
pub async fn create_expense(
    state: State<'_, AppState>,
    input: CreateExpenseInput,
) -> Result<Entry, String> {
    run(&state, |conn, uid| {
        entries::create_expense(
            conn,
            uid,
            input.amount,
            &input.date,
            input.category_id,
            input.account_id,
            &input.description,
            input.receipt.as_ref(),
        )
    })
}

#[tauri::command]
pub async fn update_entry(
    state: State<'_, AppState>,
    input: UpdateEntryInput,
) -> Result<Entry, String> {
    run(&state, |conn, uid| {
        entries::update_entry(
            conn,
            uid,
            input.id,
            input.amount,
            &input.date,
            input.category_id,
            input.account_id,
            &input.description,
        )
    })
}

#[tauri::command]
pub async fn delete_entry(
    state: State<'_, AppState>,
    input: DeleteEntryInput,
) -> Result<(), String> {
    run(&state, |conn, uid| entries::delete_entry(conn, uid, input.id))
}

#[tauri::command]
pub async fn list_entries(
    state: State<'_, AppState>,
    input: ListEntriesInput,
) -> Result<Vec<Entry>, String> {
    run_ro(&state, |conn, uid| {
        entries::list_entries(
            conn,
            uid,
            EntryFilter {
                month: input.month.as_deref(),
                kind: input.kind,
                category_id: input.category_id,
                account_id: input.account_id,
                limit: input.limit,
            },
        )
    })
}

// ---------- Recurrentes ----------

#[tauri::command]
pub async fn list_recurring(
    state: State<'_, AppState>,
    input: ListRecurringInput,
) -> Result<Vec<RecurringRule>, String> {
    run_ro(&state, |conn, uid| {
        recurring::list_recurring(conn, uid, input.kind, &input.today)
    })
}

#[tauri::command]
pub async fn create_recurring(
    state: State<'_, AppState>,
    input: CreateRecurringInput,
) -> Result<RecurringRule, String> {
    let inner = rule_input(&input);
    let today = input.today.clone();
    run(&state, |conn, uid| {
        recurring::create_recurring(conn, uid, inner, &today)
    })
}

#[tauri::command]
pub async fn update_recurring(
    state: State<'_, AppState>,
    input: UpdateRecurringInput,
) -> Result<RecurringRule, String> {
    let id = input.id;
    let today = input.today.clone();
    let inner = RuleInput {
        kind: input.kind,
        name: &input.name,
        amount: input.amount,
        category_id: input.category_id,
        account_id: input.account_id,
        interval_months: input.interval_months,
        day_of_month: input.day_of_month,
        start_date: &input.start_date,
        end_date: input.end_date.as_deref(),
        bonus_every_months: input.bonus_every_months,
        bonus_percent: input.bonus_percent,
    };
    run(&state, |conn, uid| {
        recurring::update_recurring(conn, uid, id, inner, &today)
    })
}

#[tauri::command]
pub async fn delete_recurring(
    state: State<'_, AppState>,
    input: DeleteRecurringInput,
) -> Result<(), String> {
    run_ro(&state, |conn, uid| {
        recurring::delete_recurring(conn, uid, input.id)
    })
}

#[tauri::command]
pub async fn post_due_recurring(
    state: State<'_, AppState>,
    input: PostDueRecurringInput,
) -> Result<i64, String> {
    run(&state, |conn, uid| {
        recurring::post_due_recurring(conn, uid, &input.today)
    })
}

// ---------- Presupuesto ----------

#[tauri::command]
pub async fn list_budget(
    state: State<'_, AppState>,
    input: ListBudgetInput,
) -> Result<BudgetMonth, String> {
    run_ro(&state, |conn, uid| budget::list_budget(conn, uid, &input.month))
}

#[tauri::command]
pub async fn set_budget(
    state: State<'_, AppState>,
    input: SetBudgetInput,
) -> Result<BudgetMonth, String> {
    run_ro(&state, |conn, uid| {
        budget::set_budget(
            conn,
            uid,
            input.category_id,
            input.account_id,
            input.amount,
            &input.from_month,
        )
    })
}

#[tauri::command]
pub async fn month_summary(
    state: State<'_, AppState>,
    input: MonthSummaryInput,
) -> Result<MonthSummary, String> {
    run_ro(&state, |conn, uid| {
        summary::month_summary(conn, uid, &input.month, &input.today)
    })
}

pub fn open_state(app_data_dir: &std::path::Path) -> Result<AppState, String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("No se pudo crear la carpeta de datos: {e}"))?;
    let db_path = app_data_dir.join("catpresupuesto.sqlite3");
    let conn = db::open_database(&db_path).map_err(|e| e.0)?;
    let user_id = auth::saved_session(&conn).map_err(|e| e.0)?;
    Ok(AppState {
        conn: Mutex::new(conn),
        user_id: Mutex::new(user_id),
    })
}
