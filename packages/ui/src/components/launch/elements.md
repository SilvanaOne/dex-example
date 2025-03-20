Create a trading web page using the next.js and tailwind for Silvana DEX using Mina protocol for L1 settlement contract and Sui as ZK coordination layer.

User sign the rollup transaction using Auro Wallet for Mina protocol, and then the rollup tx is sent to Sui that check the inputs and sequence the txs, emitting the events. Sui events will be used to show info on the page.

Then the prover prove and merge the proofs for all txs and sends aggregated prove to Mina protocol L1 contract.
The proofs are stored on Walrus - data availability layer

Page is intended for trading WETH/WUSD pair

The page should have the following elements:

- Orderbook, showing all bids and offers, with info on amount and price for each bid or offer
- Order form for operations Buy, Sell, and Transfer where user should enter amount, price in case of Buy and Sell and recepient and currency (WETH or WUSD) in case of transfer
- User account data that should show all the fields from UserTradingAccount:

export interface MinaBalance {
amount: bigint;
stakedAmount: bigint;
borrowedAmount: bigint;
}

export interface Order {
amount: bigint;
price: bigint;
isSome: boolean;
}

export interface UserTradingAccount {
baseTokenBalance: MinaBalance;
quoteTokenBalance: MinaBalance;
bid: Order;
ask: Order;
nonce: bigint;
}
// Example of UserTradingAccount JSON
{
"ask": {
"amount": 0n,
"isSome": false,
"price": 0n
},
"baseTokenBalance": {
"amount": 50000000000n,
"borrowedAmount": 0n,
"stakedAmount": 0n
},
"bid": {
"amount": 2000000000n,
"isSome": true,
"price": 2100000000000n
},
"nonce": 4n,
"quoteTokenBalance": {
"amount": 100000000000000n,
"borrowedAmount": 0n,
"stakedAmount": 0n
}
}

- Last market trades window that show all last trades, having time (like 30 sec ago), amount and price
- Last orders sent by all users, show the time (like 50 sec ago), operation (Bid, Ask, Transfer), and amount and price (for Bid and Ask)
- Last proofs created - showing having time (like 30 sec ago), number of proofs in the proof (can be from 1 to many for aggregated proofs) and data avialiability storage hash
- Last L1 txs - including having time (like 30 sec ago), tx hash, data availability hash with aggregated proof, and number of user txs included in L1 tx
- The graph for WETH/WUSD price, showing last 50 price points

Please use the colors and style (except for size) similar to the colors ansd style of the page below that is first POC of the page. Make sure that all the info is fitted to the one page visible to the user, so user should not scroll the page. Use small fonts and small elements if necessary. Also attached below is tailwind configuration of the project that you can use. Use the elements layout similar to Binance and Bybit in attached screenshots

---- POC page -----

"use client";
import Image from "next/image";
import React, { useEffect, useState, useContext } from "react";
import Link from "next/link";
import { AddressContext } from "@/context/address";
import { getWalletInfo, connectWallet } from "@/lib/wallet";
import { checkAddress } from "@/lib/address";
import { shortenString } from "@/lib/short";
import { LaunchCollectionData, Trait, Permissions } from "@/lib/token";
import { log } from "@/lib/log";
import { UserTradingAccount } from "@/lib/dex/types";
import { fetchDexAccount } from "@/lib/dex/fetch";
import { publicKeyToU256 } from "@/lib/dex/public-key";
import { DexConfig, getConfig } from "@/lib/dex/config";
import { createAccount as createDexAccount } from "@/lib/dex/account";
import { faucet as dexFaucet } from "@/lib/dex/faucet";
import { waitTx } from "@/dex/execute";
import { order, prepareOrderPayload, TransactionType } from "@/lib/dex/order";
import { getUserKey } from "@/lib/dex/key";
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === "true";

const alice = "B62qqevZM3XZJJJKThPx9ZRNARQQEFcx1sJxaPDjzC5rWrVnMnSK8Y2";

function formatBalance(num: number | bigint | undefined): string {
if (num === undefined) return "-";
const fixed = (Number(BigInt(num) / 1_000n)/1_000_000).toLocaleString(undefined, {
maximumSignificantDigits: 4,
});
return fixed;
}

