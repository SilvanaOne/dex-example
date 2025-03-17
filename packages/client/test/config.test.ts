import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createConfig,
  getConfig,
  updateConfig,
  Config,
} from "../src/config.js";

const readOnly = true;

const config: Config = {
  dex_package: process.env.PACKAGE_ID || "",
  dex_object: process.env.DEX_ID || "",
  circuit_blob_id: process.env.CIRCUIT_BLOB_ID || "",
  mina_network: process.env.MINA_NETWORK || "mina",
  mina_chain: process.env.MINA_CHAIN || "local",
  mina_contract: process.env.MINA_CONTRACT || "",
};
describe("Config", async () => {
  it("should create config", { skip: readOnly }, async () => {
    const { configPackageID, configID, adminID } = await createConfig(config);
    console.log({ configPackageID, configID, adminID });
    assert.ok(!!configPackageID);
    assert.ok(!!configID);
    assert.ok(!!adminID);
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
