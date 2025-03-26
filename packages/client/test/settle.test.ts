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
import { fetchMinaAccount, initBlockchain } from "@silvana-one/mina-utils";
import { DEXContract } from "../src/contracts/contract.js";
import { PrivateKey, PublicKey } from "o1js";
import { checkMinaContractDeployment } from "../src/deploy.js";

let dexObjects: DexObjects | undefined = undefined;
const minaAdminSecretKey: string = process.env.TEST_ACCOUNT_1_PRIVATE_KEY!;

const chain = process.env.MINA_CHAIN! as
  | "local"
  | "devnet"
  | "zeko"
  | "mainnet";
if (
  chain !== "local" &&
  chain !== "devnet" &&
  chain !== "zeko" &&
  chain !== "mainnet"
) {
  throw new Error(`Invalid chain: ${chain}`);
}

let currentMinaBlockNumber: number = 0;

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
    await initBlockchain(chain);
    const poolPublicKey = pool.minaPublicKey;
    console.log("poolPublicKey", poolPublicKey);
    const dexContract = new DEXContract(PublicKey.fromBase58(poolPublicKey));

    let isDeployed = await checkMinaContractDeployment({
      contractAddress: poolPublicKey,
      adminPublicKey: PrivateKey.fromBase58(minaAdminSecretKey)
        .toPublicKey()
        .toBase58(),
    });
    while (!isDeployed) {
      console.log("DEX contract is not deployed, retrying...");
      await sleep(60000);
      isDeployed = await checkMinaContractDeployment({
        contractAddress: poolPublicKey,
        adminPublicKey: minaAdminSecretKey,
      });
    }

    await fetchMinaAccount({ publicKey: poolPublicKey, force: true });
    const contractBlockNumber = Number(
      dexContract.blockNumber.get().toBigInt()
    );
    console.log("contractBlockNumber", contractBlockNumber);
    currentMinaBlockNumber = contractBlockNumber + 1;
    console.log(
      "\x1b[32m%s\x1b[0m",
      "currentMinaBlockNumber",
      currentMinaBlockNumber
    );
    while (true) {
      await fetchMinaAccount({ publicKey: poolPublicKey, force: true });
      const contractBlockNumber = Number(
        dexContract.blockNumber.get().toBigInt()
      );
      console.log("contractBlockNumber", contractBlockNumber);
      if (contractBlockNumber >= currentMinaBlockNumber) {
        currentMinaBlockNumber = contractBlockNumber + 1;
        console.log(
          "\x1b[32m%s\x1b[0m",
          "updating currentMinaBlockNumber to ",
          currentMinaBlockNumber
        );
      }
      const dex = await fetchDex();
      if (!dex) {
        throw new Error("DEX is not received");
      }
      let block_number: number | undefined = undefined;
      let previous_block_number: number | undefined = undefined;
      let current_block_number = Number(dex.block_number) - 1;
      console.log("current_block_number", current_block_number);
      //console.log("previous_block_address", previous_block_address);

      while (!block_number && current_block_number > currentMinaBlockNumber) {
        const block = await fetchBlock({ blockNumber: current_block_number });
        block_number = Number(block.block.block_number);
        console.log("block", block_number);

        if (current_block_number === currentMinaBlockNumber) {
          block_number = previous_block_number;
        }
        previous_block_number = current_block_number + 1;
      }
      console.log("block_number", block_number);
      if (block_number) {
        const block = await fetchBlock({ blockNumber: block_number });
        console.log("block.block.mina_tx_hash", block.block.mina_tx_hash);
        console.log(
          "mina_tx_included_in_block",
          block.block.mina_tx_included_in_block
        );

        if (
          //block.block.mina_tx_hash !== null ||
          block.block.mina_tx_included_in_block
        ) {
          console.log(
            "The block already settled, updating currentMinaBlockNumber to ",
            currentMinaBlockNumber + 1
          );
          currentMinaBlockNumber++;
        } else {
          console.log("Fetching proofs for block", currentMinaBlockNumber);
          const proofs = await fetchBlockProofs({
            blockNumber: currentMinaBlockNumber,
          });
          if (proofs.isFinished && proofs.blockProof && block_number) {
            console.log("Settling block", currentMinaBlockNumber);
            const blockProof = proofs.blockProof;
            const proofData = await readFromWalrus({
              blobId: blockProof,
            });
            if (!proofData) {
              throw new Error("Proof data is not received");
            }
            const state = await SequenceState.fromJSON(proofData);
            if (!state.dexProof) {
              throw new Error("DEX proof is not received");
            }
            await settleMinaContract({
              poolPublicKey,
              adminPrivateKey: minaAdminSecretKey,
              proof: state.dexProof,
            });
            currentMinaBlockNumber++;
          } else {
            console.log("Proofs are not ready, retrying...");
          }
        }
      }
      await sleep(30000);
    }
  });
});
