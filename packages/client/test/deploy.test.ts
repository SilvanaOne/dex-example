import { describe, it } from "node:test";
import assert from "node:assert";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { Transaction } from "@mysten/sui/transactions";
import { getKey } from "../src/key.js";
import { writeFile } from "node:fs/promises";
import { suiClient } from "../src/sui-client.js";
import { buildPublishTx } from "../src/publish.js";
import { buildMovePackage } from "../src/build.js";
import { executeTx, waitTx } from "../src/execute.js";
import { TokenId } from "o1js";
import { publicKeyToU256 } from "../src/public-key.js";
import { createInitialState, DexObjects } from "./helpers/dex.js";

const userSecretKeys: string[] = [
  process.env.SECRET_KEY_1!,
  process.env.SECRET_KEY_2!,
  process.env.SECRET_KEY_3!,
];
const adminSecretKey: string = process.env.ADMIN_SECRET_KEY!;
const validatorSecretKey: string = process.env.VALIDATOR_SECRET_KEY!;
const proverSecretKey: string = process.env.PROVER_SECRET_KEY!;

if (!adminSecretKey || !validatorSecretKey || !proverSecretKey) {
  throw new Error("Missing environment variables");
}
userSecretKeys.map((secretKey) => {
  if (!secretKey) {
    throw new Error("Missing environment variables");
  }
});

let packageID: string | undefined = undefined;
let dexID: string | undefined = undefined;
let poolID: string | undefined = undefined;
let dexObjects: DexObjects | undefined = undefined;

