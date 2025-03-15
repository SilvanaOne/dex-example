import { describe, it } from "node:test";
import assert from "node:assert";
import {
  UInt32,
  Bool,
  UInt64,
  PrivateKey,
  PublicKey,
  Field,
  Struct,
  ZkProgram,
  Gadgets,
  Provable,
  Cache,
  Signature,
  VerificationKey,
  verify,
} from "o1js";
import { DEXProgram, DEXProof } from "../src/contracts/rollup.js";
import {
  Operation,
  ActionCreateAccount,
  ActionAsk,
  ActionBid,
  ActionTransfer,
  ActionTrade,
} from "../src/types.js";
import {
  RollupActionCreateAccount,
  RollupActionAsk,
  RollupActionBid,
  RollupActionTransfer,
  RollupActionTrade,
  DEXMap,
  DEXState,
  RollupUserTradingAccount,
  RollupOrder,
} from "../src/contracts/types.js";
import { signDexFields } from "../src/sign.js";

function getUser() {
  const privateKey = PrivateKey.random();
  return {
    publicKey: privateKey.toPublicKey(),
    privateKey,
  };
}

let vk: VerificationKey | null = null;
const poolPublicKey = PrivateKey.random().toPublicKey();
const faucetBaseTokenAmount = 1_000_000_000n;
const faucetQuoteTokenAmount = 2_000_000_000_000n;
const tradeBaseTokenAmount = 1_000_000_000n;
const tradeQuoteTokenAmount = 2_000_000_000_000n;
const tradePrice = 2_000_000_000_000n;
const users: {
  [key: string]: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
  };
} = {
  alice: getUser(),
  bob: getUser(),
  faucet: getUser(),
};

