export type CategoryKind = 'income' | 'expense';

export type AccountKind =
  | 'corriente'
  | 'vista'
  | 'ahorro'
  | 'deposito_plazo'
  | 'efectivo';

export type EntryKind = 'opening' | 'income' | 'expense' | 'transfer' | 'adjustment';

export type LedgerType = 'asset' | 'income' | 'expense' | 'equity';

export interface User {
  id: number;
  username: string;
  onboardingDone: boolean;
}

export interface AuthStatus {
  hasUsers: boolean;
  user: User | null;
}

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string;
  archived: boolean;
}

export interface Account {
  id: number;
  name: string;
  kind: AccountKind;
  balance: number;
  archived: boolean;
}

export interface ReceiptMeta {
  merchant: string | null;
  taxId: string | null;
  docType: string | null;
  folio: string | null;
}

export interface EntryLine {
  ledgerAccountId: number;
  ledgerAccountName: string;
  ledgerAccountType: LedgerType;
  debit: number;
  credit: number;
}

export interface Entry {
  id: number;
  date: string;
  kind: EntryKind;
  description: string;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountId: number | null;
  accountName: string | null;
  toAccountId: number | null;
  toAccountName: string | null;
  recurringId: number | null;
  isBonus: boolean;
  receipt: ReceiptMeta | null;
  lines: EntryLine[];
}

export interface RecurringRule {
  id: number;
  kind: CategoryKind;
  name: string;
  amount: number;
  categoryId: number;
  categoryName: string;
  accountId: number;
  accountName: string;
  intervalMonths: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  bonusEveryMonths: number | null;
  bonusPercent: number | null;
  nextDate: string;
}

export interface BudgetLine {
  categoryId: number;
  categoryName: string;
  color: string;
  accountId: number | null;
  accountName: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
}

export interface BudgetMonth {
  month: string;
  lines: BudgetLine[];
  totalBudget: number;
  totalSpent: number;
  unbudgetedSpent: number;
}

export interface MonthSummary {
  month: string;
  incomeActual: number;
  incomeProjected: number;
  expenseActual: number;
  expenseProjected: number;
  budgetTotal: number;
  budgetSpent: number;
  unbudgetedSpent: number;
  totalBalance: number;
}

export interface RegisterInput {
  username: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface SetOnboardingDoneInput {
  done: boolean;
}

export interface ListCategoriesInput {
  kind: CategoryKind | null;
  includeArchived: boolean;
}

export interface CreateCategoryInput {
  name: string;
  kind: CategoryKind;
  color: string;
}

export interface UpdateCategoryInput {
  id: number;
  name: string;
  color: string;
}

export interface ArchiveCategoryInput {
  id: number;
}

export interface ListAccountsInput {
  includeArchived: boolean;
}

export interface CreateAccountInput {
  name: string;
  kind: AccountKind;
  openingBalance: number;
  date: string;
}

export interface UpdateAccountInput {
  id: number;
  name: string;
  kind: AccountKind;
}

export interface ArchiveAccountInput {
  id: number;
}

export interface AdjustAccountBalanceInput {
  id: number;
  newBalance: number;
  date: string;
}

export interface CreateTransferInput {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  date: string;
  description: string;
}

export interface CreateIncomeInput {
  amount: number;
  date: string;
  categoryId: number;
  accountId: number;
  description: string;
}

export interface CreateExpenseInput {
  amount: number;
  date: string;
  categoryId: number;
  accountId: number;
  description: string;
  receipt: ReceiptMeta | null;
}

export interface UpdateEntryInput {
  id: number;
  amount: number;
  date: string;
  categoryId: number;
  accountId: number;
  description: string;
}

export interface DeleteEntryInput {
  id: number;
}

export interface ListEntriesInput {
  month: string | null;
  kind: EntryKind | null;
  categoryId: number | null;
  accountId: number | null;
  limit: number | null;
}

export interface ListRecurringInput {
  kind: CategoryKind | null;
  today: string;
}

export interface CreateRecurringInput {
  kind: CategoryKind;
  name: string;
  amount: number;
  categoryId: number;
  accountId: number;
  intervalMonths: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  bonusEveryMonths: number | null;
  bonusPercent: number | null;
  today: string;
}

export interface UpdateRecurringInput {
  id: number;
  kind: CategoryKind;
  name: string;
  amount: number;
  categoryId: number;
  accountId: number;
  intervalMonths: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  bonusEveryMonths: number | null;
  bonusPercent: number | null;
  today: string;
}

export interface DeleteRecurringInput {
  id: number;
}

export interface PostDueRecurringInput {
  today: string;
}

export interface ListBudgetInput {
  month: string;
}

export interface SetBudgetInput {
  categoryId: number;
  accountId: number | null;
  amount: number;
  fromMonth: string;
}

export interface MonthSummaryInput {
  month: string;
  today: string;
}
