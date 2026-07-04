import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as file from '../utils/file'
import { loadConfig } from './config'
import { AccountSchema, ConnectionSchema, EnvSchema, FileConfigSchema, StateSchema } from './schema'

vi.mock('../utils/file')
vi.mock('../utils/logger')

describe('AccountSchema', () => {
  const validAccount = {
    trueLayerId: 'tl-acc-1',
    actualId: 'actual-acc-1',
    budgetId: 'budget-1',
    friendlyName: 'My Account',
  }

  it('accepts a minimal valid account', () => {
    expect(AccountSchema.safeParse(validAccount).success).toBe(true)
  })

  it('accepts optional isCard and flip', () => {
    const result = AccountSchema.safeParse({ ...validAccount, isCard: true, flip: false })
    expect(result.success).toBe(true)
  })

  it('rejects missing trueLayerId', () => {
    const { trueLayerId: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects empty trueLayerId', () => {
    expect(AccountSchema.safeParse({ ...validAccount, trueLayerId: '' }).success).toBe(false)
  })

  it('rejects missing budgetId', () => {
    const { budgetId: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing actualId', () => {
    const { actualId: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing friendlyName', () => {
    const { friendlyName: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a non-boolean flip', () => {
    expect(AccountSchema.safeParse({ ...validAccount, flip: 'yes' }).success).toBe(false)
  })
})

describe('ConnectionSchema', () => {
  const validConnection = {
    name: 'My Bank',
    accounts: [],
  }

  it('accepts a valid connection with empty accounts', () => {
    expect(ConnectionSchema.safeParse(validConnection).success).toBe(true)
  })

  it('accepts isCard at connection level', () => {
    expect(ConnectionSchema.safeParse({ ...validConnection, isCard: true }).success).toBe(true)
  })

  it('accepts a connection with accounts', () => {
    const result = ConnectionSchema.safeParse({
      ...validConnection,
      accounts: [{ trueLayerId: 'tl-1', actualId: 'a-1', budgetId: 'b-1', friendlyName: 'Acc' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const { name: _, ...rest } = validConnection
    expect(ConnectionSchema.safeParse(rest).success).toBe(false)
  })
})

describe('FileConfigSchema', () => {
  const validFileConfig = {
    version: 2,
    connections: [{ name: 'My Bank', accounts: [] }],
  }

  it('accepts a valid file config', () => {
    expect(FileConfigSchema.safeParse(validFileConfig).success).toBe(true)
  })

  it('defaults includeCategoryInNotes to false', () => {
    const result = FileConfigSchema.safeParse(validFileConfig)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.includeCategoryInNotes).toBe(false)
  })

  it('accepts includeCategoryInNotes: true', () => {
    const result = FileConfigSchema.safeParse({ ...validFileConfig, includeCategoryInNotes: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.includeCategoryInNotes).toBe(true)
  })

  it('rejects empty connections array', () => {
    expect(FileConfigSchema.safeParse({ ...validFileConfig, connections: [] }).success).toBe(false)
  })

  it('rejects missing connections', () => {
    expect(FileConfigSchema.safeParse({}).success).toBe(false)
  })

  it('rejects duplicate connection names', () => {
    const result = FileConfigSchema.safeParse({
      ...validFileConfig,
      connections: [
        { name: 'My Bank', accounts: [] },
        { name: 'My Bank', accounts: [] },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts connections with unique names', () => {
    const result = FileConfigSchema.safeParse({
      ...validFileConfig,
      connections: [
        { name: 'My Bank', accounts: [] },
        { name: 'My Credit Card', accounts: [] },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('StateSchema', () => {
  it('defaults to empty connections when not provided', () => {
    const result = StateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.connections).toEqual({})
  })

  it('accepts a valid state with connections', () => {
    const result = StateSchema.safeParse({
      connections: {
        'My Bank': {
          refreshToken: 'live-token',
          accounts: {
            'tl-acc-1': { lastSyncDate: '2026-04-27' },
          },
        },
      },
    })
    expect(result.success).toBe(true)
  })

  it('defaults accounts to empty object when not provided', () => {
    const result = StateSchema.safeParse({
      connections: { 'My Bank': { refreshToken: 'token' } },
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.connections['My Bank']?.accounts).toEqual({})
  })

  it('rejects a connection with missing refreshToken', () => {
    const result = StateSchema.safeParse({
      connections: { 'My Bank': { accounts: {} } },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid lastSyncDate format', () => {
    const result = StateSchema.safeParse({
      connections: {
        'My Bank': {
          refreshToken: 'token',
          accounts: { 'tl-acc-1': { lastSyncDate: '24-04-2026' } },
        },
      },
    })
    expect(result.success).toBe(false)
  })
})

describe('EnvSchema', () => {
  const validEnv = {
    TRUELAYER_CLIENT_ID: 'client-id',
    TRUELAYER_CLIENT_SECRET: 'client-secret',
    ACTUAL_SERVER_URL: 'http://localhost:5006',
    ACTUAL_SERVER_PASSWORD: 'password',
    ACTUAL_SYNC_ID: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  }

  it('accepts valid minimal env', () => {
    expect(EnvSchema.safeParse(validEnv).success).toBe(true)
  })

  it('accepts optional CRON_SCHEDULE, DEBUG, and TZ', () => {
    const result = EnvSchema.safeParse({
      ...validEnv,
      CRON_SCHEDULE: '0 */4 * * *',
      DEBUG: 'true',
      TZ: 'Europe/London',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid ACTUAL_SERVER_URL', () => {
    expect(EnvSchema.safeParse({ ...validEnv, ACTUAL_SERVER_URL: 'not-a-url' }).success).toBe(false)
  })

  it('rejects an invalid ACTUAL_SYNC_ID', () => {
    expect(EnvSchema.safeParse({ ...validEnv, ACTUAL_SYNC_ID: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects an invalid CRON_SCHEDULE', () => {
    expect(EnvSchema.safeParse({ ...validEnv, CRON_SCHEDULE: 'not-a-cron' }).success).toBe(false)
  })

  it('rejects missing TRUELAYER_CLIENT_ID', () => {
    const { TRUELAYER_CLIENT_ID: _, ...rest } = validEnv
    expect(EnvSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing TRUELAYER_CLIENT_SECRET', () => {
    const { TRUELAYER_CLIENT_SECRET: _, ...rest } = validEnv
    expect(EnvSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing ACTUAL_SERVER_PASSWORD', () => {
    const { ACTUAL_SERVER_PASSWORD: _, ...rest } = validEnv
    expect(EnvSchema.safeParse(rest).success).toBe(false)
  })
})

describe('loadConfig', () => {
  const mockFileConfig = {
    version: 2,
    connections: [
      {
        name: 'My Bank',
        accounts: [
          {
            trueLayerId: 'tl-1',
            actualId: 'a-1',
            friendlyName: 'Account without budgetId',
          },
          {
            trueLayerId: 'tl-2',
            actualId: 'a-2',
            budgetId: 'existing-budget-id',
            friendlyName: 'Account with budgetId',
          },
        ],
      },
    ],
  }

  const mockState = { connections: {} }

  const mockEnv = {
    TRUELAYER_CLIENT_ID: 'id',
    TRUELAYER_CLIENT_SECRET: 'secret',
    ACTUAL_SERVER_URL: 'http://localhost:5006',
    ACTUAL_SERVER_PASSWORD: 'pw',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(file.readJSON).mockImplementation(async (path) => {
      if (path.toString().endsWith('config.json')) return mockFileConfig
      if (path.toString().endsWith('state.json')) return mockState
      return {}
    })
  })

  it('fills missing budgetIds when ACTUAL_SYNC_ID is provided', async () => {
    process.env = { ...mockEnv, ACTUAL_SYNC_ID: 'aaaaaaaa-bbbb-4444-8888-ccccddddeeee' }

    const config = await loadConfig()

    const account1 = config.connections[0].accounts.find((a) => a.trueLayerId === 'tl-1')
    const account2 = config.connections[0].accounts.find((a) => a.trueLayerId === 'tl-2')

    expect(account1?.budgetId).toBe('aaaaaaaa-bbbb-4444-8888-ccccddddeeee')
    expect(account2?.budgetId).toBe('existing-budget-id')
  })

  it('does not overwrite an existing budgetId', async () => {
    process.env = { ...mockEnv, ACTUAL_SYNC_ID: 'aaaaaaaa-bbbb-4444-8888-ccccddddeeee' }

    const config = await loadConfig()

    const account2 = config.connections[0].accounts.find((a) => a.trueLayerId === 'tl-2')
    expect(account2?.budgetId).toBe('existing-budget-id')
  })

  it('throws an error if budgetId is missing and no default is provided', async () => {
    process.env = { ...mockEnv } // No ACTUAL_SYNC_ID

    await expect(loadConfig()).rejects.toThrow(/Invalid config file/)
  })

  it('passes validation if all accounts have a budgetId', async () => {
    vi.mocked(file.readJSON).mockImplementation(async (path) => {
      if (path.toString().endsWith('config.json'))
        return {
          version: 2,
          connections: [
            {
              name: 'My Bank',
              accounts: [
                {
                  trueLayerId: 'tl-1',
                  actualId: 'a-1',
                  budgetId: 'b-1',
                  friendlyName: 'Acc 1',
                },
              ],
            },
          ],
        }
      if (path.toString().endsWith('state.json')) return mockState
      return {}
    })

    process.env = { ...mockEnv } // No ACTUAL_SYNC_ID

    // Should not throw
    const config = await loadConfig()
    expect(config.connections[0].accounts[0].budgetId).toBe('b-1')
  })
})
