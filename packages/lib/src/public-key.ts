import Client from "mina-signer";

const client = new Client({
  network: "testnet",
});

export function publicKeyToU256(publicKey: string): bigint {
  const raw = client.publicKeyToRaw(publicKey);
  const swappedRaw =
    raw
      .match(/.{1,2}/g)
      ?.reverse()
      .join("") || "";
  const u256 = BigInt("0x" + swappedRaw);
  return u256;
}

const MAX_BIT: bigint = 2n ** 255n;

export function convertMinaPublicKey(publicKey: string): {
  x: bigint;
  isOdd: boolean;
} {
  const u256 = publicKeyToU256(publicKey);
  const isOdd = (u256 & MAX_BIT) != 0n;
  const x = u256 - (isOdd ? MAX_BIT : 0n);
  return { x, isOdd };
}

export function convertMinaPublicKeyToFields(publicKey?: string): bigint[] {
  if (!publicKey) return [];
  const { x, isOdd } = convertMinaPublicKey(publicKey);
  return [x, isOdd ? 1n : 0n];
}

export function signFields(params: {
  privateKey: string;
  fields: bigint[];
}): string {
  const { privateKey, fields } = params;
  const signedData = client.signFields(fields, privateKey);
  return signedData.signature;
}

export function verifyFields(params: {
  publicKey: string;
  fields: bigint[];
  signature: string;
}): boolean {
  const { publicKey, fields, signature } = params;
  return client.verifyFields({ data: fields, publicKey, signature });
}
