import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { refreshToken, listAccounts, listCards, getAccountTransactions, getCardTransactions } from './truelayer'
import type { TrueLayerAccount, TrueLayerCard, TrueLayerTransaction } from './types'
import { NETWORK_TIMEOUT } from '../utils/network'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

const mockAccount: TrueLayerAccount = {
  account_id: 'acc-1',
  account_type: 'TRANSACTION',
  currency: 'GBP',
  display_name: 'Current Account',
  update_timestamp: '2026-04-24T00:00:00Z',
  account_number: {},
  provider: { provider_id: 'first-direct' },
}

const mockCard: TrueLayerCard = {
  account_id: 'card-1',
  card_network: 'VISA',
  card_type: 'CREDIT',
  currency: 'GBP',
  display_name: 'Credit Card',
  partial_card_number: '1234',
  name_on_card: 'Chris Sheppard',
  update_timestamp: '2026-04-24T00:00:00Z',
  provider: { provider_id: 'ms' },
}

const mockTransaction: TrueLayerTransaction = {
  transaction_id: 'txn-1',
  timestamp: '2026-04-24T10:00:00Z',
  description: 'Coffee Shop',
  amount: 3.5,
  currency: 'GBP',
  transaction_type: 'DEBIT',
  transaction_category: 'PURCHASE',
  transaction_classification: [],
}

describe('refreshToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns access_token and refresh_token on success', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    })

    const result = await refreshToken('client-id', 'client-secret', 'old-refresh')
    expect(result.access_token).toBe('new-access')
    expect(result.refresh_token).toBe('new-refresh')
  })

  it('sends credentials as URL-encoded form body', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'Bearer' },
    })

    await refreshToken('my-client', 'my-secret', 'my-token')

    const body = mockedAxios.post.mock.calls[0][1] as string
    expect(body).toContain('client_id=my-client')
    expect(body).toContain('client_secret=my-secret')
    expect(body).toContain('refresh_token=my-token')
    expect(body).toContain('grant_type=refresh_token')
  })

  it('throws a sanitised error on axios failure', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 401, data: { error: 'invalid_client' } },
    })
    mockedAxios.post.mockRejectedValueOnce(axiosError)
    mockedAxios.isAxiosError.mockReturnValueOnce(true)

    await expect(refreshToken('id', 'secret', 'token')).rejects.toThrow(
      'TrueLayer request failed: 401 — invalid_client',
    )
  })

  it('rethrows non-axios errors', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Network failure'))
    mockedAxios.isAxiosError.mockReturnValueOnce(false)

    await expect(refreshToken('id', 'secret', 'token')).rejects.toThrow('Network failure')
  })
})

describe('listAccounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns accounts array', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [mockAccount] } })
    const result = await listAccounts('access-token')
    expect(result).toHaveLength(1)
    expect(result[0].account_id).toBe('acc-1')
  })

  it('sends Bearer token in Authorization header', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await listAccounts('my-token')
    expect(mockedAxios.get.mock.calls[0][1]?.headers?.Authorization).toBe('Bearer my-token')
  })

  it('returns empty array when no accounts', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    expect(await listAccounts('token')).toEqual([])
  })
})

describe('listCards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns cards array', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [mockCard] } })
    const result = await listCards('access-token')
    expect(result).toHaveLength(1)
    expect(result[0].account_id).toBe('card-1')
  })

  it('sends Bearer token in Authorization header', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await listCards('my-token')
    expect(mockedAxios.get.mock.calls[0][1]?.headers?.Authorization).toBe('Bearer my-token')
  })
})

describe('getAccountTransactions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns transactions array', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [mockTransaction] } })
    const result = await getAccountTransactions('token', 'acc-1')
    expect(result).toHaveLength(1)
    expect(result[0].transaction_id).toBe('txn-1')
  })

  it('passes from param when provided', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await getAccountTransactions('token', 'acc-1', '2026-04-01')
    expect(mockedAxios.get.mock.calls[0][1]?.params).toEqual({ from: '2026-04-01' })
  })

  it('passes empty params when from is not provided', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await getAccountTransactions('token', 'acc-1')
    expect(mockedAxios.get.mock.calls[0][1]?.params).toEqual({})
  })

  it('calls the correct URL', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await getAccountTransactions('token', 'acc-1')
    expect(mockedAxios.get.mock.calls[0][0]).toContain('/accounts/acc-1/transactions')
  })
})

describe('getCardTransactions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns transactions array', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [mockTransaction] } })
    const result = await getCardTransactions('token', 'card-1')
    expect(result).toHaveLength(1)
    expect(result[0].transaction_id).toBe('txn-1')
  })

  it('passes from param when provided', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await getCardTransactions('token', 'card-1', '2026-04-01')
    expect(mockedAxios.get.mock.calls[0][1]?.params).toEqual({ from: '2026-04-01' })
  })

  it('passes empty params when from is not provided', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await getCardTransactions('token', 'card-1')
    expect(mockedAxios.get.mock.calls[0][1]?.params).toEqual({})
  })

  it('calls the correct URL', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await getCardTransactions('token', 'card-1')
    expect(mockedAxios.get.mock.calls[0][0]).toContain('/cards/card-1/transactions')
  })
})

describe('request timeouts', () => {
  beforeEach(() => vi.clearAllMocks())

  const cases: Array<[string, () => Promise<unknown>]> = [
    ['listAccounts', () => listAccounts('token')],
    ['listCards', () => listCards('token')],
    ['getAccountTransactions', () => getAccountTransactions('token', 'acc-1')],
    ['getCardTransactions', () => getCardTransactions('token', 'card-1')],
  ]

  it.each(cases)('%s sets the axios timeout option (not a header)', async (_name, call) => {
    mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } })
    await call()
    const options = mockedAxios.get.mock.calls[0][1]
    expect(options?.timeout).toBe(NETWORK_TIMEOUT)
    expect(options?.headers).not.toHaveProperty('timeout')
  })
})
