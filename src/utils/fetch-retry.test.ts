import { describe, it, expect, vi } from 'vitest'
import { isStaleSocketError, withStaleSocketRetry } from './fetch-retry'

const staleSocket = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_SOCKET', message: 'other side closed' } })

describe('isStaleSocketError', () => {
  it('recognises undici closed-socket errors', () => {
    expect(isStaleSocketError(staleSocket())).toBe(true)
    expect(isStaleSocketError(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }))).toBe(
      true,
    )
  })

  it('ignores other errors', () => {
    expect(isStaleSocketError(new Error('invalid-password'))).toBe(false)
    expect(isStaleSocketError(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }))).toBe(
      false,
    )
  })
})

describe('withStaleSocketRetry', () => {
  it('retries a stale-socket failure and returns the next response', async () => {
    const ok = new Response('ok')
    const inner = vi.fn().mockRejectedValueOnce(staleSocket()).mockResolvedValueOnce(ok)
    const res = await withStaleSocketRetry(inner as unknown as typeof fetch, 0)('http://x/sync/sync', {
      method: 'POST',
    })
    expect(res).toBe(ok)
    expect(inner).toHaveBeenCalledTimes(2)
  })

  it('does not retry other errors', async () => {
    const inner = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withStaleSocketRetry(inner as unknown as typeof fetch, 0)('http://x')).rejects.toThrow('boom')
    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('gives up after three retries', async () => {
    const inner = vi.fn().mockRejectedValue(staleSocket())
    await expect(withStaleSocketRetry(inner as unknown as typeof fetch, 0)('http://x')).rejects.toThrow('fetch failed')
    expect(inner).toHaveBeenCalledTimes(4)
  })
})
