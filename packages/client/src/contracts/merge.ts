import { verify, JsonProof } from "o1js";
import { DEXProgram, DEXProof, SequenceState } from "./rollup.js";
import { ProofStatus, MergeProofRequest } from "../types.js";
import { compileDEXProgram } from "./compile.js";
import { readFromWalrus } from "../walrus.js";
import { rejectProof } from "../proof.js";

export async function mergeProofs(
  request: MergeProofRequest,
  signal?: AbortSignal
): Promise<SequenceState | undefined> {
  signal?.addEventListener("abort", () => {
    // Clean up any resources, stop operations
    throw new Error("mergeProofs Operation aborted");
  });

  const { blockNumber, proof1, proof2 } = request;
  if (proof1.sequences.length === 0 || proof2.sequences.length === 0) {
    throw new Error("Proofs are empty");
  }
  if (
    proof1.sequences[proof1.sequences.length - 1] + 1 !==
    proof2.sequences[0]
  ) {
    throw new Error("Proofs are not consecutive");
  }
  if (
    (proof1.status.status !== ProofStatus.CALCULATED &&
      proof1.status.status !== ProofStatus.USED) ||
    (proof2.status.status !== ProofStatus.CALCULATED &&
      proof2.status.status !== ProofStatus.USED)
  ) {
    throw new Error("Proofs are not calculated");
  }
  if (!proof1.status.da_hash || !proof2.status.da_hash) {
    throw new Error("Proofs are not stored in DA");
  }
  const compilePromise = compileDEXProgram();
  let dataLoaded = true;
  // console.log("Proof 1", {
  //   block: blockNumber,
  //   sequences: proof1.sequences,
  //   status: proof1.status,
  //   da: proof1.status.da_hash,
  // });
  // console.log("Proof 2", {
  //   block: blockNumber,
  //   sequences: proof2.sequences,
  //   status: proof2.status,
  //   da: proof2.status.da_hash,
  // });

  const proof1Data = await readFromWalrus({
    blobId: proof1.status.da_hash,
  });

  if (!proof1Data) {
    console.log("Proof 1 is not stored in DA, rejecting proof", {
      block: blockNumber,
      sequences: proof1.sequences,
      status: proof1.status,
      da: proof1.status.da_hash,
    });
    await rejectProof({
      blockNumber,
      sequences: proof1.sequences,
    });
    dataLoaded = false;
  }

  const proof2Data = await readFromWalrus({
    blobId: proof2.status.da_hash,
  });
  if (!proof2Data) {
    console.log("Proof 2 is not stored in DA, rejecting proof", {
      block: blockNumber,
      sequences: proof2.sequences,
      status: proof2.status,
      da: proof2.status.da_hash,
    });
    await rejectProof({
      blockNumber,
      sequences: proof2.sequences,
    });
    dataLoaded = false;
  }
  if (!dataLoaded) {
    return undefined;
  }
  if (!proof1Data || !proof2Data) {
    throw new Error("Proofs are not stored in DA");
  }

  const sequenceState1 = await SequenceState.fromJSON(proof1Data);
  //console.log("sequenceState1", sequenceState1);
  if (!sequenceState1.dexProof) {
    throw new Error("Proof 1 is not exist in DA");
  }
  if (sequenceState1.blockNumber !== blockNumber) {
    throw new Error("Proof 1 is not for the same block");
  }
  if (sequenceState1.sequences.length !== proof1.sequences.length) {
    throw new Error("Proof 1 sequences lengths are not the same");
  }
  if (
    sequenceState1.sequences.some(
      (sequence, index) => sequence !== proof1.sequences[index]
    )
  ) {
    throw new Error("Proof 1 sequences are not the same");
  }
  const sequenceState2 = await SequenceState.fromJSON(proof2Data);
  //console.log("sequenceState2", sequenceState2);
  if (!sequenceState2.dexProof) {
    throw new Error("Proof 2 is not exist in DA");
  }
  if (sequenceState2.blockNumber !== blockNumber) {
    throw new Error("Proof 2 is not for the same block");
  }
  if (sequenceState2.sequences.length !== proof2.sequences.length) {
    throw new Error("Proof 2 sequences lengths are not the same");
  }
  if (
    sequenceState2.sequences.some(
      (sequence, index) => sequence !== proof2.sequences[index]
    )
  ) {
    throw new Error("Proof 2 sequences are not the same");
  }
  const vk = await compilePromise;
  console.time("verify proof 1");
  const valid1 = await verify(sequenceState1.dexProof, vk);
  console.timeEnd("verify proof 1");
  if (!valid1) {
    throw new Error("Proof 1 is not valid");
  }
  console.time("verify proof 2");
  const valid2 = await verify(sequenceState2.dexProof, vk);
  console.timeEnd("verify proof 2");
  if (!valid2) {
    throw new Error("Proof 2 is not valid");
  }
  console.time("merge");
  const mergedProof = await DEXProgram.merge(
    sequenceState1.dexProof.publicInput,
    sequenceState1.dexProof,
    sequenceState2.dexProof
  );
  console.timeEnd("merge");
  const sequenceState: SequenceState = new SequenceState({
    ...sequenceState2,
    sequences: [...sequenceState1.sequences, ...sequenceState2.sequences],
    dexProof: mergedProof.proof,
  });
  return sequenceState;
}
