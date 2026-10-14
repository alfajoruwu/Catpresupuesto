//! Tests de integración del contrato (casos 3-13; 1-2 y 10-11 parciales en módulos).

use crate::accounts;
use crate::auth;
use crate::budget;
use crate::categories;
use crate::db::{memory_db, seed_user};
use crate::entries::{self, EntryFilter};
use crate::models::*;
use crate::recurring::{self, RuleInput, entry_of};
use crate::summary;

fn user_with_basics(conn: &mut rusqlite::Connection, name: &str) -> (i64, i64, i64, i64) {
    let uid = seed_user(conn, name);
    let inc = categories::create_category(conn, uid, "Sueldo", CategoryKind::Income, "#00AA00")
        .unwrap()
        .id;
    let exp =
        categories::create_category(conn, uid, "Comida", CategoryKind::Expense, "#AA0000")
            .unwrap()
            .id;
    let acc = accounts::create_account(conn, uid, "Vista", AccountKind::Vista, 0, "2026-01-01")
        .unwrap()
        .id;
    (uid, inc, exp, acc)
}

#[test]
fn ingreso_gasto_mueven_saldos_y_tipo_equivocado_falla() {
    let mut conn = memory_db().unwrap();
    let (uid, inc, exp, acc) = user_with_basics(&mut conn, "user3");
    entries::create_income(&mut conn, uid, 500_000, "2026-03-05", inc, acc, "sueldo").unwrap();
    entries::create_expense(&mut conn, uid, 120_000, "2026-03-06", exp, acc, "super", None)
        .unwrap();
    assert_eq!(accounts::get_account(&conn, uid, acc).unwrap().balance, 380_000);
    let s = summary::month_summary(&conn, uid, "2026-03", "2026-03-31").unwrap();
    assert_eq!((s.income_actual, s.expense_actual), (500_000, 120_000));
    assert_eq!(s.total_balance, 380_000);
    // Categoría del tipo equivocado.
    let e1 = entries::create_income(&mut conn, uid, 10, "2026-03-07", exp, acc, "").unwrap_err();
    assert_eq!(e1.0, "La categoría no es de ingresos");
    let e2 =
        entries::create_expense(&mut conn, uid, 10, "2026-03-07", inc, acc, "", None).unwrap_err();
    assert_eq!(e2.0, "La categoría no es de gastos");
}

#[test]
fn recurrente_dia31_recorta_febrero_e_idempotente() {
    let mut conn = memory_db().unwrap();
    let (uid, inc, _exp, acc) = user_with_basics(&mut conn, "user4");
    let mk = |conn: &mut rusqlite::Connection, start: &str, end: Option<&str>, interval: i64| {
        recurring::create_recurring(
            conn,
            uid,
            RuleInput {
                kind: CategoryKind::Income,
                name: "Mensual",
                amount: 100_000,
                category_id: inc,
                account_id: acc,
                interval_months: interval,
                day_of_month: 31,
                start_date: start,
                end_date: end,
                bonus_every_months: None,
                bonus_percent: None,
            },
            "2026-01-31",
        )
        .unwrap()
    };
    let r = mk(&mut conn, "2026-01-31", None, 1);
    assert_eq!(r.next_date.as_deref(), Some("2026-02-28"));
    // 2026 no es bisiesto: febrero recorta al 28.
    recurring::post_due_recurring(&mut conn, uid, "2026-02-28").unwrap();
    assert!(entry_of(&conn, r.id, "2026-02-28", false).is_some());
    // post_due dos veces no duplica.
    let n1 = recurring::post_due_recurring(&mut conn, uid, "2026-02-28").unwrap();
    assert_eq!(n1, 0);
    // Varios meses atrasados se ponen al día.
    let n2 = recurring::post_due_recurring(&mut conn, uid, "2026-05-31").unwrap();
    assert_eq!(n2, 3); // mar, abr, may
    assert!(entry_of(&conn, r.id, "2026-05-31", false).is_some());
    // Intervalo anual: una vez al año (ene 2027, ene 2028), sin ocurrencias intermedias.
    let ra = mk(&mut conn, "2027-01-31", None, 12);
    recurring::post_due_recurring(&mut conn, uid, "2028-06-30").unwrap();
    assert!(entry_of(&conn, ra.id, "2028-01-31", false).is_some());
    assert!(entry_of(&conn, ra.id, "2027-06-30", false).is_none());
    // Regla mensual día 31: en 2028 (bisiesto) febrero cae el 29.
    let rb2 = mk(&mut conn, "2027-12-31", None, 1);
    recurring::post_due_recurring(&mut conn, uid, "2028-02-29").unwrap();
    assert!(entry_of(&conn, rb2.id, "2028-02-29", false).is_some());
    // end_date se respeta.
    let rb = mk(&mut conn, "2026-01-31", Some("2026-02-15"), 1);
    recurring::post_due_recurring(&mut conn, uid, "2026-12-31").unwrap();
    assert!(entry_of(&conn, rb.id, "2026-01-31", false).is_some());
    assert!(entry_of(&conn, rb.id, "2026-02-28", false).is_none());
}

