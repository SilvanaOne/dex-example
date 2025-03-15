import { describe, it } from "node:test";
import assert from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { saveToWalrus, readFromWalrus } from "../src/walrus.js";
let blobId: string | undefined = undefined;

describe("Store circuit", async () => {
  it("should save to walrus", async () => {
    const circuit = await readFile("./src/contracts/rollup.ts", "utf-8");
    blobId = await saveToWalrus({
      data: circuit,
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
    //console.log("blob", blob);
    assert.ok(blob, "blob is not received");
  });

  it("should save circuit address to .env.circuit", async () => {
    if (!blobId) {
      throw new Error("blobId is not set");
    }
    const envContent = `# Circuit blob ID
CIRCUIT_BLOB_ID=${blobId}
`;
    await writeFile(".env.circuit", envContent);
  });
});
