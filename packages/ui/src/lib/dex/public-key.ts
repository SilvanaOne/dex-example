"use server";

import Client from "mina-signer";
import { PublicKey } from "o1js";

const MAX_BIT: bigint = 2n ** 255n;
const client = new Client({
  network: "testnet",
});

export async function publicKeyToU256(publicKey: string): Promise<bigint> {
  const raw = client.publicKeyToRaw(publicKey);
  const publicKeyBigint = BigInt("0x" + raw);
  console.log("publicKeyBigint", publicKeyBigint);
  const publicKeyInternal: PublicKey =
    typeof publicKey === "string" ? PublicKey.fromBase58(publicKey) : publicKey;
  const x = publicKeyInternal.x.toBigInt();
  const isOdd = publicKeyInternal.isOdd.toBoolean();
  const u256 = isOdd ? x + MAX_BIT : x;
  console.log("u256", u256);
  const theSame = u256 === publicKeyBigint;
  console.log("theSame", theSame);
  return u256;
}

export async function u256ToPublicKey(u256: bigint): Promise<PublicKey> {
  const isOdd = u256 >= MAX_BIT;
  const x: bigint = isOdd ? u256 - MAX_BIT : u256;
  return PublicKey.from({
    x,
    isOdd,
  });
}
