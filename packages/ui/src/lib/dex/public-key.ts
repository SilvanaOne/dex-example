"use server";

import Client from "mina-signer";

const MAX_BIT: bigint = 2n ** 255n;
const client = new Client({
  network: "testnet",
});

export async function publicKeyToU256(publicKey: string): Promise<bigint> {
  const raw = client.publicKeyToRaw(publicKey);
  const swappedRaw =
    raw
      .match(/.{1,2}/g)
      ?.reverse()
      .join("") || "";
  const u256 = BigInt("0x" + swappedRaw);
  // console.log("publicKeyBigint", publicKeyBigint);
  // const publicKeyInternal: PublicKey =
  //   typeof publicKey === "string" ? PublicKey.fromBase58(publicKey) : publicKey;
  // const x = publicKeyInternal.x.toBigInt();
  // const isOdd = publicKeyInternal.isOdd.toBoolean();
  // const u256 = isOdd ? x + MAX_BIT : x;
  // console.log("publicKeyBigint", publicKeyBigint);
  // console.log("u256", u256);
  // const theSame = u256 === publicKeyBigint;
  // console.log("theSame", theSame);

  return u256;
}
