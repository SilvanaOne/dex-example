export const DEX_SIGNATURE_CONTEXT = 7738487874684489969637964886483n;

export enum Operation {
  CREATE_ACCOUNT = 1,
  BID = 2,
  ASK = 3,
  TRADE = 4,
  TRANSFER = 5,
  // WITHDRAW = 6,
  // DEPOSIT = 7,
  // STAKE = 8,
  // UNSTAKE = 9,
  MERGE = 100,
  SETTLE = 101,
}

export const OperationNames: { [key: number]: string } = {
  0: "not_found",
  1: "OperationCreateAccount",
  2: "OperationBid",
  3: "OperationAsk",
  4: "OperationTrade",
  5: "OperationTransfer",
  100: "OperationMerge",
  101: "OperationSettle",
};

export interface MinaSignature {
  r: bigint;
  s: bigint;
}

export interface Token {
  suiAddress: string;
  minaPublicKey: string;
  minaPrivateKey?: string;
  tokenId: string;
  token: string;
  name: string;
  description: string;
  image: string;
}

export interface Pool {
  name: string;
  suiAddress: string;
  minaPublicKey: string;
  minaPrivateKey?: string;
  baseTokenId: string;
  quoteTokenId: string;
  lastPrice: bigint;
  accounts: Record<string, UserTradingAccount>;
}

export interface BlockState {
  id: string;
  name: string;
  block_number: number;
  sequence: number;
  state: Record<string, UserTradingAccount>;
}

export interface Block {
  name: string;
  block_number: number;
  start_sequence: number;
  end_sequence: number;
  timestamp: number;
  time_since_last_block: number;
  number_of_transactions: number;
  start_action_state: number[];
  end_action_state: number[];
  state_data_availability: string | null;
  proof_data_availability: string | null;
  previous_block_address: string;
  mina_tx_hash: string | null;
  mina_tx_included_in_block: boolean;
  block_state: BlockState;
}

export interface RawBlock {
  id: {
    id: string;
  };
  name: string;
  block_number: string;
  start_sequence: string;
  end_sequence: string;
  timestamp: string;
  time_since_last_block: string;
  number_of_transactions: string;
  start_action_state: number[];
  end_action_state: number[];
  state_data_availability: string | null;
  proof_data_availability: string | null;
  previous_block_address: string;
  mina_tx_hash: string | null;
  mina_tx_included_in_block: boolean;
  block_state: {
    fields: {
      id: {
        id: string;
      };
      name: string;
      block_number: string;
      sequence: string;
      state: {
        fields: {
          contents: object[];
        };
      };
    };
  };
}

export interface MinaBalance {
  amount: bigint;
  stakedAmount: bigint;
  borrowedAmount: bigint;
}

export interface Order {
  amount: bigint;
  price: bigint;
  isSome: boolean;
}

export interface UserTradingAccount {
  baseTokenBalance: MinaBalance;
  quoteTokenBalance: MinaBalance;
  bid: Order;
  ask: Order;
  nonce: bigint;
}

export interface User {
  suiAddress: string;
  minaPublicKey: string;
  minaPrivateKey?: string;
  name: string;
  role: string;
  image: string;
  account: UserTradingAccount;
}

export interface DEXState {
  poolPublicKey: string;
  root: bigint;
  length: bigint;
  actionState: bigint;
  sequence: bigint;
  blockNumber: bigint;
}

export interface OperationData {
  operation: Operation;
  sequence: number;
  blockNumber: number;
  pool: string;
  poolPublicKey: string;
  actionState: number[];
  data: number[];
}

export interface ActionCreateAccount {
  address: string;
  poolPublicKey: string;
  publicKey: string;
  publicKeyBase58: string;
  name: string;
  role: string;
  image: string;
  baseBalance: bigint;
  quoteBalance: bigint;
}

export interface ActionBid {
  userPublicKey: string;
  poolPublicKey: string;
  baseTokenAmount: bigint;
  price: bigint;
  isSome: boolean;
  nonce: bigint;
  userSignature: MinaSignature;
}

export interface ActionAsk {
  userPublicKey: string;
  poolPublicKey: string;
  baseTokenAmount: bigint;
  price: bigint;
  isSome: boolean;
  nonce: bigint;
  userSignature: MinaSignature;
}

export interface ActionTrade {
  buyerPublicKey: string;
  sellerPublicKey: string;
  poolPublicKey: string;
  baseTokenAmount: bigint;
  quoteTokenAmount: bigint;
  price: bigint;
  buyerNonce: bigint;
  sellerNonce: bigint;
}

export interface ActionTransfer {
  senderPublicKey: string;
  receiverPublicKey: string;
  baseTokenAmount: bigint;
  quoteTokenAmount: bigint;
  senderNonce: bigint;
  receiverNonce: bigint;
  senderSignature: MinaSignature;
}

export interface OperationEvent {
  type:
    | "OperationCreateAccount"
    | "OperationBid"
    | "OperationAsk"
    | "OperationTrade"
    | "OperationTransfer";
  details:
    | ActionCreateAccount
    | ActionBid
    | ActionAsk
    | ActionTrade
    | ActionTransfer;
  operation: OperationData;
}

export interface RawOperationEvent {
  type:
    | "OperationCreateAccount"
    | "OperationBid"
    | "OperationAsk"
    | "OperationTrade"
    | "OperationTransfer";
  details: any;
  operation: {
    actionState: number[];
    data: number[];
    operation: number;
    pool: string;
    poolPublicKey: string;
    sequence: string;
    block_number: string;
  };
}

export enum ProofStatus {
  CALCULATED = 1,
  REJECTED = 2,
  USED = 3,
}

export interface ProofStatusData {
  da_hash: string;
  status: ProofStatus;
  timestamp: number;
}

export interface BlockProofs {
  blockNumber: number;
  blockProof: string;
  startSequence: number;
  endSequence?: number;
  isFinished: boolean;
  proofs: { sequences: number[]; status: ProofStatusData }[];
}

export interface MergeProofRequest {
  blockNumber: number;
  proof1: { sequences: number[]; status: ProofStatusData };
  proof2: { sequences: number[]; status: ProofStatusData };
}

export type TransactionType =
  | "buy"
  | "sell"
  | "transfer"
  | "faucet"
  | "createAccount"
  | "stake"
  | "borrow"
  | "cancelBuy"
  | "cancelSell";

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
  minaTxHash?: string;
  digest: string;
  operationName: string;
  blockNumber: number;
  sequence: number;
  operation: number;
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

export interface OrderFormState {
  orderType: TransactionType;
  amount?: string;
  price?: string;
  recipient: string;
  collateral: string;
  transferCurrency: "WETH" | "WUSD" | undefined;
  stakeCurrency: "WETH" | "WUSD" | undefined;
  borrowCurrency: "WETH" | "WUSD" | undefined;
}
