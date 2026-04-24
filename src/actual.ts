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
    console.warn(`Import warnings for ${accountId}:`, result.errors)
  }
  return { added: result.added, updated: result.updated }
}

export async function shutdownActual(): Promise<void> {
  await actual.shutdown()
}
