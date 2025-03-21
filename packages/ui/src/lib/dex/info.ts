import { NetworkInfoData } from "./ui/types";
import { fetchDex } from "./fetch";
import { getConfig } from "./config";

export async function getNetworkInfo(): Promise<NetworkInfoData | undefined> {
  const config = await getConfig();
  console.log("config", config);
  const dex = await fetchDex();
  if (!dex) {
    return undefined;
  }
  console.log("dex", dex);
  const info: NetworkInfoData = {
    l1Settlement: "Mina Protocol",
    minaChainId: config.mina_chain,
    minaContractAddress: config.mina_contract,
    minaCircuitId: config.circuit_blob_id,
    zkCoordination: "Sui",
    suiAddress: config.dex_object,
    dataAvailability: "Walrus",
    wallet: "Auro",
    lastBlockNumber: Number(dex.block_number),
    lastProvedBlockNumber: Number(dex.last_proved_block_number),
    sequence: Number(dex.sequence),
    circuitDaHash: dex?.circuit_address,
  };
  console.log("info", info);
  return info;
}
