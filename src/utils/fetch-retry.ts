// Retries fetch requests that fail because the connection was closed underneath them.
//
// The Actual sync server closes idle keep-alive connections after ~5s. Downloading and opening a large budget can
// take about that long, so @actual-app/api's next request (POST /sync/sync) can be sent on a socket the server has
// just closed. That surfaces as "fetch failed: other side closed" and downloadBudget() fails with "network-failure",
// intermittently. Such a request never reached the server, so retrying it on a fresh connection is safe.

const RETRYABLE = /other side closed|ECONNRESET|UND_ERR_SOCKET|socket hang up/i
const MAX_RETRIES = 3

function describeCause(err: unknown): string {
  const cause = (err as { cause?: { code?: string; message?: string } } | undefined)?.cause
  return `${cause?.code ?? ''} ${cause?.message ?? ''} ${(err as Error | undefined)?.message ?? ''}`
}

export function isStaleSocketError(err: unknown): boolean {
  return RETRYABLE.test(describeCause(err))
}

export function withStaleSocketRetry(fetchFn: typeof fetch, delayMs = 300): typeof fetch {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchFn(input, init)
      } catch (err) {
        if (attempt >= MAX_RETRIES || !isStaleSocketError(err)) throw err
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  }
}

export function installFetchRetry(): void {
  globalThis.fetch = withStaleSocketRetry(globalThis.fetch)
}
