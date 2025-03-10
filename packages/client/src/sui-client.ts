import { getFullnodeUrl, SuiClient, SuiEvent } from "@mysten/sui/client";

export const network: "testnet" | "devnet" | "localnet" | "mainnet" = process
  .env.SUI_CHAIN! as "testnet" | "devnet" | "localnet" | "mainnet";

export const suiClient = new SuiClient({
  url: getFullnodeUrl(network),
});
