import { describe, it } from "node:test";
import assert from "node:assert";
import {
  fetchEvents,
  fetchDexEvents,
  fetchDexObject,
  fetchDex,
} from "../src/fetch.js";
import { sleep } from "../src/sleep.js";
import { EventId } from "@mysten/sui/client";
import {
  fetchProofStatus,
  fetchSequenceData,
  fetchBlockProofs,
} from "../src/fetch.js";
import { submitProof, getProverSecretKey } from "../src/proof.js";
import {
  ProofStatus,
  BlockProofs,
  ProofStatusData,
  MergeProofRequest,
} from "../src/types.js";
import { Memory } from "@silvana-one/mina-utils";
import { mergeProofs } from "../src/contracts/merge.js";
import { SequenceState } from "../src/contracts/rollup.js";

describe("Merge proofs", async () => {
  it("should merge proofs", async () => {
    await getProverSecretKey();
    let previous_last_proved_block_number = 0;
    let previous_current_block_number = 0;
    let merged = false;
    let mergeStatus: {
      sequence1: number[];
      sequence2: number[];
      status: "started" | "success";
    }[] = [];
    while (true) {
      const dex = await fetchDex();
      const last_proved_block_number = Number(dex.last_proved_block_number);
      const current_block_number = Number(dex.block_number);
      if (
        previous_current_block_number !== current_block_number ||
        previous_last_proved_block_number !== last_proved_block_number
      ) {
        previous_last_proved_block_number = last_proved_block_number;
        previous_current_block_number = current_block_number;
        console.log(
          "\x1b[32m%s\x1b[0m",
          "last proved block number",
          last_proved_block_number
        );
        console.log(
          "\x1b[32m%s\x1b[0m",
          "current block number",
          current_block_number
        );
      }
      let startBlockNumber = last_proved_block_number + 1 - 5;
      if (startBlockNumber < 1) {
        startBlockNumber = 1;
      }
      for (
        let blockNumber = startBlockNumber;
        blockNumber <= current_block_number;
        blockNumber++
      ) {
        //console.log("fetchBlockProofs", { blockNumber });
        const proofs = await fetchBlockProofs({ blockNumber: blockNumber });
        //console.log(`proofs for block ${blockNumber}`, proofs.proofs);
        const mergeProofRequest = proofs.isFinished
          ? undefined
          : findProofsToMerge(proofs);
        // if (!mergeProofRequest) {
        //   console.log(
        //     "\x1b[31m%s\x1b[0m",
        //     `No proofs to merge for block ${blockNumber}`
        //   );
        //   console.log(proofs.proofs.map((p) => p.sequences));
        // }
        if (mergeProofRequest) {
          console.log("Merging proofs:", {
            blockNumber,
            proof1: mergeProofRequest.proof1.sequences,
            proof2: mergeProofRequest.proof2.sequences,
          });
          mergeStatus.push({
            sequence1: mergeProofRequest.proof1.sequences,
            sequence2: mergeProofRequest.proof2.sequences,
            status: "started",
          });

          try {
            const abortController = new AbortController();
            const signal = abortController.signal;

            const sequenceData = await Promise.race([
              mergeProofs(mergeProofRequest, signal),
              new Promise<null>((resolve) => {
                setTimeout(() => {
                  const index = mergeStatus.findIndex(
                    (s) =>
                      s.sequence1 === mergeProofRequest.proof1.sequences &&
                      s.sequence2 === mergeProofRequest.proof2.sequences
                  );
                  if (index !== -1 && mergeStatus[index].status !== "success") {
                    console.log(
                      "\x1b[31m%s\x1b[0m",
                      "Merge proofs operation timed out after 2 minutes",
                      mergeStatus[index]
                    );
                    abortController.abort();
                    mergeStatus.splice(index, 1);
                  }
                  resolve(null);
                }, 2 * 60 * 1000);
              }),
            ]);
            const index = mergeStatus.findIndex(
              (s) =>
                s.sequence1 === mergeProofRequest.proof1.sequences &&
                s.sequence2 === mergeProofRequest.proof2.sequences
            );
            if (index !== -1) {
              mergeStatus.splice(index, 1);
            }
            if (!sequenceData) {
              console.log(
                "\x1b[31m%s\x1b[0m",
                "Merge proofs operation timed out after 2 minutes"
              );
              continue;
            }
            submitProof({
              state: sequenceData,
              mergedSequences1: mergeProofRequest.proof1.sequences,
              mergedSequences2: mergeProofRequest.proof2.sequences,
            });
            merged = true;
            Memory.info(`Merged proofs for block ${blockNumber}`);
          } catch (error) {
            console.log(
              "\x1b[31m%s\x1b[0m",
              "Merge proofs operation aborted",
              error
            );
            Memory.info(`Merge proofs for block ${blockNumber} aborted`);
          }
          break;
        }
      }
      await sleep(5000);
    }
  });
});

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