#[test]
fn bonificacion_cada_3_meses_al_50() {
    let mut conn = memory_db().unwrap();
    let (uid, inc, _exp, acc) = user_with_basics(&mut conn, "user5");
    let r = recurring::create_recurring(
        &mut conn,
        uid,
        RuleInput {
            kind: CategoryKind::Income,
            name: "Sueldo",
            amount: 1_000_000,
            category_id: inc,
            account_id: acc,
            interval_months: 1,
            day_of_month: 5,
            start_date: "2026-01-05",
            end_date: None,
            bonus_every_months: Some(3),
            bonus_percent: Some(50.0),
        },
        "2026-01-05",
    )
    .unwrap();
    recurring::post_due_recurring(&mut conn, uid, "2026-06-30").unwrap();
    // Bonus en meses 3 y 6 (m=2 y m=5: (m+1)%3==0), 500.000 redondeado.
    let b3 = entry_of(&conn, r.id, "2026-03-05", true).unwrap();
    assert_eq!((b3.amount, b3.is_bonus), (500_000, true));
    assert!(entry_of(&conn, r.id, "2026-02-05", true).is_none());
    assert!(entry_of(&conn, r.id, "2026-06-05", true).is_some());
    // Bonus solo en ingresos.
    let (_uid2, _inc2, exp2, _acc2) = (uid, inc, {
        let c: i64 = conn
            .query_row(
                "SELECT id FROM ledger_accounts WHERE user_id = ? AND name = 'Comida'",
                [uid],
                |r| r.get(0),
            )
            .unwrap();
        c
    }, acc);
    let bad = recurring::create_recurring(
        &mut conn,
        uid,
        RuleInput {
            kind: CategoryKind::Expense,
            name: "X",
            amount: 1000,
            category_id: exp2,
            account_id: acc,
            interval_months: 1,
            day_of_month: 5,
            start_date: "2026-01-05",
            end_date: None,
            bonus_every_months: Some(3),
            bonus_percent: Some(10.0),
        },
        "2026-01-05",
    )
    .unwrap_err();
    assert_eq!(bad.0, "La bonificación solo aplica a ingresos");
}

#[test]
fn borrar_ocurrencia_no_regenera() {
    let mut conn = memory_db().unwrap();
    let (uid, inc, _exp, acc) = user_with_basics(&mut conn, "user6");
    let r = recurring::create_recurring(
        &mut conn,
        uid,
        RuleInput {
            kind: CategoryKind::Income,
            name: "Sueldo",
            amount: 100_000,
            category_id: inc,
            account_id: acc,
            interval_months: 1,
            day_of_month: 10,
            start_date: "2026-01-10",
            end_date: None,
            bonus_every_months: None,
            bonus_percent: None,
        },
        "2026-03-31",
    )
    .unwrap();
    let e = entry_of(&conn, r.id, "2026-02-10", false).unwrap();
    entries::delete_entry(&mut conn, uid, e.id).unwrap();
    assert_eq!(recurring::post_due_recurring(&mut conn, uid, "2026-03-31").unwrap(), 0);
    assert!(entry_of(&conn, r.id, "2026-02-10", false).is_none());
}

