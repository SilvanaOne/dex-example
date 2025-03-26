import { fetchSuiObject } from "./fetch.js";

export interface DexConfig {
  id: string;
  admin: string;
  dex_package: string;
  dex_object: string;
  circuit_blob_id: string;
  mina_network: string;
  mina_chain: string;
  mina_contract: string;
}

let dexConfig: DexConfig | undefined;

export async function getConfig(): Promise<DexConfig> {
  if (dexConfig) return dexConfig;
  const configID = process.env.NEXT_PUBLIC_CONFIG_ID;
  if (!configID) {
    throw new Error("CONFIG_ID is not set");
  }
  const fetchResult = await fetchSuiObject(configID);
  console.log("fetchResult", fetchResult);
  dexConfig = (fetchResult.data?.content as any)
    ?.fields as unknown as DexConfig;
  return dexConfig;
}
