import { Transaction } from "@mysten/sui/transactions";
import { getKey } from "./key.js";
import { executeTx, waitTx } from "./execute.js";
import { suiClient } from "./sui-client.js";
import { fetchSuiObject } from "./fetch.js";
import dotenv from "dotenv";

export interface DexConfig {
  admin: string;
  dex_package: string;
  dex_object: string;
  circuit_blob_id: string;
  mina_network: string;
  mina_chain: string;
  mina_contract: string;
}

let dexConfig: DexConfig | undefined;

export async function getConfig(configID?: string): Promise<DexConfig> {
  if (dexConfig) return dexConfig;
  if (!configID) {
    configID = process.env.NEXT_PUBLIC_CONFIG_ID ?? process.env.CONFIG_ID;
  }
  if (!configID) {
    throw new Error("CONFIG_ID is not set");
  }
  const fetchResult = await fetchSuiObject(configID);
  //console.log("fetchResult", fetchResult);
  dexConfig = (fetchResult.data?.content as any)
    ?.fields as unknown as DexConfig;
  if (!dexConfig) {
    throw new Error("Config object not found");
  }
  return dexConfig;
}

export async function updateConfig(config: Partial<DexConfig>): Promise<void> {
  console.log("Updating config", config);
  const suiChain = process.env.SUI_CHAIN || "localnet";
  const configPath = `.env.${suiChain}.config`;
  dotenv.config({ path: configPath });
  const configID = process.env.CONFIG_ID;
  if (!configID) {
    throw new Error("CONFIG_ID is not set");
  }
  const configPackageID = process.env.CONFIG_PACKAGE_ID;
  if (!configPackageID) {
    throw new Error("CONFIG_PACKAGE_ID is not set");
  }
  const adminSecretKey: string = process.env.ADMIN_SECRET_KEY!;
  if (!adminSecretKey) {
    throw new Error("ADMIN_SECRET_KEY is not set");
  }

  const { address, keypair } = await getKey({
    secretKey: adminSecretKey,
    name: "admin",
  });

  let configObject = await getConfig();
  if (!configObject) {
    //throw new Error("Config object not found");
    configObject = {
      admin: address,
      dex_package: process.env.PACKAGE_ID || "",
      dex_object: process.env.DEX_ID || "",
      circuit_blob_id: process.env.CIRCUIT_BLOB_ID || "",
      mina_network: "mina",
      mina_chain: process.env.MINA_CHAIN || "",
      mina_contract: process.env.MINA_CONTRACT || "",
    };
  }
  // Create a new config object by merging the existing config with the updates
  const updatedConfig = {
    ...configObject,
    ...config,
  };
  console.log("Updated config", updatedConfig);
  // Build transaction to update the config

  /*
      public fun update_config(
          dex_config: &mut DexConfig,
          dex_object: address,
          circuit_blob_id: String,
          mina_network: String,
          mina_chain: String,
          mina_contract: String,
          ctx: &mut TxContext,
  */
  const tx = new Transaction();

  const configArguments = [
    tx.object(configID),
    tx.pure.address(updatedConfig.dex_package || ""),
    tx.pure.address(updatedConfig.dex_object || ""),
    tx.pure.string(updatedConfig.circuit_blob_id || ""),
    tx.pure.string(updatedConfig.mina_network || ""),
    tx.pure.string(updatedConfig.mina_chain || ""),
    tx.pure.string(updatedConfig.mina_contract || ""),
  ];

  tx.moveCall({
    package: configPackageID,
    module: "addresses",
    function: "update_config",
    arguments: configArguments,
  });

  tx.setSender(address);
  tx.setGasBudget(100_000_000);
  const signedTx = await tx.sign({ client: suiClient, signer: keypair });
  const { digest } = await executeTx(signedTx);

  // Wait for transaction to complete
  const waitResult = await waitTx(digest);
  if (waitResult.errors) {
    console.log(`Errors for tx ${digest}:`, waitResult.errors);
    throw new Error(`Failed to update config: ${waitResult.errors}`);
  }

  console.log("Config updated successfully:", digest);
}
