mod accounts;
mod auth;
mod budget;
mod categories;
mod commands;
mod db;
mod entries;
mod error;
mod ledger;
mod models;
mod recurring;
mod summary;
#[cfg(test)]
mod tests;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir().map_err(|e| {
                Box::new(std::io::Error::other(format!(
                    "No se pudo obtener la carpeta de datos: {e}"
                ))) as Box<dyn std::error::Error>
            })?;
            let state = commands::open_state(&dir).map_err(|e| {
                Box::new(std::io::Error::other(e)) as Box<dyn std::error::Error>
            })?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth_status,
            commands::register,
            commands::login,
            commands::logout,
            commands::set_onboarding_done,
            commands::list_categories,
            commands::create_category,
            commands::update_category,
            commands::archive_category,
            commands::list_accounts,
            commands::create_account,
            commands::update_account,
            commands::archive_account,
            commands::adjust_account_balance,
            commands::create_transfer,
            commands::create_income,
            commands::create_expense,
            commands::update_entry,
            commands::delete_entry,
            commands::list_entries,
            commands::list_recurring,
            commands::create_recurring,
            commands::update_recurring,
            commands::delete_recurring,
            commands::post_due_recurring,
            commands::list_budget,
            commands::set_budget,
            commands::month_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
