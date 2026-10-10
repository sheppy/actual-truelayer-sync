export const DEFAULT_CONSENT_WARNING_DAYS = 7

export interface ConsentInfo {
  daysLeft: number
  expiringSoon: boolean
  message: string
}

/** Summarises a TrueLayer consent expiry timestamp, or returns undefined if it is missing/invalid. */
export function describeConsent(
  expiresAt: string | undefined,
  warningDays = DEFAULT_CONSENT_WARNING_DAYS,
  now: Date = new Date(),
): ConsentInfo | undefined {
  if (!expiresAt) return undefined
  const expiry = new Date(expiresAt)
  if (Number.isNaN(expiry.getTime())) return undefined
  const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86_400_000)
  const date = expiresAt.slice(0, 10)
  const expiringSoon = daysLeft <= warningDays
  const message = expiringSoon
    ? daysLeft < 0
      ? `└ Bank consent EXPIRED on ${date}. Re-authorise this connection (npm run setup) to resume syncing.`
      : `└ Bank consent expires on ${date} (${daysLeft} day${daysLeft === 1 ? '' : 's'}). Re-authorise this connection (npm run setup) to keep syncing.`
    : `└ Bank consent valid until ${date} (${daysLeft} days).`
  return { daysLeft, expiringSoon, message }
}
