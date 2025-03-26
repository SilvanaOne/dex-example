import { SuiEvent } from "@mysten/sui/client";
import { SignatureWithBytes } from "@mysten/sui/cryptography";
import { suiClient } from "./sui-client.js";
import { OperationNames } from "./types.js";
import { LastTransactionData } from "./types.js";
export async function executeTx(
  tx: SignatureWithBytes
): Promise<Partial<LastTransactionData>> {
  const start = Date.now();
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
  console.log("executedTx", executedTx.events);
  const events = executedTx.events;
  const event = events?.find(
    (event) => event.transactionModule === "transactions"
  );
  console.log("event", event?.parsedJson);
  const blockNumber = Number(
    (event?.parsedJson as any)?.operation?.block_number ?? 0
  );
  const sequence = Number((event?.parsedJson as any)?.operation?.sequence ?? 0);
  const operation = Number(
    (event?.parsedJson as any)?.operation?.operation ?? 0
  );
  const operationName =
    operation && typeof operation === "number"
      ? OperationNames[operation]
      : "unknown";
  const end = Date.now();
  const executeTime = end - start;
  console.log("tx execute, ms:", executeTime);

  if (executedTx.effects?.status?.status === "failure") {
    console.log(
      `Errors for tx ${executedTx.digest}:`,
      executedTx.effects?.status?.error
    );
    throw new Error(`tx execution failed: ${executedTx.digest}`);
  }
  return {
    digest: executedTx.digest,
    executeTime,
    operationName,
    blockNumber,
    sequence,
    operation,
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
