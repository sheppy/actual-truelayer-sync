import actual from '@actual-app/api'
import { getApiVersion, getServerVersion, mismatchMessage, versionsMatch } from './version'

interface InitOptions {
  serverURL: string
  password: string
  syncId: string
  verbose: boolean
}

/** Returns a warning message if the server and @actual-app/api versions differ, otherwise undefined. */
export async function checkActualVersion(serverURL: string): Promise<string | undefined> {
  const [serverVersion, apiVersion] = [await getServerVersion(serverURL), getApiVersion()]
  if (serverVersion && apiVersion && !versionsMatch(serverVersion, apiVersion)) {
    return mismatchMessage(serverVersion, apiVersion)
  }
  return undefined
}

export async function initActual(options: InitOptions): Promise<void> {
  await actual.init({
    serverURL: options.serverURL,
    password: options.password,
    verbose: options.verbose,
    dataDir: './data',
  })
  try {
    await actual.downloadBudget(options.syncId)
  } catch (err) {
    if (String((err as Error)?.message ?? err).includes('out-of-sync-migrations')) {
      const hint = await checkActualVersion(options.serverURL)
      throw new Error(
        `Failed to open budget: out-of-sync-migrations. ${hint ?? 'Make sure @actual-app/api matches your Actual server version.'}`,
      )
    }
    throw err
  }
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

export async function shutdownActual(): Promise<void> {
  await actual.shutdown()
}
