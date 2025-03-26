"use client";

import { useState, useEffect, useContext } from "react";
import { shortenString } from "@/lib/short";
import {
  PendingTransactions,
  TransactionType,
  LastTransactionData,
  LastTransactionErrors,
  NetworkInfoData,
  OrderFormState,
  UserTradingAccount,
  fetchDexAccount,
  publicKeyToU256,
  DexConfig,
  getConfig,
  createAccount as createDexAccount,
  faucet as dexFaucet,
  waitTx,
  order as dexOrder,
  prepareOrderPayload,
  getUserKey,
  getNetworkInfo,
} from "@dex-example/lib";
import OrderBook from "@/components/dex/order-book";
import { OrderForm } from "@/components/dex/order-form";
import UserAccount from "@/components/dex/user-account";
import OpenOrders from "@/components/dex/open-orders";
import MarketTrades from "@/components/dex/market-trades";
import LastOrders from "@/components/dex/last-orders";
import LastProofs from "@/components/dex/last-proofs";
import LastL1Txs from "@/components/dex/last-l1-txs";
import LastTransaction from "@/components/dex/last-transaction";
import NetworkInfo from "@/components/dex/network-info";
import Image from "next/image";
import dynamic from "next/dynamic";
import { getEthPrice } from "@dex-example/lib";
import { formatBalance, formatPrice } from "@/lib/format";

import { AddressContext } from "@/context/address";
import { getWalletInfo, connectWallet } from "@/lib/wallet";
import { checkAddress } from "@/lib/address";
import { log } from "@/lib/log";

import { mockTransactions } from "./mock";
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === "true";

// Use dynamic import with SSR disabled for the chart component
const TradingChart = dynamic(() => import("@/components/dex/trading-chart"), {
  ssr: false,
});

