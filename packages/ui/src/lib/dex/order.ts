"use server";
import { getConfig } from "./config";
import { publicKeyToU256 } from "./public-key";
import { Transaction } from "@mysten/sui/transactions";
import { getKey, getUserKey } from "./key";
import { suiClient } from "./sui-client";
import { executeTx } from "./execute";
import { fetchDexAccount } from "./fetch";
import { Operation } from "./types";
import { prepareSignPayload, convertMinaSignature } from "./sign";
import { wrapMinaSignature } from "./wrap";

export type TransactionType = "buy" | "sell" | "transfer";

const poolPublicKey: string = process.env.POOL_PUBLIC_KEY!;

if (!poolPublicKey) {
  throw new Error("POOL PUBLIC KEY is not set");
}

export async function prepareOrderPayload(params: {
  user: string;
  amount: number;
  price?: number;
  recipient?: string;
  type: TransactionType;
}): Promise<{
  payload: bigint[];
  amount: bigint;
  price?: bigint;
  recipient?: string;
  nonce: bigint;
}> {
  const { user, type } = params;
  const config = await getConfig();
  const u256 = await publicKeyToU256(user);
  const u256String = u256.toString();
  const packageID = config.dex_package;
  const dexID = config.dex_object;

  if (!packageID) {
    throw new Error("PACKAGE_ID is not set");
  }

  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }

  const userAccount = await fetchDexAccount({ addressU256: u256String });
  if (!userAccount) {
    throw new Error("Cannot fetch accounts");
  }
  let nonce = userAccount.nonce;
  let amount: bigint | undefined = BigInt(params.amount * 1_000_000) * 1000n;
  let price: bigint | undefined = undefined;
  let recipient: string | undefined = undefined;
  if (type === "buy" || type === "sell") {
    if (!params.price) {
      throw new Error("Price is not set");
    }
    price = BigInt(params.price * 1_000_000) * 1000n;
  }
  if (type === "transfer") {
    if (!params.recipient) {
      throw new Error("Recipient is not set");
    }
    recipient = params.recipient;
  }

  let operation =
    params.type === "buy"
      ? Operation.BID
      : params.type === "sell"
      ? Operation.ASK
      : Operation.TRANSFER;

  const payload = await prepareSignPayload({
    poolPublicKey: poolPublicKey,
    operation,
    nonce,
    baseTokenAmount: amount,
    price: price,
    receiverPublicKey: recipient,
  });
  return { payload: payload.minaData, amount, price, recipient, nonce };
}

export async function order(params: {
  user: string;
  amount: bigint;
  price?: bigint;
  recipient?: string;
  nonce: bigint;
  payload: bigint[];
  signature: string;
  type: TransactionType;
  key?: string;
}): Promise<{ digest: string; prepareDelay: number; executeDelay: number }> {
  const start = Date.now();
  const { user, amount, price, payload, type } = params;
  let keyPromise: Promise<string> | undefined = undefined;
  if (params.key) {
    keyPromise = undefined;
  } else {
    keyPromise = getUserKey();
  }
  const u256 = await publicKeyToU256(params.user);
  const u256String = u256.toString();
  const userAccountPromise = fetchDexAccount({ addressU256: u256String });
  const config = await getConfig();

  const userAccount = await userAccountPromise;
  if (!userAccount) {
    throw new Error("Cannot fetch accounts");
  }

  const packageID = config.dex_package;
  const dexID = config.dex_object;
  if (!packageID) {
    throw new Error("PACKAGE_ID is not set");
  }

  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }

  const signature = await convertMinaSignature(params.signature);

  let nonce = userAccount.nonce;
  if (nonce !== params.nonce) {
    throw new Error("Nonce mismatch");
  }

  const tx = new Transaction();

  console.time("bid state");
  const { minaSignature, suiSignature } = await wrapMinaSignature({
    minaSignature: signature,
    minaPublicKey: user,
    poolPublicKey: poolPublicKey,
    operation: Operation.BID,
    nonce,
    baseTokenAmount: amount,
    price: price,
  });

  if (!amount || !price) {
    throw new Error("Amount or price is not set");
  }

  const bidArguments = [
    tx.object(dexID),
    tx.pure.u256(u256),
    tx.pure.u64(amount),
    tx.pure.u64(price),
    tx.pure.u256(minaSignature.r),
    tx.pure.u256(minaSignature.s),
    tx.pure.vector("u8", suiSignature),
  ];

  tx.moveCall({
    package: packageID,
    module: "transactions",
    function: "bid",
    arguments: bidArguments,
  });

  const key = params.key ?? (await keyPromise);
  const { address, keypair } = await getKey({
    secretKey: key,
    name: "user",
  });

  tx.setSender(address);
  tx.setGasBudget(10_000_000);

  const signedTx = await tx.sign({
    signer: keypair,
    client: suiClient,
  });

  const end = Date.now();
  const prepareDelay = end - start;
  const { digest, executeDelay } = await executeTx(signedTx);
  console.log("Bid:", {
    digest,
    prepareDelay,
    executeDelay,
  });

  return { digest, prepareDelay, executeDelay };
}