#[test]
fn presupuesto_vigencia_spent_y_cero() {
    let mut conn = memory_db().unwrap();
    let (uid, _inc, exp, acc) = user_with_basics(&mut conn, "user7");
    budget::set_budget(&conn, uid, exp, None, 200_000, "2026-01").unwrap();
    entries::create_expense(&mut conn, uid, 50_000, "2026-03-10", exp, acc, "", None).unwrap();
    // En marzo sigue vigente el de enero.
    let m = budget::list_budget(&conn, uid, "2026-03").unwrap();
    assert_eq!(m.lines.len(), 1);
    let l = &m.lines[0];
    assert_eq!((l.amount, l.spent, l.remaining), (200_000, 50_000, 150_000));
    assert!((l.percent - 25.0).abs() < 1e-9);
    assert_eq!((m.total_budget, m.total_spent, m.unbudgeted_spent), (200_000, 50_000, 0));
    // Amount 0 en abril: desaparece desde abril pero marzo intacto.
    budget::set_budget(&conn, uid, exp, None, 0, "2026-04").unwrap();
    assert!(budget::list_budget(&conn, uid, "2026-04").unwrap().lines.is_empty());
    assert_eq!(budget::list_budget(&conn, uid, "2026-03").unwrap().lines.len(), 1);
}

#[test]
fn transferencia_conserva_total_y_ajuste_ambos_sentidos() {
    let mut conn = memory_db().unwrap();
    let (uid, _inc, _exp, a) = user_with_basics(&mut conn, "user8");
    let b = accounts::create_account(&mut conn, uid, "Ahorro", AccountKind::Ahorro, 0, "2026-01-01")
        .unwrap()
        .id;
    accounts::adjust_account_balance(&mut conn, uid, a, 300_000, "2026-01-02").unwrap();
    entries::create_transfer(&mut conn, uid, a, b, 100_000, "2026-01-03", "").unwrap();
    let s = summary::month_summary(&conn, uid, "2026-01", "2026-01-31").unwrap();
    assert_eq!(s.total_balance, 300_000);
    // Ajuste a la baja.
    let e = accounts::adjust_account_balance(&mut conn, uid, a, 150_000, "2026-01-04")
        .unwrap()
        .unwrap();
    assert_eq!(e.amount, 50_000);
    assert_eq!(e.kind, EntryKind::Adjustment);
    assert_eq!(accounts::get_account(&conn, uid, a).unwrap().balance, 150_000);
    // Sin diferencia: null.
    assert!(
        accounts::adjust_account_balance(&mut conn, uid, a, 150_000, "2026-01-05")
            .unwrap()
            .is_none()
    );
}

#[test]
fn aislamiento_entre_usuarios() {
    let mut conn = memory_db().unwrap();
    let (ua, _i, _e, acc_a) = user_with_basics(&mut conn, "alice");
    let (ub, inc_b, _e, acc_b) = user_with_basics(&mut conn, "bob");
    let cat_a: i64 = conn
        .query_row(
            "SELECT id FROM ledger_accounts WHERE user_id = ? AND name = 'Comida'",
            [ua],
            |r| r.get(0),
        )
        .unwrap();
    // B no puede usar categoría ni cuenta de A.
    let e1 = entries::create_expense(&mut conn, ub, 1000, "2026-01-01", cat_a, acc_b, "", None)
        .unwrap_err();
    assert_eq!(e1.0, "La categoría no es de gastos");
    let e2 = entries::create_income(&mut conn, ub, 1000, "2026-01-01", inc_b, acc_a, "").unwrap_err();
    assert_eq!(e2.0, "Cuenta no encontrada");
    // B no lee asientos de A.
    let cat_sueldo_a: i64 = conn
        .query_row(
            "SELECT id FROM ledger_accounts WHERE user_id = ? AND name = 'Sueldo'",
            [ua],
            |r| r.get(0),
        )
        .unwrap();
    let ea = entries::create_income(&mut conn, ua, 1000, "2026-01-01", cat_sueldo_a, acc_a, "")
        .unwrap();
    assert!(entries::get_entry(&conn, ub, ea.id).is_err());
    assert!(entries::list_entries(&conn, ub, EntryFilter { month: None, kind: None, category_id: None, account_id: None, limit: None }).unwrap().is_empty());
    // A puede archivar una cuenta en 0 sin que B se entere.
    let vacia =
        accounts::create_account(&mut conn, ua, "Vacia", AccountKind::Efectivo, 0, "2026-01-01")
            .unwrap()
            .id;
    accounts::archive_account(&conn, ua, vacia).unwrap();
    assert!(accounts::get_account(&conn, ub, acc_b).is_ok());
}

