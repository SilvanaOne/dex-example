import { describe, it } from "node:test";
import assert from "node:assert";

import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { getKey } from "../src/key.js";
import { suiClient } from "../src/sui-client.js";
import { executeTx, waitTx } from "../src/execute.js";
import { fetchBlock, fetchSequenceData } from "../src/fetch.js";
import { readFromWalrus, saveToWalrus } from "../src/walrus.js";
import { BlockData } from "../src/types.js";
import { writeFile } from "node:fs/promises";
import { serializeIndexedMap } from "@silvana-one/storage";
import { calculateStateRoot } from "../src/contracts/state.js";
const adminSecretKey: string = process.env.ADMIN_SECRET_KEY!;
const adminAddress: string = process.env.ADMIN!;
if (!adminSecretKey) {
  throw new Error("Missing environment variables");
}

const packageID = process.env.PACKAGE_ID;
const dexID = process.env.DEX_ID;
const adminID = process.env.ADMIN_ID;
let blockID: string | undefined = undefined;
let blockBlobId: string | undefined = undefined;

describe("DEX Block", async () => {
  it("should create a block", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }

    if (!dexID) {
      throw new Error("DEX_ID is not set");
    }

    if (!adminID) {
      throw new Error("ADMIN_ID is not set");
    }

    const { address, keypair } = await getKey({
      secretKey: adminSecretKey,
      name: "admin",
    });

    /*
    public fun create_block(dex: &mut DEX, pool: &Pool, clock: &Clock, ctx: &mut TxContext)
    */

    const tx = new Transaction();

    const blockArguments = [
      tx.object(adminID),
      tx.object(dexID),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ];

    tx.moveCall({
      package: packageID,
      module: "main",
      function: "create_block",
      arguments: blockArguments,
    });

    tx.setSender(address);
    tx.setGasBudget(200_000_000);

    const signedTx = await tx.sign({
      signer: keypair,
      client: suiClient,
    });

    const { tx: createBlockTx, digest, events } = await executeTx(signedTx);
    console.log(`create block tx:`, {
      digest,
      events,
    });

    createBlockTx.objectChanges?.map((change) => {
      if (
        change.type === "created" &&
        change.objectType.endsWith("main::Block") &&
        !change.objectType.includes("display")
      ) {
        blockID = change.objectId;
      }
    });
    console.log(`blockID:`, blockID);
    assert.ok(blockID, "block ID is not set");
    const waitResult = await waitTx(digest);
    if (waitResult.errors) {
      console.log(`Errors for tx ${digest}:`, waitResult.errors);
    }
    assert.ok(!waitResult.errors, "create block transaction failed");
  });
  it("should save block and block state to Walrus", async () => {
    if (!blockID) {
      throw new Error("block ID is not set");
    }

    if (!adminAddress) {
      throw new Error("admin address is not set");
    }

    const blockData = await fetchBlock({ blockID });
    // console.log("blockData", blockData);
    // console.log("blockData block", blockData.block);
    // console.log("blockData block_state", blockData.block.block_state);
    console.log(
      "blockData block_state state",
      blockData.block.block_state.state
    );
    const sequenceData = await fetchSequenceData({
      sequence: blockData.block.block_state.sequence,
      blockNumber: blockData.block.block_number,
    });
    if (!sequenceData) {
      throw new Error("sequence data is not set");
    }
    console.log(
      "sequenceData",
      Object.entries(sequenceData.accounts).forEach(([key, value]) => {
        console.log("key", key);
        console.log("value", value.toAccountData());
      })
    );
    const root = await calculateStateRoot({
      state: blockData.block.block_state.state,
    });
    console.log("root", root);
    console.log("sequenceData.map.root", sequenceData.map.root.toBigInt());
    console.log("map length", sequenceData.map.length.toBigInt());
    if (root !== sequenceData.map.root.toBigInt()) {
      throw new Error("state root does not match");
    }
    blockData.map = serializeIndexedMap(sequenceData.map);
    blockBlobId = await saveToWalrus({
      data: JSON.stringify(
        blockData,
        (_, value) =>
          typeof value === "bigint" ? value.toString() + "n" : value,
        2
      ),
      address: adminAddress,
      numEpochs: 5,
    });
    console.log(`block blobId:`, blockBlobId);
  });
  it("should read block and block state from Walrus", async () => {
    if (!blockBlobId) {
      throw new Error("block blobId is not set");
    }

    const block = await readFromWalrus({
      blobId: blockBlobId,
    });
    //console.log(`block:`, block);
    if (!block) {
      throw new Error("block is not received");
    }
    const blockData = JSON.parse(block) as BlockData;
    await writeFile(`./data/block-${blockData.block.block_number}.json`, block);
  });
  it("should save block and block state blobIds to Sui", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }

    if (!dexID) {
      throw new Error("DEX_ID is not set");
    }

    if (!blockID) {
      throw new Error("BLOCK_ID is not set");
    }

    if (!blockBlobId) {
      throw new Error("BLOCK_BLOB_ID is not set");
    }

    const { address, keypair } = await getKey({
      secretKey: adminSecretKey,
      name: "admin",
    });

    /*
    public fun update_block_state_data_availability(
    block: &mut Block,
    state_data_availability: String,
    */

    const tx = new Transaction();

    const blockArguments = [tx.object(blockID), tx.pure.string(blockBlobId)];

    tx.moveCall({
      package: packageID,
      module: "main",
      function: "update_block_state_data_availability",
      arguments: blockArguments,
    });

    tx.setSender(address);
    tx.setGasBudget(100_000_000);

    const signedTx = await tx.sign({
      signer: keypair,
      client: suiClient,
    });

    const { tx: updateBlockTx, digest, events } = await executeTx(signedTx);
    console.log(`update block tx:`, {
      digest,
      events,
    });
    console.log(`tx objects:`, updateBlockTx.objectChanges);

    const waitResult = await waitTx(digest);
    if (waitResult.errors) {
      console.log(`Errors for tx ${digest}:`, waitResult.errors);
    }
    assert.ok(!waitResult.errors, "update block transaction failed");
  });
});
