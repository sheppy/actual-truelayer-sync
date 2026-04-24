import type { TrueLayerTransaction, TrueLayerAccount, TrueLayerCard } from './types'
import type { Account } from './config'

export interface ActualTransaction {
  account: string
  date: string
  amount: number
  payee_name: string
  imported_id: string
  notes?: string
  cleared: boolean
}

export function shouldFlipAmount(
  configAccount: Account,
  trueLayerAccount: TrueLayerAccount | TrueLayerCard | undefined,
): boolean {
  // Determine flip: explicit config takes precedence, then infer from card_type === 'CREDIT'
  if (configAccount.flip !== undefined) {
    return configAccount.flip
  }

  if (trueLayerAccount !== undefined && 'card_type' in trueLayerAccount && trueLayerAccount.card_type === 'CREDIT') {
    return true
  }

  return false
}

export function toActualAmount(amount: number, shouldFlip: boolean): number {
  return Math.round(amount * 100) * (shouldFlip ? -1 : 1)
}

export function transformTransaction(
  trueLayerTransaction: TrueLayerTransaction,
  configAccount: Account,
  trueLayerAccount: TrueLayerAccount | TrueLayerCard | undefined,
  includeCategoryInNotes: boolean,
): ActualTransaction {
  return {
    account: configAccount.actualId,
    date: trueLayerTransaction.timestamp.split('T')[0]!,
    amount: toActualAmount(trueLayerTransaction.amount, shouldFlipAmount(configAccount, trueLayerAccount)),
    payee_name: trueLayerTransaction.description,
    imported_id: trueLayerTransaction.transaction_id,
    notes:
      includeCategoryInNotes && trueLayerTransaction.transaction_category !== 'UNKNOWN'
        ? trueLayerTransaction.transaction_category
        : undefined,
    cleared: true,
  }
}

export function transformTransactions(
  trueLayerTransactions: TrueLayerTransaction[],
  configAccount: Account,
  trueLayerAccount: TrueLayerAccount | TrueLayerCard | undefined,
  includeCategoryInNotes: boolean,
): ActualTransaction[] {
  return trueLayerTransactions.map((t) =>
    transformTransaction(t, configAccount, trueLayerAccount, includeCategoryInNotes),
  )
}