#[test]
fn ocurrencia_futura_cuenta_en_projected() {
    let mut conn = memory_db().unwrap();
    let (uid, inc, exp, acc) = user_with_basics(&mut conn, "user13");
    recurring::create_recurring(
        &mut conn,
        uid,
        RuleInput {
            kind: CategoryKind::Income,
            name: "Sueldo",
            amount: 400_000,
            category_id: inc,
            account_id: acc,
            interval_months: 1,
            day_of_month: 20,
            start_date: "2026-03-20",
            end_date: None,
            bonus_every_months: None,
            bonus_percent: None,
        },
        "2026-03-10",
    )
    .unwrap();
    recurring::create_recurring(
        &mut conn,
        uid,
        RuleInput {
            kind: CategoryKind::Expense,
            name: "Arriendo",
            amount: 150_000,
            category_id: exp,
            account_id: acc,
            interval_months: 1,
            day_of_month: 25,
            start_date: "2026-03-25",
            end_date: None,
            bonus_every_months: None,
            bonus_percent: None,
        },
        "2026-03-10",
    )
    .unwrap();
    let s = summary::month_summary(&conn, uid, "2026-03", "2026-03-10").unwrap();
    assert_eq!((s.income_actual, s.expense_actual), (0, 0));
    assert_eq!((s.income_projected, s.expense_projected), (400_000, 150_000));
}

#[test]
fn auth_login_basico() {
    let conn = memory_db().unwrap();
    let uid = auth::register(&conn, "carlos", "pass1234").unwrap().id;
    assert!(auth::login(&conn, "carlos", "mal").is_err());
    let st = auth::auth_status(&conn, Some(uid)).unwrap();
    assert!(st.has_users && st.user.is_some());
}

