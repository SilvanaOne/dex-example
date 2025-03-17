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
  ProofStatus,
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
      console.log("account", account);
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
  sequences?: number[];
  limit?: number;
}): Promise<OperationEvent[] | undefined> {
  const { sequences, limit } = params;
  //console.log("fetchDexEvents", params);
  if (!packageID) {
    throw new Error("PACKAGE_ID is not set");
  }
  const events: SuiEvent[] = [];
  let eventsData = await fetchEvents({
    packageID,
    module: "transactions",
    limit,
  });
  if (eventsData) {
    events.push(...eventsData.data);
  }
  while (eventsData?.hasNextPage && eventsData?.nextCursor) {
    eventsData = await fetchEvents({
      packageID,
      module: "transactions",
      limit,
      cursor: eventsData?.nextCursor,
    });
    if (eventsData) {
      events.push(...eventsData.data);
    }
  }
  const filteredEvents: OperationEvent[] | undefined = events
    ?.filter((event) => event?.type?.includes("::transactions::Operation"))
    .map((event) => {
      return {
        type: event.type?.split("::").at(-1),
        details: (event?.parsedJson as any)?.details,
        operation: (event?.parsedJson as any)?.operation,
      } as RawOperationEvent;
    })
    .map(convertRawOperationEvent)
    ?.filter((event) => {
      //console.log("event 1", event);
      if (sequences) {
        return sequences.includes(event?.operation?.sequence);
      }
      return true;
    });
  //console.log("events", filteredEvents);
  return filteredEvents;
}

export async function fetchBlock(params: {
  blockID: string;
}): Promise<BlockData> {
  const { blockID } = params;
  const fetchedBlock = await fetchSuiObject(blockID);
  const rawBlock = (fetchedBlock?.data?.content as any)?.fields as RawBlock;
  if (!rawBlock) {
    throw new Error("raw block is not received");
  }
  const block: Block = rawBlockToBlock(rawBlock);
  //console.log(`block:`, block);
  const blockEvents = (
    await fetchDexEvents({
      sequences: block.sequences,
    })
  )?.filter((event) => {
    return event.operation.blockNumber === block.block_number;
  });
  //console.log(`blockEvents:`, blockEvents);
  const blockData: BlockData = {
    blockNumber: block.block_number,
    blockID,
    sequences: block.sequences,
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
  const previousBlockNumber = blockNumber - 1;
  //console.log("fetching dex data", dexID);
  const dex = await fetchSuiObject(dexID);
  const dexData = (dex?.data?.content as any)?.fields;
  //console.log("dexData", dexData);
  if (
    !dexData ||
    !dexData?.block_number ||
    !dexData?.last_block_address ||
    !dexData?.pool?.fields?.publicKeyBase58
  ) {
    throw new Error("DEX_DATA is not received");
  }
  const poolPublicKey = dexData?.pool?.fields?.publicKeyBase58;
  //console.log("poolPublicKey", poolPublicKey);
  const lastBlockNumber = Number(dexData?.block_number) - 1;
  //console.log("lastBlockNumber", lastBlockNumber);
  let lastBlockAddress = dexData?.last_block_address;
  //console.log("lastBlockAddress", lastBlockAddress);
  let block = await fetchBlock({ blockID: lastBlockAddress });
  //console.log("fetched block", block.blockNumber);
  while (
    block.blockNumber > previousBlockNumber ||
    block?.block?.state_data_availability === undefined
  ) {
    lastBlockAddress = block?.block?.previous_block_address;
    if (!lastBlockAddress) {
      throw new Error("Last block address is not received");
    }
    block = await fetchBlock({ blockID: lastBlockAddress });
    //console.log("fetched block", block.blockNumber);
  }
  if (block.blockNumber > previousBlockNumber) {
    throw new Error("Fetched block number is not correct");
  }
  //console.log("block", block);
  const dataAvailability = block?.block?.state_data_availability;
  if (!dataAvailability) {
    throw new Error("Data availability is not received");
  }
  //console.log("dataAvailability", dataAvailability);
  const data = await readFromWalrus({
    blobId: dataAvailability,
  });
  //console.log("data", data);
  if (!data) {
    throw new Error("Data is not received from walrus");
  }
  const blockData: BlockData = JSON.parse(data);
  const blockState = blockData?.block?.block_state;
  if (!blockState) {
    throw new Error("Block state is not received");
  }
  const serializedMap = blockData?.map;

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
  //console.log("map root", map.root.toBigInt());
  //console.log("map length", map.length.toBigInt());

  function getStartSequence(sequences: number[]) {
    if (!sequences) {
      throw new Error("Sequences are not received");
    }
    if (sequences.length === 0) {
      return 1;
    }
    return sequences.reduce((acc, curr) => {
      if (curr > sequence) {
        return curr;
      }
      return acc;
    }, sequences[0]);
  }

  const startSequence = getStartSequence(blockData?.block?.sequences);
  const sequences: number[] = [];
  for (let i = startSequence; i <= sequence; i++) {
    sequences.push(i);
  }
  //console.log("sequences", sequences);
  const events = await fetchDexEvents({
    sequences,
    limit: 100,
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
    sequences,
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
  )?.fields?.statuses?.fields?.contents.map((item: any) => {
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
  //console.log("statusData", statusData);
  /*
statusData {
  sequences: [ '11' ],
  status: {
    input1: null,
    input2: null,
    is_merge_proof: false,
    number_of_retries: 0,
    operation: 4,
    proof: {
      type: '0x2860e790344704baf2896c16550643fe989f50b17670b321bc89e73f005f602f::prover::Proof',
      fields: [Object]
    },
    prover: null,
    sequence: '11',
    status: 2,
    timestamp: '1742247125236'
  }
}
  */
  const status: ProofStatusData = {
    status: statusData?.status?.status,
    timestamp: Number(statusData?.status?.timestamp),
    number_of_retries: statusData?.status?.number_of_retries,
    is_merge_proof: statusData?.status?.is_merge_proof,
    sequence: statusData?.status?.sequence
      ? Number(statusData?.status?.sequence)
      : undefined,
    operation: statusData?.status?.operation,
    input1: statusData?.status?.input1,
    input2: statusData?.status?.input2,
    proof: statusData?.status?.proof?.fields,
    prover: statusData?.status?.prover,
  };
  return status;
}
