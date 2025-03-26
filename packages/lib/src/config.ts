import { fetchSuiObject } from "./fetch.js";

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