const operations: {
  operation: Operation;
  action:
    | ActionCreateAccount
    | ActionAsk
    | ActionBid
    | ActionTransfer
    | ActionTrade;
}[] = [
  {
    operation: Operation.CREATE_ACCOUNT,
    action: {
      poolPublicKey: poolPublicKey.toBase58(),
      publicKey: users.faucet.publicKey.toBase58(),
      baseBalance: 1_000_000_000_000n,
      quoteBalance: 2_000_000_000_000_000n,
      nonce: 0n,
      address: "",
      publicKeyBase58: users.faucet.publicKey.toBase58(),
      name: "Faucet",
      role: "faucet",
      image: "",
    } as ActionCreateAccount,
  },
  {
    operation: Operation.CREATE_ACCOUNT,
    action: {
      poolPublicKey: poolPublicKey.toBase58(),
      publicKey: users.alice.publicKey.toBase58(),
      baseBalance: 0n,
      quoteBalance: 0n,
      nonce: 0n,
      address: "",
      publicKeyBase58: users.alice.publicKey.toBase58(),
      name: "Alice",
      role: "user",
      image: "",
    } as ActionCreateAccount,
  },
  {
    operation: Operation.CREATE_ACCOUNT,
    action: {
      poolPublicKey: poolPublicKey.toBase58(),
      publicKey: users.bob.publicKey.toBase58(),
      baseBalance: 0n,
      quoteBalance: 0n,
      nonce: 0n,
      address: "",
      publicKeyBase58: users.bob.publicKey.toBase58(),
      name: "Bob",
      role: "user",
      image: "",
    } as ActionCreateAccount,
  },
  {
    operation: Operation.TRANSFER,
    action: {
      senderPublicKey: users.faucet.publicKey.toBase58(),
      receiverPublicKey: users.alice.publicKey.toBase58(),
      baseTokenAmount: faucetBaseTokenAmount,
      quoteTokenAmount: faucetQuoteTokenAmount,
      senderNonce: 0,
      receiverNonce: 0,
      senderSignature: (
        await signDexFields({
          poolPublicKey: poolPublicKey.toBase58(),
          minaPrivateKey: users.faucet.privateKey.toBase58(),
          operation: Operation.TRANSFER,
          nonce: 0,
          baseTokenAmount: faucetBaseTokenAmount,
          quoteTokenAmount: faucetQuoteTokenAmount,
          receiverPublicKey: users.alice.publicKey.toBase58(),
        })
      ).minaSignature,
    } as ActionTransfer,
  },
  {
    operation: Operation.TRANSFER,
    action: {
      senderPublicKey: users.faucet.publicKey.toBase58(),
      receiverPublicKey: users.bob.publicKey.toBase58(),
      baseTokenAmount: faucetBaseTokenAmount,
      quoteTokenAmount: faucetQuoteTokenAmount,
      senderNonce: 1,
      receiverNonce: 0,
      senderSignature: (
        await signDexFields({
          poolPublicKey: poolPublicKey.toBase58(),
          minaPrivateKey: users.faucet.privateKey.toBase58(),
          operation: Operation.TRANSFER,
          nonce: 1,
          baseTokenAmount: faucetBaseTokenAmount,
          quoteTokenAmount: faucetQuoteTokenAmount,
          receiverPublicKey: users.bob.publicKey.toBase58(),
        })
      ).minaSignature,
    } as ActionTransfer,
  },
  {
    operation: Operation.ASK,
    action: {
      userPublicKey: users.alice.publicKey.toBase58(),
      poolPublicKey: poolPublicKey.toBase58(),
      baseTokenAmount: tradeBaseTokenAmount,
      price: tradePrice,
      isSome: true,
      nonce: 1,
      userSignature: (
        await signDexFields({
          poolPublicKey: poolPublicKey.toBase58(),
          minaPrivateKey: users.alice.privateKey.toBase58(),
          operation: Operation.ASK,
          nonce: 1,
          baseTokenAmount: tradeBaseTokenAmount,
          price: tradePrice,
        })
      ).minaSignature,
    } as ActionAsk,
  },
  {
    operation: Operation.BID,
    action: {
      userPublicKey: users.bob.publicKey.toBase58(),
      poolPublicKey: poolPublicKey.toBase58(),
      baseTokenAmount: tradeBaseTokenAmount,
      price: tradePrice,
      isSome: true,
      nonce: 1,
      userSignature: (
        await signDexFields({
          poolPublicKey: poolPublicKey.toBase58(),
          minaPrivateKey: users.bob.privateKey.toBase58(),
          operation: Operation.BID,
          nonce: 1,
          baseTokenAmount: tradeBaseTokenAmount,
          price: tradePrice,
        })
      ).minaSignature,
    } as ActionBid,
  },
  {
    operation: Operation.TRADE,
    action: {
      buyerPublicKey: users.bob.publicKey.toBase58(),
      sellerPublicKey: users.alice.publicKey.toBase58(),
      poolPublicKey: poolPublicKey.toBase58(),
      baseTokenAmount: tradeBaseTokenAmount,
      quoteTokenAmount: tradeQuoteTokenAmount,
      price: tradePrice,
      buyerNonce: 2,
      sellerNonce: 2,
    } as ActionTrade,
  },
];

function convertActionToRollupAction(params: {
  operation: Operation;
  action:
    | ActionCreateAccount
    | ActionAsk
    | ActionBid
    | ActionTransfer
    | ActionTrade;
}):
  | RollupActionCreateAccount
  | RollupActionAsk
  | RollupActionBid
  | RollupActionTransfer
  | RollupActionTrade {
  const { action, operation } = params;
  switch (operation) {
    case Operation.CREATE_ACCOUNT:
      return RollupActionCreateAccount.fromAction(
        action as ActionCreateAccount
      );
    case Operation.ASK:
      return RollupActionAsk.fromAction(action as ActionAsk);
    case Operation.BID:
      return RollupActionBid.fromAction(action as ActionBid);
    case Operation.TRANSFER:
      return RollupActionTransfer.fromAction(action as ActionTransfer);
    case Operation.TRADE:
      return RollupActionTrade.fromAction(action as ActionTrade);
    default:
      throw new Error(
        `convertActionToRollupAction: Unsupported operation: ${operation}`
      );
  }
}

