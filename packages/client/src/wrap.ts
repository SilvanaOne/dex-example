import { PrivateKey, Signature, Field, PublicKey, Poseidon } from "o1js";
import { MinaSignature, Operation } from "./types.js";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { bcs } from "@mysten/sui/bcs";
import { publicKeyToU256 } from "./public-key.js";
import secp256k1 from "secp256k1";
import crypto from "node:crypto";

const DEX_SIGNATURE_CONTEXT = 7738487874684489969637964886483n;

/*
/*
    poolPublicKey: u256,
    operation: u8,
    accountPublicKey: u256,
    nonce: u64,
    baseTokenAmount: Option<u64>,
    quoteTokenAmount: Option<u64>,
    price: Option<u64>,
    receiverPublicKey: Option<u256>,
    receiverNonce: Option<u64>,
*/

export async function wrapMinaSignature(params: {
  minaSignature: MinaSignature;
  minaPublicKey: string;
  poolPublicKey: string;
  operation: Operation;
  nonce: number;
  baseTokenAmount?: bigint; // u64
  quoteTokenAmount?: bigint; // u64
  price?: bigint; // u64
  receiverPublicKey?: string;
}): Promise<{
  minaSignature: MinaSignature;
  suiSignature: number[];
  minaData: bigint[];
  suiData: number[];
}> {
  const {
    minaSignature,
    minaPublicKey,
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

  const minaSignatureFields = Signature.fromValue(minaSignature);
  const valid = minaSignatureFields
    .verify(PublicKey.fromBase58(minaPublicKey), minaData)
    .toBoolean();
  if (!valid) {
    throw new Error("wrapMinaSignature: Invalid mina signature");
  }

  let suiData = new Uint8Array([
    ...bcs.u256().serialize(DEX_SIGNATURE_CONTEXT).toBytes(),
    ...bcs.u256().serialize(minaSignature.r).toBytes(),
    ...bcs.u256().serialize(minaSignature.s).toBytes(),
    ...bcs.u256().serialize(publicKeyToU256(poolPublicKey)).toBytes(),
    ...bcs.u8().serialize(operation).toBytes(),
    ...bcs.u256().serialize(publicKeyToU256(minaPublicKey)).toBytes(),
    ...bcs.u64().serialize(nonce).toBytes(),
  ]);
  if (baseTokenAmount !== undefined) {
    suiData = new Uint8Array([
      ...suiData,
      ...bcs.u64().serialize(baseTokenAmount).toBytes(),
    ]);
  }
  if (quoteTokenAmount !== undefined) {
    suiData = new Uint8Array([
      ...suiData,
      ...bcs.u64().serialize(quoteTokenAmount).toBytes(),
    ]);
  }
  if (price !== undefined) {
    suiData = new Uint8Array([
      ...suiData,
      ...bcs.u64().serialize(price).toBytes(),
    ]);
  }
  if (receiverPublicKey !== undefined) {
    suiData = new Uint8Array([
      ...suiData,
      ...bcs.u256().serialize(publicKeyToU256(receiverPublicKey)).toBytes(),
    ]);
  }

  const validatorSecretKey = process.env.VALIDATOR_SECRET_KEY;
  if (!validatorSecretKey) {
    throw new Error("Missing environment variables VALIDATOR_SECRET_KEY");
  }
  const validator = Secp256k1Keypair.fromSecretKey(validatorSecretKey);
  const signedData = await validator.sign(suiData);
  const suiSignature: number[] = Array.from(signedData);
  const hash = crypto.createHash("sha256");
  hash.update(suiData);
  const messageHash = hash.digest();
  const verified = secp256k1.ecdsaVerify(
    signedData,
    messageHash,
    validator.getPublicKey().toRawBytes()
  );
  if (!verified) {
    throw new Error("Invalid sui signature");
  }

  return {
    minaSignature,
    suiSignature,
    minaData: minaData.map((d) => d.toBigInt()),
    suiData: Array.from(suiData),
  };
}
