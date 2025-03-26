import { suiClient } from "./sui-client.js";
import { publicKeyToU256 } from "./public-key.js";
import {
  UserTradingAccount,
  OperationEvent,
  RawOperationEvent,
  convertRawOperationEvent,
  BlockData,
  RawBlock,
  Block,
  rawBlockToBlock,
  SequenceData,
  ProofStatusData,
  BlockProofs,
} from "./types.js";
import {
  EventId,
  PaginatedEvents,
  SuiEvent,
  SuiEventFilter,
} from "@mysten/sui/client";
import {
  GetDynamicFieldsParams,
  GetDynamicFieldObjectParams,
} from "@mysten/sui/client";
import { deserializeIndexedMerkleMap } from "@silvana-one/storage";
import { DEXMap } from "./contracts/provable-types.js";
import { SequenceState } from "./contracts/rollup.js";
import { readFromWalrus } from "./walrus.js";
import { calculateState } from "./contracts/state.js";
const packageID = process.env.PACKAGE_ID;
const dexID = process.env.DEX_ID;

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
  blocks: {
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

// export async function fetchDex() {
//   const dexObject = await fetchDexObject();
//   return (dexObject?.data?.content as any)?.fields;
// }

export async function fetchDexAccount(
  address: string
): Promise<UserTradingAccount | undefined> {
  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }
  const publicKey = publicKeyToU256(address).toString();
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

export async function fetchDexEvents(params: {
  firstSequence: number;
  lastSequence?: number;
  limit?: number;
}): Promise<OperationEvent[] | undefined> {
  const { firstSequence, lastSequence, limit } = params;
  //console.log("fetchDexEvents", params);
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

export async function fetchSequenceData(params: {
  sequence: number;
  blockNumber: number;
  prove?: boolean;
}): Promise<SequenceState | undefined> {
  const { sequence, blockNumber, prove = false } = params;
  //console.log("fetchSequenceData", { sequence, blockNumber });
  if (!dexID) {
    throw new Error("DEX_ID is not set");
  }
  if (!blockNumber || blockNumber < 1) {
    throw new Error("Incorrect block number");
  }
  let previousBlockNumber = blockNumber - 1;
  //console.log("fetching dex data", dexID);
  const dex = await fetchSuiObject(dexID);
  const dexData = (dex?.data?.content as any)?.fields;
  //console.log("dexData", dexData);
  if (
    !dexData ||
    !dexData?.block_number ||
    !dexData?.previous_block_address ||
    !dexData?.pool?.fields?.publicKeyBase58
  ) {
    throw new Error("DEX_DATA is not received");
  }
  const poolPublicKey = dexData?.pool?.fields?.publicKeyBase58;
  //let previousBlockAddress = dexData?.previous_block_address;
  let blockData = await fetchBlock({ blockNumber: previousBlockNumber });
  while (
    blockData?.block?.block_number > previousBlockNumber ||
    blockData?.block?.state_data_availability === undefined
  ) {
    previousBlockNumber--;
    if (previousBlockNumber < 0) {
      throw new Error("Previous block number is not correct");
    }
    blockData = await fetchBlock({ blockNumber: previousBlockNumber });
  }
  // if (blockData?.block?.block_number > previousBlockNumber) {
  //   throw new Error("Fetched block number is not correct");
  // }
  const dataAvailability = blockData?.block?.state_data_availability;
  if (!dataAvailability) {
    throw new Error("Data availability is not received");
  }
  const data = await readFromWalrus({
    blobId: dataAvailability,
  });
  if (!data) {
    throw new Error("Data is not received from walrus");
  }
  const daBlockData: BlockData = JSON.parse(data);
  const blockState = daBlockData?.block?.block_state;
  if (!blockState) {
    throw new Error("Block state is not received");
  }
  const serializedMap = daBlockData?.map;

  if (!serializedMap) {
    throw new Error("Serialized map is not received");
  }
  const map = deserializeIndexedMerkleMap({
    serializedIndexedMap: serializedMap,
    type: DEXMap,
  });
  if (!map) {
    throw new Error("Map cannot be deserialized");
  }

  const events = await fetchDexEvents({
    firstSequence: blockData?.block?.block_state.sequence + 1,
    lastSequence: sequence,
  });
  if (!events) {
    throw new Error("Events are not received");
  }
  //console.log("events", events);

  const state = await calculateState({
    poolPublicKey,
    blockNumber,
    sequence,
    serializedMap,
    block: blockData.block,
    operations: events,
    prove,
  });

  return state;
}

export async function fetchProofStatus(params: {
  sequence: number;
  blockNumber: number;
}): Promise<ProofStatusData | undefined> {
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
