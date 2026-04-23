import * as actual from '@actual-app/api'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import type { Connection, Secrets, TrueLayerTokenResponse, TrueLayerTransaction } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(__dirname, '..', 'data', 'config.json')

async function syncConnection(connection: Connection, globalSecrets: Secrets) {
  console.log(`\n[${new Date().toISOString()}] --- Syncing: ${connection.name} ---`)
  try {
    const tokenRes = await axios.post<TrueLayerTokenResponse>(
      'https://auth.truelayer.com/connect/token',
      `grant_type=refresh_token&client_id=${globalSecrets.clientId}&client_secret=${globalSecrets.clientSecret}&refresh_token=${connection.refreshToken}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )

    const { access_token, refresh_token: newRefreshToken } = tokenRes.data
    connection.refreshToken = newRefreshToken

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
        notes: t.transaction_id,
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

async function mainTask() {
  if (!fs.existsSync(configPath)) {
    console.error('config.json not found in /app/data')
    return
  }

  const fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const globalSecrets: Secrets = {
    clientId: process.env.TRUELAYER_CLIENT_ID ?? '',
    clientSecret: process.env.TRUELAYER_CLIENT_SECRET ?? '',
  }

  try {
    await actual.init({
      serverURL: process.env.ACTUAL_SERVER_URL ?? '',
      password: process.env.ACTUAL_SERVER_PASSWORD ?? '',
      verbose: !!process.env.DEBUG,
    })
    await actual.downloadBudget(process.env.ACTUAL_SYNC_ID ?? '')

    let updatedAny = false
    for (const conn of fullConfig.connections) {
      const success = await syncConnection(conn, globalSecrets)
      if (success) updatedAny = true
    }

    if (updatedAny) {
      fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2), 'utf8')
      console.log('Tokens updated in config.json.')
    }
  } catch (e) {
    console.error('Global Sync Error:', (e as Error).message)
  } finally {
    await actual.shutdown()
    console.log('Sync cycle finished. Sleeping...')
  }
}

// 1. Run immediately on startup
mainTask()

// 2. Schedule future runs
const schedule = process.env.CRON_SCHEDULE
if (schedule) {
  console.log(`Scheduler initialized with pattern: ${schedule}`)
  cron.schedule(schedule, () => {
    mainTask()
  })
}
