import { suiClient } from "./sui-client.js";
import { publicKeyToU256 } from "./public-key.js";
import {
  UserTradingAccount,
  OperationEvent,
  RawOperationEvent,
  convertRawOperationEvent,
} from "./types.js";
import { SuiEvent } from "@mysten/sui/client";

const poolID = process.env.POOL_ID;
const packageID = process.env.PACKAGE_ID;

export async function fetchSuiObject(objectID: string) {
  console.time("getObject");
  const data = await suiClient.getObject({
    id: objectID,
    options: {
      showContent: true,
      showStorageRebate: true,
      showDisplay: true,
      showType: true,
    },
  });
  console.timeEnd("getObject");
  return data;
}

export async function fetchDexPool() {
  if (!poolID) {
    throw new Error("POOL_ID is not set");
  }
  const data = await fetchSuiObject(poolID);

  return data;
}

export async function fetchDexAccount(
  address: string
): Promise<UserTradingAccount | undefined> {
  const publicKey = publicKeyToU256(address).toString();
  const poolData = (await fetchDexPool()) as any;
  const accounts = poolData?.data?.content?.fields?.accounts?.fields.contents;
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
        nonce: Number(data?.nonce),
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
}): Promise<SuiEvent[] | undefined> {
  const { packageID, module, limit } = params;

  console.time("queryEvents");
  try {
    const data = await suiClient.queryEvents({
      query: {
        MoveModule: {
          package: packageID,
          module,
        },
      },
      limit: limit || 200,
      order: "descending",
    });
    console.timeEnd("queryEvents");
    return data?.data;
  } catch (error) {
    console.timeEnd("queryEvents");
    console.error("error", error);
    return undefined;
  }
}

export async function fetchDexEvents(params: {
  sequences?: number[];
  limit?: number;
}): Promise<OperationEvent[] | undefined> {
  const { sequences, limit } = params;
  console.log("fetchDexEvents", params);
  if (!packageID) {
    throw new Error("PACKAGE_ID is not set");
  }

  const events = await fetchEvents({
    packageID,
    module: "trade",
    limit: limit ?? (sequences?.length ? sequences.length * 10 : 200),
  });
  const filteredEvents: OperationEvent[] | undefined = events
    ?.filter((event) => event?.type?.includes("::trade::Operation"))
    .map((event) => {
      return {
        type: event.type?.split("::").at(-1),
        details: (event?.parsedJson as any)?.details,
        operation: (event?.parsedJson as any)?.operation,
      } as RawOperationEvent;
    })
    .map(convertRawOperationEvent)
    ?.filter((event) => {
      console.log("event 1", event);
      if (sequences) {
        return sequences.includes(event?.operation?.sequence);
      }
      return true;
    });
  console.log("events", filteredEvents);
  return filteredEvents;
}
