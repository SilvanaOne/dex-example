"use server";
import { getConfig } from "./config.js";
import { publicKeyToU256 } from "./public-key.js";
import { Transaction } from "@mysten/sui/transactions";
import { getKey } from "./key.js";
import { suiClient } from "./sui-client.js";
import { executeTx, waitTx } from "./execute.js";
import { LastTransactionData } from "./types.js";
const adminSecretKey: string = process.env.ADMIN_SECRET_KEY!;
const validatorSecretKey: string = process.env.VALIDATOR_SECRET_KEY!;

if (!adminSecretKey || !validatorSecretKey) {
  throw new Error("Missing environment variables");
}

export async function createAccount(
  user: string
): Promise<Partial<LastTransactionData>> {
  const start = Date.now();
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

  if (!adminSecretKey) {
    throw new Error("ADMIN_SECRET_KEY is not set");
  }

  const { address, keypair } = await getKey({
    secretKey: adminSecretKey,
    name: "admin",
  });

  const tx = new Transaction();

  const userAccountArguments = [
    tx.object(dexID),
    tx.pure.u256(await publicKeyToU256(user)),
    tx.pure.string(user),
    tx.pure.string("user"),
    tx.pure.string(
      "https://www.pngarts.com/files/5/User-Avatar-PNG-Transparent-Image.png"
    ),
    tx.pure.string(user),
    tx.pure.u64(0n),
    tx.pure.u64(0n),
  ];

  tx.moveCall({
    package: packageID,
    module: "transactions",
    function: "create_account",
    arguments: userAccountArguments,
  });

  tx.setSender(address);
  tx.setGasBudget(100_000_000);
  const signedTx = await tx.sign({
    signer: keypair,
    client: suiClient,
  });

  const end = Date.now();
  const prepareTime = end - start;
  const result = await executeTx(signedTx);
  console.log("Created user:", result);
  return { ...result, prepareTime };
}
