import { suiClient } from "./sui-client.js";
import {
  UserTradingAccount,
  OperationEvent,
  RawOperationEvent,
  RawBlock,
  Block,
  ProofStatusData,
  BlockProofs,
  BlockData,
} from "./types.js";
import {
  EventId,
  PaginatedEvents,
  SuiEvent,
  SuiEventFilter,
} from "@mysten/sui/client";
import { DexConfig, getConfig } from "./config.js";
import { convertRawOperationEvent } from "./event.js";
import { rawBlockToBlock } from "./block.js";

let configCached: DexConfig | undefined = undefined;

export async function getDexID(): Promise<string> {
  if (configCached) return configCached.dex_object;
  const config = await getConfig();
  configCached = config;
  return config.dex_object;
}

export async function getPackageID(): Promise<string> {
  if (configCached) return configCached.dex_package;
  const config = await getConfig();
  configCached = config;
  return config.dex_package;
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
  block_number: number;
  circuit: {
    type: string;
    fields: any;
  };
  circuit_address: string;
  id: {
    id: string;
  };
  isPaused: boolean;
  last_proved_block_number: bigint;
  last_proved_sequence: bigint;
  name: string;
  pool: {
    type: string;
    fields: any;
  };
  previous_block_actions_state: number[];
  previous_block_last_sequence: bigint;
  previous_block_timestamp: number;
  proof_calculations: {
    type: string;
    fields: any;
  };
  public_key: number[];
  sequence: number;
  version: number;
}

export async function fetchDex(): Promise<DexObject | undefined> {
  const dexObject = await fetchDexObject();
  const dexData = (dexObject?.data?.content as any)?.fields;
  if (!dexData) {
    throw new Error("DEX_DATA is not received");
  }
  return {
    ...dexData,
    block_number: Number(dexData.block_number),
    last_proved_block_number: Number(dexData.last_proved_block_number),
    last_proved_sequence: Number(dexData.last_proved_sequence),
    previous_block_last_sequence: Number(dexData.previous_block_last_sequence),
    previous_block_timestamp: Number(dexData.previous_block_timestamp),
    sequence: Number(dexData.sequence),
    version: Number(dexData.version),
  };
}

export async function fetchDexAccount(params: {
  addressU256: bigint;
}): Promise<UserTradingAccount | undefined> {
  const { addressU256 } = params;
  const dexID = await getDexID();
  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }
  const publicKey = addressU256.toString();
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

export async function fetchBlock(params: {
  blockNumber: number;
}): Promise<BlockData> {
  const { blockNumber } = params;
  const dex = await fetchDexObject();
  //console.log("dex", dex);
  //console.log("dex.data", (dex?.data?.content as any)?.fields);
  const dexData = (dex?.data?.content as any)?.fields?.blocks?.fields?.id?.id;
  console.log("blocks id", dexData);
  if (!dexData || typeof dexData !== "string") {
    throw new Error("DEX_DATA is not received");
  }
  const blocks = await suiClient.getDynamicFieldObject({
    parentId: dexData,
    name: {
      type: "u64",
      value: blockNumber.toString(),
    },
  });
  const rawBlock = (blocks.data?.content as any)?.fields as RawBlock;
  // return data;

  // const blockID = dex.blocks.fields.contents[blockNumber].fields.id.id;
  // const fetchedBlock = await fetchSuiObject(blockID);
  // const rawBlock = (fetchedBlock?.data?.content as any)?.fields as RawBlock;
  if (!rawBlock) {
    throw new Error("raw block is not received");
  }
  const block: Block = rawBlockToBlock(rawBlock);
  //console.log(`block:`, block);
  const blockEvents = (
    await fetchDexEvents({
      firstSequence: block.start_sequence,
      lastSequence: block.end_sequence,
    })
  )?.filter((event) => {
    return event.operation.blockNumber === block.block_number;
  });
  //console.log(`blockEvents:`, blockEvents);
  const blockData: BlockData = {
    block,
    events: blockEvents ?? [],
  };
  return blockData;
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

export async function fetchDexEvents(params: {
  firstSequence: number;
  lastSequence?: number;
  limit?: number;
}): Promise<OperationEvent[] | undefined> {
  const { firstSequence, lastSequence, limit } = params;
  //console.log("fetchDexEvents", params);
  const packageID = await getPackageID();
  if (!packageID) {
    throw new Error("PACKAGE_ID is not set");
  }
  const events: OperationEvent[] = [];

  function convertEvents(events: SuiEvent[]): OperationEvent[] {
    return events
      ?.filter((event) => event?.type?.includes("::transactions::Operation"))
      .map((event) => {
        return {
          type: event.type?.split("::").at(-1),
          details: (event?.parsedJson as any)?.details,
          operation: (event?.parsedJson as any)?.operation,
        } as RawOperationEvent;
      })
      .map(convertRawOperationEvent);
  }
  let eventsData = await suiClient.queryEvents({
    query: {
      MoveModule: {
        package: packageID,
        module: "transactions",
      },
    },
    limit,
    order: "descending",
  });
  if (eventsData) {
    events.push(...convertEvents(eventsData.data));
  }
  let fetchedAllEvents = events.some((event) => {
    return event.operation.sequence === firstSequence;
  });
  while (
    eventsData?.hasNextPage &&
    eventsData?.nextCursor &&
    !fetchedAllEvents
  ) {
    eventsData = await suiClient.queryEvents({
      query: {
        MoveModule: {
          package: packageID,
          module: "transactions",
        },
      },
      limit,
      order: "descending",
      cursor: eventsData?.nextCursor,
    });
    if (eventsData) {
      events.push(...convertEvents(eventsData.data));
    }
    fetchedAllEvents = events.some((event) => {
      return event.operation.sequence === firstSequence;
    });
  }
  // console.log(
  //   "fetchDexEvents events",
  //   events.map((event) => event.operation.sequence)
  // );
  const filteredEvents: OperationEvent[] = events.filter((event) => {
    if (event?.operation?.sequence < firstSequence) {
      return false;
    }
    if (lastSequence && event?.operation?.sequence > lastSequence) {
      return false;
    }
    return true;
  });
  return filteredEvents;
}