let sequence1: number[] = [];
let sequence2: number[] = [];
let provedSequences: { sequences: number[]; timestamp: number }[] = [];

export function findProofsToMerge(
  proofs: BlockProofs
): MergeProofRequest | undefined {
  if (proofs.isFinished) {
    return undefined;
  }
  // console.log("findProofsToMerge", {
  //   blockNumber: proofs.blockNumber,
  //   proofs: proofs.proofs
  //     .filter((p) => p.status.status === ProofStatus.CALCULATED)
  //     .map((p) => p.sequences),
  // });
  if (proofs.endSequence) {
    for (let i = proofs.startSequence + 1; i <= proofs.endSequence; i++) {
      const sequence1: number[] = [];
      const sequence2: number[] = [];
      for (let j = proofs.startSequence; j < i; j++) sequence1.push(j);
      for (let j = i; j <= proofs.endSequence; j++) sequence2.push(j);
      const proof1 = proofs.proofs.find((p) =>
        arraysEqual(p.sequences, sequence1)
      );
      const proof2 = proofs.proofs.find((p) =>
        arraysEqual(p.sequences, sequence2)
      );
      if (
        proof1 &&
        proof2 &&
        proof1.status.status !== ProofStatus.REJECTED &&
        proof2.status.status !== ProofStatus.REJECTED &&
        !provedSequences.find((ps) =>
          arraysEqual(ps.sequences, [...proof1.sequences, ...proof2.sequences])
        )
      ) {
        console.log("Merging proofs to create block proof:", {
          blockNumber: proofs.blockNumber,
          proof1: proof1.sequences,
          proof2: proof2.sequences,
        });
        provedSequences.push({
          sequences: [...proof1.sequences, ...proof2.sequences],
          timestamp: Date.now(),
        });
        return {
          blockNumber: proofs.blockNumber,
          proof1: proof1,
          proof2: proof2,
        };
      }
    }
  }
  for (let i = 0; i < proofs.proofs.length; i++) {
    const proof1 = proofs.proofs[i];
    if (
      proof1.status.status !== ProofStatus.CALCULATED &&
      proof1.status.status !== ProofStatus.USED
    ) {
      continue;
    }
    if (arraysEqual(proof1.sequences, sequence1)) {
      continue;
    }
    if (arraysEqual(proof1.sequences, sequence2)) {
      continue;
    }
    for (let j = 0; j < proofs.proofs.length; j++) {
      if (i === j) continue;

      const proof2 = proofs.proofs[j];
      if (
        proof2.status.status !== ProofStatus.CALCULATED &&
        proof2.status.status !== ProofStatus.USED
      ) {
        continue;
      }
      if (arraysEqual(proof2.sequences, sequence1)) {
        continue;
      }
      if (arraysEqual(proof2.sequences, sequence2)) {
        continue;
      }
      const isUsed =
        proof1.status.status === ProofStatus.USED ||
        proof2.status.status === ProofStatus.USED;

      // Condition 1: last element of proof1.sequences is one less than the first element of proof2.sequences
      if (
        proof1.sequences.length > 0 &&
        proof2.sequences.length > 0 &&
        proof1.sequences[proof1.sequences.length - 1] + 1 ===
          proof2.sequences[0]
      ) {
        // Construct combined sequences
        const combined = [...proof1.sequences, ...proof2.sequences];

        // Condition 2: ensure no proof already has the same combined sequence
        const theSameProof = proofs.proofs.find((p) =>
          arraysEqual(p.sequences, combined)
        );

        const alreadyExists =
          theSameProof !== undefined &&
          theSameProof.status.status === ProofStatus.CALCULATED;
        if (
          !alreadyExists &&
          ((theSameProof === undefined && isUsed === false) ||
            theSameProof?.status?.status === ProofStatus.REJECTED)
        ) {
          // Check if we've already proved this combined sequence before
          const existingProvedSequence = provedSequences.find((ps) =>
            arraysEqual(ps.sequences, combined)
          );
          if (
            !existingProvedSequence ||
            existingProvedSequence.timestamp < Date.now() - 1000 * 60 * 1
          ) {
            provedSequences.push({
              sequences: combined,
              timestamp: Date.now(),
            });

            sequence1 = proof1.sequences;
            sequence2 = proof2.sequences;

            return {
              blockNumber: proofs.blockNumber,
              proof1,
              proof2,
            };
          } else {
            console.log(
              `Already proved this combined sequence at ${new Date(
                existingProvedSequence.timestamp
              ).toISOString()}`
            );
          }
        }
      }
    }
  }
  return undefined;
}
