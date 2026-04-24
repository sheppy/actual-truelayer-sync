export type TrueLayerAccount = {
  update_timestamp: string
  account_id: string
  account_type: 'TRANSACTION' | 'SAVINGS' | 'BUSINESS_TRANSACTION' | 'BUSINESS_SAVINGS'
  currency: TrueLayerCurrency
  display_name: string
  account_number: {
    number?: string
    sort_code?: string
    swift_bic?: string
    iban?: string
    routing_number?: string
    bsb?: string
  }
  provider: {
    provider_id: string
  }
}

export type TrueLayerCard = {
  account_id: string
  card_network: string
  card_type: string
  currency: TrueLayerCurrency
  display_name: string
  partial_card_number: string
  name_on_card: string
  valid_from?: string
  valid_to?: string
  update_timestamp: string
  provider: {
    provider_id: string
  }
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
