import fs from 'node:fs'
import path from 'node:path'

// @actual-app/api must match the Actual server's version: a client older than the server cannot open budgets
// that have newer database migrations applied ("out-of-sync-migrations"), even brand-new ones.

export async function getServerVersion(serverURL: string): Promise<string | undefined> {
  try {
    const res = await fetch(new URL('/info', serverURL), { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return undefined
    const body = (await res.json()) as { build?: { version?: string } }
    return body.build?.version
  } catch {
    return undefined
  }
}

// The package's "exports" map doesn't expose package.json, so find it next to the resolved entry point.
export function getApiVersion(): string | undefined {
  try {
    let dir = path.dirname(require.resolve('@actual-app/api'))
    for (let i = 0; i < 5; i++, dir = path.dirname(dir)) {
      const pkgPath = path.join(dir, 'package.json')
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string }
        if (pkg.name === '@actual-app/api') return pkg.version
      }
    }
  } catch {
    // fall through
  }
  return undefined
}

export function versionsMatch(serverVersion: string, apiVersion: string): boolean {
  const majorMinor = (v: string) => v.split('.').slice(0, 2).join('.')
  return majorMinor(serverVersion) === majorMinor(apiVersion)
}

export function mismatchMessage(serverVersion: string, apiVersion: string): string {
  return (
    `Actual server is ${serverVersion} but @actual-app/api is ${apiVersion}. ` +
    `Mismatched versions fail with "out-of-sync-migrations". ` +
    `Install the matching client (npm install @actual-app/api@${serverVersion}) and rebuild.`
  )
}
