import axios from 'axios'
import type { TrueLayerAccount, TrueLayerCard, TrueLayerTransaction, TrueLayerTokenResponse } from './types'

const BASE_URL = 'https://api.truelayer.com/data/v1'
const AUTH_URL = 'https://auth.truelayer.com/connect/token'

function sanitiseTrueLayerError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const code = err.response?.data?.error ?? 'unknown_error'
    throw new Error(`TrueLayer request failed: ${status ?? 'no status'} — ${code}`)
  }
  throw err
}

export async function refreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string }> {
  try {
    const res = await axios.post<TrueLayerTokenResponse>(
      AUTH_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )
    return { access_token: res.data.access_token, refresh_token: res.data.refresh_token }
  } catch (err) {
    sanitiseTrueLayerError(err)
  }
}

export async function listAccounts(accessToken: string): Promise<TrueLayerAccount[]> {
  const res = await axios.get<{ results: TrueLayerAccount[] }>(`${BASE_URL}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.data.results
}

export async function listCards(accessToken: string): Promise<TrueLayerCard[]> {
  const res = await axios.get<{ results: TrueLayerCard[] }>(`${BASE_URL}/cards`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.data.results
}

export async function getAccountTransactions(
  accessToken: string,
  accountId: string,
  from?: string,
): Promise<TrueLayerTransaction[]> {
  const params = from ? { from } : {}
  const res = await axios.get<{ results: TrueLayerTransaction[] }>(`${BASE_URL}/accounts/${accountId}/transactions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  })
  return res.data.results
}

export async function getCardTransactions(
  accessToken: string,
  cardId: string,
  from?: string,
): Promise<TrueLayerTransaction[]> {
  const params = from ? { from } : {}
  const res = await axios.get<{ results: TrueLayerTransaction[] }>(`${BASE_URL}/cards/${cardId}/transactions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  })
  return res.data.results
}
