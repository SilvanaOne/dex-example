"use client"

import { useState, useEffect } from "react"
import { shortenString } from "@/lib/short"
import type { UserTradingAccount } from "@/lib/dex/ui/types"
import type { TransactionType } from "@/lib/dex/ui/order"
import OrderBook from "@/components/dex/order-book"
import OrderForm from "@/components/dex/order-form"
import UserAccount from "@/components/dex/user-account"
import OpenOrders from "@/components/dex/open-orders"
import MarketTrades from "@/components/dex/market-trades"
import LastOrders from "@/components/dex/last-orders"
import LastProofs from "@/components/dex/last-proofs"
import LastL1Txs from "@/components/dex/last-l1-txs"
import LastTransaction from "@/components/dex/last-transaction"
import NetworkInfo from "@/components/dex/network-info"
import Image from "next/image"
import dynamic from "next/dynamic"

// Use dynamic import with SSR disabled for the chart component
const TradingChart = dynamic(() => import("@/components/dex/trading-chart"), {
  ssr: false,
})

export default function DEX() {
  const [account, setAccount] = useState<UserTradingAccount | undefined>(undefined)
  const [address, setAddress] = useState<string | undefined>(undefined)
  const [orderType, setOrderType] = useState<TransactionType>("buy")
  const [highlight, setHighlight] = useState<boolean>(false)
  const [priceDirection, setPriceDirection] = useState<"up" | "down">("up") // Track price direction

  // Mock data for demonstration
  useEffect(() => {
    // Generate random transaction IDs
    const generateTxId = () => {
      return "0x" + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
    }

    // Simulate fetching account data
    const mockAccount: UserTradingAccount = {
      ask: {
        amount: 0n,
        isSome: false,
        price: 0n,
      },
      baseTokenBalance: {
        amount: 50000000000n,
        borrowedAmount: 0n,
        stakedAmount: 0n,
        pendingDeposits: 2500000000n,
        pendingWithdrawals: 1000000000n,
      },
      bid: {
        amount: 2000000000n,
        isSome: true,
        price: 2100000000000n,
      },
      nonce: 4n,
      quoteTokenBalance: {
        amount: 100000000000000n,
        borrowedAmount: 0n,
        stakedAmount: 0n,
        pendingDeposits: 5000000000000n,
        pendingWithdrawals: 2000000000000n,
      },
      pendingDeposits: [
        {
          id: generateTxId(),
          amount: 2500000000n,
          currency: "WETH",
          timestamp: Date.now() - 300000, // 5 minutes ago
          confirmations: 4,
          estimatedTimeRemaining: 480, // 8 minutes
        },
        {
          id: generateTxId(),
          amount: 5000000000000n,
          currency: "WUSD",
          timestamp: Date.now() - 600000, // 10 minutes ago
          confirmations: 8,
          estimatedTimeRemaining: 240, // 4 minutes
        },
      ],
      pendingWithdrawals: [
        {
          id: generateTxId(),
          amount: 1000000000n,
          currency: "WETH",
          timestamp: Date.now() - 900000, // 15 minutes ago
          confirmations: 10,
          estimatedTimeRemaining: 120, // 2 minutes
        },
        {
          id: generateTxId(),
          amount: 2000000000000n,
          currency: "WUSD",
          timestamp: Date.now() - 1200000, // 20 minutes ago
          confirmations: 11,
          estimatedTimeRemaining: 60, // 1 minute
        },
      ],
    }

    setAccount(mockAccount)
    setAddress("B62qqevZM3XZJJJKThPx9ZRNARQQEFcx1sJxaPDjzC5rWrVnMnSK8Y2")

    // Randomly set price direction for demonstration
    setPriceDirection(Math.random() > 0.5 ? "up" : "down")
  }, [])

  return (
    <div className="flex flex-col  h-screen bg-[#0b0e11] text-white overflow-hidden">
      {/* Professional Header with price and absolute change */}
      <header className="flex items-center justify-between px-3 py-1 bg-[#161a1e] border-b border-[#2a2e37]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <Image src="/img/silvana.png" alt="Silvana DEX" width={32} height={32} className="mr-2" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
              Silvana DEX
            </h1>
          </div>
          <div className="flex items-center">
            <div className="text-white text-sm font-medium mr-2">WETH/WUSD</div>
            <div className="flex items-center">
              <div className="text-white text-sm font-medium mr-1">2011.89</div>
              {priceDirection === "up" ? (
                <div className="text-[#02c076] text-xs flex items-center">
                  <span className="mr-0.5">▲</span>
                  <span>2088.45</span>
                </div>
              ) : (
                <div className="text-[#f6465d] text-xs flex items-center">
                  <span className="mr-0.5">▼</span>
                  <span>2088.45</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center">
          {address ? (
            <div className="flex items-center bg-[#2a2e37] rounded-lg px-2 py-0.5 text-xs">
              <span className="text-[#848e9c] mr-1">Connected:</span>
              <span className="text-white">{shortenString(address, 8)}</span>
            </div>
          ) : (
            <button className="bg-accent hover:bg-accent-dark rounded-lg px-3 py-0.5 text-xs transition-colors">
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
              <OrderForm orderType={orderType} setOrderType={setOrderType} address={address} />
            </div>

            {/* User Account Section - Now with Open Orders above Wallet Balance */}
            <div className="w-1/2 flex flex-col bg-[#161a1e] p-1 space-y-1">
              {/* Open Orders - Takes 1/3 of the height */}
              <div className="h-1/3">
                <OpenOrders account={account} />
              </div>

              {/* Wallet Balance - Takes 2/3 of the height */}
              <div className="h-2/3">
                <UserAccount account={account} highlight={highlight} />
              </div>
            </div>
          </div>

          {/* Bottom Panels - Now 3/5 height to fill remaining space */}
          <div className="h-3/5 flex flex-col gap-0.5 p-0.5 overflow-hidden bg-[#0b0e11]">
            {/* Row 1: Your Last Transaction and Last Proofs side by side */}
            <div className="flex gap-0.5 h-1/2">
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <LastTransaction />
              </div>
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <LastProofs />
              </div>
            </div>

            {/* Row 2: Network Info and Last L1 Txs with equal widths */}
            <div className="flex gap-0.5 h-1/2">
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <NetworkInfo />
              </div>
              <div className="bg-[#161a1e] rounded overflow-hidden w-1/2">
                <LastL1Txs />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

