import { describe, it } from "node:test";
import assert from "node:assert";

import { readFile } from "node:fs/promises";
import { DexObjects } from "./helpers/dex.js";
import {
  fetchDexAccount,
  fetchSequenceData,
  fetchSuiObject,
  fetchBlockProofs,
} from "../src/fetch.js";
import { proveSequence } from "../src/prove.js";
import { SequenceState } from "../src/contracts/rollup.js";
import { serializeIndexedMap } from "@silvana-one/storage";
let dexObjects: DexObjects | undefined = undefined;

describe("Fetch DEX users accounts", async () => {
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
  });

  it("should fetch block proofs", async () => {
    const blockProofs = await fetchBlockProofs({
      blockNumber: 1,
    });
    console.log("block proofs", blockProofs);
  });

  it.skip("should fetch user", async () => {
    const user = await fetchSuiObject(
      "0x33ac72049a5c6c89cf022439c1b20e7857665911581bc9e53edbe565745d2e2d"
    );
    console.log("user", user);
    console.log("user display", user.data?.display?.data);
  });

  it.skip("should fetch user accounts", async () => {
    if (!dexObjects) {
      throw new Error("DEX_OBJECTS is not set");
    }
    const { faucet, alice, bob, pool } = dexObjects;
    const aliceAccount = await fetchDexAccount(alice.minaPublicKey);
    console.log("alice account", aliceAccount);
  });

  it.skip("should fetch sequence data", async () => {
    console.time("fetchSequenceData");
    const sequenceData = await fetchSequenceData({
      sequence: 11,
      blockNumber: 1,
      prove: true,
    });
    //console.log("sequence data", sequenceData);
    if (!sequenceData) {
      throw new Error("Sequence data is not received");
    }
    const proof = sequenceData.dexProof;
    if (!proof) {
      throw new Error("Proof is not received");
    }
    console.timeEnd("fetchSequenceData");
    const str = sequenceData.toJSON();
    const state = await SequenceState.fromJSON(str);
    assert.deepEqual(state.blockNumber, sequenceData.blockNumber);
    assert.deepEqual(state.sequences, sequenceData.sequences);
    assert.deepEqual(
      state.dexState.toRollupData(),
      sequenceData.dexState.toRollupData()
    );
    assert.deepEqual(
      serializeIndexedMap(state.map),
      serializeIndexedMap(sequenceData.map)
    );
    assert.deepEqual(state.accounts, sequenceData.accounts);
    assert.deepEqual(state.dexProof?.toJSON(), sequenceData.dexProof?.toJSON());
  });
});
