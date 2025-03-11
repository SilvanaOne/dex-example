import { describe, it } from "node:test";
import assert from "node:assert";

import { Transaction } from "@mysten/sui/transactions";
import { getKey } from "../src/key.js";
import { readFile } from "node:fs/promises";
import { suiClient } from "../src/sui-client.js";
import { executeTx, waitTx } from "../src/execute.js";
import { publicKeyToU256 } from "../src/public-key.js";
import { DexObjects } from "./helpers/dex.js";
import { signDexFields } from "../src/sign.js";
import { Operation, User, UserTradingAccount } from "../src/types.js";
import { fetchDexAccount } from "../src/fetch.js";
import { wrapMinaSignature } from "../src/wrap.js";

const aliceSecretKey: string = process.env.SECRET_KEY_1!;
const bobSecretKey: string = process.env.SECRET_KEY_2!;
const botSecretKey: string = process.env.SECRET_KEY_3!;

if (!aliceSecretKey || !bobSecretKey || !botSecretKey) {
  throw new Error("Missing environment variables");
}

const packageID = process.env.PACKAGE_ID;
const dexID = process.env.DEX_ID;
const poolID = process.env.POOL_ID;
let dexObjects: DexObjects | undefined = undefined;
const traders: {
  name: string;
  user: User;
  secretKey: string;
  ask: number;
  bid: number;
}[] = [];
const accountsBefore: {
  name: string;
  account: UserTradingAccount;
}[] = [];
const accountsAfter: {
  name: string;
  account: UserTradingAccount;
}[] = [];
const amount = 1_000_000_000n;
const tradePrice = 2100;

