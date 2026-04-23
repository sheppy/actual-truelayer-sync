// @actual-app/api ships types that reference @actual-app/core's raw TypeScript source,
// which is incompatible with strict tsconfig settings. We declare the module manually
// with just the surface area we actually use, and redirect here via tsconfig `paths`.

export interface InitOptions {
  serverURL: string
  password: string
  verbose?: boolean
}

export interface ImportTransactionsResult {
  errors: unknown[]
  added: string[]
  updated: string[]
}

export interface ActualTransaction {
  date: string
  amount: number
  payee_name?: string
  notes?: string
  imported_id?: string
  cleared?: boolean
  account?: string
}

export function init(options: InitOptions): Promise<void>
export function downloadBudget(syncId: string): Promise<void>
export function importTransactions(accountId: string, transactions: ActualTransaction[]): Promise<ImportTransactionsResult>
export function shutdown(): Promise<void>
