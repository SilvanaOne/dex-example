import { describe, it } from "node:test";
import assert from "node:assert";

import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { getKey } from "../src/key.js";
import { suiClient } from "../src/sui-client.js";
import { executeTx, waitTx } from "../src/execute.js";
import { fetchSuiObject, fetchDexEvents } from "../src/fetch.js";
import { readFromWalrus, saveToWalrus } from "../src/walrus.js";
import {
  OperationEvent,
  BlockData,
  Block,
  RawBlock,
  rawBlockToBlock,
  UserTradingAccount,
} from "../src/types.js";
import { writeFile } from "node:fs/promises";

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
let blockEvents: OperationEvent[] | undefined = undefined;
let sequences: number[] | undefined = undefined;
let blockNumber: number | undefined = undefined;
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
    sequences =
      (events as any)?.sequences && Array.isArray((events as any)?.sequences)
        ? (events as any)?.sequences.map((sequence: any) => Number(sequence))
        : undefined;
    console.log(`sequences:`, sequences);
    assert.ok(sequences, "sequences are not received");
    blockNumber = (events as any)?.block_number
      ? Number((events as any)?.block_number)
      : undefined;
    assert.ok(blockNumber, "block number is not received");
    assert.ok(typeof blockNumber === "number", "block number is not a number");
    assert.ok(blockNumber > 0, "block number is not positive");
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

    blockEvents = await fetchDexEvents({
      sequences,
    });
    console.log(`blockEvents:`, blockEvents);
    assert.ok(blockEvents, "block events are not received");
    //assert.ok(blockEvents?.length > 0, "block events are not received");
  });
  it("should save block and block state to Walrus", async () => {
    if (!blockID) {
      throw new Error("block ID is not set");
    }

    if (!adminAddress) {
      throw new Error("admin address is not set");
    }

    if (!blockEvents) {
      throw new Error("block events are not set");
    }

    if (!sequences) {
      throw new Error("sequences are not set");
    }

    if (!blockNumber) {
      throw new Error("block number is not set");
    }

    const fetchedBlock = await fetchSuiObject(blockID);
    const rawBlock = (fetchedBlock?.data?.content as any)?.fields as RawBlock;
    assert.ok(rawBlock, "raw block is not set");
    const block: Block = rawBlockToBlock(rawBlock);
    //console.log(`block:`, block);
    const blockData: BlockData = {
      blockNumber,
      blockID,
      sequences,
      block,
      events: blockEvents,
    };
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
    console.log(`block:`, block);
    if (!block) {
      throw new Error("block is not received");
    }
    await writeFile(`./data/block-${blockNumber}.json`, block);
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
