"use client";
import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Initialize Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Example of the user trading account interface
interface MinaBalance {
  amount: bigint;
  stakedAmount: bigint;
  borrowedAmount: bigint;
}
interface Order {
  amount: bigint;
  price: bigint;
  isSome: boolean;
}
interface UserTradingAccount {
  baseTokenBalance: MinaBalance;
  quoteTokenBalance: MinaBalance;
  bid: Order;
  ask: Order;
  nonce: bigint;
}

export default function SilvanaDexPage() {
  //
  // Mock data and states
  //
  const [account, setAccount] = useState<UserTradingAccount | null>(null);
  const [orderType, setOrderType] = useState<"buy" | "sell" | "transfer">(
    "buy"
  );
  const [amount, setAmount] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [transferRecipient, setTransferRecipient] = useState<string>("");
  const [currency, setCurrency] = useState<"WETH" | "WUSD">("WETH");

  // Mock orderbook data
  const mockBids = [
    { amount: 2.5, price: 2100 },
    { amount: 1.2, price: 2090 },
    { amount: 4.8, price: 2085 },
  ];
  const mockAsks = [
    { amount: 3.7, price: 2110 },
    { amount: 2.1, price: 2112 },
    { amount: 5.0, price: 2115 },
  ];

  // Mock last trades data
  const mockLastTrades = [
    { time: "30s ago", amount: 2.1, price: 2105 },
    { time: "45s ago", amount: 1.0, price: 2108 },
    { time: "1m ago", amount: 0.5, price: 2099 },
  ];

  // Mock last orders from all users
  const mockLastOrders = [
    { time: "50s ago", op: "Bid", amount: 2, price: 2100 },
    { time: "55s ago", op: "Ask", amount: 3, price: 2112 },
    { time: "1m ago", op: "Transfer", amount: 5, price: "-" },
  ];

  // Mock last proofs
  const mockLastProofs = [
    { time: "30s ago", proofCount: 5, daHash: "abc123...xyz" },
    { time: "2m ago", proofCount: 10, daHash: "def456...zzz" },
  ];

  // Mock last L1 txs
  const mockLastL1 = [
    { time: "30s ago", txHash: "0xabcd1234", daHash: "walrus...123", userTxs: 15 },
    { time: "1m ago", txHash: "0xbcde5678", daHash: "walrus...456", userTxs: 10 },
  ];

  // Mock chart data (50 random points)
  const [chartData, setChartData] = useState({
    labels: Array.from({ length: 50 }, (_, i) => i + 1),
    datasets: [
      {
        label: "WETH/WUSD Price",
        data: Array.from({ length: 50 }, () =>
          2100 + Math.random() * 50 - 25
        ),
      },
    ],
  });

  //
  // On mount, mock a user trading account
  //
  useEffect(() => {
    const sampleAccount: UserTradingAccount = {
      baseTokenBalance: {
        amount: BigInt(50000000000),
        borrowedAmount: BigInt(0),
        stakedAmount: BigInt(0),
      },
      quoteTokenBalance: {
        amount: BigInt(100000000000000),
        borrowedAmount: BigInt(0),
        stakedAmount: BigInt(0),
      },
      bid: {
        amount: BigInt(2000000000),
        price: BigInt(2100000000000),
        isSome: true,
      },
      ask: {
        amount: BigInt(0),
        price: BigInt(0),
        isSome: false,
      },
      nonce: BigInt(4),
    };
    setAccount(sampleAccount);
  }, []);

  //
  // Form handlers
  //
  const handleSubmitOrder = () => {
    // Here you'd actually call a function to sign and send the TX for buy/sell/transfer
    alert(
      `Submitting a ${orderType.toUpperCase()} order:
      - Amount: ${amount}
      - Price: ${price}
      - Currency (transfer only): ${currency}
      - Recipient (transfer only): ${transferRecipient}`
    );
    setAmount("");
    setPrice("");
    setTransferRecipient("");
  };

  //
  // Helper for formatting balances
  //
  function formatBalance(num: bigint): string {
    const fixed = Number(num) / 1_000_000_000;
    return fixed.toLocaleString(undefined, {
      maximumSignificantDigits: 5,
    });
  }

  //
  // Render
  //
  return (
    <div className="mx-auto flex h-screen w-full mt-24 flex-col items-center justify-center bg-light-base dark:bg-jacarta-800 p-4 text-xs lg:text-xxs overflow-hidden">
      {/* We place everything in a grid that fits on one screen: 3 columns x 3 rows (adjust as needed). */}
      <div className="grid h-full w-full max-w-screen-2xl grid-rows-3 grid-cols-3 gap-2">
        {/* 1) User account data */}
        <div className="row-span-1 col-span-1 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg">
          <h2 className="font-bold text-jacarta-600 dark:text-white mb-1 text-center">
            User Account Data
          </h2>
          {account ? (
            <div className="flex flex-col gap-1 overflow-auto">
              <p>
                <span className="font-semibold">Base Balance (WETH):</span>{" "}
                {formatBalance(account.baseTokenBalance.amount)} 
              </p>
              <p>
                <span className="font-semibold">Quote Balance (WUSD):</span>{" "}
                {formatBalance(account.quoteTokenBalance.amount)}
              </p>
              <p>
                <span className="font-semibold">Bid Amount:</span>{" "}
                {account.bid.isSome
                  ? formatBalance(account.bid.amount)
                  : "--"}{" "}
                WETH at {account.bid.isSome ? formatBalance(account.bid.price) : "--"} WUSD
              </p>
              <p>
                <span className="font-semibold">Ask Amount:</span>{" "}
                {account.ask.isSome
                  ? formatBalance(account.ask.amount)
                  : "--"}{" "}
                WETH at {account.ask.isSome ? formatBalance(account.ask.price) : "--"} WUSD
              </p>
              <p>
                <span className="font-semibold">Nonce:</span>{" "}
                {account.nonce.toString()}
              </p>
            </div>
          ) : (
            <p>No account data found.</p>
          )}
        </div>

        {/* 2) Order form */}
        <div className="row-span-1 col-span-1 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg">
          <h2 className="font-bold text-jacarta-600 dark:text-white mb-2 text-center">
            Order Form
          </h2>
          <div className="mb-2 flex justify-center gap-1">
            <button
              className={`px-2 py-1 rounded ${
                orderType === "buy" ? "bg-accent text-white" : "bg-white dark:bg-jacarta-700"
              }`}
              onClick={() => setOrderType("buy")}
            >
              Buy
            </button>
            <button
              className={`px-2 py-1 rounded ${
                orderType === "sell" ? "bg-accent text-white" : "bg-white dark:bg-jacarta-700"
              }`}
              onClick={() => setOrderType("sell")}
            >
              Sell
            </button>
            <button
              className={`px-2 py-1 rounded ${
                orderType === "transfer" ? "bg-accent text-white" : "bg-white dark:bg-jacarta-700"
              }`}
              onClick={() => setOrderType("transfer")}
            >
              Transfer
            </button>
          </div>

          {orderType !== "transfer" ? (
            <div className="flex flex-col gap-1 mb-2">
              <label>Amount</label>
              <input
                className="rounded p-1 border dark:bg-jacarta-700"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
              <label>Price</label>
              <input
                className="rounded p-1 border dark:bg-jacarta-700"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter price"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1 mb-2">
              <label>Recipient Address</label>
              <input
                className="rounded p-1 border dark:bg-jacarta-700"
                value={transferRecipient}
                onChange={(e) => setTransferRecipient(e.target.value)}
                placeholder="B62..."
              />
              <label>Currency</label>
              <select
                className="rounded p-1 border dark:bg-jacarta-700"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "WETH" | "WUSD")}
              >
                <option value="WETH">WETH</option>
                <option value="WUSD">WUSD</option>
              </select>
              <label>Amount</label>
              <input
                className="rounded p-1 border dark:bg-jacarta-700"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
          )}

          <button
            className="bg-accent text-white rounded p-1 mt-auto"
            onClick={handleSubmitOrder}
          >
            Submit
          </button>
        </div>

        {/* 3) Orderbook */}
        <div className="row-span-2 col-span-1 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg">
          <h2 className="font-bold text-jacarta-600 dark:text-white mb-2 text-center">
            Orderbook
          </h2>
          <div className="flex flex-1 overflow-hidden">
            {/* Bids */}
            <div className="w-1/2 overflow-auto mr-1 border-r border-jacarta-100 dark:border-jacarta-600 pr-1">
              <h3 className="text-green text-center mb-1">Bids</h3>
              {mockBids.map((b, idx) => (
                <div
                  key={idx}
                  className="flex justify-between border-b border-jacarta-100 dark:border-jacarta-600 py-1"
                >
                  <span>{b.amount} WETH</span>
                  <span>@ {b.price} WUSD</span>
                </div>
              ))}
            </div>
            {/* Asks */}
            <div className="w-1/2 overflow-auto ml-1">
              <h3 className="text-red text-center mb-1">Asks</h3>
              {mockAsks.map((a, idx) => (
                <div
                  key={idx}
                  className="flex justify-between border-b border-jacarta-100 dark:border-jacarta-600 py-1"
                >
                  <span>{a.amount} WETH</span>
                  <span>@ {a.price} WUSD</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4) Last market trades */}
        <div className="row-span-1 col-span-1 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg overflow-auto">
          <h2 className="font-bold text-jacarta-600 dark:text-white text-center mb-2">
            Last Market Trades
          </h2>
          {mockLastTrades.map((t, idx) => (
            <div
              key={idx}
              className="flex justify-between border-b border-jacarta-100 dark:border-jacarta-600 py-1"
            >
              <span>{t.time}</span>
              <span>
                {t.amount} @ {t.price}
              </span>
            </div>
          ))}
        </div>

        {/* 5) Last orders sent */}
        <div className="row-span-1 col-span-1 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg overflow-auto">
          <h2 className="font-bold text-jacarta-600 dark:text-white text-center mb-2">
            Last Orders
          </h2>
          {mockLastOrders.map((o, idx) => (
            <div
              key={idx}
              className="flex justify-between border-b border-jacarta-100 dark:border-jacarta-600 py-1"
            >
              <span>{o.time}</span>
              <span>{o.op}</span>
              <span>
                {o.amount} {o.price !== "-" ? `@ ${o.price}` : ""}
              </span>
            </div>
          ))}
        </div>

        {/* 6) Last proofs */}
        <div className="row-span-1 col-span-1 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg overflow-auto">
          <h2 className="font-bold text-jacarta-600 dark:text-white text-center mb-2">
            Last Proofs Created
          </h2>
          {mockLastProofs.map((p, idx) => (
            <div
              key={idx}
              className="flex flex-col border-b border-jacarta-100 dark:border-jacarta-600 py-1"
            >
              <span>
                <strong>Time:</strong> {p.time}
              </span>
              <span>
                <strong># of Proofs:</strong> {p.proofCount}
              </span>
              <span>
                <strong>DA Hash:</strong> {p.daHash}
              </span>
            </div>
          ))}
        </div>

        {/* 7) Last L1 txs */}
        <div className="row-span-1 col-span-1 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg overflow-auto">
          <h2 className="font-bold text-jacarta-600 dark:text-white text-center mb-2">
            Last L1 TXs
          </h2>
          {mockLastL1.map((tx, idx) => (
            <div
              key={idx}
              className="flex flex-col border-b border-jacarta-100 dark:border-jacarta-600 py-1"
            >
              <span>
                <strong>Time:</strong> {tx.time}
              </span>
              <span>
                <strong>Tx Hash:</strong> {tx.txHash}
              </span>
              <span>
                <strong>DA Hash:</strong> {tx.daHash}
              </span>
              <span>
                <strong>User TXs:</strong> {tx.userTxs}
              </span>
            </div>
          ))}
        </div>

        {/* 8) Chart for WETH/WUSD */}
        <div className="row-span-1 col-span-3 flex flex-col border border-jacarta-100 dark:border-jacarta-600 p-2 rounded-lg">
          <h2 className="font-bold text-jacarta-600 dark:text-white text-center mb-1">
            WETH / WUSD Price Chart (Last 50 Points)
          </h2>
          <div className="flex-1">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { ticks: { display: false } },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}