import { describe, it } from "node:test";
import assert from "node:assert";

import { fetchEvents } from "../src/fetch.js";
import { OperationEvent } from "../src/types.js";
const packageID = process.env.PACKAGE_ID;

describe("Events", async () => {
  it("should fetch events", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }
    const events = await fetchEvents({
      packageID,
      module: "trade",
    });
    const filteredEvents: OperationEvent[] | undefined = events?.data
      ?.filter((event) => event?.type?.includes("::trade::Operation"))
      .map((event) => {
        return {
          type: event.type?.split("::").at(-1),
          details: (event?.parsedJson as any)?.details,
          operation: (event?.parsedJson as any)?.operation,
        } as OperationEvent;
      });
    console.log("events", filteredEvents);
    assert.ok(filteredEvents, "events are not received");
    assert.ok(filteredEvents?.length > 0, "events are not received");
  });
});
