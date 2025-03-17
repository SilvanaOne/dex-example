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

export async function submitProof(params: {
  state: SequenceState;
}): Promise<void> {
  const { state } = params;
  if (!packageID || !dexID) {
    throw new Error("PACKAGE_ID or DEX_ID is not set");
  }

  const proof = state.dexProof?.toJSON();
  if (!proof) {
    throw new Error("Proof is not provided");
  }
  // const publicInput = proof.publicInput.map((item: string) => BigInt(item));
  // const publicOutput = proof.publicOutput.map((item: string) => BigInt(item));
  // const maxProofsVerified = proof.maxProofsVerified;
  // if (maxProofsVerified !== 2) {
  //   throw new Error("Max proofs verified is not 2");
  // }
  const proverSecretKey: string = process.env.PROVER_SECRET_KEY!;
  if (!proverSecretKey) {
    throw new Error("PROVER_SECRET_KEY is not set");
  }

  const { address, keypair } = await getKey({
    secretKey: proverSecretKey,
    name: "prover",
  });

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
    tx.pure.vector("u64", [BigInt(state.sequence)]),
    // tx.pure.vector("u256", publicInput),
    // tx.pure.vector("u256", publicOutput),
    // tx.pure.u8(maxProofsVerified),
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
