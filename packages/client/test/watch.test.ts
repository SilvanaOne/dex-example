import { describe, it } from "node:test";
import assert from "node:assert";
import { fetchEvents } from "../src/fetch.js";
import { sleep } from "../src/sleep.js";
import { EventId } from "@mysten/sui/client";
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
        module: "trade",
        cursor,
      });
      cursor = events?.nextCursor;
      console.log(
        `*******************  events ${i}: ***********************\n`,
        events
      );
      const timestamp = events?.data?.[events.data.length - 1]?.timestampMs;
      if (timestamp && typeof timestamp === "string") {
        lastTimestamp = Number(timestamp);
      }
      i++;
    }
  });
});
