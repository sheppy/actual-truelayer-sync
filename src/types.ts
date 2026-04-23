export type Secrets = {
  clientId: string
  clientSecret: string
}

export type Account = {
  truelayerId: string
  actualId: string
  friendlyName: string
}

export type Connection = {
  name: string
  refreshToken: string
  accounts: Account[]
}

export type TrueLayerTokenResponse = {
  access_token: string
  expires_in: number
  refresh_token: string
  token_type: string
  scope?: string
}

type TrueLayerCurrency = 'EUR' | 'GBP' | 'USD' | 'AUD'

export type TrueLayerTransaction = {
  transaction_id: string
  normalised_provider_transaction_id?: string
  provider_transaction_id?: string
  timestamp: string
  description: string
  amount: number
  currency: TrueLayerCurrency
  transaction_type: 'DEBIT' | 'CREDIT'
  transaction_category:
    | 'ATM'
    | 'BILL_PAYMENT'
    | 'CASH'
    | 'CASHBACK'
    | 'CHEQUE'
    | 'CORRECTION'
    | 'CREDIT'
    | 'DIRECT_DEBIT'
    | 'DIVIDEND'
    | 'FEE_CHARGE'
    | 'INTEREST'
    | 'OTHER'
    | 'PURCHASE'
    | 'STANDING_ORDER'
    | 'TRANSFER'
    | 'DEBIT'
    | 'UNKNOWN'
  transaction_classification: string[]
  merchant_name?: string
  running_balance?: {
    amount?: number
    currency?: TrueLayerCurrency
  }
  meta?: {
    provider_transaction_category?: string
    provider_reference?: string
    provider_merchant_name?: string
    provider_category?: string
    address?: string
    provider_id?: string
    counter_party_preferred_name?: string
    counter_party_iban?: string
    user_comments?: string
    debtor_account_name?: string
    provider_source?: string
  }
}
