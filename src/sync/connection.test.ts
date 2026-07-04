import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import type { Connection, Config } from '../config/schema'
import * as truelayer from '../truelayer/truelayer'
import * as accounts from './accounts'
import * as account from './account'
import { syncConnection } from './connection'

vi.mock('axios')
vi.mock('../utils/logger')
vi.mock('../truelayer/truelayer')
vi.mock('./accounts')
vi.mock('./account')

const baseConnection: Connection = {
  name: 'My Bank',
  accounts: [{ trueLayerId: 'acc-1', budgetId: 'budget-1', actualId: 'a-1', friendlyName: 'Current Account' }],
}

const baseConfig: Config = {
  version: 2,
  includeCategoryInNotes: false,
  lookbackDays: 14,
  connections: [baseConnection],
  env: {
    TRUELAYER_CLIENT_ID: 'client-id',
    TRUELAYER_CLIENT_SECRET: 'client-secret',
    ACTUAL_SERVER_URL: 'http://localhost:5006',
    ACTUAL_SERVER_PASSWORD: 'password',
    ACTUAL_SYNC_ID: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    LOG_FORMAT: 'json',
  },
  state: {
    connections: {
      'My Bank': {
        refreshToken: 'old-refresh-token',
        accounts: {},
      },
    },
  },
}

describe('syncConnection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a ConnectionState with the new refresh token', async () => {
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    })
    vi.mocked(accounts.fetchAccountMap).mockResolvedValueOnce(new Map())
    vi.mocked(account.syncAccount).mockResolvedValueOnce(false)

    const result = await syncConnection(baseConnection, baseConfig)

    expect(result?.refreshToken).toBe('new-refresh')
  })

  it('calls fetchAccountMap with the connection and access token', async () => {
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'old-refresh-token',
    })
    vi.mocked(accounts.fetchAccountMap).mockResolvedValueOnce(new Map())
    vi.mocked(account.syncAccount).mockResolvedValueOnce(false)

    await syncConnection(baseConnection, baseConfig)

    expect(accounts.fetchAccountMap).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Bank' }), 'new-access')
  })

  it('calls syncAccount for each account in the connection', async () => {
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'old-refresh-token',
    })
    vi.mocked(accounts.fetchAccountMap).mockResolvedValueOnce(new Map())
    vi.mocked(account.syncAccount).mockResolvedValueOnce(false)

    await syncConnection(baseConnection, baseConfig)

    expect(account.syncAccount).toHaveBeenCalledTimes(1)
    expect(account.syncAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        configAccount: expect.objectContaining({ trueLayerId: 'acc-1' }),
        accessToken: 'new-access',
        includeCategoryInNotes: false,
        lookbackDays: 14,
        lastSyncDate: undefined,
        dryRun: false,
      }),
    )
  })

  it('passes lastSyncDate from state to syncAccount', async () => {
    const configWithState: Config = {
      ...baseConfig,
      state: {
        connections: {
          'My Bank': {
            refreshToken: 'old-refresh-token',
            accounts: { 'acc-1': { lastSyncDate: '2026-04-24' } },
          },
        },
      },
    }
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'old-refresh-token',
    })
    vi.mocked(accounts.fetchAccountMap).mockResolvedValueOnce(new Map())
    vi.mocked(account.syncAccount).mockResolvedValueOnce(false)

    await syncConnection(baseConnection, configWithState)

    expect(account.syncAccount).toHaveBeenCalledWith(
      expect.objectContaining({ lastSyncDate: '2026-04-24' }),
    )
  })

  it('returns updated accounts with lastSyncDate when syncAccount returns true', async () => {
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'old-refresh-token',
    })
    vi.mocked(accounts.fetchAccountMap).mockResolvedValueOnce(new Map())
    vi.mocked(account.syncAccount).mockResolvedValueOnce(true)

    const result = await syncConnection(baseConnection, baseConfig)

    expect(result?.accounts['acc-1']?.lastSyncDate).toBe(new Date().toISOString().slice(0, 10))
  })

  it('returns accounts unchanged when syncAccount returns false', async () => {
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'old-refresh-token',
    })
    vi.mocked(accounts.fetchAccountMap).mockResolvedValueOnce(new Map())
    vi.mocked(account.syncAccount).mockResolvedValueOnce(false)

    const result = await syncConnection(baseConnection, baseConfig)

    expect(result?.accounts['acc-1']).toBeUndefined()
  })

  it('returns undefined when authentication fails', async () => {
    const axiosError = Object.assign(new Error('Unauthorized'), {
      isAxiosError: true,
      response: { data: { error: 'invalid_client' } },
    })
    vi.mocked(truelayer.refreshToken).mockRejectedValueOnce(axiosError)
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true)

    const result = await syncConnection(baseConnection, baseConfig)

    expect(result).toBeUndefined()
    expect(accounts.fetchAccountMap).not.toHaveBeenCalled()
  })

  it('returns undefined when authentication fails with a generic error', async () => {
    vi.mocked(truelayer.refreshToken).mockRejectedValueOnce(new Error('Network failure'))
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)

    const result = await syncConnection(baseConnection, baseConfig)

    expect(result).toBeUndefined()
  })

  it('returns ConnectionState with new token when fetchAccountMap fails', async () => {
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    })
    vi.mocked(accounts.fetchAccountMap).mockRejectedValueOnce(new Error('API error'))
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)

    const result = await syncConnection(baseConnection, baseConfig)

    expect(result?.refreshToken).toBe('new-refresh')
    expect(result?.accounts).toEqual({})
  })

  it('returns undefined when no state entry exists for the connection', async () => {
    const configWithNoState: Config = { ...baseConfig, state: { connections: {} } }

    const result = await syncConnection(baseConnection, configWithNoState)

    expect(result).toBeUndefined()
    expect(truelayer.refreshToken).not.toHaveBeenCalled()
  })

  it('passes dryRun flag through to syncAccount', async () => {
    vi.mocked(truelayer.refreshToken).mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'old-refresh-token',
    })
    vi.mocked(accounts.fetchAccountMap).mockResolvedValueOnce(new Map())
    vi.mocked(account.syncAccount).mockResolvedValueOnce(false)

    await syncConnection(baseConnection, baseConfig, true)

    expect(account.syncAccount).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }))
  })
})
