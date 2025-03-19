import { Transaction } from "@mysten/sui/transactions";
import { getKey } from "../src/key.js";
import { executeTx, waitTx } from "../src/execute.js";
import { suiClient } from "./sui-client.js";
import { JsonProof } from "o1js";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { saveToWalrus } from "./walrus.js";
import { SequenceState } from "./contracts/rollup.js";

const packageID = process.env.PACKAGE_ID;
const dexID = process.env.DEX_ID;
const adminID = process.env.ADMIN_ID;

let proverSecretKey: string | undefined = undefined;
let adminSecretKey: string | undefined = process.env.ADMIN_SECRET_KEY;

export async function getProverSecretKey() {
  if (proverSecretKey) {
    return proverSecretKey;
  }
  const { secretKey } = await getKey({
    secretKey: proverSecretKey,
    name: "prover",
  });
  proverSecretKey = secretKey;
  return secretKey;
}

export async function submitProof(params: {
  state: SequenceState;
  mergedSequences1: number[];
  mergedSequences2: number[];
}): Promise<void> {
  const { state, mergedSequences1, mergedSequences2 } = params;
  if (!packageID || !dexID) {
    throw new Error("PACKAGE_ID or DEX_ID is not set");
  }

  const proof = state.dexProof?.toJSON();
  if (!proof) {
    throw new Error("Proof is not provided");
  }

  // const proverSecretKey: string = process.env.PROVER_SECRET_KEY!;
  // if (!proverSecretKey) {
  //   throw new Error("PROVER_SECRET_KEY is not set");
  // }

  const { address, keypair, secretKey } = await getKey({
    secretKey: proverSecretKey,
    name: "prover",
  });
  proverSecretKey = secretKey;

  const blobData = state.toJSON();
  console.time("saveToWalrus");
  const blobId = await saveToWalrus({
    data: blobData,
    address,
    numEpochs: 1,
  });
  console.timeEnd("saveToWalrus");
  console.log("Blob ID:", blobId);
  if (!blobId) {
    throw new Error("Blob ID is not received");
  }

  console.time("tx");
  const tx = new Transaction();

  const proofArguments = [
    tx.object(dexID),
    tx.pure.u64(BigInt(state.blockNumber)),
    tx.pure.vector("u64", state.sequences.map(BigInt)),
    tx.pure.vector("u64", mergedSequences1.map(BigInt)),
    tx.pure.vector("u64", mergedSequences2.map(BigInt)),
    tx.pure.string(blobId),
    tx.object(SUI_CLOCK_OBJECT_ID),
  ];

  tx.moveCall({
    package: packageID,
    module: "main",
    function: "submit_proof",
    arguments: proofArguments,
  });

  tx.setSender(address);
  tx.setGasBudget(200_000_000);
  const signedTx = await tx.sign({ client: suiClient, signer: keypair });
  const { digest } = await executeTx(signedTx);

  // Wait for transaction to complete
  const waitResult = await waitTx(digest);
  if (waitResult.errors) {
    console.log(`Errors for tx ${digest}:`, waitResult.errors);
    throw new Error(`Failed to submit proof: ${waitResult.errors}`);
  }
  console.timeEnd("tx");
  console.log("Proof submitted successfully:", digest);
}

export async function submitMinaTx(params: {
  blockNumber: number;
  minaTx: string;
  blockID: string;
}): Promise<void> {
  console.log("Submitting mina tx hash to sui contract", params);
  const { blockNumber, minaTx, blockID } = params;
  if (!packageID || !dexID) {
    throw new Error("PACKAGE_ID or DEX_ID is not set");
  }
  if (!adminID) {
    throw new Error("ADMIN_ID is not set");
  }

  const { address, keypair } = await getKey({
    secretKey: adminSecretKey,
    name: "admin",
  });

  console.time("tx");
  const tx = new Transaction();

  /*
      public fun update_block_mina_tx_hash(
          admin: &Admin,
          block: &mut Block,
          mina_tx_hash: String,
          clock: &Clock,
          ctx: &mut TxContext,
  */
  const proofArguments = [
    tx.object(adminID),
    tx.object(blockID),
    tx.pure.string(minaTx),
    tx.object(SUI_CLOCK_OBJECT_ID),
  ];

  tx.moveCall({
    package: packageID,
    module: "main",
    function: "update_block_mina_tx_hash",
    arguments: proofArguments,
  });

  tx.setSender(address);
  tx.setGasBudget(200_000_000);
  const signedTx = await tx.sign({ client: suiClient, signer: keypair });
  const { digest } = await executeTx(signedTx);

  // Wait for transaction to complete
  const waitResult = await waitTx(digest);
  if (waitResult.errors) {
    console.log(`Errors for tx ${digest}:`, waitResult.errors);
    throw new Error(`Failed to submit mina tx: ${waitResult.errors}`);
  }
  console.timeEnd("tx");
  console.log("Mina tx submitted successfully:", digest);
}
