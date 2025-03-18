import { describe, it } from "node:test";
import assert from "node:assert";
import { fetchDex, fetchBlock } from "../src/fetch.js";
import { sleep } from "../src/sleep.js";
import { fetchBlockProofs } from "../src/fetch.js";
import { settleMinaContract } from "../src/settle.js";
import { DexObjects } from "./helpers/dex.js";
import { readFile } from "node:fs/promises";
import { readFromWalrus } from "../src/walrus.js";
import { SequenceState } from "../src/contracts/rollup.js";

let dexObjects: DexObjects | undefined = undefined;
const minaAdminSecretKey: string = process.env.TEST_ACCOUNT_1_PRIVATE_KEY!;

describe("Settle", async () => {
  it("should read configuration", async () => {
    const config = await readFile("./data/dex-objects.json", "utf-8");
    const { dexObjects: dexObjectsInternal } = JSON.parse(
      config,
      (key, value) => {
        if (
          typeof key === "string" &&
          (key.toLowerCase().endsWith("amount") ||
            key.toLowerCase().endsWith("price")) &&
          typeof value === "string" &&
          value.endsWith("n")
        ) {
          return BigInt(value.slice(0, -1));
        }
        return value;
      }
    ) as { dexObjects: DexObjects };
    dexObjects = dexObjectsInternal;
    if (!dexObjects) {
      throw new Error("DEX_OBJECTS is not set");
    }

    //console.log("DEX_OBJECTS", dexObjects.alice);
  });
  it("should settle", async () => {
    if (!dexObjects) {
      throw new Error("DEX_OBJECTS is not set");
    }
    const { pool } = dexObjects;
    if (!pool || !pool.minaPublicKey) {
      throw new Error("Pool public key is not set");
    }
    const poolPublicKey = pool.minaPublicKey;

    while (true) {
      const dex = await fetchDex();
      let previous_block_address = dex.previous_block_address;
      const current_block_number = Number(dex.block_number);
      console.log("current_block_number", current_block_number);
      console.log("previous_block_address", previous_block_address);
      for (
        let blockNumber = current_block_number - 1;
        blockNumber >= 0;
        blockNumber--
      ) {
        const block = await fetchBlock({ blockID: previous_block_address });
        console.log("block", block.block.block_number);
        console.log("block.block.mina_tx_hash", block.block.mina_tx_hash);

        if (
          block.block.mina_tx_hash !== null ||
          block.block.block_number == 0
        ) {
          console.log("fetchBlockProofs blockNumber", blockNumber);
          const proofs = await fetchBlockProofs({
            blockNumber: blockNumber + 1,
          });
          if (proofs.isFinished && proofs.blockProof) {
            const blockProof = proofs.blockProof;
            const proofData = await readFromWalrus({
              blobId: blockProof,
            });
            if (!proofData) {
              throw new Error("Proof data is not set");
            }
            const state = await SequenceState.fromJSON(proofData);
            if (!state.dexProof) {
              throw new Error("DEX proof is not set");
            }
            await settleMinaContract({
              poolPublicKey,
              adminPrivateKey: minaAdminSecretKey,
              proof: state.dexProof,
            });
          }
        } else previous_block_address = block.block.previous_block_address;
      }
      await sleep(60000);
    }
  });
});
