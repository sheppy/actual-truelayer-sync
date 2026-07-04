import actual from '@actual-app/api'

interface InitOptions {
  serverURL: string
  password: string
  verbose: boolean
}

export async function initActual(options: InitOptions): Promise<void> {
  await actual.init({
    serverURL: options.serverURL,
    password: options.password,
    verbose: options.verbose,
    dataDir: './data',
  })
}

export async function selectBudget(budgetId: string): Promise<void> {
  const budgets = await actual.getBudgets()
  const budget = budgets.find((b) => b.groupId === budgetId)
  if (!budget) {
    throw new Error(`Budget with ID ${budgetId} not found.`)
  }
  await actual.downloadBudget(budgetId)
}

export async function importTransactions(
  accountId: string,
  transactions: Parameters<typeof actual.importTransactions>[1],
): Promise<{ added: string[]; updated: string[] }> {
  const result = await actual.importTransactions(accountId, transactions)
  if (result.errors.length > 0) {
    throw new Error(`Import errors for account ${accountId}: ${JSON.stringify(result.errors)}`)
  }
  return { added: result.added, updated: result.updated }
}

export async function getAccounts(): Promise<Array<{ id: string; name: string; closed: boolean }>> {
  return actual.getAccounts()
}

export async function getBudgets(): Promise<Array<{ groupId: string; name: string }>> {
  return (await actual.getBudgets()).map((b) => ({ groupId: b.groupId, name: b.name }))
}

export async function shutdownActual(): Promise<void> {
  await actual.shutdown()
}
