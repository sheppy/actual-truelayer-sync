import axios from 'axios'
import cron from 'node-cron'
import { loadConfig, writeConfig } from './config'
import { initActual, importTransactions, shutdownActual } from './actual'
import { refreshToken, listAccounts, listCards, getAccountTransactions, getCardTransactions } from './truelayer'
import { transformTransactions } from './transform'
import type { Connection, Config } from './config'
import type { TrueLayerAccount, TrueLayerCard } from './types'

async function syncConnection(connection: Connection, config: Config): Promise<void> {
  const startedAt = Date.now()
  console.log(`\n[${connection.name}] --- Syncing @ ${new Date().toISOString()} ---`)
  console.log(`[${connection.name}] Authenticating with TrueLayer...`)
  try {
    const { access_token, refresh_token: newRefreshToken } = await refreshToken(
      config.env.TRUELAYER_CLIENT_ID,
      config.env.TRUELAYER_CLIENT_SECRET,
      connection.refreshToken,
    )

    const tokenChanged = newRefreshToken !== connection.refreshToken
    console.log(`[${connection.name}] └ Refresh token ${tokenChanged ? 'CHANGED' : 'unchanged'}.`)
    connection.refreshToken = newRefreshToken

    // Fetch all accounts/cards from TrueLayer, log unmatched, and build a map for flip inference
    let trueLayerAccountsById = new Map<string, TrueLayerAccount | TrueLayerCard>()
    try {
      console.log(`[${connection.name}] Fetching ${connection.isCard ? 'card' : 'account'} details...`)
      const trueLayerAccounts = connection.isCard ? await listCards(access_token) : await listAccounts(access_token)
      trueLayerAccountsById = new Map(trueLayerAccounts.map((a) => [a.account_id, a]))
      console.log(
        `[${connection.name}] └ Found ${trueLayerAccounts.length} ${connection.isCard ? 'card' : 'account'}${trueLayerAccounts.length === 1 ? '' : 's'}.`,
      )

      const configuredIds = new Set(connection.accounts.map((a) => a.trueLayerId))
      const unmatched = trueLayerAccounts.filter((a) => !configuredIds.has(a.account_id))
      if (unmatched.length > 0) {
        console.log(
          `[${connection.name}] Unmatched TrueLayer ${connection.isCard ? 'card' : 'account'} (not in config):`,
        )
        for (const a of unmatched) {
          const detail = 'account_type' in a ? ` (${a.account_type})` : ` (${a.card_type})`
          console.log(`  └ ${a.display_name}${detail} — trueLayerId: ${a.account_id}`)
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
      const prefix = `[${connection.name}][${configAccount.friendlyName}]`

      // Compute from date: lastSyncDate minus 14-day overlap, or undefined for first run
      let fromDate: string | undefined
      if (configAccount.lastSyncDate) {
        const d = new Date(configAccount.lastSyncDate)
        d.setDate(d.getDate() - 14)
        fromDate = d.toISOString().slice(0, 10)
      }

      console.log(`${prefix} Fetching transactions${fromDate ? ` since ${fromDate}` : ''}...`)
      const isCard = configAccount.isCard ?? connection.isCard ?? false
      const trueLayerTransactions = isCard
        ? await getCardTransactions(access_token, configAccount.trueLayerId, fromDate)
        : await getAccountTransactions(access_token, configAccount.trueLayerId, fromDate)

      const trueLayerAccount = trueLayerAccountsById.get(configAccount.trueLayerId)
      const transactions = transformTransactions(trueLayerTransactions, configAccount, trueLayerAccount)

      if (transactions.length > 0) {
        console.log(`${prefix} └ Found ${transactions.length} transactions.`)
        const dates = trueLayerTransactions.map((t) => t.timestamp).sort()
        const from = dates[0].slice(0, 10)
        const to = dates[dates.length - 1].slice(0, 10)
        const result = await importTransactions(configAccount.actualId, transactions)
        const added = result.added.length
        const updated = result.updated.length
        configAccount.lastSyncDate = new Date().toISOString().slice(0, 10)
        let summary: string
        if (added > 0 && updated > 0) {
          summary = `Added ${added} and updated ${updated} transaction${updated === 1 ? '' : 's'}`
        } else if (added > 0) {
          summary = `Added ${added} transaction${added === 1 ? '' : 's'}`
        } else if (updated > 0) {
          summary = `Updated ${updated} transaction${updated === 1 ? '' : 's'}`
        } else {
          summary = 'No new transactions to import'
        }
        console.log(`${prefix} └ ${summary} (${from} → ${to}).`)
      } else {
        console.log(`${prefix} └ No transactions.`)
      }
    }
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[${connection.name}] Done in ${elapsed}s.`)
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(`[${connection.name}] Failed:`, err.response?.data ?? err.message)
    } else if (err instanceof Error) {
      console.error(`[${connection.name}] Failed:`, err.message)
    } else {
      console.error(`[${connection.name}] Failed:`, err)
    }
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
      await syncConnection(connection, config)
      // Always write config to persist the lastSyncDate and token changes
      await writeConfig(config)
    }
  } catch (e) {
    console.error('\nGlobal Sync Error:', String(e))
  } finally {
    await shutdownActual()
    console.log('\nSync cycle finished. Sleeping...')
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
