import {
  ZkProgram,
  Field,
  Cache,
  PublicKey,
  SelfProof,
  Provable,
  Poseidon,
  Struct,
  Experimental,
  UInt64,
  Bool,
  Signature,
} from "o1js";
import {
  Operation,
  UserTradingAccount,
  ActionCreateAccount,
  ActionBid,
  ActionAsk,
  ActionTrade,
  ActionTransferBaseToken,
  ActionTransferQuoteToken,
} from "../types.js";

export const DEX_HEIGHT = 10; // TODO: change to 20 in production
const IndexedMerkleMap = Experimental.IndexedMerkleMap;
type IndexedMerkleMap = Experimental.IndexedMerkleMap;

export class DEXMap extends IndexedMerkleMap(DEX_HEIGHT) {}

export class DEXState extends Struct({
  poolPublicKey: PublicKey,
  root: Field,
  actionState: Field,
  sequence: UInt64,
}) {
  static assertEquals(a: DEXState, b: DEXState) {
    a.poolPublicKey.assertEquals(b.poolPublicKey);
    a.root.assertEquals(b.root);
    a.actionState.assertEquals(b.actionState);
    a.sequence.assertEquals(b.sequence);
  }
}

export class RollupMinaBalance extends Struct({
  amount: UInt64,
  borrowedAmount: UInt64,
}) {}

export class RollupOrder extends Struct({
  amount: UInt64,
  price: UInt64,
}) {}

export class RollupUserTradingAccount extends Struct({
  baseTokenBalance: RollupMinaBalance,
  quoteTokenBalance: RollupMinaBalance,
  bid: RollupOrder,
  ask: RollupOrder,
  nonce: UInt64,
}) {
  hash(): Field {
    return Poseidon.hashPacked(RollupUserTradingAccount, this);
  }

  fromAccountData(accountData: UserTradingAccount): RollupUserTradingAccount {
    return new RollupUserTradingAccount({
      baseTokenBalance: new RollupMinaBalance({
        amount: UInt64.from(accountData.baseTokenBalance.amount),
        borrowedAmount: UInt64.from(
          accountData.baseTokenBalance.borrowedAmount
        ),
      }),
      quoteTokenBalance: new RollupMinaBalance({
        amount: UInt64.from(accountData.quoteTokenBalance.amount),
        borrowedAmount: UInt64.from(
          accountData.quoteTokenBalance.borrowedAmount
        ),
      }),
      bid: new RollupOrder({
        amount: UInt64.from(accountData.bid.amount),
        price: UInt64.from(accountData.bid.price),
      }),
      ask: new RollupOrder({
        amount: UInt64.from(accountData.ask.amount),
        price: UInt64.from(accountData.ask.price),
      }),
      nonce: UInt64.from(accountData.nonce),
    });
  }
}

/*

export interface ActionCreateAccount {
  address: string;
  publicKey: string;
  publicKeyBase58: string;
  name: string;
  role: string;
  image: string;
  baseBalance: bigint;
  quoteBalance: bigint;
}
  */

export class RollupActionCreateAccount extends Struct({
  publicKey: PublicKey,
  baseBalance: UInt64, // TODO: remove in production
  quoteBalance: UInt64, // TODO: remove in production
}) {
  fromAction(action: ActionCreateAccount): RollupActionCreateAccount {
    return new RollupActionCreateAccount({
      publicKey: PublicKey.fromBase58(action.publicKey),
      baseBalance: UInt64.from(action.baseBalance),
      quoteBalance: UInt64.from(action.quoteBalance),
    });
  }
}

/*
export interface ActionBid {
  userPublicKey: string;
  poolPublicKey: string;
  amount: bigint;
  price: bigint;
  isSome: boolean;
  nonce: number;
  userSignature: MinaSignature;
}
*/

