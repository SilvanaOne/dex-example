export type TransactionType =
  | "buy"
  | "sell"
  | "transfer"
  | "faucet"
  | "createAccount"
  | "stake"
  | "borrow";

// export interface MinaBalance {
//   amount: bigint;
//   stakedAmount: bigint;
//   borrowedAmount: bigint;
//   pendingDeposits: bigint;
//   pendingWithdrawals: bigint;
// }

// export interface Order {
//   amount: bigint;
//   price: bigint;
//   isSome: boolean;
// }

export interface PendingTransaction {
  id: string;
  amount: bigint;
  currency: "WETH" | "WUSD";
  timestamp: number;
  confirmations: number;
  estimatedTimeRemaining: number;
}

// export interface UserTradingAccount {
//   baseTokenBalance: MinaBalance
//   quoteTokenBalance: MinaBalance
//   bid: Order
//   ask: Order
//   nonce: bigint
//   pendingDeposits: PendingTransaction[]
//   pendingWithdrawals: PendingTransaction[]
// }

export interface PendingTransactions {
  pendingDeposits: PendingTransaction[];
  pendingWithdrawals: PendingTransaction[];
}

export interface TransactionProof {
  id: number;
  proofCount: number;
  storageHash: string;
  time: string;
}

export interface TransactionError {
  code: string;
  message: string;
  severity: "warning" | "error";
}

export interface LastTransactionData {
  prepareTime: number;
  executeTime: number;
  indexTime?: number;
  zkBlockNumber?: number;
  zkCoordinationHash: string;
  minaTxHash?: string;
  proofs?: TransactionProof[];
  errors?: TransactionError[];
}

export interface LastTransactionErrors {
  errors?: TransactionError[];
}

export interface NetworkInfoData {
  l1Settlement: string;
  minaChainId: string;
  minaContractAddress: string;
  minaCircuitId: string;
  zkCoordination: string;
  suiAddress: string;
  dataAvailability: string;
  wallet: string;
  lastBlockNumber: number;
  lastProvedBlockNumber: number;
  sequence: number;
  circuitDaHash: string;
}
