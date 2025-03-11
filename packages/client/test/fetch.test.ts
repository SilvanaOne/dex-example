import { describe, it } from "node:test";
import assert from "node:assert";

import { readFile } from "node:fs/promises";
import { DexObjects } from "./helpers/dex.js";
import { fetchDexAccount, fetchDexPool, fetchSuiObject } from "../src/fetch.js";
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

  it("should fetch user pool", async () => {
    const pool = await fetchDexPool();
    console.log("pool", pool);
    console.log("pool display", pool.data?.display?.data);
  });

  it("should fetch user", async () => {
    const user = await fetchSuiObject(
      "0x7771980c7fee7e0677f0aaf0d6a69e9463fc042a58977c7f51066888ca244e1b"
    );
    console.log("user", user);
    console.log("user display", user.data?.display?.data);
  });

  it("should fetch user accounts", async () => {
    if (!dexObjects) {
      throw new Error("DEX_OBJECTS is not set");
    }
    const { faucet, alice, bob, pool } = dexObjects;
    const aliceAccount = await fetchDexAccount(alice.minaPublicKey);
    console.log("alice account", aliceAccount);
  });
});
