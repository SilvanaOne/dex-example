// import {
//   ZkProgram,
//   PublicKey,
//   Poseidon,
//   UInt64,
//   DynamicProof,
//   FeatureFlags,
//   VerificationKey,
//   Field,
//   Bool,
//   Provable,
//   SelfProof,
// } from "o1js";
// import {
//   DEXState,
//   DEXMap,
//   RollupActionCreateAccount,
//   RollupActionBid,
//   RollupActionAsk,
//   RollupActionTrade,
//   RollupActionTransfer,
//   RollupUserTradingAccount,
//   RollupMinaBalance,
//   RollupOrder,
// } from "./types.js";
// import { mulDiv } from "./div.js";
// import { Operation } from "../types.js";
// import { getMinaSignatureData } from "./signature.js";
// import { verificationKeys } from "./vk.js";

// export const DEXCreateAccountProgram = ZkProgram({
//   name: "DEXCreateAccountProgram",
//   publicInput: DEXState,
//   publicOutput: DEXState,
//   methods: {
//     createAccount: {
//       privateInputs: [DEXMap, RollupActionCreateAccount],
//       auxiliaryOutput: DEXMap,
//       async method(
//         input: DEXState,
//         map: DEXMap,
//         action: RollupActionCreateAccount
//       ): Promise<{
//         publicOutput: DEXState;
//         auxiliaryOutput: DEXMap;
//       }> {
//         map.root.assertEquals(input.root);
//         map.length.assertEquals(input.length);
//         const key = Poseidon.hashPacked(PublicKey, action.publicKey);
//         const account = new RollupUserTradingAccount({
//           baseTokenBalance: new RollupMinaBalance({
//             amount: action.baseBalance,
//             stakedAmount: UInt64.zero,
//             borrowedAmount: UInt64.zero,
//           }),
//           quoteTokenBalance: new RollupMinaBalance({
//             amount: action.quoteBalance,
//             stakedAmount: UInt64.zero,
//             borrowedAmount: UInt64.zero,
//           }),
//           bid: new RollupOrder({
//             amount: UInt64.zero,
//             price: UInt64.zero,
//           }),
//           ask: new RollupOrder({
//             amount: UInt64.zero,
//             price: UInt64.zero,
//           }),
//           nonce: UInt64.zero,
//         });

//         map.set(key, account.hash());

//         return {
//           publicOutput: new DEXState({
//             poolPublicKey: input.poolPublicKey,
//             root: map.root,
//             length: map.length,
//             actionState: input.actionState,
//             sequence: input.sequence.add(1),
//             verificationKey: input.verificationKey,
//           }),
//           auxiliaryOutput: map,
//         };
//       },
//     },
//   },
// });

// export const DEXBidProgram = ZkProgram({
//   name: "DEXBidProgram",
//   publicInput: DEXState,
//   publicOutput: DEXState,
//   methods: {
//     bid: {
//       privateInputs: [DEXMap, RollupActionBid, RollupUserTradingAccount],
//       auxiliaryOutput: DEXMap,
//       async method(
//         input: DEXState,
//         map: DEXMap,
//         action: RollupActionBid,
//         account: RollupUserTradingAccount
//       ): Promise<{
//         publicOutput: DEXState;
//         auxiliaryOutput: DEXMap;
//       }> {
//         map.root.assertEquals(input.root);
//         map.length.assertEquals(input.length);
//         const key = Poseidon.hashPacked(PublicKey, action.userPublicKey);
//         const value = map.get(key);
//         value.assertEquals(account.hash());
//         const quoteAmount = mulDiv({
//           value: action.baseTokenAmount,
//           multiplier: action.price,
//           denominator: UInt64.from(1_000_000_000),
//         }).result;
//         account.quoteTokenBalance.amount.assertGreaterThanOrEqual(quoteAmount);
//         action.userSignature
//           .verify(
//             action.userPublicKey,
//             getMinaSignatureData({
//               poolPublicKey: input.poolPublicKey,
//               operation: Operation.BID,
//               nonce: action.nonce,
//               baseTokenAmount: action.baseTokenAmount,
//               price: action.price,
//             })
//           )
//           .assertTrue();
//         account.bid.amount = action.baseTokenAmount;
//         account.bid.price = action.price;
//         account.nonce = account.nonce.add(1);
//         map.set(key, account.hash());