type ProcessingType = "buy" | "sell" | "transfer" | "faucet" | "createAccount";

export function LaunchForm({
onLaunch,
}: {
onLaunch: (data: LaunchCollectionData) => void;
}) {
const [account, setAccount] = useState<UserTradingAccount | undefined>(
undefined
);
const [addressU256, setAddressU256] = useState<string | undefined>(undefined);
const [highlight, setHighlight] = useState<boolean>(false);
const [user, setUser] = useState<string | undefined>(undefined);
const [key, setKey] = useState<string | undefined>(undefined);
const [config, setConfig] = useState<DexConfig | undefined>(undefined);
const [digest, setDigest] = useState<string | undefined>(undefined);
const [prepareDelay, setPrepareDelay] = useState<number | undefined>(undefined);
const [executeDelay, setExecuteDelay] = useState<number | undefined>(undefined);
const [indexingDelay, setIndexingDelay] = useState<number | undefined>(undefined);
const [txError, setTxError] = useState<string | undefined>(undefined);
const [appliedDigest, setAppliedDigest] = useState<string | undefined>(undefined);
const [amount, setAmount] = useState<number | undefined>(undefined);
const [price, setPrice] = useState<number | undefined>(undefined);
const [recipient, setRecipient] = useState<string | undefined>(undefined);
const [orderType, setOrderType] = useState<TransactionType>("buy");
const [processing, setProcessing] = useState<ProcessingType | undefined>(undefined);
const [buttonDisabled, setButtonDisabled] = useState<boolean>(true);
const [addressValid, setAddressValid] = useState<boolean>(true);

const { address, setAddress } = useContext(AddressContext);

useEffect(() => {
async function getU256Address() {
if (!user) return;
console.log("user", user);
const config = await getConfig();
console.log("config", config);
const u256 = await publicKeyToU256(user);
const u256String = u256.toString();
console.log("u256String", u256String);
setAddressU256(u256String);
}
getU256Address();
}, [user]);

useEffect(() => {
if (digest) {
setHighlight(true);
}
}, [digest]);

useEffect(() => {
if (highlight) {
const timer = setTimeout(() => {
setHighlight(false);
}, 1000);

      return () => clearTimeout(timer);
    }

}, [highlight]);

useEffect(() => {
async function getAccount() {
console.log("addressU256", addressU256);
if (!addressU256) return;
const account = await fetchDexAccount({ addressU256: addressU256 });
setAccount(account);
console.log("account", account);
}
getAccount();
}, [addressU256]);

useEffect(() => {
async function waitForTx() {
console.log("digest", digest);
if (!digest) return;
const start = Date.now();
const tx = await waitTx(digest);
const end = Date.now();
const duration = end - start;
console.log("tx", tx);
setAppliedDigest(digest);
setIndexingDelay(duration);
}
waitForTx();
}, [digest]);

useEffect(() => {
async function getAccount() {
console.log("address", address);
if (!address) return;
const u256 = await publicKeyToU256(address);
const addressU256 = u256.toString();
console.log("addressU256", addressU256);
if (!addressU256) return;
const account = await fetchDexAccount({ addressU256: addressU256 });
if (!account) return;
setAddressU256(addressU256);
setUser(address);
setAccount(account);
console.log("account", account);
}
getAccount();
}, [address]);

useEffect(() => {
let intervalId: NodeJS.Timeout;

    async function pollAccount() {
      if (!addressU256) return;

      try {
        const fetchedAccount = await fetchDexAccount({ addressU256: addressU256 });

        // Check if account data has changed
        let changed = false;
        if (fetchedAccount) {
          if (!account) {
            changed = true;
            if (DEBUG) console.log("Account was undefined");
          } else {
            if (
              account.baseTokenBalance.amount !== fetchedAccount.baseTokenBalance.amount) {
              changed = true;
              if (DEBUG) console.log("Base token balance changed");
            };
            if (
              account.quoteTokenBalance.amount !== fetchedAccount.quoteTokenBalance.amount) {
              changed = true;
              if (DEBUG) console.log("Quote token balance changed");
            };
            if (
              account.bid.amount !== fetchedAccount.bid.amount ||
              account.bid.price !== fetchedAccount.bid.price ||
              account.bid.isSome !== fetchedAccount.bid.isSome) {
              changed = true;
              if (DEBUG) console.log("Bid changed");
            };
            if (
              account.ask.amount !== fetchedAccount.ask.amount ||
              account.ask.price !== fetchedAccount.ask.price ||
              account.ask.isSome !== fetchedAccount.ask.isSome) {
              changed = true;
              if (DEBUG) console.log("Ask changed");
            };
          }
        }
        if (changed) {
          setAccount(fetchedAccount);
          setHighlight(true);
          if (DEBUG) console.log("Account updated:", fetchedAccount);
        } else {
          //if (DEBUG) console.log("Account not changed");
        }
      } catch (error) {
        console.error("Error polling account:", error);
      }
    }

    // Start polling every 1 second
    intervalId = setInterval(pollAccount, 1000);

    // Initial poll
    pollAccount();

    // Cleanup interval on component unmount
    return () => {
      clearInterval(intervalId);
    };

}, [addressU256, account, digest, appliedDigest]);

useEffect(() => {
setButtonDisabled(
addressValid && (((!amount || !price) && (orderType === "buy" || orderType === "sell")) ||
((!recipient) && (orderType === "transfer")))
);
}, [addressValid, amount, price, recipient]);

async function getAddress(): Promise<string | undefined> {
let userAddress = address;

    userAddress = (await getWalletInfo()).address;

    if (address !== userAddress) {
      setAddress(userAddress);
      if (DEBUG) console.log("address", userAddress);
    }
    setAddressValid(userAddress ? await checkAddress(userAddress) : false);
    return userAddress;

}

useEffect(() => {
getAddress();
}, []);

useEffect(() => {
async function getKey() {
const key = await getUserKey();
setKey(key);
}
getKey();
}, []);

useEffect(() => {
async function getDexConfig() {
const config = await getConfig();
setConfig(config);
}
getDexConfig();
}, []);

const generateRandomData = () => {
setAmount(Math.floor(Math.random() _ 30) / 10);
setPrice(Math.floor(Math.random() _ 500) + 1750);
const faucetPublicKey: string = process.env.NEXT_PUBLIC_FAUCET_PUBLIC_KEY!;
setRecipient(faucetPublicKey);
};

const startProcessing = (type: ProcessingType) => {
setIndexingDelay(undefined);
setPrepareDelay(undefined);
setExecuteDelay(undefined);
setDigest(undefined);
setAppliedDigest(undefined);
setTxError(undefined);
setProcessing(type);
}

const createAccount = async () => {
startProcessing("createAccount");

    if (!address) {
      setTxError("No address");
      return;
    }
    setProcessing("createAccount");
    console.log("createAccount: address", address);
    const u256 = await publicKeyToU256(address);
    const u256String = u256.toString();
    console.log("u256String", u256String);
    const account = await fetchDexAccount({ addressU256: u256String });
    console.log("checked account", account);
    if (account) {
      setAddressU256(u256String);
      setAccount(account);
    } else {
      log.info("createAccount: no account, creating account", { addressU256: u256String, address });
      console.log("creating account", u256String, address);
      try {
        const { digest, prepareDelay, executeDelay } = await createDexAccount(address);
        setAddressU256(u256String);
        setDigest(digest);
        setPrepareDelay(prepareDelay);
        setExecuteDelay(executeDelay);
      } catch (error: any) {
        setTxError(error.message ?? "tx failed");
        log.error("createAccount: error", { error });
      }

    }
    setProcessing(undefined);

}

const faucet = async () => {
startProcessing("faucet");
if (!address) {
setTxError("No user address");
return;
}
try {
const { digest, prepareDelay, executeDelay } = await dexFaucet(address);
setDigest(digest);
setPrepareDelay(prepareDelay);
setExecuteDelay(executeDelay);
if (DEBUG) console.log("digest", digest);
} catch (error: any) {
setTxError(error.message ?? "tx failed");
log.error("faucet: error", { error });
} finally {
setProcessing(undefined);
}
}

const executeOrder = async () => {
if (buttonDisabled) {
generateRandomData();
return;
}

    if (!address) {
      setTxError("No user address");
      return;
    }

    const mina = (window as any).mina;
    if (mina === undefined || mina?.isAuro !== true) {
      setTxError("No Auro Wallet found");
      return;
    }

    startProcessing(orderType);

    try {
      if (!amount || !price) {
        return;
      }
      const { payload, amount: amountBigint, price: priceBigint, nonce, recipient: recipientAddress } = await prepareOrderPayload({ user: address, amount, price, recipient, type: orderType});
      const { signature, publicKey } = await mina?.signFields({ message: payload.map(p => p.toString()) });
      if (DEBUG) console.log("Transaction result", { signature, publicKey });
      if (!signature) {
        setTxError("No signature received");
        setProcessing(undefined);
        return;
      }
      if (!publicKey) {
        setTxError("No public key received");
        setProcessing(undefined);
        return;
      }
      if (publicKey !== address) {
        setTxError("Signed using wrong address");
        setProcessing(undefined);
        return;
      }
      const { digest, prepareDelay, executeDelay } = await order({
        user: address,
        amount: amountBigint,
        price: priceBigint,
        recipient: recipientAddress,
        nonce,
        signature,
        payload,
        type: orderType,
        key });

      setDigest(digest);
      setPrepareDelay(prepareDelay);
      setExecuteDelay(executeDelay);
      if (DEBUG) console.log("digest", digest);
    } catch (error: any) {
      setTxError(error.message ?? "tx failed");
      log.error("faucet: error", { error });
    } finally {
      setProcessing(undefined);
    }

};

return (

<section className="relative py-24 dark:bg-jacarta-800">
<picture className="pointer-events-none absolute inset-0 -z-10 dark:hidden">
<Image
          width={1920}
          height={789}
          src="/img/gradient_light.jpg"
          priority
          alt="gradient"
          className="h-full w-full"
        />
</picture>
<div className="container">
<h1 className="pt-16 text-center font-display text-4xl font-medium text-jacarta-700 dark:text-white">
{orderType === "buy" ? "Trade on Silvana DEX" : "Trade on Silvana DEX"}
</h1>

        <div className="mx-auto max-w-[48.125rem] md:flex mt-8">
          <div className="mb-12 md:w-1/2 md:pr-8">
            {/* Token type */}
            <div className="mb-6">
              <label className="mb-1 block font-display text-sm text-jacarta-700 dark:text-white">
                Trade type
              </label>
              <div className="flex rounded-lg border border-jacarta-100 bg-white dark:border-jacarta-600 dark:bg-jacarta-700">
                <button
                  className={`flex-1 rounded-l-lg py-3 px-4 text-center ${orderType === "buy"
                    ? "bg-accent text-white"
                    : "hover:bg-jacarta-50 dark:text-jacarta-300 dark:hover:bg-jacarta-600"
                    }`}
                  onClick={() => setOrderType("buy")}
                >
                  Buy
                </button>
                <button
                  className={`flex-1 rounded-r-lg py-3 px-4 text-center ${orderType === "sell"
                    ? "bg-accent text-white"
                    : "hover:bg-jacarta-50 dark:text-jacarta-300 dark:hover:bg-jacarta-600"
                    }`}
                  onClick={() => setOrderType("sell")}
                >
                  Sell
                </button>
                <button
                  className={`flex-1 rounded-r-lg py-3 px-4 text-center ${orderType === "transfer"
                    ? "bg-accent text-white"
                    : "hover:bg-jacarta-50 dark:text-jacarta-300 dark:hover:bg-jacarta-600"
                    }`}
                  onClick={() => setOrderType("transfer")}
                >
                  Transfer
                </button>
              </div>
            </div>



            {((orderType === "sell") ||
              orderType === "buy" ||
              orderType === "transfer") && (
                <>
                  {(orderType === "sell" ||
                    orderType === "buy") && (
                      <>
                        <div className="mb-6">
                          <label
                            htmlFor="token-amount"
                            className="mb-1 block font-display text-sm text-jacarta-700 dark:text-white"
                          >
                            {orderType === "buy"
                              ? "Amount to buy"
                              : "Amount to sell"}
                            <span className="text-red">*</span>
                          </label>
                          <input
                            type="text"
                            pattern="[0-9]*\.?[0-9]*"
                            inputMode="decimal"
                            id="token-amount"
                            className="w-full rounded-lg border-jacarta-100 py-3 hover:ring-2 hover:ring-accent/10 focus:ring-accent dark:border-jacarta-600 dark:bg-jacarta-700 dark:text-white dark:placeholder:text-jacarta-300"
                            placeholder={
                              orderType === "buy"
                                ? "Enter amount to buy"
                                : "Enter amount to sell"
                            }
                            required
                            autoComplete="off"
                            value={amount}
                            onChange={(e) => {
                              const input = e.target as HTMLInputElement;
                              setAmount(Number(input.value));
                            }}
                          />
                        </div>



                        <div className="mb-6">
                          <label
                            htmlFor="token-price"
                            className="mb-1 block font-display text-sm text-jacarta-700 dark:text-white"
                          >
                            Price<span className="text-red">*</span>
                          </label>
                          <input
                            type="text"
                            pattern="[0-9]*\.?[0-9]*"
                            id="token-price"
                            className="w-full rounded-lg border-jacarta-100 py-3 hover:ring-2 hover:ring-accent/10 focus:ring-accent dark:border-jacarta-600 dark:bg-jacarta-700 dark:text-white dark:placeholder:text-jacarta-300"
                            placeholder="Enter price"
                            required
                            autoComplete="off"
                            maxLength={6}
                            value={price}
                            onInput={(e) => {
                              const input = e.target as HTMLInputElement;
                              setPrice(Number(input.value));
                            }}
                          />
                        </div>
                      </>
                    )}

                  {(
                    orderType === "transfer") && (
                      <>
                        <div className="mb-6">
                          <label
                            htmlFor="token-amount"
                            className="mb-1 block font-display text-sm text-jacarta-700 dark:text-white"
                          >
                            Recipient address

                            <span className="text-red">*</span>
                          </label>
                          <input
                            type="text"
                            pattern="^B62[1-9A-HJ-NP-Za-km-z]{52}$"
                            id="token-amount"
                            className="w-full rounded-lg border-jacarta-100 py-3 hover:ring-2 hover:ring-accent/10 focus:ring-accent dark:border-jacarta-600 dark:bg-jacarta-700 dark:text-white dark:placeholder:text-jacarta-300"
                            placeholder={
                              "B62..."
                            }
                            required
                            autoComplete="off"
                            value={recipient}
                            onChange={(e) => {
                              const input = e.target as HTMLInputElement;
                              setRecipient(input.value);
                            }}
                          />
                        </div>



                      </>
                    )}


                  {/* Wallet address */}
                  <div className="mb-6">
                    <label className="mb-1 block font-display text-sm text-jacarta-700 dark:text-white">
                      Your Wallet Address<span className="text-red">*</span>
                    </label>
                    <button
                      className={`js-copy-clipboard flex w-full select-none items-center rounded-lg border bg-white py-3 px-4 hover:bg-jacarta-50 dark:bg-jacarta-700 dark:text-jacarta-300 ${addressValid
                        ? "border-jacarta-100 dark:border-jacarta-600"
                        : "border-2 border-red"
                        }`}
                      id="admin-address"
                      // data-tippy-content="Copy"
                      onClick={() => {
                        navigator.clipboard.writeText(address ?? "");
                      }}
                    >
                      <span>{shortenString(address, 14) ?? ""}</span>

                      <div className="ml-auto mb-px h-4 w-4 fill-jacarta-500 dark:fill-jacarta-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="15"
                          height="16"
                        >
                          <path fill="none" d="M0 0h24v24H0z"></path>
                          <path d="M7 7V3a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4v3.993c0 .556-.449 1.007-1.007 1.007H3.007A1.006 1.006 0 0 1 2 20.993l.003-12.986C2.003 7.451 2.452 7 3.01 7H7zm2 0h6.993C16.549 7 17 7.449 17 8.007V15h3V4H9v3zM4.003 9L4 20h11V9H4.003z"></path>
                        </svg>
                      </div>
                    </button>
                  </div>

                  {/* <Tippy content={launchTip}> */}
                  <button
                    onClick={executeOrder}
                    className={`rounded-full py-3 px-8 text-center font-semibold transition-all ${buttonDisabled && false // TODO: remove this in production
                      ? "bg-jacarta-300 text-white cursor-not-allowed"
                      : "bg-accent text-white shadow-accent-volume hover:bg-accent-dark"
                      }`}
                  >
                    {addressValid
                      ? buttonDisabled
                        ? "Generate random data" // TODO: remove this in production
                        : orderType === "buy"
                          ? "Buy"
                          : "Sell"
                      : "Create account"}
                  </button>
                </>
              )}
            {/* </Tippy> */}
          </div>

          <>

            <div className={`min-w-60 max-w-md rounded-2lg border ${highlight ? 'border-accent' : 'border-jacarta-100'} bg-white p-8 dark:border-jacarta-600 dark:bg-jacarta-700 ${highlight ? 'shadow-accent-volume' : ''}`}>
              <div className="text-medium mb-4 font-bold text-jacarta-600 dark:text-jacarta-300 text-center">
                YOUR DEX ACCOUNT
              </div>
              {!account && (
                <div>
                  <button
                    onClick={() => {
                      createAccount();
                    }}
                    disabled={processing === "createAccount"}
                    className={`inline-block w-full rounded-full ${processing === "faucet" ? "bg-accent-dark cursor-not-allowed" : "bg-accent hover:bg-accent-dark"
                      } py-2 px-8 text-center font-semibold text-white shadow-accent-volume transition-all`}
                  >
                    {processing === "createAccount" ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Create account"
                    )}
                  </button>
                </div>
              )}

              {account && (
                <>
                  <div className="text-medium  font-bold text-jacarta-400 dark:text-jacarta-300 text-center">
                    BALANCE
                  </div>
                  <div className="mb-3 sm:flex sm:flex-wrap">

                    <div className="sm:w-1/2 sm:pr-4 lg:pr-8">
                      <div className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="text-sm text-jacarta-400 dark:text-jacarta-300">
                          Wrapped ETH
                        </span>
                      </div>
                      <div className="mt-3 flex">
                        <div>
                          <div className="flex items-center whitespace-nowrap">
                            <span className="text-lg font-medium leading-tight tracking-tight">
                              {formatBalance(account.baseTokenBalance.amount)} WETH
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="sm:w-1/2 sm:pr-4 lg:pr-8">
                      <div className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="text-sm text-jacarta-400 dark:text-jacarta-300">
                          Wrapped USD
                        </span>
                      </div>
                      <div className="mt-3 flex">
                        <div>
                          <div className="flex items-center whitespace-nowrap">
                            <span className="text-lg font-medium leading-tight tracking-tight">
                              {formatBalance(account.quoteTokenBalance.amount)} WUSD
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        faucet();
                      }}
                      disabled={processing === "faucet"}
                      className={`inline-block w-full rounded-full ${processing === "faucet" ? "bg-accent-dark cursor-not-allowed" : "bg-accent hover:bg-accent-dark"
                        } py-2 px-8 text-center font-semibold text-white shadow-accent-volume transition-all`}
                    >
                      {processing === "faucet" ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        "Faucet"
                      )}
                    </button>
                  </div>

                  <div className="text-medium mt-4 font-bold text-green dark:text-jacarta-300  text-center">
                    BID
                  </div>
                  <div className="mb-8 sm:flex sm:flex-wrap">

                    <div className="sm:w-1/2 sm:pr-4 lg:pr-8">
                      <div className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="text-sm text-jacarta-400 dark:text-jacarta-300">
                          Amount
                        </span>
                      </div>
                      <div className="mt-3 flex">
                        <div>
                          <div className="flex items-center whitespace-nowrap">
                            <span className="text-lg font-medium leading-tight tracking-tight text-green">
                              {formatBalance(account.bid.isSome ? account.bid.amount : undefined)} WETH
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="sm:w-1/2 sm:pr-4 lg:pr-8">
                      <div className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="text-sm text-jacarta-400 dark:text-jacarta-300">
                          Price
                        </span>
                      </div>
                      <div className="mt-3 flex">
                        <div>
                          <div className="flex items-center whitespace-nowrap">
                            <span className="text-lg font-medium leading-tight tracking-tight text-green">
                              {formatBalance(account.bid.isSome ? account.bid.price : undefined)} WUSD
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-medium  font-bold text-red dark:text-jacarta-300 text-center">
                    ASK
                  </div>
                  <div className="mb-8 sm:flex sm:flex-wrap">

                    <div className="sm:w-1/2 sm:pr-4 lg:pr-8">
                      <div className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="text-sm text-jacarta-400 dark:text-jacarta-300">
                          Amount
                        </span>
                      </div>
                      <div className="mt-3 flex">
                        <div>
                          <div className="flex items-center whitespace-nowrap">
                            <span className="text-lg font-medium leading-tight tracking-tight text-red">
                              {formatBalance(account.ask.isSome ? account.ask.amount : undefined)} WETH
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="sm:w-1/2 sm:pr-4 lg:pr-8">
                      <div className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="text-sm text-jacarta-400 dark:text-jacarta-300">
                          Price
                        </span>
                      </div>
                      <div className="mt-3 flex">
                        <div>
                          <div className="flex items-center whitespace-nowrap">
                            <span className="text-lg font-medium leading-tight tracking-tight text-red">
                              {formatBalance(account.ask.isSome ? account.ask.price : undefined)} WUSD
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {digest && (
                    <>
                      <div className="text-medium  font-bold dark:text-jacarta-300 text-center">
                        {"TX"}
                      </div>
                      <div className=" dark:text-jacarta-300 text-center text-normal">
                        <Link
                          href={`https://suiscan.xyz/devnet/tx/${digest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex text-normal text-center items-center justify-between py-3.5 font-normal text-base text-jacarta-700 dark:text-white hover:text-accent focus:text-accent dark:hover:text-accent dark:focus:text-accent lg:px-5`}
                        >
                          {shortenString(digest, 24)}
                        </Link>
                      </div>
                    </>)}
                  {txError && (
                    <>
                      <div className="text-small dark:text-jacarta-300 text-center">
                        {txError}
                      </div>

                    </>)}
                </>)}
              {prepareDelay && (
                <div className="text-small dark:text-jacarta-300 text-center">
                  {`tx prepared in: ${prepareDelay} ms`}
                </div>

              )}
              {executeDelay && (
                <div className="text-small dark:text-jacarta-300 text-center">
                  {`tx executed in: ${executeDelay} ms`}
                </div>

              )}
              {indexingDelay && (
                <div className="text-small dark:text-jacarta-300 text-center">
                  {`tx indexed in: ${indexingDelay} ms`}
                </div>
              )}


            </div>
          </>

        </div>
      </div>
    </section>

);
}

