import { describe, it, expect } from 'vitest'
import { describeConsent } from './consent'

const now = new Date('2026-10-10T12:00:00Z')

describe('describeConsent', () => {
  it('returns undefined when there is no expiry', () => {
    expect(describeConsent(undefined, 7, now)).toBeUndefined()
    expect(describeConsent('not-a-date', 7, now)).toBeUndefined()
  })

  it('reports a valid consent as informational', () => {
    const info = describeConsent('2027-01-08T07:18:58Z', 7, now)
    expect(info).toMatchObject({ daysLeft: 89, expiringSoon: false })
    expect(info?.message).toContain('valid until 2027-01-08')
  })

  it('warns within the warning window', () => {
    const info = describeConsent('2026-10-15T12:00:00Z', 7, now)
    expect(info).toMatchObject({ daysLeft: 5, expiringSoon: true })
    expect(info?.message).toContain('expires on 2026-10-15 (5 days)')
  })

  it('flags an expired consent', () => {
    const info = describeConsent('2026-10-01T00:00:00Z', 7, now)
    expect(info?.expiringSoon).toBe(true)
    expect(info?.message).toContain('EXPIRED on 2026-10-01')
  })

  it('honours a custom warning window', () => {
    expect(describeConsent('2026-11-01T12:00:00Z', 30, now)?.expiringSoon).toBe(true)
    expect(describeConsent('2026-11-01T12:00:00Z', 7, now)?.expiringSoon).toBe(false)
  })
})