//         return {
//           publicOutput: new DEXState({
//             poolPublicKey: input.poolPublicKey,
//             root: map.root,
//             length: map.length,
//             actionState: input.actionState,
//             sequence: input.sequence.add(1),
//             verificationKey: input.verificationKey,
//           }),
//           auxiliaryOutput: map,
//         };
//       },
//     },
//   },
// });

// export const DEXAskProgram = ZkProgram({
//   name: "DEXAskProgram",
//   publicInput: DEXState,
//   publicOutput: DEXState,
//   methods: {
//     ask: {
//       privateInputs: [DEXMap, RollupActionAsk, RollupUserTradingAccount],
//       auxiliaryOutput: DEXMap,
//       async method(
//         input: DEXState,
//         map: DEXMap,
//         action: RollupActionAsk,
//         account: RollupUserTradingAccount
//       ): Promise<{
//         publicOutput: DEXState;
//         auxiliaryOutput: DEXMap;
//       }> {
//         map.root.assertEquals(input.root);
//         map.length.assertEquals(input.length);
//         const key = Poseidon.hashPacked(PublicKey, action.userPublicKey);
//         const value = map.get(key);
//         value.assertEquals(account.hash());
//         account.baseTokenBalance.amount.assertGreaterThanOrEqual(
//           action.baseTokenAmount
//         );
//         action.userSignature
//           .verify(
//             action.userPublicKey,
//             getMinaSignatureData({
//               poolPublicKey: input.poolPublicKey,
//               operation: Operation.ASK,
//               nonce: action.nonce,
//               baseTokenAmount: action.baseTokenAmount,
//               price: action.price,
//             })
//           )
//           .assertTrue();
//         account.ask.amount = action.baseTokenAmount;
//         account.ask.price = action.price;
//         account.nonce = account.nonce.add(1);
//         map.set(key, account.hash());

//         return {
//           publicOutput: new DEXState({
//             poolPublicKey: input.poolPublicKey,
//             root: map.root,
//             length: map.length,
//             actionState: input.actionState,
//             sequence: input.sequence.add(1),
//             verificationKey: input.verificationKey,
//           }),
//           auxiliaryOutput: map,
//         };
//       },
//     },
//   },
// });

// export const DEXTradeProgram = ZkProgram({
//   name: "DEXTradeProgram",
//   publicInput: DEXState,
//   publicOutput: DEXState,
//   methods: {
//     trade: {
//       privateInputs: [
//         DEXMap,
//         RollupActionTrade,
//         RollupUserTradingAccount,
//         RollupUserTradingAccount,
//       ],
//       auxiliaryOutput: DEXMap,
//       async method(
//         input: DEXState,
//         map: DEXMap,
//         action: RollupActionTrade,
//         buyer: RollupUserTradingAccount,
//         seller: RollupUserTradingAccount
//       ): Promise<{
//         publicOutput: DEXState;
//         auxiliaryOutput: DEXMap;
//       }> {
//         action.baseTokenAmount
//           .equals(UInt64.zero)
//           .assertFalse("amount is zero");
//         action.quoteTokenAmount
//           .equals(UInt64.zero)
//           .assertFalse("price is zero");

//         map.root.assertEquals(input.root);
//         map.length.assertEquals(input.length);
//         const buyerKey = Poseidon.hashPacked(PublicKey, action.buyerPublicKey);
//         const sellerKey = Poseidon.hashPacked(
//           PublicKey,
//           action.sellerPublicKey
//         );
//         const buyerValue = map.get(buyerKey);
//         buyerValue.assertEquals(buyer.hash());
//         const sellerValue = map.get(sellerKey);
//         sellerValue.assertEquals(seller.hash());

//         buyer.quoteTokenBalance.amount.assertGreaterThanOrEqual(
//           action.quoteTokenAmount
//         );
//         seller.baseTokenBalance.amount.assertGreaterThanOrEqual(
//           action.baseTokenAmount
//         );

//         // Check buyer bid validity
//         buyer.bid.amount.assertGreaterThanOrEqual(action.baseTokenAmount);
//         buyer.bid.price.value
//           .mul(action.baseTokenAmount.value)
//           .assertLessThanOrEqual(
//             action.quoteTokenAmount.value.mul(1_000_000_000n)
//           );

//         // Check seller ask validity
//         seller.ask.amount.assertGreaterThanOrEqual(action.baseTokenAmount);
//         seller.ask.price.value
//           .mul(action.baseTokenAmount.value)
//           .assertLessThanOrEqual(
//             action.quoteTokenAmount.value.mul(1_000_000_000n)
//           );