describe("Deploy DEX contracts", async () => {
  it("should publish SUI DEX package", async () => {
    const { address, keypair } = await getKey({
      secretKey: adminSecretKey,
      name: "admin",
    });
    const { modules, dependencies } = await buildMovePackage("../coordination");
    const { signedTx } = await buildPublishTx({
      modules,
      dependencies,
      address,
      keypair,
    });
    const { tx, digest, events } = await executeTx(signedTx);
    tx.objectChanges?.map((change) => {
      if (change.type === "published") {
        packageID = change.packageId;
      } else if (
        change.type === "created" &&
        change.objectType.includes("trade::DEX") &&
        !change.objectType.includes("display")
      ) {
        dexID = change.objectId;
      }
    });
    console.log("Published DEX contract:", {
      digest,
      events,
      packageID,
      dexID,
    });

    const waitResult = await waitTx(digest);
    if (waitResult.errors) {
      console.log(`Errors for tx ${digest}:`, waitResult.errors);
    }
    assert.ok(!waitResult.errors, "publish transaction failed");
    assert.ok(packageID, "package ID is not set");
    assert.ok(dexID, "DEX ID is not set");
  });

  it("should create tokens, pool and setup public keys", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }

    if (!dexID) {
      throw new Error("DEX_ID is not set");
    }
    const { address, keypair } = await getKey({
      secretKey: adminSecretKey,
      name: "admin",
    });

    const { keypair: validator } = await getKey({
      secretKey: validatorSecretKey,
      name: "validator",
      topup: false,
    });

    dexObjects = createInitialState();
    const { baseToken, quoteToken, pool } = dexObjects;
    const tx = new Transaction();

    /*
            dex: &mut DEX,
            publicKey: u256,
            publicKeyBase58: String,
            tokenId: u256,
            token: String,
            name: String,
            description: String,
            image: String,
            ctx: &mut TxContext,
    */
    const baseTokenArguments = [
      tx.object(dexID),
      tx.pure.u256(publicKeyToU256(baseToken.minaPublicKey)),
      tx.pure.string(baseToken.minaPublicKey),
      tx.pure.u256(TokenId.fromBase58(baseToken.tokenId).toBigInt()),
      tx.pure.string(baseToken.token),
      tx.pure.string(baseToken.name),
      tx.pure.string(baseToken.description),
      tx.pure.string(baseToken.image),
    ];

    const quoteTokenArguments = [
      tx.object(dexID),
      tx.pure.u256(publicKeyToU256(quoteToken.minaPublicKey)),
      tx.pure.string(quoteToken.minaPublicKey),
      tx.pure.u256(TokenId.fromBase58(quoteToken.tokenId).toBigInt()),
      tx.pure.string(quoteToken.token),
      tx.pure.string(quoteToken.name),
      tx.pure.string(quoteToken.description),
      tx.pure.string(quoteToken.image),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "create_token",
      arguments: baseTokenArguments,
    });

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "create_token",
      arguments: quoteTokenArguments,
    });

    /*
        public fun create_pool(
            dex: &mut DEX,
            clock: &Clock,
            name: String,
            publicKey: u256,
            publicKeyBase58: String,
            baseTokenId: u256,
            quoteTokenId: u256,
            ctx: &mut TxContext,
    */

    const poolArguments = [
      tx.object(dexID),
      tx.object(SUI_CLOCK_OBJECT_ID),
      tx.pure.string(pool.name),
      tx.pure.u256(publicKeyToU256(pool.minaPublicKey)),
      tx.pure.string(pool.minaPublicKey),
      tx.pure.u256(TokenId.fromBase58(pool.baseTokenId).toBigInt()),
      tx.pure.u256(TokenId.fromBase58(pool.quoteTokenId).toBigInt()),
      tx.pure.u64(pool.lastPrice),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "create_pool",
      arguments: poolArguments,
    });
    /*
        public fun set_public_key(
            dex: &mut DEX,
            public_key: vector<u8>,
            clock: &Clock,
            ctx: &mut TxContext,
    */

    const publicKeyArguments = [
      tx.object(dexID),
      tx.pure.vector("u8", validator.getPublicKey().toRawBytes()),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "set_public_key",
      arguments: publicKeyArguments,
    });

    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const signedTx = await tx.sign({
      signer: keypair,
      client: suiClient,
    });

    const { tx: initTx, digest, events } = await executeTx(signedTx);
    initTx.objectChanges?.map((change) => {
      if (
        change.type === "created" &&
        change.objectType.includes("trade::Pool") &&
        !change.objectType.includes("display")
      ) {
        poolID = change.objectId;
      }
    });
    console.log("Created initial state:", {
      initTx,
      objectChanges: initTx.objectChanges,
      digest,
      events,
      poolID,
    });
    const waitResult = await waitTx(digest);
    if (waitResult.errors) {
      console.log(`Errors for tx ${digest}:`, waitResult.errors);
    }
    assert.ok(!waitResult.errors, "publish transaction failed");
    assert.ok(poolID, "pool ID is not set");
  });

  it("should create users", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }

    if (!dexID) {
      throw new Error("DEX_ID is not set");
    }

    if (!poolID) {
      throw new Error("POOL_ID is not set");
    }

    if (!dexObjects) {
      throw new Error("DEX_OBJECTS is not set");
    }

    const { address, keypair } = await getKey({
      secretKey: adminSecretKey,
      name: "admin",
    });

    const { faucet, liquidityProvider, alice, bob } = dexObjects;
    const tx = new Transaction();

    /*
        public fun create_account(
            dex: &mut DEX,
            pool: &mut Pool,
            publicKey: u256,
            publicKeyBase58: String,
            role: String,
            image: String,
            name: String,
            baseBalance: u64,
            quoteBalance: u64,
            ctx: &mut TxContext,
    */

    const faucetAccountArguments = [
      tx.object(dexID),
      tx.object(poolID),
      tx.pure.u256(publicKeyToU256(faucet.minaPublicKey)),
      tx.pure.string(faucet.minaPublicKey),
      tx.pure.string(faucet.role),
      tx.pure.string(faucet.image),
      tx.pure.string(faucet.name),
      tx.pure.u64(faucet.account.baseTokenBalance.amount),
      tx.pure.u64(faucet.account.quoteTokenBalance.amount),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "create_account",
      arguments: faucetAccountArguments,
    });

    const liquidityProviderAccountArguments = [
      tx.object(dexID),
      tx.object(poolID),
      tx.pure.u256(publicKeyToU256(liquidityProvider.minaPublicKey)),
      tx.pure.string(liquidityProvider.minaPublicKey),
      tx.pure.string(liquidityProvider.role),
      tx.pure.string(liquidityProvider.image),
      tx.pure.string(liquidityProvider.name),
      tx.pure.u64(liquidityProvider.account.baseTokenBalance.amount),
      tx.pure.u64(liquidityProvider.account.quoteTokenBalance.amount),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "create_account",
      arguments: liquidityProviderAccountArguments,
    });

    const aliceAccountArguments = [
      tx.object(dexID),
      tx.object(poolID),
      tx.pure.u256(publicKeyToU256(alice.minaPublicKey)),
      tx.pure.string(alice.minaPublicKey),
      tx.pure.string(alice.role),
      tx.pure.string(alice.image),
      tx.pure.string(alice.name),
      tx.pure.u64(alice.account.baseTokenBalance.amount),
      tx.pure.u64(alice.account.quoteTokenBalance.amount),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "create_account",
      arguments: aliceAccountArguments,
    });

    const bobAccountArguments = [
      tx.object(dexID),
      tx.object(poolID),
      tx.pure.u256(publicKeyToU256(bob.minaPublicKey)),
      tx.pure.string(bob.minaPublicKey),
      tx.pure.string(bob.role),
      tx.pure.string(bob.image),
      tx.pure.string(bob.name),
      tx.pure.u64(bob.account.baseTokenBalance.amount),
      tx.pure.u64(bob.account.quoteTokenBalance.amount),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "create_account",
      arguments: bobAccountArguments,
    });

    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const signedTx = await tx.sign({
      signer: keypair,
      client: suiClient,
    });

    const { digest, events } = await executeTx(signedTx);
    console.log("Created users:", {
      digest,
      events,
    });
    const waitResult = await waitTx(digest);
    if (waitResult.errors) {
      console.log(`Errors for tx ${digest}:`, waitResult.errors);
    }
    assert.ok(!waitResult.errors, "init transaction failed");
  });
  it("should save object IDs to .env.contracts", async () => {
    const envContent = `# Chains
SUI_CHAIN=${process.env.SUI_CHAIN}
MINA_CHAIN=${process.env.MINA_CHAIN}

# Package ID
PACKAGE_ID=${packageID}

# Object IDs
DEX_ID=${dexID}
POOL_ID=${poolID}`;
    await writeFile(".env.public", envContent);
  });

  it("should save DEX objects to data folder", async () => {
    await writeFile(
      "./data/dex-objects.json",
      JSON.stringify(
        { dexObjects },
        (_, value) =>
          typeof value === "bigint" ? value.toString() + "n" : value,
        2
      )
    );
  });
});
