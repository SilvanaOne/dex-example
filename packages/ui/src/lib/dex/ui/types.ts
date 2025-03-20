export interface MinaBalance {
  amount: bigint
  stakedAmount: bigint
  borrowedAmount: bigint
  pendingDeposits: bigint
  pendingWithdrawals: bigint
}

export interface Order {
  amount: bigint
  price: bigint
  isSome: boolean
}

export interface PendingTransaction {
  id: string
  amount: bigint
  currency: "WETH" | "WUSD"
  timestamp: number
  confirmations: number
  estimatedTimeRemaining: number
}

export interface UserTradingAccount {
  baseTokenBalance: MinaBalance
  quoteTokenBalance: MinaBalance
  bid: Order
  ask: Order
  nonce: bigint
  pendingDeposits: PendingTransaction[]
  pendingWithdrawals: PendingTransaction[]
}

