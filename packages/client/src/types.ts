import { u256ToPublicKey } from "./public-key.js";
import {
  serializeIndexedMap,
  IndexedMapSerialized,
} from "@silvana-one/storage";

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
  block_sequence: number;
  state: Record<string, UserTradingAccount>;
}

export interface Block {
  name: string;
  block_number: number;
  block_sequence: number;
  timestamp: number;
  time_since_last_block: number;
  number_of_transactions: number;
  sequences: number[];
  start_action_state: number[];
  end_action_state: number[];
  state_data_availability: string | null;
  proof_data_availability: string | null;
  previous_block_address: string;
  mina_tx_hash: string | null;
  mina_tx_included_in_block: number | null;
  block_state: BlockState;
}

export interface RawBlock {
  id: {
    id: string;
  };
  name: string;
  block_number: string;
  block_sequence: string;
  timestamp: string;
  time_since_last_block: string;
  number_of_transactions: string;
  sequences: string[];
  start_action_state: number[];
  end_action_state: number[];
  state_data_availability: string | null;
  proof_data_availability: string | null;
  previous_block_address: string;
  mina_tx_hash: string | null;
  mina_tx_included_in_block: string | null;
  block_state: {
    fields: {
      id: {
        id: string;
      };
      name: string;
      block_number: string;
      block_sequence: string;
      state: {
        fields: {
          contents: object[];
        };
      };
    };
  };
}

