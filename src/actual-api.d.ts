// @actual-app/api is a CJS module that references @actual-app/core's raw TypeScript
// source, which doesn't compile cleanly under strict mode. This ambient declaration
// overrides the module's types with just the surface area we actually use.
declare module '@actual-app/api' {
  const actual: {
    init(options: { serverURL: string; password: string; verbose?: boolean }): Promise<void>
    downloadBudget(syncId: string): Promise<void>
    importTransactions(
      accountId: string,
      transactions: {
        date: string
        amount: number
        payee_name?: string
        notes?: string
        imported_id?: string
        cleared?: boolean
        account?: string
      }[],
    ): Promise<{ errors: unknown[]; added: string[]; updated: string[] }>
    shutdown(): Promise<void>
  }
  export default actual
}
