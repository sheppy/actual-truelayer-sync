import cron from 'node-cron'
import { loadConfig, writeState } from './config/config'
import { initActual, selectBudget, shutdownActual } from './actual/actual'
import { syncConnection } from './sync/connection'
import { log, logError } from './utils/logger'
import type { Config } from './config/schema'

const dryRun = process.argv.includes('--dry-run')

async function mainTask(config: Config): Promise<void> {
  try {
    await initActual({
      serverURL: config.env.ACTUAL_SERVER_URL,
      password: config.env.ACTUAL_SERVER_PASSWORD,
      verbose: !!config.env.DEBUG,
    })

    for (const connection of config.connections) {
      const result = await syncConnection(connection, config, dryRun)
      if (result) {
        config.state.connections[connection.name] = result
        await writeState(config)
      }
    }
  } catch (e) {
    logError(['Sync'], 'Global sync error:', e)
  } finally {
    await shutdownActual()
    log(['Sync'], 'Sync cycle finished. Sleeping...')
  }
}

void (async () => {
  let config: Config
  try {
    config = await loadConfig()
  } catch (err) {
    logError(['Sync'], 'Failed to load config:', err)
    process.exit(1)
  }

  if (dryRun) {
    log(['DRY RUN'], 'No transactions will be imported and no runs will be scheduled.')
  }

  await mainTask(config)

  if (dryRun) {
    if (config.env.CRON_SCHEDULE) {
      log(['DRY RUN'], `Would have scheduled: ${config.env.CRON_SCHEDULE}`)
    }
    return
  }

  if (config.env.CRON_SCHEDULE) {
    const timezone = config.env.TZ
    log(
      ['Sync'],
      `Scheduler initialized with pattern: ${config.env.CRON_SCHEDULE}${timezone ? ` (timezone: ${timezone})` : ''}`,
    )
    cron.schedule(
      config.env.CRON_SCHEDULE,
      () => {
        mainTask(config).catch((err) => logError(['Sync'], 'Unhandled task error:', err))
      },
      {
        noOverlap: true,
        ...(timezone ? { timezone } : {}),
      },
    )
  }
})()

process.on('SIGTERM', () => {
  log(['Sync'], 'SIGTERM received, shutting down...')
  shutdownActual()
    .catch((err) => logError(['Sync'], 'Error during shutdown:', err))
    .finally(() => process.exit(0))
})