const fieldOperations: {
  operation: Operation;
  action:
    | RollupActionCreateAccount
    | RollupActionAsk
    | RollupActionBid
    | RollupActionTransfer
    | RollupActionTrade;
}[] = operations.map((item) => ({
  operation: item.operation,
  action: convertActionToRollupAction({
    operation: item.operation,
    action: item.action,
  }),
}));

const proofs: DEXProof[] = [];
const mergeJobs: number[][] = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 11],
  [12, 13],
];
let map = new DEXMap();
let dexState = new DEXState({
  poolPublicKey: poolPublicKey,
  root: map.root,
  length: map.length,
  actionState: Field.random(),
  sequence: UInt64.from(0),
});

describe("Circuits", async () => {
  it("should analyze circuits methods", async () => {
    console.log("Analyzing circuits methods...");
    console.time("methods analyzed");
    const methods: {
      name: string;
      result: any;
      skip: boolean;
    }[] = [];
    methods.push({
      name: "DEXProgram",
      result: await DEXProgram.analyzeMethods(),
      skip: false,
    });

    console.timeEnd("methods analyzed");
    const maxRows = 2 ** 16;
    for (const contract of methods) {
      // calculate the size of the contract - the sum or rows for each method
      const size = Object.values(contract.result).reduce(
        (acc, method) => acc + (method as any).rows,
        0
      );
      // calculate percentage rounded to 0 decimal places
      const percentage =
        Math.round((((size as number) * 100) / maxRows) * 100) / 100;

      console.log(
        `${contract.name} rows: ${size} (${percentage}% of max ${maxRows} rows)`
      );
      if (contract.skip !== true)
        for (const method in contract.result) {
          console.log(
            "\t",
            method,
            `rows:`,
            (contract.result as any)[method].rows
          );
        }
    }
  });

  it("should compile DEX Program", async () => {
    console.log("compiling...");
    console.time("compiled");
    const cache = Cache.FileSystem("./cache");
    const { verificationKey } = await DEXProgram.compile({ cache });
    vk = verificationKey;
    console.timeEnd("compiled");
  });

  it("should create proofs", async () => {
    console.log("proving...");
    if (!vk) {
      throw new Error("vk is null");
    }
    console.time("proved");
    for (const item of fieldOperations) {
      console.log(`proving ${item.operation.toString()}...`);
      console.time(item.operation.toString());
      let dexProof: DEXProof;
      switch (item.operation) {
        case Operation.CREATE_ACCOUNT:
          {
            const { proof, auxiliaryOutput } = await DEXProgram.createAccount(
              dexState,
              map,
              item.action as RollupActionCreateAccount
            );
            dexProof = proof;
            map.root = proof.publicOutput.root;
            map.length = proof.publicOutput.length;
            dexState = proof.publicOutput;
          }
          break;
        case Operation.ASK:
          {
            const account = new RollupUserTradingAccount({
              baseTokenBalance: {
                amount: UInt64.from(faucetBaseTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              quoteTokenBalance: {
                amount: UInt64.from(faucetQuoteTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              bid: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              ask: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              nonce: UInt64.from(0),
            });
            const { proof, auxiliaryOutput } = await DEXProgram.ask(
              dexState,
              map,
              item.action as RollupActionAsk,
              account
            );
            dexProof = proof;
            map = auxiliaryOutput;
            map.root = proof.publicOutput.root;
            map.length = proof.publicOutput.length;
            dexState = proof.publicOutput;
          }
          break;
        case Operation.BID:
          {
            const account = new RollupUserTradingAccount({
              baseTokenBalance: {
                amount: UInt64.from(faucetBaseTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              quoteTokenBalance: {
                amount: UInt64.from(faucetQuoteTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              bid: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              ask: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              nonce: UInt64.from(0),
            });
            const { proof, auxiliaryOutput } = await DEXProgram.bid(
              dexState,
              map,
              item.action as RollupActionBid,
              account
            );
            dexProof = proof;
            map = auxiliaryOutput;
            map.root = proof.publicOutput.root;
            map.length = proof.publicOutput.length;
            dexState = proof.publicOutput;
          }
          break;
        case Operation.TRADE:
          {
            const buyerAccount = new RollupUserTradingAccount({
              baseTokenBalance: {
                amount: UInt64.from(faucetBaseTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              quoteTokenBalance: {
                amount: UInt64.from(faucetQuoteTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              bid: new RollupOrder({
                amount: UInt64.from(tradeBaseTokenAmount),
                price: UInt64.from(tradePrice),
              }),
              ask: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              nonce: UInt64.from(1),
            });
            const sellerAccount = new RollupUserTradingAccount({
              baseTokenBalance: {
                amount: UInt64.from(faucetBaseTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              quoteTokenBalance: {
                amount: UInt64.from(faucetQuoteTokenAmount),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              bid: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              ask: new RollupOrder({
                amount: UInt64.from(tradeBaseTokenAmount),
                price: UInt64.from(tradePrice),
              }),
              nonce: UInt64.from(1),
            });
            const { proof, auxiliaryOutput } = await DEXProgram.trade(
              dexState,
              map,
              item.action as RollupActionTrade,
              buyerAccount,
              sellerAccount
            );
            dexProof = proof;
            map = auxiliaryOutput;
            map.root = proof.publicOutput.root;
            map.length = proof.publicOutput.length;
            dexState = proof.publicOutput;
          }
          break;
        case Operation.TRANSFER:
          {
            const senderAccount = new RollupUserTradingAccount({
              baseTokenBalance: {
                amount: UInt64.from(
                  1_000_000_000_000n -
                    faucetBaseTokenAmount *
                      (
                        item.action as RollupActionTransfer
                      ).senderNonce.toBigInt()
                ),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              quoteTokenBalance: {
                amount: UInt64.from(
                  2_000_000_000_000_000n -
                    faucetQuoteTokenAmount *
                      (
                        item.action as RollupActionTransfer
                      ).senderNonce.toBigInt()
                ),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              bid: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              ask: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              nonce: UInt64.from(
                (item.action as RollupActionTransfer).senderNonce
              ),
            });
            const receiverAccount = new RollupUserTradingAccount({
              baseTokenBalance: {
                amount: UInt64.from(0),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              quoteTokenBalance: {
                amount: UInt64.from(0),
                stakedAmount: UInt64.from(0),
                borrowedAmount: UInt64.from(0),
              },
              bid: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              ask: new RollupOrder({
                amount: UInt64.from(0),
                price: UInt64.from(0),
              }),
              nonce: UInt64.from(0),
            });
            const { proof, auxiliaryOutput } = await DEXProgram.transfer(
              dexState,
              map,
              item.action as RollupActionTransfer,
              senderAccount,
              receiverAccount
            );
            dexProof = proof;
            map = auxiliaryOutput;
            map.root = proof.publicOutput.root;
            map.length = proof.publicOutput.length;
            dexState = proof.publicOutput;
          }
          break;

        default:
          throw new Error(`prove: Unsupported operation: ${item.operation}`);
      }
      proofs.push(dexProof);
      console.timeEnd(item.operation.toString());
    }
    console.timeEnd("proved");
    console.log(`proofs: ${proofs.length}`);
  });

  it("should merge proofs", async () => {
    console.log("merging...");
    if (!vk) {
      throw new Error("vk is null");
    }
    console.time("merged");
    let i = 0;
    for (const job of mergeJobs) {
      console.log(`merging ${job[0]} and ${job[1]}...`);
      console.time(job.toString());
      const mergedProof = await DEXProgram.merge(
        proofs[job[0]].publicInput,
        proofs[job[0]],
        proofs[job[1]]
      );
      console.timeEnd(job.toString());
      proofs.push(mergedProof.proof);
    }
    console.timeEnd("merged");
    const blockProof = proofs[proofs.length - 1].toJSON();
    const ok = await verify(blockProof, vk);
    console.log(`block proof: ${ok}`);
  });
});
