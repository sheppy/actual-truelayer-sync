import actual from '@actual-app/api'
import axios from 'axios'
import cron from 'node-cron'
import { loadConfig, writeConfig } from './config'
import { refreshToken, listAccounts, listCards, getAccountTransactions, getCardTransactions } from './truelayer'
import type { Connection, Config } from './config'
import type { TrueLayerAccount, TrueLayerCard } from './types'

async function syncConnection(connection: Connection, config: Config) {
  console.log(`\n[${new Date().toISOString()}] --- Syncing: ${connection.name} ---`)
  try {
    const { access_token, refresh_token: newRefreshToken } = await refreshToken(
      config.env.TRUELAYER_CLIENT_ID,
      config.env.TRUELAYER_CLIENT_SECRET,
      connection.refreshToken,
    )
    connection.refreshToken = newRefreshToken

    // Fetch all accounts/cards from TrueLayer, log unmatched, and build a map for flip inference
    let trueLayerAccountsById = new Map<string, TrueLayerAccount | TrueLayerCard>()
    try {
      const accountData = connection.isCard ? await listCards(access_token) : await listAccounts(access_token)

      trueLayerAccountsById = new Map(accountData.map((a) => [a.account_id, a]))

      const configuredIds = new Set(connection.accounts.map((a) => a.truelayerId))
      const unmatched = accountData.filter((a) => !configuredIds.has(a.account_id))
      if (unmatched.length > 0) {
        console.log(`[${connection.name}] Unmatched TrueLayer accounts/cards (not in config):`)
        for (const a of unmatched) {
          const detail = 'account_type' in a ? ` (${a.account_type})` : ` (${a.card_type})`
          console.log(`  - ${a.display_name}${detail} — truelayerId: ${a.account_id}`)
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error === 'endpoint_not_supported') {
        console.log(
          `[${connection.name}] Provider does not support accounts listing — skipping unmatched account check.`,
        )
      } else {
        throw err
      }
    }

    for (const account of connection.accounts) {
      console.log(`Fetching ${account.friendlyName}...`)
      const isCard = account.isCard ?? connection.isCard ?? false
      const transactionData = isCard
        ? await getCardTransactions(access_token, account.truelayerId)
        : await getAccountTransactions(access_token, account.truelayerId)

      // Determine flip: explicit config takes precedence, then infer from card_type === 'CREDIT'
      const trueLayerAccount = trueLayerAccountsById.get(account.truelayerId)
      const isCreditCard =
        trueLayerAccount !== undefined && 'card_type' in trueLayerAccount && trueLayerAccount.card_type === 'CREDIT'
      const shouldFlip = account.flip ?? isCreditCard

      const transactions = transactionData.map((t) => ({
        account: account.actualId,
        date: t.timestamp.split('T')[0]!,
        amount: Math.round(t.amount * 100) * (shouldFlip ? -1 : 1),
        payee_name: t.description,
        imported_id: t.transaction_id,
        // TODO: Make configurable
        notes: t.transaction_category !== 'UNKNOWN' ? t.transaction_category : undefined,
        cleared: true,
      }))

      if (transactions.length > 0) {
        await actual.importTransactions(account.actualId, transactions)
        console.log(`Imported ${transactions.length} items to ${account.friendlyName}.`)
      }
    }
    return true
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(`Failed ${connection.name}:`, err.response?.data ?? err.message)
    } else if (err instanceof Error) {
      console.error(`Failed ${connection.name}:`, err.message)
    } else {
      console.error(`Failed ${connection.name}:`, err)
    }
    return false
  }
}

async function mainTask(config: Config) {
  try {
    await actual.init({
      serverURL: config.env.ACTUAL_SERVER_URL,
      password: config.env.ACTUAL_SERVER_PASSWORD,
      verbose: !!config.env.DEBUG,
      dataDir: './data',
    })
    await actual.downloadBudget(config.env.ACTUAL_SYNC_ID)

    let updatedAny = false
    for (const conn of config.connections) {
      const success = await syncConnection(conn, config)
      if (success) {
        updatedAny = true
      }
    }

    if (updatedAny) {
      await writeConfig(config)
    }
  } catch (e) {
    console.error('Global Sync Error:', String(e))
  } finally {
    await actual.shutdown()
    console.log('Sync cycle finished. Sleeping...')
  }
}

void (async () => {
  // Validate env vars and config file before doing anything else
  let config: Config
  try {
    config = await loadConfig()
  } catch (err) {
    console.error(String(err))
    process.exit(1)
  }

  // 1. Run immediately on startup
  await mainTask(config)

  // 2. Optionally schedule future runs
  if (config.env.CRON_SCHEDULE) {
    console.log(`Scheduler initialized with pattern: ${config.env.CRON_SCHEDULE}`)
    cron.schedule(config.env.CRON_SCHEDULE, () => {
      mainTask(config)
    })
  }
})()