----- Tailwind config ------------

import type { Config } from "tailwindcss";

const config: Config = {
content: [
"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
],
darkMode: "class",
theme: {
screens: {
sm: "575px",
md: "768px",
lg: "1025px",
xl: "1202px",
},
fontFamily: {
display: ['"CalSans-SemiBold"', "sans-serif"],
body: ['"DM Sans"', "sans-serif"],
},
container: {
center: true,
padding: "1rem",
},
colors: {
transparent: "transparent",
current: "currentColor",
white: "#ffffff",
accent: "#8358FF",
"accent-dark": "#7444FF",
"accent-light": "#9E7CFF",
"accent-lighter": "#B9A0FF",
"light-base": "#F5F8FA",
green: "#10b981",
orange: "#FEB240",
"orange-bright": "#FA6D1E",
red: "#EF4444",
yellow: {
300: "#fde047",
400: "#facc15",
500: "#eab308",
600: "#ca8a04",
},
blue: "#428AF8",
jacarta: {
base: "#5A5D79",
50: "#F4F4F6",
100: "#E7E8EC",
200: "#C4C5CF",
300: "#A1A2B3",
400: "#7D7F96",
500: "#5A5D79",
600: "#363A5D",
700: "#131740",
800: "#101436",
900: "#0D102D",
},
highlightBg: "#FFF59D",
highlightText: "#1E293B",
},
boxShadow: {
none: "none",
sm: "0px 1px 2px 0px rgba(13, 16, 45, 0.1)",
base: "0px 1px 2px -1px rgba(13, 16, 45, 0.1), 0px 2px 4px 0px rgba(13, 16, 45, 0.1)",
md: "0px 2px 4px -2px rgba(13, 16, 45, 0.1), 0px 4px 6px -1px rgba(13, 16, 45, 0.1)",
lg: "0px 4px 6px -4px rgba(13, 16, 45, 0.1), 0px 10px 15px -3px rgba(13, 16, 45, 0.1)",
xl: "0px 8px 10px -6px rgba(13, 16, 45, 0.1), 0px 20px 25px -5px rgba(13, 16, 45, 0.1)",
"2xl":
"0px 25px 50px -12px rgba(13, 16, 45, 0.1), 0px 12px 24px 0px rgba(13, 16, 45, 0.1)",
"accent-volume":
"5px 5px 10px rgba(108, 106, 213, 0.25), inset 2px 2px 6px #A78DF0, inset -5px -5px 10px #6336E4",
"white-volume":
"5px 5px 10px rgba(108, 106, 212, 0.25), inset 2px 2px 6px #EEF1F9, inset -5px -5px 10px #DFE3EF",
},
fontSize: {
xxs: ["0.625rem", { lineHeight: "normal" }],
xs: ["0.75rem", { lineHeight: "normal" }],
"2xs": ["0.8125rem", { lineHeight: "normal" }],
sm: ["0.875rem", { lineHeight: "normal" }],
base: ["1rem", { lineHeight: "normal" }],
md: ["1.125rem", { lineHeight: "normal" }],
lg: ["1.25rem", { lineHeight: "1.5" }],
xl: ["1.5rem", { lineHeight: "normal" }],
"2xl": ["1.75rem", { lineHeight: "normal" }],
"3xl": ["2rem", { lineHeight: "normal" }],
"4xl": ["2.25rem", { lineHeight: "normal" }],
"5xl": ["2.5rem", { lineHeight: "normal" }],
"6xl": ["3.5rem", { lineHeight: "normal" }],
"7xl": ["4.25rem", { lineHeight: "normal" }],
},
extend: {
borderRadius: {
"2lg": "0.625rem",
"2.5xl": "1.25rem",
},
transitionProperty: {
height: "height",
width: "width",
},
animation: {
fly: "fly 6s cubic-bezier(0.75, 0.02, 0.31, 0.87) infinite",
marquee: "marquee 60s linear infinite",
marqueeRight: "marqueeRight 60s linear infinite",
heartBeat: "heartBeat 1s cubic-bezier(0.75, 0.02, 0.31, 0.87) infinite",
progress: "progress 5s linear",
"spin-slow": "spin 10s linear infinite",
gradient: "gradient 6s linear infinite",
gradientDiagonal: "gradientDiagonal 6s linear infinite",
},
keyframes: {
fly: {
"0%, 100%": { transform: "translateY(5%)" },
"50%": { transform: "translateY(0)" },
},
marquee: {
"0%": { transform: "translateX(0)" },
to: { transform: "translateX(-2322px)" },
},
marqueeRight: {
"0%": { transform: "translateX(-2322px)" },
to: { transform: "translateX(0)" },
},
heartBeat: {
"0%, 40%, 80%, 100%": { transform: "scale(1.1)" },
"20%, 60%": { transform: "scale(.8)" },
},
progress: {
"0%": { width: "0%" },
"100%": { width: "100%" },
},
gradient: {
"100%": { backgroundPosition: "200% center" },
},
gradientDiagonal: {
"100%": { backgroundPosition: "200% center" },
},
},
},
customGroups: {
names: ["dropdown"],
},
},
variants: {
display: ["children", "children-not"],
},
corePlugins: {
visibility: false,
},
plugins: [
require("@tailwindcss/forms"),
//require("tailwindcss-custom-groups"),
],
};
export default config;
