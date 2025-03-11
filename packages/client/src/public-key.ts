import { PublicKey } from "o1js";

const MAX_BIT: bigint = 2n ** 255n;

export function publicKeyToU256(publicKey: PublicKey | string): bigint {
  const publicKeyInternal: PublicKey =
    typeof publicKey === "string" ? PublicKey.fromBase58(publicKey) : publicKey;
  const x = publicKeyInternal.x.toBigInt();
  const isOdd = publicKeyInternal.isOdd.toBoolean();
  return isOdd ? x + MAX_BIT : x;
}

export function u256ToPublicKey(u256: bigint): PublicKey {
  const isOdd = u256 >= MAX_BIT;
  const x: bigint = isOdd ? u256 - MAX_BIT : u256;
  return PublicKey.from({
    x,
    isOdd,
  });
}
