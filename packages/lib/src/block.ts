import { Block, RawBlock } from "./types.js";
import { u256ToPublicKey } from "./public-key.js";
import { UserTradingAccount } from "./types.js";

export function rawBlockToBlock(raw: RawBlock): Block {
  const blockState = raw.block_state?.fields?.state?.fields?.contents;
  if (!blockState || !Array.isArray(blockState))
    throw new Error("Invalid block state");
  return {
    name: raw.name,
    block_number: Number(raw.block_number),
    start_sequence: Number(raw.start_sequence),
    end_sequence: Number(raw.end_sequence),
    timestamp: Number(raw.timestamp),
    time_since_last_block: Number(raw.time_since_last_block),
    number_of_transactions: Number(raw.number_of_transactions),
    start_action_state: raw.start_action_state,
    end_action_state: raw.end_action_state,
    state_data_availability: raw.state_data_availability,
    proof_data_availability: raw.proof_data_availability,
    mina_tx_hash: raw.mina_tx_hash,
    mina_tx_included_in_block: raw.mina_tx_included_in_block,
    block_state: {
      id: raw.block_state?.fields?.id?.id,
      name: raw.block_state?.fields?.name,
      block_number: Number(raw.block_state?.fields?.block_number),
      sequence: Number(raw.block_state?.fields?.sequence),
      state: Object.fromEntries(
        blockState.map((item: any) => {
          if (!item?.fields?.key || typeof item?.fields?.key !== "string") {
            throw new Error("block state key is not a string");
          }
          const key = u256ToPublicKey(BigInt(item.fields.key));
          const value = item.fields.value.fields;
          const account: UserTradingAccount = {
            baseTokenBalance: {
              amount: BigInt(value.baseTokenBalance.fields.amount),
              stakedAmount: BigInt(value.baseTokenBalance.fields.stakedAmount),
              borrowedAmount: BigInt(
                value.baseTokenBalance.fields.borrowedAmount
              ),
            },
            quoteTokenBalance: {
              amount: BigInt(value.quoteTokenBalance.fields.amount),
              stakedAmount: BigInt(value.quoteTokenBalance.fields.stakedAmount),
              borrowedAmount: BigInt(
                value.quoteTokenBalance.fields.borrowedAmount
              ),
            },
            bid: {
              amount: BigInt(value.bid.fields.amount),
              price: BigInt(value.bid.fields.price),
              isSome: value.bid.fields.isSome,
            },
            ask: {
              amount: BigInt(value.ask.fields.amount),
              price: BigInt(value.ask.fields.price),
              isSome: value.ask.fields.isSome,
            },
            nonce: BigInt(value.nonce),
          };
          return [key, account];
        })
      ),
    },
  };
}
