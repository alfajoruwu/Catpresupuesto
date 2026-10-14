import { invoke } from '@tauri-apps/api/core';
import type {
  Account,
  AdjustAccountBalanceInput,
  ArchiveAccountInput,
  ArchiveCategoryInput,
  AuthStatus,
  BudgetMonth,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  CreateExpenseInput,
  CreateIncomeInput,
  CreateRecurringInput,
  CreateTransferInput,
  DeleteEntryInput,
  DeleteRecurringInput,
  Entry,
  ListAccountsInput,
  ListBudgetInput,
  ListCategoriesInput,
  ListEntriesInput,
  ListRecurringInput,
  LoginInput,
  MonthSummary,
  MonthSummaryInput,
  PostDueRecurringInput,
  RecurringRule,
  RegisterInput,
  SetBudgetInput,
  SetOnboardingDoneInput,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateEntryInput,
  UpdateRecurringInput,
  User,
} from './types';

export class ApiError extends Error {}

async function call<T>(cmd: string, input?: unknown): Promise<T> {
  try {
    return await invoke<T>(cmd, input === undefined ? undefined : { input });
  } catch (e: unknown) {
    const raw = typeof e === 'string' ? e : String(e);
    // Los errores de validación del backend ya vienen redactados para el usuario; los técnicos
    // (argumentos que Tauri no pudo leer, fallos de SQLite) se reemplazan por un mensaje claro.
    if (raw.startsWith('invalid args') || raw.startsWith('Error de base de datos')) {
      console.error(`${cmd}: ${raw}`);
      throw new ApiError(
        raw.startsWith('invalid args')
          ? 'Faltan datos por completar. Revisa el formulario.'
          : 'Hubo un problema con los datos. Inténtalo de nuevo.',
      );
    }
    throw new ApiError(raw);
  }
}

export const api = {
  authStatus(): Promise<AuthStatus> {
    return call<AuthStatus>('auth_status');
  },
  register(input: RegisterInput): Promise<User> {
    return call<User>('register', input);
  },
  login(input: LoginInput): Promise<User> {
    return call<User>('login', input);
  },
  logout(): Promise<null> {
    return call<null>('logout');
  },
  setOnboardingDone(input: SetOnboardingDoneInput): Promise<User> {
    return call<User>('set_onboarding_done', input);
  },
  listCategories(input: ListCategoriesInput): Promise<Category[]> {
    return call<Category[]>('list_categories', input);
  },
  createCategory(input: CreateCategoryInput): Promise<Category> {
    return call<Category>('create_category', input);
  },
  updateCategory(input: UpdateCategoryInput): Promise<Category> {
    return call<Category>('update_category', input);
  },
  archiveCategory(input: ArchiveCategoryInput): Promise<null> {
    return call<null>('archive_category', input);
  },
  listAccounts(input: ListAccountsInput): Promise<Account[]> {
    return call<Account[]>('list_accounts', input);
  },
  createAccount(input: CreateAccountInput): Promise<Account> {
    return call<Account>('create_account', input);
  },
  updateAccount(input: UpdateAccountInput): Promise<Account> {
    return call<Account>('update_account', input);
  },
  archiveAccount(input: ArchiveAccountInput): Promise<null> {
    return call<null>('archive_account', input);
  },
  adjustAccountBalance(input: AdjustAccountBalanceInput): Promise<Entry | null> {
    return call<Entry | null>('adjust_account_balance', input);
  },
  createTransfer(input: CreateTransferInput): Promise<Entry> {
    return call<Entry>('create_transfer', input);
  },
  createIncome(input: CreateIncomeInput): Promise<Entry> {
    return call<Entry>('create_income', input);
  },
  createExpense(input: CreateExpenseInput): Promise<Entry> {
    return call<Entry>('create_expense', input);
  },
  updateEntry(input: UpdateEntryInput): Promise<Entry> {
    return call<Entry>('update_entry', input);
  },
  deleteEntry(input: DeleteEntryInput): Promise<null> {
    return call<null>('delete_entry', input);
  },
  listEntries(input: ListEntriesInput): Promise<Entry[]> {
    return call<Entry[]>('list_entries', input);
  },
  listRecurring(input: ListRecurringInput): Promise<RecurringRule[]> {
    return call<RecurringRule[]>('list_recurring', input);
  },
  createRecurring(input: CreateRecurringInput): Promise<RecurringRule> {
    return call<RecurringRule>('create_recurring', input);
  },
  updateRecurring(input: UpdateRecurringInput): Promise<RecurringRule> {
    return call<RecurringRule>('update_recurring', input);
  },
  deleteRecurring(input: DeleteRecurringInput): Promise<null> {
    return call<null>('delete_recurring', input);
  },
  postDueRecurring(input: PostDueRecurringInput): Promise<number> {
    return call<number>('post_due_recurring', input);
  },
  listBudget(input: ListBudgetInput): Promise<BudgetMonth> {
    return call<BudgetMonth>('list_budget', input);
  },
  setBudget(input: SetBudgetInput): Promise<BudgetMonth> {
    return call<BudgetMonth>('set_budget', input);
  },
  monthSummary(input: MonthSummaryInput): Promise<MonthSummary> {
    return call<MonthSummary>('month_summary', input);
  },
};
