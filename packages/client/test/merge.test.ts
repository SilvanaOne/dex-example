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

describe("Merge proofs", async () => {
  it("should merge proofs", async () => {
    await getProverSecretKey();
    let previous_last_proved_block_number = 0;
    let previous_current_block_number = 0;
    let merged = false;
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

      for (
        let blockNumber = last_proved_block_number + 1;
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
          const sequenceData = await mergeProofs(mergeProofRequest);
          submitProof({
            state: sequenceData,
            mergedSequences1: mergeProofRequest.proof1.sequences,
            mergedSequences2: mergeProofRequest.proof2.sequences,
          });
          merged = true;
          Memory.info(`Merged proofs for block ${blockNumber}`);
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
  // console.log("findProofsToMerge", {
  //   blockNumber: proofs.blockNumber,
  //   proofs: proofs.proofs.map((p) => p.sequences),
  // });
  for (let i = 0; i < proofs.proofs.length; i++) {
    const proof1 = proofs.proofs[i];
    if (proof1.status.status !== ProofStatus.CALCULATED) {
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
      if (proof2.status.status !== ProofStatus.CALCULATED) {
        continue;
      }
      if (arraysEqual(proof2.sequences, sequence1)) {
        continue;
      }
      if (arraysEqual(proof2.sequences, sequence2)) {
        continue;
      }

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
        const alreadyExists = proofs.proofs.some((p) =>
          arraysEqual(p.sequences, combined)
        );
        if (!alreadyExists) {
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
