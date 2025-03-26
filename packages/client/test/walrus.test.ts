import { describe, it } from "node:test";
import assert from "node:assert";

import { saveToWalrus, readFromWalrus } from "@dex-example/lib";
let blobId: string | undefined = undefined;

describe("Walrus", async () => {
  it("should save to walrus", async () => {
    blobId = await saveToWalrus({
      data: JSON.stringify(
        {
          message: "Hello, world!",
          date: new Date().toLocaleString(),
        },
        null,
        2
      ),
    });
    assert.ok(blobId, "blobId is not set");
  });

  it("should read from walrus", async () => {
    if (!blobId) {
      throw new Error("blobId is not set");
    }
    const blob = await readFromWalrus({
      blobId,
    });
    console.log("blob", blob);
    assert.ok(blob, "blob is not received");
  });
});
