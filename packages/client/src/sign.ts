import { PrivateKey, Signature, Field, PublicKey, Poseidon } from "o1js";
import { MinaSignature, Operation, DEX_SIGNATURE_CONTEXT } from "./types.js";

export async function signDexFields(params: {
  minaPrivateKey: string;
  poolPublicKey: string;
  operation: Operation;
  nonce: bigint;
  baseTokenAmount?: bigint; // u64
  quoteTokenAmount?: bigint; // u64
  price?: bigint; // u64
  receiverPublicKey?: string;
}): Promise<{
  minaSignature: MinaSignature;
  minaData: bigint[];
}> {
  const {
    minaPrivateKey,
    poolPublicKey,
    operation,
    nonce,
    baseTokenAmount,
    quoteTokenAmount,
    price,
    receiverPublicKey,
  } = params;
  const poolPublicKeyFields = PublicKey.fromBase58(poolPublicKey);
  const minaData: Field[] = [
    Field(DEX_SIGNATURE_CONTEXT),
    Poseidon.hashPacked(PublicKey, poolPublicKeyFields),
    Field(operation),
    Field(nonce),
  ];
  if (baseTokenAmount !== undefined) minaData.push(Field(baseTokenAmount));
  if (quoteTokenAmount !== undefined) minaData.push(Field(quoteTokenAmount));
  if (price !== undefined) minaData.push(Field(price));
  if (receiverPublicKey !== undefined)
    minaData.push(
      Poseidon.hashPacked(PublicKey, PublicKey.fromBase58(receiverPublicKey))
    );

  const privateKey = PrivateKey.fromBase58(minaPrivateKey);
  const minaSignatureFields = Signature.create(privateKey, minaData);
  const minaSignature = {
    r: minaSignatureFields.r.toBigInt(),
    s: minaSignatureFields.s.toBigInt(),
  };
  const minaSignatureFieldsCheck = Signature.fromValue(minaSignature);
  const valid = minaSignatureFieldsCheck
    .verify(privateKey.toPublicKey(), minaData)
    .toBoolean();
  if (!valid) {
    throw new Error("signDexFields: Invalid mina signature");
  }

  return {
    minaSignature,
    minaData: minaData.map((d) => d.toBigInt()),
  };
}
