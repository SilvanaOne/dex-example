import { describe, it } from "node:test";
import assert from "node:assert";
import { fetchEvents, fetchDexEvents, fetchBlock } from "@dex-example/lib";
import { sleep } from "@silvana-one/storage";
import { EventId } from "@mysten/sui/client";
import { fetchProofStatus, fetchDex, fetchBlockProofs } from "@dex-example/lib";
import {
  submitProof,
  getProverSecretKey,
  fetchSequenceData,
} from "@dex-example/contracts";
import { ProofStatus } from "@dex-example/lib";
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
      if (events?.data) {
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
          if (!dex) {
            throw new Error("DEX data not found");
          }
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

          let startBlockNumber = last_proved_block_number + 1 - 5;
          if (startBlockNumber < 1) {
            startBlockNumber = 1;
          }
          for (
            let blockNumber = startBlockNumber;
            blockNumber <= current_block_number;
            blockNumber++
          ) {
            //console.log(`Fetching block ${blockNumber} proofs...`);
            const blockProofs = await fetchBlockProofs({
              blockNumber,
            });
            if (!blockProofs.isFinished) {
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
                if (sequence < current_sequence) {
                  //console.log(`Proving sequence ${sequence}...`);
                  await proveSequenceInternal({ sequence, blockNumber });
                }
              }
            }
          }
          await sleep(1000);
        } else {
          for (const event of newEvents) {
            if ((event as any)?.data?.operation) {
              const sequence = Number(
                (event as any)?.data?.operation?.sequence
              );
              const blockNumber = Number(
                (event as any)?.data?.operation?.block_number
              );
              await proveSequenceInternal({ sequence, blockNumber });
            }
          }
        }
        i++;
      }
    }
  });
});

const proveSequences: number[] = [];

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
    proof?.status !== ProofStatus.USED &&
    !proveSequences.includes(sequence)
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
      proveSequences.push(sequence);
      Memory.info(`Proof for sequence ${sequence} submitted`);
    } else {
      console.error("Sequence data not found:", {
        sequence,
        blockNumber,
      });
    }
  } else {
    // process.stdout.write(
    //   `${blockNumber}:${sequence}                                     \r`
    // );
    //console.log(`${blockNumber}:${sequence}`);
  }
}
