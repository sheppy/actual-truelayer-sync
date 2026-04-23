import actual from '@actual-app/api'
import axios from 'axios'
import cron from 'node-cron'
import { loadConfig, writeConfig } from './config'
import type { Connection, Config } from './config'
import type { TrueLayerTokenResponse, TrueLayerTransaction, TrueLayerAccount } from './types'

async function syncConnection(connection: Connection, config: Config) {
  console.log(`\n[${new Date().toISOString()}] --- Syncing: ${connection.name} ---`)
  try {
    const tokenRes = await axios.post<TrueLayerTokenResponse>(
      'https://auth.truelayer.com/connect/token',
      `grant_type=refresh_token&client_id=${config.env.TRUELAYER_CLIENT_ID}&client_secret=${config.env.TRUELAYER_CLIENT_SECRET}&refresh_token=${connection.refreshToken}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )

    const { access_token, refresh_token: newRefreshToken } = tokenRes.data
    connection.refreshToken = newRefreshToken

    // Fetch all accounts from TrueLayer and log any not present in config
    const accountsRes = await axios.get<{ results: TrueLayerAccount[] }>('https://api.truelayer.com/data/v1/accounts', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const configuredIds = new Set(connection.accounts.map((a) => a.truelayerId))
    const unmatched = accountsRes.data.results.filter((a) => !(a.account_id && configuredIds.has(a.account_id)))
    if (unmatched.length > 0) {
      console.log(`[${connection.name}] Unmatched TrueLayer accounts (not in config):`)
      for (const a of unmatched) {
        console.log(`  - ${a.display_name} (${a.account_type}) — truelayerId: ${a.account_id}`)
      }
    }

    for (const account of connection.accounts) {
      console.log(`Fetching ${account.friendlyName}...`)
      const transRes = await axios.get<{ results: TrueLayerTransaction[] }>(
        `https://api.truelayer.com/data/v1/accounts/${account.truelayerId}/transactions`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        },
      )

      const transactions = transRes.data.results.map((t) => ({
        account: account.actualId,
        date: t.timestamp.split('T')[0]!,
        amount: Math.round(t.amount * 100),
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
