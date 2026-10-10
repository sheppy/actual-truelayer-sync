import { describe, it, expect, vi, afterEach } from 'vitest'
import { getServerVersion, getApiVersion, versionsMatch, mismatchMessage } from './version'

afterEach(() => vi.unstubAllGlobals())

describe('versionsMatch', () => {
  it('matches on major.minor', () => {
    expect(versionsMatch('26.10.0', '26.10.0')).toBe(true)
    expect(versionsMatch('26.10.1', '26.10.0')).toBe(true)
  })

  it('detects mismatches', () => {
    expect(versionsMatch('26.10.0', '26.6.0')).toBe(false)
    expect(versionsMatch('27.1.0', '26.1.0')).toBe(false)
  })
})

describe('getServerVersion', () => {
  it('reads build.version from /info', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ build: { version: '26.10.0' } })))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getServerVersion('http://actual:5006')).toBe('26.10.0')
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://actual:5006/info')
  })

  it('returns undefined when the server is unreachable or has no version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect(await getServerVersion('http://actual:5006')).toBeUndefined()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    expect(await getServerVersion('http://actual:5006')).toBeUndefined()
  })
})

describe('getApiVersion', () => {
  it('finds the installed @actual-app/api version', () => {
    expect(getApiVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('mismatchMessage', () => {
  it('names both versions and the fix', () => {
    const msg = mismatchMessage('26.10.0', '26.6.0')
    expect(msg).toContain('26.10.0')
    expect(msg).toContain('26.6.0')
    expect(msg).toContain('npm install @actual-app/api@26.10.0')
  })
})
