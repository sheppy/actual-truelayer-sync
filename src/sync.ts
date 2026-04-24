import axios from 'axios'
import cron from 'node-cron'
import { loadConfig, writeConfig } from './config'
import { initActual, importTransactions, shutdownActual } from './actual'
import { refreshToken, listAccounts, listCards, getAccountTransactions, getCardTransactions } from './truelayer'
import { transformTransactions } from './transform'
import type { Connection, Config } from './config'
import type { TrueLayerAccount, TrueLayerCard } from './types'

async function syncConnection(connection: Connection, config: Config): Promise<boolean> {
  console.log(`\n[${new Date().toISOString()}] --- Syncing: ${connection.name} ---`)
  try {
    const { access_token, refresh_token: newRefreshToken } = await refreshToken(
      config.env.TRUELAYER_CLIENT_ID,
      config.env.TRUELAYER_CLIENT_SECRET,
      connection.refreshToken,
    )

    const tokenChanged = newRefreshToken !== connection.refreshToken
    console.log(`[${connection.name}] Refresh token ${tokenChanged ? 'CHANGED' : 'unchanged'}.`)
    connection.refreshToken = newRefreshToken

    // Fetch all accounts/cards from TrueLayer, log unmatched, and build a map for flip inference
    let trueLayerAccountsById = new Map<string, TrueLayerAccount | TrueLayerCard>()
    try {
      const trueLayerAccounts = connection.isCard ? await listCards(access_token) : await listAccounts(access_token)
      trueLayerAccountsById = new Map(trueLayerAccounts.map((a) => [a.account_id, a]))

      const configuredIds = new Set(connection.accounts.map((a) => a.truelayerId))
      const unmatched = trueLayerAccounts.filter((a) => !configuredIds.has(a.account_id))
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

    for (const configAccount of connection.accounts) {
      console.log(`Fetching ${configAccount.friendlyName}...`)
      const isCard = configAccount.isCard ?? connection.isCard ?? false
      const trueLayerTransactions = isCard
        ? await getCardTransactions(access_token, configAccount.truelayerId)
        : await getAccountTransactions(access_token, configAccount.truelayerId)

      const trueLayerAccount = trueLayerAccountsById.get(configAccount.truelayerId)
      const transactions = transformTransactions(trueLayerTransactions, configAccount, trueLayerAccount)

      if (transactions.length > 0) {
        await importTransactions(configAccount.actualId, transactions)
        console.log(`Imported ${transactions.length} items to ${configAccount.friendlyName}.`)
      } else {
        console.log(`No new transactions for ${configAccount.friendlyName}.`)
      }
    }
    return tokenChanged
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
    await initActual({
      serverURL: config.env.ACTUAL_SERVER_URL,
      password: config.env.ACTUAL_SERVER_PASSWORD,
      syncId: config.env.ACTUAL_SYNC_ID,
      verbose: !!config.env.DEBUG,
    })

    for (const connection of config.connections) {
      const tokenChanged = await syncConnection(connection, config)
      if (tokenChanged) {
        await writeConfig(config)
      }
    }
  } catch (e) {
    console.error('Global Sync Error:', String(e))
  } finally {
    await shutdownActual()
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
    const timezone = config.env.TZ
    console.log(
      `Scheduler initialized with pattern: ${config.env.CRON_SCHEDULE}${timezone ? ` (timezone: ${timezone})` : ''}`,
    )
    cron.schedule(config.env.CRON_SCHEDULE, () => mainTask(config), {
      noOverlap: true,
      ...(timezone ? { timezone } : {}),
    })
  }
})()

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')
  shutdownActual()
    .catch((err) => console.error('Error during shutdown:', err))
    .finally(() => process.exit(0))
})
