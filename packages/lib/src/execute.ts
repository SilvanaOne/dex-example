import { SuiEvent } from "@mysten/sui/client";
import { SignatureWithBytes } from "@mysten/sui/cryptography";
import { suiClient } from "./sui-client.js";

export async function executeTx(tx: SignatureWithBytes) {
  const executedTx = await suiClient.executeTransactionBlock({
    transactionBlock: tx.bytes,
    signature: tx.signature,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showInput: true,
      showEvents: true,
      showBalanceChanges: true,
    },
  });

  if (executedTx.effects?.status?.status === "failure") {
    console.error(
      `Errors for tx ${executedTx.digest}:`,
      executedTx.effects?.status?.error
    );
    throw new Error(`tx execution failed: ${executedTx.digest}`);
  }
  return {
    tx: executedTx,
    digest: executedTx.digest,
    events: (executedTx.events as SuiEvent[])?.[0]?.parsedJson as object,
  };
}

export async function waitTx(digest: string) {
  console.time(`wait tx`);
  const txWaitResult = await suiClient.waitForTransaction({
    digest,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showInput: true,
      showEvents: true,
      showBalanceChanges: true,
    },
  });
  console.timeEnd(`tx wait`);
  return txWaitResult;
}