//         // Update buyer balances
//         buyer.bid.amount = buyer.bid.amount.sub(action.baseTokenAmount);
//         buyer.baseTokenBalance.amount = buyer.baseTokenBalance.amount.add(
//           action.baseTokenAmount
//         );
//         buyer.quoteTokenBalance.amount = buyer.quoteTokenBalance.amount.sub(
//           action.quoteTokenAmount
//         );
//         buyer.nonce = buyer.nonce.add(1);

//         // Update seller balances
//         seller.ask.amount = seller.ask.amount.sub(action.baseTokenAmount);
//         seller.baseTokenBalance.amount = seller.baseTokenBalance.amount.sub(
//           action.baseTokenAmount
//         );
//         seller.quoteTokenBalance.amount = seller.quoteTokenBalance.amount.add(
//           action.quoteTokenAmount
//         );
//         seller.nonce = seller.nonce.add(1);

//         map.set(buyerKey, buyer.hash());
//         map.set(sellerKey, seller.hash());

//         return {
//           publicOutput: new DEXState({
//             poolPublicKey: input.poolPublicKey,
//             root: map.root,
//             length: map.length,
//             actionState: input.actionState,
//             sequence: input.sequence.add(1),
//             verificationKey: input.verificationKey,
//           }),
//           auxiliaryOutput: map,
//         };
//       },
//     },
//   },
// });

// export const DEXTransferProgram = ZkProgram({
//   name: "DEXTransferProgram",
//   publicInput: DEXState,
//   publicOutput: DEXState,
//   methods: {
//     transfer: {
//       privateInputs: [
//         DEXMap,
//         RollupActionTransfer,
//         RollupUserTradingAccount,
//         RollupUserTradingAccount,
//       ],
//       auxiliaryOutput: DEXMap,
//       async method(
//         input: DEXState,
//         map: DEXMap,
//         action: RollupActionTransfer,
//         sender: RollupUserTradingAccount,
//         receiver: RollupUserTradingAccount
//       ): Promise<{
//         publicOutput: DEXState;
//         auxiliaryOutput: DEXMap;
//       }> {
//         action.baseTokenAmount
//           .equals(UInt64.zero)
//           .assertFalse("amount is zero");
//         action.quoteTokenAmount
//           .equals(UInt64.zero)
//           .assertFalse("amount is zero");

//         map.root.assertEquals(input.root);
//         map.length.assertEquals(input.length);
//         const senderKey = Poseidon.hashPacked(
//           PublicKey,
//           action.senderPublicKey
//         );
//         const receiverKey = Poseidon.hashPacked(
//           PublicKey,
//           action.receiverPublicKey
//         );
//         const senderValue = map.get(senderKey);
//         const senderHash = sender.hash();
//         senderValue.assertEquals(senderHash);
//         const receiverValue = map.get(receiverKey);
//         const receiverHash = receiver.hash();
//         receiverValue.assertEquals(receiverHash);

//         // Verify sender has sufficient balance and no borrowed amounts
//         sender.baseTokenBalance.amount.assertGreaterThanOrEqual(
//           action.baseTokenAmount,
//           "insufficient base token sender balance"
//         );
//         sender.quoteTokenBalance.amount.assertGreaterThanOrEqual(
//           action.quoteTokenAmount,
//           "insufficient quote token sender balance"
//         );
//         sender.baseTokenBalance.borrowedAmount
//           .equals(UInt64.zero)
//           .assertTrue("cannot transfer borrowed amount");
//         sender.quoteTokenBalance.borrowedAmount
//           .equals(UInt64.zero)
//           .assertTrue("cannot transfer borrowed amount");

//         // Verify signature
//         const signatureData = getMinaSignatureData({
//           poolPublicKey: input.poolPublicKey,
//           operation: Operation.TRANSFER,
//           nonce: action.senderNonce,
//           baseTokenAmount: action.baseTokenAmount,
//           quoteTokenAmount: action.quoteTokenAmount,
//           receiverPublicKey: action.receiverPublicKey,
//         });
//         action.senderSignature
//           .verify(action.senderPublicKey, signatureData)
//           .assertTrue();

//         // Update sender balance
//         sender.baseTokenBalance.amount = sender.baseTokenBalance.amount.sub(
//           action.baseTokenAmount
//         );
//         sender.quoteTokenBalance.amount = sender.quoteTokenBalance.amount.sub(
//           action.quoteTokenAmount
//         );
//         sender.nonce = sender.nonce.add(1);