export class RollupActionBid extends Struct({
  userPublicKey: PublicKey,
  amount: UInt64,
  price: UInt64,
  nonce: UInt64,
  userSignature: Signature,
}) {
  fromAction(action: ActionBid): RollupActionBid {
    return new RollupActionBid({
      userPublicKey: PublicKey.fromBase58(action.userPublicKey),
      amount: UInt64.from(action.amount),
      price: UInt64.from(action.price),
      nonce: UInt64.from(action.nonce),
      userSignature: Signature.fromValue(action.userSignature),
    });
  }
}

/*
export interface ActionAsk {
  userPublicKey: string;
  poolPublicKey: string;
  amount: bigint;
  price: bigint;
  isSome: boolean;
  nonce: number;
  userSignature: MinaSignature;
}
*/

export class RollupActionAsk extends Struct({
  userPublicKey: PublicKey,
  amount: UInt64,
  price: UInt64,
  nonce: UInt64,
  userSignature: Signature,
}) {
  fromAction(action: ActionAsk): RollupActionAsk {
    return new RollupActionAsk({
      userPublicKey: PublicKey.fromBase58(action.userPublicKey),
      amount: UInt64.from(action.amount),
      price: UInt64.from(action.price),
      nonce: UInt64.from(action.nonce),
      userSignature: Signature.fromValue(action.userSignature),
    });
  }
}

/*
export interface ActionTrade {
  buyerPublicKey: string;
  sellerPublicKey: string;
  poolPublicKey: string;
  amount: bigint;
  quoteAmount: bigint;
  price: bigint;
  buyerNonce: number;
  sellerNonce: number;
}

*/

export class RollupActionTrade extends Struct({
  buyerPublicKey: PublicKey,
  sellerPublicKey: PublicKey,
  amount: UInt64,
  quoteAmount: UInt64,
  price: UInt64,
}) {
  fromAction(action: ActionTrade): RollupActionTrade {
    return new RollupActionTrade({
      buyerPublicKey: PublicKey.fromBase58(action.buyerPublicKey),
      sellerPublicKey: PublicKey.fromBase58(action.sellerPublicKey),
      amount: UInt64.from(action.amount),
      quoteAmount: UInt64.from(action.quoteAmount),
      price: UInt64.from(action.price),
    });
  }
}

/*

export interface ActionTransferBaseToken {
  senderPublicKey: string;
  receiverPublicKey: string;
  amount: bigint;
  senderNonce: number;
  receiverNonce: number;
  senderSignature: MinaSignature;
}
  */

export class RollupActionTransferBaseToken extends Struct({
  senderPublicKey: PublicKey,
  receiverPublicKey: PublicKey,
  amount: UInt64,
  senderNonce: UInt64,
  senderSignature: Signature,
}) {
  fromAction(action: ActionTransferBaseToken): RollupActionTransferBaseToken {
    return new RollupActionTransferBaseToken({
      senderPublicKey: PublicKey.fromBase58(action.senderPublicKey),
      receiverPublicKey: PublicKey.fromBase58(action.receiverPublicKey),
      amount: UInt64.from(action.amount),
      senderNonce: UInt64.from(action.senderNonce),
      senderSignature: Signature.fromValue(action.senderSignature),
    });
  }
}

/*

export interface ActionTransferQuoteToken {
  senderPublicKey: string;
  receiverPublicKey: string;
  amount: bigint;
  senderNonce: number;
  receiverNonce: number;
  senderSignature: MinaSignature;
}
*/

export class RollupActionTransferQuoteToken extends Struct({
  senderPublicKey: PublicKey,
  receiverPublicKey: PublicKey,
  amount: UInt64,
  senderNonce: UInt64,
  senderSignature: Signature,
}) {
  fromAction(action: ActionTransferQuoteToken): RollupActionTransferQuoteToken {
    return new RollupActionTransferQuoteToken({
      senderPublicKey: PublicKey.fromBase58(action.senderPublicKey),
      receiverPublicKey: PublicKey.fromBase58(action.receiverPublicKey),
      amount: UInt64.from(action.amount),
      senderNonce: UInt64.from(action.senderNonce),
      senderSignature: Signature.fromValue(action.senderSignature),
    });
  }
}
