import { SignatureWithBytes } from "@mysten/sui/cryptography";
import { OperationNames } from "./types.js";
import { LastTransactionData } from "./types.js";
import { executeTx } from "./execute.js";

export async function executeOperationTx(
  tx: SignatureWithBytes
): Promise<Partial<LastTransactionData>> {
  const start = Date.now();
  const executedTx = await executeTx(tx);
  const events = executedTx.tx.events;
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

  if (executedTx.tx.effects?.status?.status === "failure") {
    console.log(
      `Errors for tx ${executedTx.digest}:`,
      executedTx.tx.effects?.status?.error
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
