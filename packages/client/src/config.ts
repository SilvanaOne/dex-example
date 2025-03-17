import { Transaction } from "@mysten/sui/transactions";
import { getKey } from "../src/key.js";
import { writeFile } from "node:fs/promises";
import { buildPublishTx } from "../src/publish.js";
import { buildMovePackage } from "../src/build.js";
import { executeTx, waitTx } from "../src/execute.js";
import { suiClient } from "./sui-client.js";
import { fetchSuiObject } from "./fetch.js";
import dotenv from "dotenv";

export interface Config {
  dex_package: string;
  dex_object: string;
  circuit_blob_id: string;
  mina_network: string;
  mina_chain: string;
  mina_contract: string;
}

export async function getConfig(): Promise<Config | undefined> {
  const suiChain = process.env.SUI_CHAIN || "localnet";
  const configPath = `.env.${suiChain}.config`;
  dotenv.config({ path: configPath });
  const configID = process.env.CONFIG_ID;
  if (!configID) {
    throw new Error("CONFIG_ID is not set");
  }
  const config = ((await fetchSuiObject(configID))?.data?.content as any)
    ?.fields;
  if (!config) {
    return undefined;
  }
  console.log(config);
  return config as unknown as Config;
}

export async function updateConfig(config: Partial<Config>): Promise<void> {
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
  let configObject = await getConfig();
  if (!configObject) {
    //throw new Error("Config object not found");
    configObject = {
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

  // Build transaction to update the config
  const adminSecretKey: string = process.env.ADMIN_SECRET_KEY!;
  if (!adminSecretKey) {
    throw new Error("ADMIN_SECRET_KEY is not set");
  }

  const { address, keypair } = await getKey({
    secretKey: adminSecretKey,
    name: "admin",
  });

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

export async function createConfig(config: Config): Promise<{
  configPackageID: string;
  adminID: string;
  configID: string;
}> {
  const adminSecretKey: string = process.env.ADMIN_SECRET_KEY!;
  if (!adminSecretKey) {
    throw new Error("ADMIN_SECRET_KEY is not set");
  }
  const { address, keypair } = await getKey({
    secretKey: adminSecretKey,
    name: "admin",
  });

  const { modules, dependencies } = await buildMovePackage("../config");
  const { signedTx } = await buildPublishTx({
    modules,
    dependencies,
    address,
    keypair,
  });
  const { tx: publishTx, digest, events } = await executeTx(signedTx);
  let configPackageID: string | undefined = undefined;
  let configID: string | undefined = undefined;
  let adminID: string | undefined = undefined;
  //console.log(tx.objectChanges);
  publishTx.objectChanges?.map((change) => {
    if (change.type === "published") {
      configPackageID = change.packageId;
    } else if (
      change.type === "created" &&
      change.objectType.includes("addresses::ConfigAdmin")
    ) {
      adminID = change.objectId;
    }
  });
  console.log("Published DEX config:", {
    digest,
    events,
    configPackageID,
    adminID,
  });
  const waitResult = await waitTx(digest);
  if (waitResult.errors) {
    console.log(`Errors for tx ${digest}:`, waitResult.errors);
  }

  if (!configPackageID) {
    throw new Error("Config package ID is not set");
  }
  if (!adminID) {
    throw new Error("Admin ID is not set");
  }

  const tx = new Transaction();

  /*
      public fun create_config(
          config_admin: &mut ConfigAdmin,
          dex_package: address,
          dex_object: address,
          circuit_blob_id: String,
          mina_network: String,
          mina_chain: String,
          mina_contract: String,
          ctx: &mut TxContext,
  */

  const configArguments = [
    tx.object(adminID),
    tx.pure.address(config.dex_package || ""),
    tx.pure.address(config.dex_object || ""),
    tx.pure.string(config.circuit_blob_id || ""),
    tx.pure.string(config.mina_network || ""),
    tx.pure.string(config.mina_chain || ""),
    tx.pure.string(config.mina_contract || ""),
  ];

  tx.moveCall({
    package: configPackageID,
    module: "addresses",
    function: "create_config",
    arguments: configArguments,
  });

  tx.setSender(address);
  tx.setGasBudget(100_000_000);
  const signedCreateTx = await tx.sign({
    signer: keypair,
    client: suiClient,
  });

  const {
    tx: createTx,
    digest: createDigest,
    events: createEvents,
  } = await executeTx(signedCreateTx);

  createTx.objectChanges?.map((change) => {
    if (
      change.type === "created" &&
      change.objectType.includes("addresses::DexConfig") &&
      !change.objectType.includes("display")
    ) {
      configID = change.objectId;
    }
  });
  console.log("Created DEX config:", {
    digest: createDigest,
    events: createEvents,
    configPackageID,
    adminID,
    configID,
  });
  const waitCreateResult = await waitTx(createDigest);
  if (waitCreateResult.errors) {
    console.log(`Errors for tx ${createDigest}:`, waitCreateResult.errors);
  }
  if (!configID) {
    throw new Error("Config ID is not set");
  }

  const envContent = `# Chains
SUI_CHAIN=${process.env.SUI_CHAIN}
MINA_CHAIN=${process.env.MINA_CHAIN}

# Config Package ID
CONFIG_PACKAGE_ID=${configPackageID}

# Object IDs
CONFIG_ID=${configID}
ADMIN_ID=${adminID}
`;
  await writeFile(`.env.${process.env.SUI_CHAIN}.config`, envContent);
  return { configPackageID, configID, adminID };
}