export function rawBlockToBlock(raw: RawBlock): Block {
  const blockState = raw.block_state?.fields?.state?.fields?.contents;
  if (!blockState || !Array.isArray(blockState))
    throw new Error("Invalid block state");
  return {
    name: raw.name,
    block_number: Number(raw.block_number),
    block_sequence: Number(raw.block_sequence),
    timestamp: Number(raw.timestamp),
    time_since_last_block: Number(raw.time_since_last_block),
    number_of_transactions: Number(raw.number_of_transactions),
    sequences: raw.sequences.map(Number),
    start_action_state: raw.start_action_state,
    end_action_state: raw.end_action_state,
    state_data_availability: raw.state_data_availability,
    proof_data_availability: raw.proof_data_availability,
    previous_block_address: raw.previous_block_address,
    mina_tx_hash: raw.mina_tx_hash,
    mina_tx_included_in_block: raw.mina_tx_included_in_block
      ? Number(raw.mina_tx_included_in_block)
      : null,
    block_state: {
      id: raw.block_state?.fields?.id?.id,
      name: raw.block_state?.fields?.name,
      block_number: Number(raw.block_state?.fields?.block_number),
      block_sequence: Number(raw.block_state?.fields?.block_sequence),
      state: Object.fromEntries(
        blockState.map((item: any) => {
          if (!item?.fields?.key || typeof item?.fields?.key !== "string") {
            throw new Error("block state key is not a string");
          }
          const key = u256ToPublicKey(BigInt(item.fields.key)).toBase58();
          const value = item.fields.value.fields;
          const account: UserTradingAccount = {
            baseTokenBalance: {
              amount: BigInt(value.baseTokenBalance.fields.amount),
              stakedAmount: BigInt(value.baseTokenBalance.fields.stakedAmount),
              borrowedAmount: BigInt(
                value.baseTokenBalance.fields.borrowedAmount
              ),
            },
            quoteTokenBalance: {
              amount: BigInt(value.quoteTokenBalance.fields.amount),
              stakedAmount: BigInt(value.quoteTokenBalance.fields.stakedAmount),
              borrowedAmount: BigInt(
                value.quoteTokenBalance.fields.borrowedAmount
              ),
            },
            bid: {
              amount: BigInt(value.bid.fields.amount),
              price: BigInt(value.bid.fields.price),
              isSome: value.bid.fields.isSome,
            },
            ask: {
              amount: BigInt(value.ask.fields.amount),
              price: BigInt(value.ask.fields.price),
              isSome: value.ask.fields.isSome,
            },
            nonce: BigInt(value.nonce),
          };
          return [key, account];
        })
      ),
    },
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

export function convertRawOperationEvent(
  raw: RawOperationEvent
): OperationEvent {
  const details = raw.details;
  if (details.userPublicKey) {
    details.userPublicKey = u256ToPublicKey(
      BigInt(raw.details.userPublicKey)
    ).toBase58();
  }
  if (details.userSignature) {
    details.userSignature = {
      r: BigInt(raw.details.userSignature.r),
      s: BigInt(raw.details.userSignature.s),
    };
  }
  if (details.senderSignature) {
    details.senderSignature = {
      r: BigInt(raw.details.senderSignature.r),
      s: BigInt(raw.details.senderSignature.s),
    };
  }
  if (details.amount) {
    details.amount = BigInt(raw.details.amount);
  }
  if (details.nonce) {
    details.nonce = Number(raw.details.nonce);
  }
  if (details.poolPublicKey) {
    details.poolPublicKey = u256ToPublicKey(
      BigInt(raw.details.poolPublicKey)
    ).toBase58();
  }
  if (details.price) {
    details.price = BigInt(raw.details.price);
  }
  if (details.isSome) {
    details.isSome = raw.details.isSome;
  }
  if (details.buyerPublicKey) {
    details.buyerPublicKey = u256ToPublicKey(
      BigInt(raw.details.buyerPublicKey)
    ).toBase58();
  }
  if (details.sellerPublicKey) {
    details.sellerPublicKey = u256ToPublicKey(
      BigInt(raw.details.sellerPublicKey)
    ).toBase58();
  }
  if (details.senderPublicKey) {
    details.senderPublicKey = u256ToPublicKey(
      BigInt(raw.details.senderPublicKey)
    ).toBase58();
  }
  if (details.receiverPublicKey) {
    details.receiverPublicKey = u256ToPublicKey(
      BigInt(raw.details.receiverPublicKey)
    ).toBase58();
  }
  if (details.senderNonce) {
    details.senderNonce = Number(raw.details.senderNonce);
  }
  if (details.receiverNonce) {
    details.receiverNonce = Number(raw.details.receiverNonce);
  }
  if (details.quoteAmount) {
    details.quoteAmount = BigInt(raw.details.quoteAmount);
  }
  if (details.buyerNonce) {
    details.buyerNonce = Number(raw.details.buyerNonce);
  }
  if (details.sellerNonce) {
    details.sellerNonce = Number(raw.details.sellerNonce);
  }
  if (details.baseBalance) {
    details.baseBalance = BigInt(raw.details.baseBalance);
  }
  if (details.quoteBalance) {
    details.quoteBalance = BigInt(raw.details.quoteBalance);
  }

  return {
    type: raw.type,
    details,
    operation: {
      actionState: raw.operation.actionState,
      data: raw.operation.data,
      operation: raw.operation.operation,
      pool: raw.operation.pool,
      poolPublicKey: raw.operation.poolPublicKey,
      sequence: Number(raw.operation.sequence),
      blockNumber: Number(raw.operation.block_number),
    },
  };
}

export interface BlockData {
  blockNumber: number;
  blockID: string;
  sequences: number[];
  block: Block;
  events: OperationEvent[];
  map?: IndexedMapSerialized;
}

export interface SequenceData {
  sequence: number;
  blockNumber: number;
  operation: OperationData;
  map: IndexedMapSerialized;
}

export enum ProofStatus {
  NOT_STARTED = 0,
  IN_PROGRESS = 1,
  CALCULATED = 2,
  USED = 3,
  FAILED = 4,
  REJECTED = 5,
  ABANDONED = 6,
}

export interface ProofStatusData {
  status: ProofStatus;
  timestamp?: number;
  number_of_retries: number;
  is_merge_proof: boolean;
  sequence?: number;
  operation: Operation;
  input1?: number[];
  input2?: number[];
  proof?: {
    publicInput: bigint[];
    publicOutput: bigint[];
    maxProofsVerified: number; // should be 2
    proofDataAvailabilityHash: string;
  };
  prover?: string; // Sui addresses are represented as strings
}
