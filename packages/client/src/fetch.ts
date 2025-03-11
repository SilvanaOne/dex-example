import { suiClient } from "./sui-client.js";
import { publicKeyToU256 } from "./public-key.js";
import { UserTradingAccount } from "./types.js";

const objectID = process.env.OBJECT_ID;
const poolID = process.env.POOL_ID;

export async function fetchSuiObject(objectID: string) {
  console.time("getObject");
  const data = await suiClient.getObject({
    id: objectID,
    options: {
      showContent: true,
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
      const data = account?.fields?.value?.fields;
      const result: UserTradingAccount = {
        baseTokenBalance: {
          amount: BigInt(data?.baseTokenBalance?.fields?.amount),
          borrowedAmount: BigInt(
            data?.baseTokenBalance?.fields?.borrowedAmount
          ),
        },
        quoteTokenBalance: {
          amount: BigInt(data?.quoteTokenBalance?.fields?.amount),
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
