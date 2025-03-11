export enum Operation {
  CREATE_ACCOUNT = 1,
  BID = 2,
  ASK = 3,
  TRADE = 4,
  TRANSFER_BASE_TOKEN = 5,
  TRANSFER_QUOTE_TOKEN = 6,
}

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
  accounts: Record<string, UserTradingAccount>;
}

export interface Block {
  suiAddress: string;
  blockNumber: number;
  timestamp: number;
  timeSinceLastBlock: number;
  numberOfTransactions: number;
  sequences: number[];
  startActionState: bigint;
  endActionState: bigint;
  stateDataAvailability: string | null;
  proofDataAvailability: string | null;
}

export interface MinaBalance {
  amount: bigint;
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
  nonce: number;
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
