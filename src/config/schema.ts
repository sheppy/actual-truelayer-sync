import { z } from 'zod'
import cron from 'node-cron'

export const AccountSchema = z.object({
  trueLayerId: z.string().min(1),
  budgetId: z.string().min(1),
  actualId: z.string().min(1),
  friendlyName: z.string().min(1),
  isCard: z.boolean().optional(),
  flip: z.boolean().optional(),
})

export const ConnectionSchema = z.object({
  name: z.string().min(1),
  isCard: z.boolean().optional(),
  accounts: z.array(AccountSchema),
})

export const FileConfigSchema = z
  .object({
    version: z.number().int(),
    includeCategoryInNotes: z.boolean().default(false),
    lookbackDays: z.number().int().positive().default(14),
    connections: z.array(ConnectionSchema).min(1),
  })
  .refine((data) => new Set(data.connections.map((c) => c.name)).size === data.connections.length, {
    message: 'Connection names must be unique',
    path: ['connections'],
  })

export const EnvSchema = z.object({
  TRUELAYER_CLIENT_ID: z.string().min(1),
  TRUELAYER_CLIENT_SECRET: z.string().min(1),
  ACTUAL_SERVER_URL: z.url(),
  ACTUAL_SERVER_PASSWORD: z.string().min(1),
  ACTUAL_SYNC_ID: z.uuid().optional(),
  CRON_SCHEDULE: z
    .string()
    .optional()
    .refine((val) => val === undefined || cron.validate(val), { message: 'Invalid cron expression' }),
  DEBUG: z.string().optional(),
  TZ: z.string().optional(),
  LOG_FORMAT: z.enum(['text', 'json']).default('json'),
})

export const AccountStateSchema = z.object({
  lastSyncDate: z.string().date().optional(),
})

export const ConnectionStateSchema = z.object({
  refreshToken: z.string().min(1),
  accounts: z.record(z.string(), AccountStateSchema).default({}),
})

export const StateSchema = z.object({
  connections: z.record(z.string(), ConnectionStateSchema).default({}),
})

export type Account = z.infer<typeof AccountSchema>
export type Connection = z.infer<typeof ConnectionSchema>
export type FileConfig = z.infer<typeof FileConfigSchema>
export type AccountState = z.infer<typeof AccountStateSchema>
export type ConnectionState = z.infer<typeof ConnectionStateSchema>
export type Env = z.infer<typeof EnvSchema>
export type State = z.infer<typeof StateSchema>

export type Config = FileConfig & {
  env: Env
  state: State
}
