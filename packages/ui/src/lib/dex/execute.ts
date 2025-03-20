import { SuiEvent } from "@mysten/sui/client";
import { SignatureWithBytes } from "@mysten/sui/cryptography";
import { suiClient } from "./sui-client";

export async function executeTx(tx: SignatureWithBytes) {
  const start = Date.now();
  const executedTx = await suiClient.executeTransactionBlock({
    transactionBlock: tx.bytes,
    signature: tx.signature,
  });
  const end = Date.now();
  const executeDelay = end - start;
  console.log("tx execute, ms:", executeDelay);

  if (executedTx.effects?.status?.status === "failure") {
    console.log(
      `Errors for tx ${executedTx.digest}:`,
      executedTx.effects?.status?.error
    );
    throw new Error(`tx execution failed: ${executedTx.digest}`);
  }
  return {
    digest: executedTx.digest,
    executeDelay,
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