describe("Trade", async () => {
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

  it("Alice and Bob should ask and bid", async () => {
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

    const { pool, alice, bob } = dexObjects;

    traders.push(
      {
        name: "Alice",
        user: alice,
        secretKey: aliceSecretKey,
        ask: 2100,
        bid: 2000,
      },
      {
        name: "Bob",
        user: bob,
        secretKey: bobSecretKey,
        ask: 2200,
        bid: 2100,
      }
    );

    for (const trader of traders) {
      if (!trader.user.minaPrivateKey) {
        throw new Error(`${trader.name} private key is not set`);
      }
      const { address, keypair } = await getKey({
        secretKey: trader.secretKey,
        name: trader.name,
      });

      const traderAccount = await fetchDexAccount(trader.user.minaPublicKey);
      if (!traderAccount) {
        throw new Error(`Cannot fetch ${trader.name} account`);
      }
      accountsBefore.push({
        name: trader.name,
        account: traderAccount,
      });

      let nonce = traderAccount.nonce;
      {
        const tx = new Transaction();

        const bidSignatures = await signDexFields({
          minaPrivateKey: trader.user.minaPrivateKey,
          poolPublicKey: pool.minaPublicKey,
          operation: Operation.BID,
          nonce,
          amount,
          price: BigInt(trader.bid) * amount,
        });

        const { minaSignature, suiSignature } = await wrapMinaSignature({
          minaSignature: bidSignatures.minaSignature,
          minaPublicKey: trader.user.minaPublicKey,
          poolPublicKey: pool.minaPublicKey,
          operation: Operation.BID,
          nonce,
          amount,
          price: BigInt(trader.bid) * amount,
        });

        nonce++;

        /*
          public fun bid(
              dex: &mut DEX,
              pool: &mut Pool,
              publicKey: u256,
              amount: u64,
              price: u64,
              userSignature_r: u256,
              userSignature_s: u256,
              validatorSignature: vector<u8>,

      */

        const bidArguments = [
          tx.object(dexID),
          tx.object(poolID),
          tx.pure.u256(publicKeyToU256(trader.user.minaPublicKey)),
          tx.pure.u64(amount),
          tx.pure.u64(BigInt(trader.bid) * amount),
          tx.pure.u256(minaSignature.r),
          tx.pure.u256(minaSignature.s),
          tx.pure.vector("u8", suiSignature),
        ];

        tx.moveCall({
          package: packageID,
          module: "trade",
          function: "bid",
          arguments: bidArguments,
        });

        tx.setSender(address);
        tx.setGasBudget(10_000_000);

        const signedTx = await tx.sign({
          signer: keypair,
          client: suiClient,
        });

        const { digest, events } = await executeTx(signedTx);
        console.log(`${trader.name} bid:`, {
          digest,
          events,
        });
        const waitResult = await waitTx(digest);
        if (waitResult.errors) {
          console.log(`Errors for tx ${digest}:`, waitResult.errors);
        }
        assert.ok(!waitResult.errors, "bid transaction failed");

        const newAccount = await fetchDexAccount(trader.user.minaPublicKey);
        if (!newAccount) {
          throw new Error("Cannot fetch accounts");
        }
        console.log(`${trader.name} account after bid:`, newAccount);
      }
      {
        const tx = new Transaction();

        const askSignatures = await signDexFields({
          minaPrivateKey: trader.user.minaPrivateKey,
          poolPublicKey: pool.minaPublicKey,
          operation: Operation.ASK,
          nonce,
          amount,
          price: BigInt(trader.ask) * amount,
        });

        const { minaSignature, suiSignature } = await wrapMinaSignature({
          minaSignature: askSignatures.minaSignature,
          minaPublicKey: trader.user.minaPublicKey,
          poolPublicKey: pool.minaPublicKey,
          operation: Operation.ASK,
          nonce,
          amount,
          price: BigInt(trader.ask) * amount,
        });

        nonce++;

        const askArguments = [
          tx.object(dexID),
          tx.object(poolID),
          tx.pure.u256(publicKeyToU256(trader.user.minaPublicKey)),
          tx.pure.u64(amount),
          tx.pure.u64(BigInt(trader.ask) * amount),
          tx.pure.u256(minaSignature.r),
          tx.pure.u256(minaSignature.s),
          tx.pure.vector("u8", suiSignature),
        ];

        tx.moveCall({
          package: packageID,
          module: "trade",
          function: "ask",
          arguments: askArguments,
        });

        tx.setSender(address);
        tx.setGasBudget(10_000_000);

        const signedTx = await tx.sign({
          signer: keypair,
          client: suiClient,
        });

        const { digest, events } = await executeTx(signedTx);
        console.log(`${trader.name} ask:`, {
          digest,
          events,
        });
        const waitResult = await waitTx(digest);
        if (waitResult.errors) {
          console.log(`Errors for tx ${digest}:`, waitResult.errors);
        }
        assert.ok(!waitResult.errors, "ask transaction failed");

        const newAccount = await fetchDexAccount(trader.user.minaPublicKey);
        if (!newAccount) {
          throw new Error("Cannot fetch accounts");
        }
        console.log(`${trader.name} account after ask:`, newAccount);
      }
    }
  });
  it("should trade", async () => {
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

    const { pool, alice, bob } = dexObjects;

    const { address, keypair } = await getKey({
      secretKey: botSecretKey,
      name: "bot",
    });

    /*
          public fun trade(
              dex: &mut DEX,
              pool: &mut Pool,
              buyerPublicKey: u256,
              sellerPublicKey: u256,
              amount: u64,
              price: u64,
      */
    const tx = new Transaction();

    const tradeArguments = [
      tx.object(dexID),
      tx.object(poolID),
      tx.pure.u256(publicKeyToU256(bob.minaPublicKey)),
      tx.pure.u256(publicKeyToU256(alice.minaPublicKey)),
      tx.pure.u64(amount),
      tx.pure.u64(BigInt(tradePrice) * amount),
    ];

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "trade",
      arguments: tradeArguments,
    });

    tx.setSender(address);
    tx.setGasBudget(10_000_000);

    const signedTx = await tx.sign({
      signer: keypair,
      client: suiClient,
    });

    const { digest, events } = await executeTx(signedTx);
    console.log(`trade:`, {
      digest,
      events,
    });
    const waitResult = await waitTx(digest);
    if (waitResult.errors) {
      console.log(`Errors for tx ${digest}:`, waitResult.errors);
    }
    assert.ok(!waitResult.errors, "trade transaction failed");

    const newAliceAccount = await fetchDexAccount(alice.minaPublicKey);
    if (!newAliceAccount) {
      throw new Error("Cannot fetch accounts");
    }
    console.log(`Alice account after trade:`, newAliceAccount);

    const newBobAccount = await fetchDexAccount(bob.minaPublicKey);
    if (!newBobAccount) {
      throw new Error("Cannot fetch accounts");
    }
    console.log(`Bob account after trade:`, newBobAccount);
    accountsAfter.push({
      name: "Alice",
      account: newAliceAccount,
    });
    accountsAfter.push({
      name: "Bob",
      account: newBobAccount,
    });

    for (const account of accountsBefore) {
      const accountAfter = accountsAfter.find(
        (a) => a.name === account.name
      )?.account;
      if (!accountAfter) {
        throw new Error(`Cannot find account after for ${account.name}`);
      }
      compareAccounts({
        name: account.name,
        before: account.account,
        after: accountAfter,
      });
    }
  });
});

function compareAccounts(params: {
  name: string;
  before: UserTradingAccount;
  after: UserTradingAccount;
}) {
  const { name, before, after } = params;
  const baseBefore = before.baseTokenBalance.amount;
  const baseAfter = after.baseTokenBalance.amount;
  const quoteBefore = before.quoteTokenBalance.amount;
  const quoteAfter = after.quoteTokenBalance.amount;
  console.log(
    `${name} base token balance: ${baseBefore / 1_000_000_000n} -> ${
      baseAfter / 1_000_000_000n
    }`
  );
  console.log(
    `${name} quote token balance: ${quoteBefore / 1_000_000_000n} -> ${
      quoteAfter / 1_000_000_000n
    }`
  );
}
