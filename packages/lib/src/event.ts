import { RawOperationEvent, OperationEvent } from "./types.js";
import { u256ToPublicKey } from "./public-key.js";

export function convertRawOperationEvent(
  raw: RawOperationEvent
): OperationEvent {
  const details = raw.details;
  if (details.userPublicKey) {
    details.userPublicKey = u256ToPublicKey(BigInt(raw.details.userPublicKey));
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
    details.poolPublicKey = u256ToPublicKey(BigInt(raw.details.poolPublicKey));
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
    );
  }
  if (details.sellerPublicKey) {
    details.sellerPublicKey = u256ToPublicKey(
      BigInt(raw.details.sellerPublicKey)
    );
  }
  if (details.senderPublicKey) {
    details.senderPublicKey = u256ToPublicKey(
      BigInt(raw.details.senderPublicKey)
    );
  }
  if (details.receiverPublicKey) {
    details.receiverPublicKey = u256ToPublicKey(
      BigInt(raw.details.receiverPublicKey)
    );
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
