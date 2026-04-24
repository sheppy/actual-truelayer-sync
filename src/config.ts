import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import cron from 'node-cron'

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json')

const AccountSchema = z.object({
  truelayerId: z.string().min(1),
  actualId: z.string().min(1),
  friendlyName: z.string().min(1),
  isCard: z.boolean().optional(),
  flip: z.boolean().optional(),
  lastSyncDate: z.string().date().optional(),
})

const ConnectionSchema = z.object({
  name: z.string().min(1),
  refreshToken: z.string().min(1),
  isCard: z.boolean().optional(),
  accounts: z.array(AccountSchema),
})

const FileConfigSchema = z.object({
  connections: z.array(ConnectionSchema).min(1),
})

const EnvSchema = z.object({
  TRUELAYER_CLIENT_ID: z.string().min(1),
  TRUELAYER_CLIENT_SECRET: z.string().min(1),
  ACTUAL_SERVER_URL: z.string().url(),
  ACTUAL_SERVER_PASSWORD: z.string().min(1),
  ACTUAL_SYNC_ID: z.string().uuid(),
  CRON_SCHEDULE: z
    .string()
    .optional()
    .refine((val) => val === undefined || cron.validate(val), { message: 'Invalid cron expression' }),
  DEBUG: z.string().optional(),
  TZ: z.string().optional(),
})

export type Account = z.infer<typeof AccountSchema>
export type Connection = z.infer<typeof ConnectionSchema>
export type FileConfig = z.infer<typeof FileConfigSchema>

export type Config = z.infer<typeof FileConfigSchema> & {
  env: z.infer<typeof EnvSchema>
}

export async function loadConfig(): Promise<Config> {
  // Validate environment variables
  const envResult = EnvSchema.safeParse(process.env)
  if (!envResult.success) {
    const issues = envResult.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Missing or invalid environment variables:\n${issues}`)
  }

  // Validate config file
  let raw: unknown
  try {
    const text = await fs.readFile(CONFIG_PATH, 'utf-8')
    raw = JSON.parse(text)
  } catch (err) {
    throw new Error(`Failed to read config at ${CONFIG_PATH}: ${String(err)}`)
  }

  const fileResult = FileConfigSchema.safeParse(raw)
  if (!fileResult.success) {
    throw new Error(`Invalid config file:\n${fileResult.error.toString()}`)
  }

  return { ...fileResult.data, env: envResult.data }
}

export async function writeConfig(config: Config): Promise<void> {
  const { env: _, ...fileConfig } = config
  const tmpPath = `${CONFIG_PATH}.tmp`
  await fs.writeFile(tmpPath, JSON.stringify(fileConfig, null, 2), 'utf-8')
  await fs.rename(tmpPath, CONFIG_PATH)
  console.log('Tokens updated in config.json.')
}
