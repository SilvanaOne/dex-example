import { describe, it } from "node:test";
import assert from "node:assert";
import {
  CoinBalance,
  getFullnodeUrl,
  SuiClient,
  SuiEvent,
} from "@mysten/sui/client";
import { bcs } from "@mysten/sui/bcs";
import { MIST_PER_SUI } from "@mysten/sui/utils";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Transaction, TransactionArgument } from "@mysten/sui/transactions";
import crypto from "node:crypto";
import secp256k1 from "secp256k1";
import { getKey } from "../src/key.js";
import { SignatureWithBytes } from "@mysten/sui/cryptography";
import { writeFile } from "node:fs/promises";
import { suiClient } from "../src/sui-client.js";
import { buildPublishTx } from "../src/publish.js";
import { buildMovePackage } from "../src/build.js";
import { executeTx, waitTx } from "../src/execute.js";
import { PrivateKey, PublicKey, TokenId } from "o1js";

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

let packageID = process.env.PACKAGE_ID;
let objectID = process.env.OBJECT_ID;
let poolID = process.env.POOL_ID;

describe("Deploy DEX contracts", async () => {
  it("should publish SUI DEX package", async () => {
    const { address, keypair } = await getKey({
      secretKey: adminSecretKey,
      name: "admin",
    });
    const { modules, dependencies } = await buildMovePackage("../coordination");
    const signedTx = await buildPublishTx({
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
        change.objectType.includes("trade::DEX")
      ) {
        objectID = change.objectId;
      }
    });
    console.log("Published DEX contract:", {
      digest,
      events,
      packageID,
      objectID,
    });

    await waitTx(digest);
  });

  it("should create pool", async () => {
    if (!packageID) {
      throw new Error("PACKAGE_ID is not set");
    }

    if (!objectID) {
      throw new Error("OBJECT_ID is not set");
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

    const poolPublicKey = PrivateKey.random().toPublicKey();
    const baseTokenPublicKey = PrivateKey.random().toPublicKey();
    const baseTokenTokenId = TokenId.derive(baseTokenPublicKey);
    const quoteTokenPublicKey = PrivateKey.random().toPublicKey();
    const quoteTokenTokenId = TokenId.derive(quoteTokenPublicKey);
    const tx = new Transaction();

    /*
        public fun create_pool(
            dex: &mut DEX,
            name: String,
            publicKey: MinaPublicKey,
            baseToken: Token,
            quoteToken: Token,
            ctx: &mut TxContext,
        )

        public struct Token has copy, drop, store {
            publicKey: MinaPublicKey,
            tokenId: u256,
            token: String,
            name: String,
            description: String,
        }
    */

    const MinaPublicKey = bcs.struct("MinaPublicKey", {
      x: bcs.u256(),
      isOdd: bcs.bool(),
    });
    const Token = bcs.struct("Token", {
      publicKey: MinaPublicKey,
      tokenId: bcs.u256(),
      token: bcs.string(),
      name: bcs.string(),
      description: bcs.string(),
    });

    const NumEvent = bcs.struct("NumEvent", {
      num1: bcs.u256(),
      num2: bcs.u256(),
    });

    tx.moveCall({
      package: packageID,
      module: "trade",
      function: "num_event",
      arguments: [
        tx.pure(
          NumEvent.serialize({
            num1: 1,
            num2: 2,
          }).toBytes()
        ),
      ],
    });

    // tx.moveCall({
    //   package: packageID,
    //   module: "trade",
    //   function: "create_pool",
    //   arguments: [
    //     tx.object(objectID),
    //     tx.pure.string("DETH/DUSD"),
    //     tx.pure(
    //       MinaPublicKey.serialize({
    //         x: poolPublicKey.x.toBigInt(),
    //         isOdd: poolPublicKey.isOdd.toBoolean(),
    //       })
    //     ),
    //     tx.pure(
    //       Token.serialize({
    //         publicKey: {
    //           x: baseTokenPublicKey.x.toBigInt(),
    //           isOdd: baseTokenPublicKey.isOdd.toBoolean(),
    //         },
    //         tokenId: baseTokenTokenId.toBigInt(),
    //         token: "DETH",
    //         name: "Wrapped Ethereum",
    //         description: "Wrapped Ethereum token on Silvana DEX",
    //       })
    //     ),
    //     tx.pure(
    //       Token.serialize({
    //         publicKey: {
    //           x: quoteTokenPublicKey.x.toBigInt(),
    //           isOdd: quoteTokenPublicKey.isOdd.toBoolean(),
    //         },
    //         tokenId: quoteTokenTokenId.toBigInt(),
    //         token: "DUSD",
    //         name: "Wrapped USD",
    //         description: "Wrapped USD token on Silvana DEX",
    //       })
    //     ),
    //   ],
    // });

    tx.setSender(address);
    tx.setGasBudget(10_000_000);

    const signedTx = await tx.sign({
      signer: keypair,
      client: suiClient,
    });

    const { tx: poolTx, digest, events } = await executeTx(signedTx);
    poolTx.objectChanges?.map((change) => {
      if (
        change.type === "created" &&
        change.objectType.includes("trade::DEX")
      ) {
        poolID = change.objectId;
      }
    });
    console.log("Created pool:", {
      poolTx,
      digest,
      events,
      poolID,
    });
    await waitTx(digest);
  });
  it("should save object IDs to .env.contracts", async () => {
    const envContent = `PACKAGE_ID=${packageID}
OBJECT_ID=${objectID}
POOL_ID=${poolID}`;
    await writeFile(".env.contracts", envContent);
  });
});
