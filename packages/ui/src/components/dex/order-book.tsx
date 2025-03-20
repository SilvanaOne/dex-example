"use client"

import { useState, useEffect } from "react"

interface OrderBookEntry {
  price: number
  amount: number
  total: number
}

export default function OrderBook() {
  const [asks, setAsks] = useState<OrderBookEntry[]>([])
  const [bids, setBids] = useState<OrderBookEntry[]>([])
  const [spread, setSpread] = useState<{ amount: number; percentage: number }>({ amount: 0, percentage: 0 })
  const [depthView, setDepthView] = useState<"0.01" | "0.1" | "1.0">("0.01")

  useEffect(() => {
    // Generate mock order book data
    const mockAsks: OrderBookEntry[] = []
    const mockBids: OrderBookEntry[] = []

    const basePrice = 2011.89
    let askTotal = 0
    let bidTotal = 0

    // Generate asks (sell orders)
    for (let i = 0; i < 15; i++) {
      const price = basePrice + i * Number.parseFloat(depthView) + Math.random() * 0.02
      const amount = Math.random() * 10 + 0.5
      askTotal += amount
      mockAsks.push({
        price: Number.parseFloat(price.toFixed(2)),
        amount: Number.parseFloat(amount.toFixed(4)),
        total: Number.parseFloat(askTotal.toFixed(4)),
      })
    }

    // Generate bids (buy orders)
    for (let i = 0; i < 15; i++) {
      const price = basePrice - i * Number.parseFloat(depthView) - Math.random() * 0.02
      const amount = Math.random() * 10 + 0.5
      bidTotal += amount
      mockBids.push({
        price: Number.parseFloat(price.toFixed(2)),
        amount: Number.parseFloat(amount.toFixed(4)),
        total: Number.parseFloat(bidTotal.toFixed(4)),
      })
    }

    // Sort asks ascending, bids descending
    mockAsks.sort((a, b) => a.price - b.price)
    mockBids.sort((a, b) => b.price - a.price)

    // Calculate spread
    const spreadAmount = mockAsks[0].price - mockBids[0].price
    const spreadPercentage = (spreadAmount / mockBids[0].price) * 100

    setAsks(mockAsks)
    setBids(mockBids)
    setSpread({
      amount: Number.parseFloat(spreadAmount.toFixed(2)),
      percentage: Number.parseFloat(spreadPercentage.toFixed(2)),
    })
  }, [depthView])

  return (
    <div className="h-full p-1 flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-xs font-semibold text-white">Order Book</h3>
        <div className="flex space-x-1 text-[10px]">
          <button
            className={`px-1 py-0.5 rounded ${
              depthView === "0.01" ? "bg-accent text-white" : "bg-[#2a2e37] text-[#848e9c] hover:bg-[#3a3e47]"
            } transition-colors`}
            onClick={() => setDepthView("0.01")}
          >
            0.01
          </button>
          <button
            className={`px-1 py-0.5 rounded ${
              depthView === "0.1" ? "bg-accent text-white" : "bg-[#2a2e37] text-[#848e9c] hover:bg-[#3a3e47]"
            } transition-colors`}
            onClick={() => setDepthView("0.1")}
          >
            0.1
          </button>
          <button
            className={`px-1 py-0.5 rounded ${
              depthView === "1.0" ? "bg-accent text-white" : "bg-[#2a2e37] text-[#848e9c] hover:bg-[#3a3e47]"
            } transition-colors`}
            onClick={() => setDepthView("1.0")}
          >
            1.0
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 text-[9px] text-[#848e9c] mb-0.5 font-medium">
        <div>Price</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (Sell Orders) */}
      <div className="overflow-hidden mb-1 max-h-[calc(50%-20px)]">
        {asks.map((ask, index) => (
          <div
            key={`ask-${index}`}
            className="grid grid-cols-3 text-[9px] hover:bg-[#2a2e37] transition-colors relative"
          >
            <div className="text-[#f6465d] z-10">{ask.price.toFixed(2)}</div>
            <div className="text-right z-10">{ask.amount.toFixed(4)}</div>
            <div className="text-right z-10">{ask.total.toFixed(4)}</div>
            <div
              className="absolute right-0 top-0 h-full bg-[#2c2431] opacity-20"
              style={{ width: `${(ask.total / asks[asks.length - 1].total) * 100}%` }}
            ></div>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="text-center text-[9px] py-0.5 border-y border-[#2a2e37] text-[#848e9c] font-medium">
        Spread: <span className="text-white">{spread.amount}</span> (
        <span className="text-white">{spread.percentage.toFixed(2)}%</span>)
      </div>

      {/* Bids (Buy Orders) */}
      <div className="overflow-hidden mt-1 max-h-[calc(50%-20px)]">
        {bids.map((bid, index) => (
          <div
            key={`bid-${index}`}
            className="grid grid-cols-3 text-[9px] hover:bg-[#2a2e37] transition-colors relative"
          >
            <div className="text-[#02c076] z-10">{bid.price.toFixed(2)}</div>
            <div className="text-right z-10">{bid.amount.toFixed(4)}</div>
            <div className="text-right z-10">{bid.total.toFixed(4)}</div>
            <div
              className="absolute right-0 top-0 h-full bg-[#1c3131] opacity-20"
              style={{ width: `${(bid.total / bids[bids.length - 1].total) * 100}%` }}
            ></div>
          </div>
        ))}
      </div>
    </div>
  )
}

