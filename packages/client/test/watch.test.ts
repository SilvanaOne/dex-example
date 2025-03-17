import { describe, it } from "node:test";
import assert from "node:assert";
import { fetchEvents, fetchDexEvents } from "../src/fetch.js";
import { sleep } from "../src/sleep.js";
import { EventId } from "@mysten/sui/client";
import { fetchProofStatus, fetchSequenceData } from "../src/fetch.js";
import { submitProof } from "../src/proof.js";
import { ProofStatus } from "../src/types.js";
import { Memory } from "@silvana-one/mina-utils";

const packageID = process.env.PACKAGE_ID;

describe("Watch Events", async () => {
  it("should watch events", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }

    let cursor: EventId | null | undefined = undefined;
    let lastTimestamp: number | undefined = undefined;
    let i = 1;
    while (true) {
      await sleep(1000);
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
        for (const event of newEvents) {
          if (event.type === "ProofCalculationRequestEvent") {
            if ((event as any)?.data?.sequences?.length === 1) {
              const sequence = Number((event as any)?.data?.sequences[0]);
              const blockNumber = Number((event as any)?.data?.block_number);
              const proof = await fetchProofStatus({
                sequence,
                blockNumber,
              });
              if (proof?.status !== ProofStatus.CALCULATED) {
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
                  });
                  Memory.info(`Proof for sequence ${sequence} submitted`);
                } else {
                  console.log("Sequence data not found:", {
                    sequence,
                    blockNumber,
                  });
                }
              }
            }
          }
        }
        i++;
      }
    }
  });
});
