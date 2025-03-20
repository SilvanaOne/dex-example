import { describe, it } from "node:test";
import assert from "node:assert";
import { fetchEvents, fetchDexEvents, fetchBlock } from "../src/fetch.js";
import { sleep } from "../src/sleep.js";
import { EventId } from "@mysten/sui/client";
import {
  fetchProofStatus,
  fetchSequenceData,
  fetchDex,
  fetchBlockProofs,
} from "../src/fetch.js";
import { submitProof, getProverSecretKey } from "../src/proof.js";
import { ProofStatus } from "../src/types.js";
import { Memory } from "@silvana-one/mina-utils";

const packageID = process.env.PACKAGE_ID;

describe("Prove", async () => {
  it("should prove", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }
    await getProverSecretKey();
    let cursor: EventId | null | undefined = undefined;
    let lastTimestamp: number | undefined = undefined;
    let i = 1;
    let last_proved_block_number = 0;
    let last_proved_sequence = 0;
    let delay = 10;
    while (true) {
      await sleep(delay);
      const events = await fetchEvents({
        packageID,
        module: "transactions",
        cursor,
      });
      cursor = events?.nextCursor;
      if (events?.data && events.data.length > 0) {
        const newEvents = events.data.map((event) => {
          return {
            type: event.type?.split("::").at(-1),
            timestamp: Number(event.timestampMs),
            data: event.parsedJson,
          };
        });
        // console.log(
        //   `*******************  events ${i}: ***********************\n`,
        //   // newEvents.map((event) => JSON.stringify(event, null, 2))
        //   newEvents
        // );
        const timestamp = events?.data?.[events.data.length - 1]?.timestampMs;
        if (timestamp && typeof timestamp === "string") {
          lastTimestamp = Number(timestamp);
        }
        if (newEvents.length === 0) {
          const dex = await fetchDex();
          const new_last_proved_block_number = Number(
            dex.last_proved_block_number
          );
          const new_last_proved_sequence = Number(dex.last_proved_sequence);
          const current_block_number = Number(dex.block_number);
          const current_sequence = Number(dex.sequence);
          if (
            new_last_proved_block_number !== last_proved_block_number ||
            new_last_proved_sequence !== last_proved_sequence
          ) {
            last_proved_block_number = new_last_proved_block_number;
            last_proved_sequence = new_last_proved_sequence;
            console.log(
              "\x1b[32m%s\x1b[0m",
              "last_proved_block_number",
              last_proved_block_number
            );
            console.log(
              "\x1b[32m%s\x1b[0m",
              "last_proved_sequence",
              last_proved_sequence
            );
          }

          for (
            let blockNumber = last_proved_block_number + 1;
            blockNumber <= current_block_number;
            blockNumber++
          ) {
            const blockProofs = await fetchBlockProofs({
              blockNumber,
            });
            if (blockProofs.isFinished) {
              break;
            }
            let startSequence = blockProofs.startSequence;
            const maxSequence =
              blockProofs.endSequence ??
              blockProofs.proofs.reduce((max, proof) => {
                return Math.max(
                  max,
                  proof.sequences.reduce((max, sequence) => {
                    return Math.max(max, sequence);
                  }, startSequence)
                );
              }, startSequence);
            for (
              let sequence = startSequence;
              sequence <= maxSequence;
              sequence++
            ) {
              delay = 100;
              await proveSequenceInternal({ sequence, blockNumber });
            }
          }
        } else {
          for (const event of newEvents) {
            if ((event as any)?.data?.operation) {
              const sequence = Number(
                (event as any)?.data?.operation?.sequence
              );
              const blockNumber = Number(
                (event as any)?.data?.operation?.block_number
              );
              delay = 100;
              await proveSequenceInternal({ sequence, blockNumber });
            }
          }
        }
        i++;
      }
    }
  });
});

async function proveSequenceInternal({
  sequence,
  blockNumber,
}: {
  sequence: number;
  blockNumber: number;
}) {
  const proof = await fetchProofStatus({
    sequence,
    blockNumber,
  });
  if (
    proof?.status !== ProofStatus.CALCULATED &&
    proof?.status !== ProofStatus.USED
  ) {
    console.log("Calculating proof:", {
      sequence,
      blockNumber,
    });
    const sequenceData = await fetchSequenceData({
      sequence,
      blockNumber,
      prove: true,
    });
    if (sequenceData) {
      submitProof({
        state: sequenceData,
        mergedSequences1: [],
        mergedSequences2: [],
      });
      Memory.info(`Proof for sequence ${sequence} submitted`);
    } else {
      console.error("Sequence data not found:", {
        sequence,
        blockNumber,
      });
    }
  }
}
