import { describe, it } from "node:test";
import assert from "node:assert";

import { readFile } from "node:fs/promises";
import { DexObjects } from "./helpers/dex.js";
import {
  fetchDexAccount,
  fetchProofStatus,
  fetchSequenceData,
  fetchSuiObject,
} from "../src/fetch.js";
import { submitProof } from "../src/proof.js";
import { SequenceState } from "../src/contracts/rollup.js";
import { toASCII } from "node:punycode";
let dexObjects: DexObjects | undefined = undefined;
let sequenceState: SequenceState | undefined = undefined;
const blockNumber = 1;
const sequence = 11;

describe("Submit DEX proof", async () => {
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

  it.skip("should fetch sequence data and calculate proof", async () => {
    console.time("fetchSequenceData");
    const sequenceData = await fetchSequenceData({
      sequence,
      blockNumber,
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
    //console.log("proof", proof.toJSON());
    sequenceState = sequenceData;
  });

  it.skip("should submit proof", async () => {
    if (!sequenceState) {
      throw new Error("Sequence state is not received");
    }

    await submitProof({
      state: sequenceState,
      mergedSequences1: [],
      mergedSequences2: [],
    });
  });

  it("should fetch proof status", async () => {
    const proofStatus = await fetchProofStatus({
      sequence,
      blockNumber,
    });
    console.log("proofStatus", proofStatus);
  });
});