#[test]
fn sesion_sobrevive_al_reabrir_la_base() {
    let dir = std::env::temp_dir().join(format!("catpresupuesto-sesion-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("db.sqlite3");
    let reopen = || crate::db::open_database(&path).unwrap();
    let conn = reopen();
    assert_eq!(auth::saved_session(&conn).unwrap(), None);
    let uid = auth::register(&conn, "ana", "pass1234").unwrap().id;
    auth::save_session(&conn, Some(uid)).unwrap();
    drop(conn);
    let conn = reopen();
    assert_eq!(auth::saved_session(&conn).unwrap(), Some(uid));
    auth::save_session(&conn, None).unwrap();
    drop(conn);
    assert_eq!(auth::saved_session(&reopen()).unwrap(), None);
    std::fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn bordes_contrato_recibo_update_delete_filtros() {
    use crate::recurring::RuleInput;
    let mut conn = memory_db().unwrap();
    let uid = seed_user(&conn, "bordes");
    let inc = categories::create_category(&conn, uid, "Sueldo", CategoryKind::Income, "#00AA00").unwrap().id;
    let exp = categories::create_category(&conn, uid, "Comida", CategoryKind::Expense, "#FF0000").unwrap().id;
    let acc = accounts::create_account(&mut conn, uid, "Vista", AccountKind::Vista, 0, "2026-01-01").unwrap().id;
    // receipt roundtrip
    let e = entries::create_expense(&mut conn, uid, 5000, "2026-02-01", exp, acc, "pan", Some(&ReceiptMeta { merchant: Some("Líder".into()), tax_id: None, doc_type: Some("boleta".into()), folio: Some("42".into()) })).unwrap();
    assert_eq!(e.receipt.as_ref().unwrap().folio.as_deref(), Some("42"));
    assert_eq!(e.category_color.as_deref(), Some("#FF0000"));
    // archive conserva asientos
    categories::archive_category(&conn, uid, exp).unwrap();
    assert_eq!(entries::list_entries(&conn, uid, EntryFilter { month: Some("2026-02"), kind: None, category_id: None, account_id: None, limit: None }).unwrap().len(), 1);
    // recurrente: update no toca generados; delete deja NULL
    let r = recurring::create_recurring(&mut conn, uid, RuleInput { kind: CategoryKind::Income, name: "S", amount: 1000, category_id: inc, account_id: acc, interval_months: 1, day_of_month: 5, start_date: "2026-01-05", end_date: None, bonus_every_months: None, bonus_percent: None }, "2026-02-28").unwrap();
    let before: i64 = conn.query_row("SELECT COUNT(*) FROM entries WHERE recurring_id = ?", [r.id], |x| x.get(0)).unwrap();
    assert_eq!(before, 2);
    recurring::update_recurring(&mut conn, uid, r.id, RuleInput { kind: CategoryKind::Income, name: "S2", amount: 2000, category_id: inc, account_id: acc, interval_months: 1, day_of_month: 5, start_date: "2026-01-05", end_date: None, bonus_every_months: None, bonus_percent: None }, "2026-02-28").unwrap();
    let jan_amount: i64 = conn.query_row("SELECT SUM(l.debit) FROM entry_lines l JOIN entries e ON e.id=l.entry_id JOIN ledger_accounts a ON a.id=l.ledger_account_id WHERE e.recurring_id=? AND e.occurrence_date='2026-01-05' AND a.type='asset'", [r.id], |x| x.get(0)).unwrap();
    assert_eq!(jan_amount, 1000);
    recurring::delete_recurring(&conn, uid, r.id).unwrap();
    let nulls: i64 = conn.query_row("SELECT COUNT(*) FROM entries WHERE recurring_id IS NULL AND description IN ('S','S2')", [], |x| x.get(0)).unwrap();
    assert_eq!(nulls, 2);
    // list_entries: orden date DESC, id DESC + limit + kind + accountId
    entries::create_income(&mut conn, uid, 7000, "2026-03-01", inc, acc, "a").unwrap();
    entries::create_income(&mut conn, uid, 8000, "2026-03-01", inc, acc, "b").unwrap();
    let l = entries::list_entries(&conn, uid, EntryFilter { month: Some("2026-03"), kind: Some(EntryKind::Income), category_id: None, account_id: Some(acc), limit: Some(1) }).unwrap();
    assert_eq!(l.len(), 1);
    assert_eq!(l[0].description, "b");
    // update_entry conserva recurring (usa asiento recurrente nuevo)
    let r2 = recurring::create_recurring(&mut conn, uid, RuleInput { kind: CategoryKind::Income, name: "T", amount: 3000, category_id: inc, account_id: acc, interval_months: 1, day_of_month: 7, start_date: "2026-04-07", end_date: None, bonus_every_months: None, bonus_percent: None }, "2026-04-30").unwrap();
    let re = entry_of(&conn, r2.id, "2026-04-07", false).unwrap();
    let up = entries::update_entry(&mut conn, uid, re.id, 3500, "2026-04-07", inc, acc, "T2").unwrap();
    assert_eq!((up.amount, up.recurring_id), (3500, Some(r2.id)));
    // adjust sin saldo inicial previo: openingBalance 0 no crea asiento
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM entries WHERE kind='opening'", [], |x| x.get(0)).unwrap();
    assert_eq!(n, 0);
}

#[test]
fn list_recurring_filtra_por_tipo() {
    use crate::recurring::RuleInput;
    let mut conn = memory_db().unwrap();
    let uid = seed_user(&conn, "recurrentes");
    let inc = categories::create_category(&conn, uid, "Sueldo", CategoryKind::Income, "#00AA00").unwrap().id;
    let exp = categories::create_category(&conn, uid, "Arriendo", CategoryKind::Expense, "#FF0000").unwrap().id;
    let acc = accounts::create_account(&mut conn, uid, "Vista", AccountKind::Vista, 0, "2026-01-01").unwrap().id;
    recurring::create_recurring(&mut conn, uid, RuleInput { kind: CategoryKind::Income, name: "Sueldo", amount: 1000, category_id: inc, account_id: acc, interval_months: 1, day_of_month: 5, start_date: "2026-01-05", end_date: None, bonus_every_months: None, bonus_percent: None }, "2026-01-01").unwrap();
    recurring::create_recurring(&mut conn, uid, RuleInput { kind: CategoryKind::Expense, name: "Arriendo", amount: 500, category_id: exp, account_id: acc, interval_months: 1, day_of_month: 5, start_date: "2026-01-05", end_date: None, bonus_every_months: None, bonus_percent: None }, "2026-01-01").unwrap();
    let names = |kind| -> Vec<String> {
        recurring::list_recurring(&conn, uid, kind, "2026-01-01").unwrap().into_iter().map(|r| r.name).collect()
    };
    assert_eq!(names(Some(CategoryKind::Income)), ["Sueldo"]);
    assert_eq!(names(Some(CategoryKind::Expense)), ["Arriendo"]);
    assert_eq!(names(None), ["Arriendo", "Sueldo"]);
}