export default function DEX() {
  const [account, setAccount] = useState<UserTradingAccount | undefined>(
    undefined
  );
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransactions | undefined
  >(undefined);
  const [priceDirection, setPriceDirection] = useState<"up" | "down">("up"); // Track price direction
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [change, setChange] = useState<number | undefined>(undefined);
  const [orderType, setOrderType] = useState<TransactionType>("buy");
  const [networkInfo, setNetworkInfo] = useState<NetworkInfoData | undefined>(
    undefined
  );
  const [addressU256, setAddressU256] = useState<string | undefined>(undefined);
  const [highlight, setHighlight] = useState<boolean>(false);
  const [user, setUser] = useState<string | undefined>(undefined);
  const [key, setKey] = useState<string | undefined>(undefined);
  const [config, setConfig] = useState<DexConfig | undefined>(undefined);
  const [txData, setTxData] = useState<
    LastTransactionData | LastTransactionErrors | null
  >(null);
  const [processing, setProcessing] = useState<TransactionType | undefined>(
    undefined
  );
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
    async function waitForTx(txData: LastTransactionData) {
      if (!txData?.digest) return;
      if (txData.indexTime) return;
      const start = Date.now();
      const tx = await waitTx(txData.digest);
      const end = Date.now();
      const duration = end - start;
      console.log("index delay", duration);
      setTxData((prevTxData) => {
        if (prevTxData === null) return prevTxData;
        return { ...prevTxData, indexTime: duration };
      });
    }
    if (txData !== null && (txData as any).digest) {
      waitForTx(txData as LastTransactionData);
    }
  }, [txData]);

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
  }, [address, txData]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function pollAccount() {
      if (!addressU256) return;

      try {
        const fetchedAccount = await fetchDexAccount({
          addressU256: addressU256,
        });

        // Check if account data has changed
        let changed = false;
        if (fetchedAccount) {
          if (!account) {
            changed = true;
            if (DEBUG) console.log("Account was undefined");
          } else {
            if (
              account.baseTokenBalance.amount !==
              fetchedAccount.baseTokenBalance.amount
            ) {
              changed = true;
              if (DEBUG) console.log("Base token balance changed");
            }
            if (
              account.quoteTokenBalance.amount !==
              fetchedAccount.quoteTokenBalance.amount
            ) {
              changed = true;
              if (DEBUG) console.log("Quote token balance changed");
            }
            if (
              account.bid.amount !== fetchedAccount.bid.amount ||
              account.bid.price !== fetchedAccount.bid.price ||
              account.bid.isSome !== fetchedAccount.bid.isSome
            ) {
              changed = true;
              if (DEBUG) console.log("Bid changed");
            }
            if (
              account.ask.amount !== fetchedAccount.ask.amount ||
              account.ask.price !== fetchedAccount.ask.price ||
              account.ask.isSome !== fetchedAccount.ask.isSome
            ) {
              changed = true;
              if (DEBUG) console.log("Ask changed");
            }
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
  }, [addressU256, account, txData]);

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
    async function fetchNetworkInfo() {
      const networkInfo = await getNetworkInfo();
      setNetworkInfo(networkInfo);
    }
    fetchNetworkInfo();
  }, [config]);

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

  const startProcessing = (type: TransactionType) => {
    setTxData(null);
    setProcessing(type);
  };

  const createAccount = async () => {
    startProcessing("createAccount");
    if (!address) {
      setTxData({
        errors: [
          {
            code: "E0001",
            message: "No user address",
            severity: "error",
          },
        ],
      });
      setProcessing(undefined);
      return;
    }
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
      log.info("createAccount: no account, creating account", {
        addressU256: u256String,
        address,
      });
      console.log("creating account", u256String, address);
      try {
        const result = await createDexAccount(address);
        setAddressU256(u256String);
        setTxData(result);
      } catch (error: any) {
        setTxData({
          errors: [
            {
              code: "E0001",
              message: error.message ?? "tx failed",
              severity: "error",
            },
          ],
        });
      }
    }
    setProcessing(undefined);
  };

  const faucet = async () => {
    startProcessing("faucet");
    if (!address) {
      setTxData({
        errors: [
          {
            code: "E0001",
            message: "No user address",
            severity: "error",
          },
        ],
      });
      return;
    }
    try {
      const result = await dexFaucet(address);
      setTxData(result);
      if (DEBUG) console.log("result", result);
    } catch (error: any) {
      setTxData({
        errors: [
          {
            code: "E0001",
            message: error.message ?? "tx failed",
            severity: "error",
          },
        ],
      });
    } finally {
      setProcessing(undefined);
    }
  };

  const executeOrder = async (order: OrderFormState) => {
    startProcessing(order.orderType);

    if (!address) {
      setTxData({
        errors: [
          {
            code: "E0001",
            message: "No user address",
            severity: "error",
          },
        ],
      });
      setProcessing(undefined);
      return;
    }
    const mina = (window as any).mina;
    if (mina === undefined || mina?.isAuro !== true) {
      setTxData({
        errors: [
          {
            code: "E0001",
            message: "No Auro Wallet found",
            severity: "error",
          },
        ],
      });
      setProcessing(undefined);
      return;
    }

    if (
      order.orderType !== "buy" &&
      order.orderType !== "sell" &&
      order.orderType !== "transfer" &&
      order.orderType !== "cancelBuy" &&
      order.orderType !== "cancelSell"
    ) {
      setTxData({
        errors: [
          {
            code: "E0002",
            message: `${order.orderType} orders are in development, check back soon!`,
            severity: "error",
          },
        ],
      });
      setProcessing(undefined);
      return;
    }

    let amount =
      order.amount !== undefined && order.amount !== ""
        ? Number(order.amount)
        : undefined;
    let price =
      order.price !== undefined && order.price !== ""
        ? Number(order.price)
        : undefined;

    if (amount === undefined) {
      setTxData({
        errors: [
          {
            code: "E0003",
            message: `Amount is required for ${order.orderType} orders`,
            severity: "error",
          },
        ],
      });
      setProcessing(undefined);
      return;
    }

    if (
      price === undefined &&
      (order.orderType === "buy" ||
        order.orderType === "sell" ||
        order.orderType === "cancelBuy" ||
        order.orderType === "cancelSell")
    ) {
      setTxData({
        errors: [
          {
            code: "E0004",
            message: `Price is required for ${order.orderType} orders`,
            severity: "error",
          },
        ],
      });
      setProcessing(undefined);
      return;
    }

    if (!order.recipient && order.orderType === "transfer") {
      setTxData({
        errors: [
          {
            code: "E0005",
            message: `Recipient is required for transfer orders`,
            severity: "error",
          },
        ],
      });
      setProcessing(undefined);
      return;
    }

    let type: TransactionType = order.orderType;
    if (order.orderType === "cancelBuy") type = "buy";
    if (order.orderType === "cancelSell") type = "sell";

    try {
      const orderPayload = await prepareOrderPayload({
        user: address,
        amount,
        price,
        recipient: order.recipient,
        type,
        currency: order.transferCurrency ?? "WETH",
      });
      const { signature, publicKey } = await mina?.signFields({
        message: orderPayload.payload.map((p: bigint) => p.toString()),
      });
      if (DEBUG) console.log("Transaction result", { signature, publicKey });
      if (!signature) {
        setTxData({
          errors: [
            {
              code: "E0007",
              message: "No signature received",
              severity: "error",
            },
          ],
        });
        setProcessing(undefined);
      }
      if (!publicKey) {
        setTxData({
          errors: [
            {
              code: "E0008",
              message: "No public key received",
              severity: "error",
            },
          ],
        });
        setProcessing(undefined);
        return;
      }
      if (publicKey !== address) {
        setTxData({
          errors: [
            {
              code: "E0009",
              message: "Signed using wrong address",
              severity: "error",
            },
          ],
        });
        setProcessing(undefined);
        return;
      }
      const result = await dexOrder({
        signature,
        orderPayload,
        key,
      });

      setTxData(result);
      if (DEBUG) console.log("result", result);
    } catch (error: any) {
      setTxData({
        errors: [
          {
            code: "E0010",
            message: error.message ?? "tx failed",
            severity: "error",
          },
        ],
      });
    } finally {
      setProcessing(undefined);
    }
  };

  useEffect(() => {
    const fetchPrice = async () => {
      const data = await getEthPrice();
      if (data?.price) setPrice(data.price);
      if (data?.change) {
        if (data.change > 0) {
          setPriceDirection("up");
          setChange(data.change);
        } else {
          setPriceDirection("down");
          setChange(-data.change);
        }
      }
    };
    fetchPrice();
  }, []);

  async function fetchWalletInfo(): Promise<{
    address: string | undefined;
    network: string | undefined;
  }> {
    const walletInfo = await getWalletInfo();
    setAddress(walletInfo.address);
    return walletInfo;
  }

  useEffect(() => {
    fetchWalletInfo();
  }, []);

  async function connect() {
    const address = (await connectWallet()).address;
    setAddress(address);
  }

  // Mock data for demonstration
  useEffect(() => {
    setPendingTransactions(mockTransactions);
  }, []);

  return (
    <div className="flex flex-col  h-screen bg-[#0b0e11] text-white overflow-hidden">
      {/* Professional Header with price and absolute change */}
      <header className="flex items-center justify-between px-3 py-1 bg-[#161a1e] border-b border-[#2a2e37]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <Image
              src="/img/silvana.png"
              alt="Silvana DEX"
              width={32}
              height={32}
              className="mr-2"
            />
            <h1 className="text-lg font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
              Silvana DEX
            </h1>
          </div>
          {price && change && (
            <div className="flex items-center">
              <div className="text-white text-sm font-medium mr-2">
                WETH/WUSD
              </div>
              <div className="flex items-center">
                <div className="text-white text-sm font-medium mr-1">
                  {formatPrice(price, 6)}
                </div>
                {priceDirection === "up" ? (
                  <div className="text-[#02c076] text-xs flex items-center">
                    <span className="mr-0.5">▲</span>
                    <span>{formatPrice(change, 3)}%</span>
                  </div>
                ) : (
                  <div className="text-[#f6465d] text-xs flex items-center">
                    <span className="mr-0.5">▼</span>
                    <span>{formatPrice(change, 3)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center">
          {address ? (
            <div className="flex items-center bg-[#2a2e37] rounded-lg px-2 py-0.5 text-xs">
              <span className="text-[#848e9c] mr-1">Connected:</span>
              <span className="text-white">{shortenString(address, 12)}</span>
            </div>
          ) : (
            <button
              onClick={connect}
              className="bg-accent hover:bg-accent-dark rounded-lg px-3 py-0.5 text-xs transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Trading Interface */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Chart, Orderbook, and Market Trades */}
        <div className="w-2/5 flex flex-col border-r border-[#2a2e37]">
          {/* Trading Chart */}
          <div className="h-2/5 border-b border-[#2a2e37] bg-[#161a1e]">
            <TradingChart />
          </div>

          {/* Middle section with Order Book and Market Trades */}
          <div className="h-2/5 flex border-b border-[#2a2e37] bg-[#161a1e]">
            {/* Order Book */}
            <div className="w-1/2 border-r border-[#2a2e37] overflow-hidden">
              <OrderBook />
            </div>

            {/* Market Trades */}
            <div className="w-1/2 overflow-hidden">
              <MarketTrades />
            </div>
          </div>

          {/* Last Orders - Now under Market Trades */}
          <div className="h-1/5 bg-[#161a1e] overflow-hidden">
            <LastOrders />
          </div>
        </div>

        {/* Right Column - Trading Form and Info */}
        <div className="w-3/5 flex flex-col">
          {/* Trading Form and User Account - Now 2/5 height to match chart */}
          <div className="flex h-2/5 border-b border-[#2a2e37]">
            {/* Trading Form */}
            <div className="w-1/2 border-r border-[#2a2e37] bg-[#161a1e] p-1">
              <OrderForm
                orderType={orderType}
                setOrderType={setOrderType}
                address={address}
                processing={processing}
                executeOrder={executeOrder}
                marketPrice={price}
                account={account}
              />
            </div>

            {/* User Account Section - Now with Open Orders above Wallet Balance */}
            <div className="w-1/2 flex flex-col bg-[#161a1e] p-1 space-y-1">
              {/* Open Orders - Takes 1/3 of the height */}
              <div className="h-1/3">
                <OpenOrders
                  account={account}
                  address={address}
                  processing={processing}
                  executeOrder={executeOrder}
                />
              </div>

              {/* Wallet Balance - Takes 2/3 of the height */}
              <div className="h-2/3">
                <UserAccount
                  account={account}
                  pendingTransactions={pendingTransactions}
                  highlight={highlight}
                  faucet={faucet}
                  processing={processing}
                  createAccount={createAccount}
                />
              </div>
            </div>
          </div>

          {/* Bottom Panels - Now 3/5 height to fill remaining space */}
          <div className="h-3/5 flex flex-col gap-0.5 p-0.5 overflow-hidden bg-[#0b0e11]">
            {/* Row 1: Your Last Transaction and Last Proofs side by side */}
            <div className="flex gap-0.5 h-1/2">
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <LastTransaction txData={txData} />
              </div>
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <LastProofs />
              </div>
            </div>

            {/* Row 2: Network Info and Last L1 Txs with equal widths */}
            <div className="flex gap-0.5 h-1/2">
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <NetworkInfo networkInfo={networkInfo} />
              </div>
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <LastL1Txs />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
