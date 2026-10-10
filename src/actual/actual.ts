import actual from '@actual-app/api'

interface InitOptions {
  serverURL: string
  password: string
  syncId: string
  verbose: boolean
}

export async function initActual(options: InitOptions): Promise<void> {
  await actual.init({
    serverURL: options.serverURL,
    password: options.password,
    verbose: options.verbose,
    dataDir: './data',
  })
  await actual.downloadBudget(options.syncId)
}

export async function importTransactions(
  accountId: string,
  transactions: Parameters<typeof actual.importTransactions>[1],
): Promise<{ added: string[]; updated: string[] }> {
  const result = await actual.importTransactions(accountId, transactions)
  if (result.errors.length > 0) {
    throw new Error(`Import errors for account ${accountId}: ${JSON.stringify(result.errors)}`)
  }
  return { added: result.added as string[], updated: result.updated as string[] }
}

/** Runs Actual's own matching without saving anything, returning how many transactions would be added. */
export async function previewImport(
  accountId: string,
  transactions: Parameters<typeof actual.importTransactions>[1],
): Promise<{ wouldAdd: number; wouldMatch: number }> {
  const result = await actual.importTransactions(accountId, transactions, { dryRun: true })
  if (result.errors.length > 0) {
    throw new Error(`Import errors for account ${accountId}: ${JSON.stringify(result.errors)}`)
  }
  const total = (transactions as unknown[]).length
  return { wouldAdd: result.added.length, wouldMatch: total - result.added.length }
}

export async function getAccounts(): Promise<Array<{ id: string; name: string; closed: boolean }>> {
  return actual.getAccounts()
}

export async function shutdownActual(): Promise<void> {
  await actual.shutdown()
}
