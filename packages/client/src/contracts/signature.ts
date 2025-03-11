import { Field, Poseidon, PublicKey, UInt64 } from "o1js";
import { MinaSignature, Operation, DEX_SIGNATURE_CONTEXT } from "../types.js";

export function getMinaSignatureData(params: {
  publicKey: PublicKey;
  poolPublicKey: PublicKey;
  operation: Operation;
  nonce: UInt64;
  amount?: UInt64;
  price?: UInt64;
  receiverPublicKey?: PublicKey;
}) {
  const {
    publicKey,
    poolPublicKey,
    operation,
    nonce,
    amount,
    price,
    receiverPublicKey,
  } = params;
  const minaData: Field[] = [
    Field(DEX_SIGNATURE_CONTEXT),
    Poseidon.hashPacked(PublicKey, poolPublicKey),
    Field(operation),
    nonce.value,
  ];
  if (amount !== undefined) minaData.push(amount.value);
  if (price !== undefined) minaData.push(price.value);
  if (receiverPublicKey !== undefined)
    minaData.push(Poseidon.hashPacked(PublicKey, receiverPublicKey));
  return minaData;
}