//         // Update receiver balance
//         receiver.baseTokenBalance.amount = receiver.baseTokenBalance.amount.add(
//           action.baseTokenAmount
//         );
//         receiver.quoteTokenBalance.amount =
//           receiver.quoteTokenBalance.amount.add(action.quoteTokenAmount);

//         map.set(senderKey, sender.hash());
//         map.set(receiverKey, receiver.hash());

//         return {
//           publicOutput: new DEXState({
//             poolPublicKey: input.poolPublicKey,
//             root: map.root,
//             length: map.length,
//             actionState: input.actionState,
//             sequence: input.sequence.add(1),
//             verificationKey: input.verificationKey,
//           }),
//           auxiliaryOutput: map,
//         };
//       },
//     },
//   },
// });

// export class DEXProof extends DynamicProof<DEXState, DEXState> {
//   static publicInputType = DEXState;
//   static publicOutputType = DEXState;
//   static maxProofsVerified = 0 as const;
//   static featureFlags = FeatureFlags.allMaybe;
// }

// function checkVerificationKey(
//   verificationKey: VerificationKey,
//   mergeVerificationKey: Field
// ) {
//   const hash = verificationKey.hash;
//   const keys = Object.keys(verificationKeys).filter(
//     (k) => k !== "DEXMergeProgram"
//   );
//   let found = hash.equals(mergeVerificationKey);
//   for (const key of keys) {
//     found = hash.equals(Field.fromJSON(verificationKeys[key].hash)).or(found);
//   }
//   found.assertTrue();
// }

// export const DEXMergeProgram = ZkProgram({
//   name: "DEXMergeProgram",
//   publicInput: DEXState,
//   publicOutput: DEXState,
//   maxProofsVerified: 2,
//   methods: {
//     merge: {
//       privateInputs: [SelfProof, SelfProof],
//       async method(
//         input: DEXState,
//         proof1: SelfProof<DEXState, DEXState>,
//         proof2: SelfProof<DEXState, DEXState>
//       ) {
//         proof1.verify();
//         proof2.verify();
//         DEXState.assertEquals(input, proof1.publicInput);
//         DEXState.assertEquals(proof1.publicOutput, proof2.publicInput);
//         return {
//           publicOutput: proof2.publicOutput,
//         };
//       },
//     },
//     // merge: {
//     //   privateInputs: [DEXProof, VerificationKey, DEXProof, VerificationKey],
//     //   async method(
//     //     input: DEXState,
//     //     proof1: DEXProof,
//     //     verificationKey1: VerificationKey,
//     //     proof2: DEXProof,
//     //     verificationKey2: VerificationKey
//     //   ) {
//     //     // checkVerificationKey(verificationKey1, input.verificationKey);
//     //     // checkVerificationKey(verificationKey2, input.verificationKey);
//     //     Provable.log("step 1");
//     //     proof1.verify(verificationKey1);
//     //     Provable.log("step 2");
//     //     proof2.verify(verificationKey2);
//     //     Provable.log("step 3");
//     //     DEXState.assertEquals(input, proof1.publicInput);
//     //     Provable.log("step 4");
//     //     DEXState.assertEquals(proof1.publicOutput, proof2.publicInput);
//     //     Provable.log("step 5");
//     //     return {
//     //       publicOutput: proof2.publicOutput,
//     //     };
//     //   },
//     // },
//     convert: {
//       privateInputs: [DEXProof, VerificationKey],
//       async method(
//         input: DEXState,
//         proof: DEXProof,
//         verificationKey: VerificationKey
//       ) {
//         proof.verify(verificationKey);
//         DEXState.assertEquals(input, proof.publicInput);
//         return {
//           publicOutput: proof.publicOutput,
//         };
//       },
//     },
//   },
// });

// export class DEXMergeProof extends ZkProgram.Proof(DEXMergeProgram) {}

// export const circuits: {
//   name: string;
//   circuit: ReturnType<typeof ZkProgram>;
// }[] = [
//   {
//     name: "DEXCreateAccountProgram",
//     circuit: DEXCreateAccountProgram,
//   },
//   {
//     name: "DEXBidProgram",
//     circuit: DEXBidProgram,
//   },
//   {
//     name: "DEXAskProgram",
//     circuit: DEXAskProgram,
//   },
//   {
//     name: "DEXTradeProgram",
//     circuit: DEXTradeProgram,
//   },
//   {
//     name: "DEXTransferProgram",
//     circuit: DEXTransferProgram,
//   },
//   {
//     name: "DEXMergeProgram",
//     circuit: DEXMergeProgram,
//   },
// ];
