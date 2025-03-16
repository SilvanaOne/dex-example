import { describe, it } from "node:test";
import assert from "node:assert";
import { createConfig, getConfig, updateConfig } from "../src/config.js";

const readOnly = true;

describe("Config", async () => {
  it("should create config", { skip: readOnly }, async () => {
    const { configPackageID, configID } = await createConfig();
    console.log({ configPackageID, configID });
    assert.ok(!!configPackageID);
    assert.ok(!!configID);
  });

  it("should get config", async () => {
    const config = await getConfig();
    console.log(config);
  });

  it("should update config", { skip: readOnly }, async () => {
    await updateConfig({
      mina_chain: process.env.MINA_CHAIN || "",
    });
  });

  it("should get config after update", { skip: readOnly }, async () => {
    const config = await getConfig();
    console.log(config);
    assert.ok(config !== undefined);
  });
});
