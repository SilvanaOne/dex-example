import { suiClient } from "./sui-client.js";
import {
  UserTradingAccount,
  OperationEvent,
  RawOperationEvent,
  RawBlock,
  Block,
  ProofStatusData,
  BlockProofs,
} from "./types.js";
import {
  EventId,
  PaginatedEvents,
  SuiEvent,
  SuiEventFilter,
} from "@mysten/sui/client";
import { getConfig } from "./config.js";

let dexIDcached: string | undefined = undefined;

export async function getDexID(): Promise<string> {
  if (dexIDcached) return dexIDcached;
  const config = await getConfig();
  dexIDcached = config.dex_object;
  return dexIDcached;
}

export async function fetchSuiObject(objectID: string) {
  //console.time("getObject");
  const data = await suiClient.getObject({
    id: objectID,
    options: {
      showContent: true,
      showDisplay: true,
      showType: true,
    },
  });
  //console.timeEnd("getObject");
  return data;
}

export async function fetchDexObject() {
  const dexID = await getDexID();
  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }
  //console.time("fetchDexObject");
  const data = await suiClient.getObject({
    id: dexID,
    options: {
      showContent: true,
      showDisplay: true,
      showType: true,
    },
  });
  //console.timeEnd("fetchDexObject");
  return data;
}

interface DexObject {
  actionsState: number[];
  admin: string;
  block_number: string;
  circuit: {
    type: string;
    fields: any;
  };
  circuit_address: string;
  id: {
    id: string;
  };
  isPaused: boolean;
  last_proved_block_number: string;
  last_proved_sequence: string;
  name: string;
  pool: {
    type: string;
    fields: any;
  };
  previous_block_actions_state: number[];
  previous_block_address: string;
  previous_block_last_sequence: string;
  previous_block_timestamp: string;
  proof_calculations: {
    type: string;
    fields: any;
  };
  public_key: number[];
  sequence: string;
  version: number;
}

export async function fetchDex(): Promise<DexObject | undefined> {
  const dexObject = await fetchDexObject();
  return (dexObject?.data?.content as any)?.fields as DexObject;
}

export async function fetchDexAccount(params: {
  addressU256: string;
}): Promise<UserTradingAccount | undefined> {
  const { addressU256 } = params;
  const dexID = await getDexID();
  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }
  const publicKey = addressU256;
  const poolData = (await fetchSuiObject(dexID)) as any;
  const accounts =
    poolData?.data?.content?.fields?.pool?.fields?.accounts?.fields.contents;
  if (accounts && Array.isArray(accounts)) {
    const account = accounts.find((item) => item?.fields?.key === publicKey);
    if (account) {
      //console.log("account", account);
      const data = account?.fields?.value?.fields;
      const result: UserTradingAccount = {
        baseTokenBalance: {
          amount: BigInt(data?.baseTokenBalance?.fields?.amount),
          stakedAmount: BigInt(data?.baseTokenBalance?.fields?.stakedAmount),
          borrowedAmount: BigInt(
            data?.baseTokenBalance?.fields?.borrowedAmount
          ),
        },
        quoteTokenBalance: {
          amount: BigInt(data?.quoteTokenBalance?.fields?.amount),
          stakedAmount: BigInt(data?.quoteTokenBalance?.fields?.stakedAmount),
          borrowedAmount: BigInt(
            data?.quoteTokenBalance?.fields?.borrowedAmount
          ),
        },
        bid: {
          amount: BigInt(data?.bid?.fields?.amount),
          price: BigInt(data?.bid?.fields?.price),
          isSome: data?.bid?.fields?.isSome,
        },
        ask: {
          amount: BigInt(data?.ask?.fields?.amount),
          price: BigInt(data?.ask?.fields?.price),
          isSome: data?.ask?.fields?.isSome,
        },
        nonce: data?.nonce,
      };
      return result;
    }
  }
  return undefined;
}

export async function fetchEvents(params: {
  packageID: string;
  module: string;
  limit?: number;
  cursor?: EventId | null | undefined;
}): Promise<PaginatedEvents | undefined> {
  const { packageID, module, limit, cursor } = params;

  //console.time("queryEvents");
  try {
    const data = await suiClient.queryEvents({
      query: {
        MoveModule: {
          package: packageID,
          module,
        },
      },
      limit,
      order: "ascending",
      cursor: cursor,
    });
    //console.timeEnd("queryEvents");
    return data;
  } catch (error) {
    //console.timeEnd("queryEvents");
    console.error("error", error);
    return undefined;
  }
}

export async function fetchProofStatus(params: {
  sequence: number;
  blockNumber: number;
}): Promise<ProofStatusData | undefined> {
  const dexID = await getDexID();
  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }
  const { sequence, blockNumber } = params;
  //console.log("fetchProofStatus", { sequence, blockNumber });
  const dex = await fetchDexObject();
  const dexData = (dex?.data?.content as any)?.fields?.proof_calculations.fields
    ?.id?.id;
  //console.log("dexData", dexData);
  if (!dexData || typeof dexData !== "string") {
    throw new Error("DEX_DATA is not received");
  }
  // const objects = await suiClient.getDynamicFields({
  //   parentId: dexData,
  // });
  // const index = objects.data.findIndex((item: any) => {
  //   return item?.name?.value === blockNumber.toString();
  // });
  // console.log("index", index);
  // if (index === -1) {
  //   throw new Error("Proof calculation is not found");
  // }
  const statuses = await suiClient.getDynamicFieldObject({
    parentId: dexData,
    name: {
      type: "u64",
      value: blockNumber.toString(),
    },
  });
  const items = (
    statuses.data?.content as any
  )?.fields?.proofs?.fields?.contents.map((item: any) => {
    return {
      sequences: item?.fields?.key,
      status: item?.fields?.value?.fields,
    };
  });
  const statusData = items.find((item: any) => {
    return (
      item?.sequences?.length === 1 &&
      item?.sequences[0] === sequence.toString()
    );
  });

  const status: ProofStatusData = {
    status: Number(statusData?.status?.status),
    timestamp: Number(statusData?.status?.timestamp),
    da_hash: statusData?.status?.da_hash,
  };
  return status;
}

export async function fetchBlockProofs(params: {
  blockNumber: number;
}): Promise<BlockProofs> {
  const dexID = await getDexID();
  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }
  const { blockNumber } = params;
  //console.log("fetchBlockProofs", { blockNumber });
  const dex = await fetchDexObject();
  const dexData = (dex?.data?.content as any)?.fields?.proof_calculations.fields
    ?.id?.id;
  //console.log("dexData", dexData);
  if (!dexData || typeof dexData !== "string") {
    throw new Error("DEX_DATA is not received");
  }
  const statuses = await suiClient.getDynamicFieldObject({
    parentId: dexData,
    name: {
      type: "u64",
      value: blockNumber.toString(),
    },
  });

  const data = (statuses.data?.content as any)?.fields;

  const items = (
    statuses.data?.content as any
  )?.fields?.proofs?.fields?.contents.map((item: any) => {
    return {
      sequences: (item?.fields?.key as string[])?.map(Number),
      status: item?.fields?.value?.fields,
    };
  });

  return {
    blockNumber,
    blockProof: data.block_proof,
    startSequence: Number(data.start_sequence),
    endSequence: data.end_sequence ? Number(data.end_sequence) : undefined,
    isFinished: data.is_finished,
    proofs: items,
  };
}
