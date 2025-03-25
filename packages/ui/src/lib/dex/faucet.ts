"use server";
import { getConfig } from "./config";
import { publicKeyToU256 } from "./public-key";
import { Transaction } from "@mysten/sui/transactions";
import { getKey } from "./key";
import { suiClient } from "./sui-client";
import { executeTx } from "./execute";
import { fetchDexAccount } from "./fetch";
import { Operation } from "./types";
import { signDexFields } from "./sign";
import { wrapMinaSignature } from "./wrap";
import { LastTransactionData } from "./ui/types";

const faucetSecretKey: string = process.env.SECRET_KEY_3!;
const faucetPublicKey: string = process.env.NEXT_PUBLIC_FAUCET_PUBLIC_KEY!;
const faucetPrivateKey: string = process.env.FAUCET_PRIVATE_KEY!;
if (!faucetSecretKey) {
  throw new Error("Missing environment variables");
}
if (!faucetPublicKey) {
  throw new Error("FAUCET PUBLIC KEY is not set");
}

if (!faucetPrivateKey) {
  throw new Error("FAUCET PRIVATE KEY is not set");
}

export async function faucet(
  user: string
): Promise<Partial<LastTransactionData>> {
  const start = Date.now();
  const config = await getConfig();
  const u256 = await publicKeyToU256(user);
  const u256String = u256.toString();
  const packageID = config.dex_package;
  const poolPublicKey = config.mina_contract;
  const dexID = config.dex_object;
  if (!packageID) {
    throw new Error("PACKAGE_ID is not set");
  }

  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }

  if (!poolPublicKey) {
    throw new Error("POOL PUBLIC KEY is not set");
  }

  const { address, keypair } = await getKey({
    secretKey: faucetSecretKey,
    name: "faucet",
  });

  const faucetU256 = await publicKeyToU256(faucetPublicKey);

  const faucetAccount = await fetchDexAccount({
    addressU256: faucetU256.toString(),
  });
  const userAccount = await fetchDexAccount({ addressU256: u256String });
  if (!faucetAccount || !userAccount) {
    throw new Error("Cannot fetch accounts");
  }
  let nonce = faucetAccount.nonce;

  const tx = new Transaction();

  const baseTokenAmount = 10_000_000_000n;
  const quoteTokenAmount = 20_000_000_000_000n;

  const faucetSignature = await signDexFields({
    minaPrivateKey: faucetPrivateKey,
    poolPublicKey: poolPublicKey,
    operation: Operation.TRANSFER,
    nonce,
    baseTokenAmount,
    quoteTokenAmount,
    receiverPublicKey: user,
  });

  const { minaSignature, suiSignature } = await wrapMinaSignature({
    minaSignature: faucetSignature.minaSignature,
    minaPublicKey: faucetPublicKey,
    poolPublicKey: poolPublicKey,
    operation: Operation.TRANSFER,
    nonce,
    baseTokenAmount,
    quoteTokenAmount,
    receiverPublicKey: user,
  });
  nonce++;

  /*
        public fun transfer(
            dex: &mut DEX,
            senderPublicKey: u256,
            receiverPublicKey: u256,
            baseTokenAmount: u64,
            quoteTokenAmount: u64,
            senderSignature_r: u256,
            senderSignature_s: u256,
            validatorSignature: vector<u8>,
    */

  const userTopupArguments = [
    tx.object(dexID),
    tx.pure.u256(await publicKeyToU256(faucetPublicKey)),
    tx.pure.u256(await publicKeyToU256(user)),
    tx.pure.u64(baseTokenAmount),
    tx.pure.u64(quoteTokenAmount),
    tx.pure.u256(minaSignature.r),
    tx.pure.u256(minaSignature.s),
    tx.pure.vector("u8", suiSignature),
  ];

  tx.moveCall({
    package: packageID,
    module: "transactions",
    function: "transfer",
    arguments: userTopupArguments,
  });

  tx.setSender(address);
  tx.setGasBudget(10_000_000);

  const signedTx = await tx.sign({
    signer: keypair,
    client: suiClient,
  });

  const end = Date.now();
  const prepareTime = end - start;
  const result = await executeTx(signedTx);
  console.log("Faucet:", result);

  return {
    ...result,
    prepareTime,
  };
}
