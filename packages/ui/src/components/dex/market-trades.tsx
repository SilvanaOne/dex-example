"use client"

import { useState, useEffect } from "react"

interface Trade {
  id: number
  price: number
  amount: number
  value: number
  time: string
  type: "buy" | "sell"
}

export default function MarketTrades() {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    // Generate mock trades
    const mockTrades: Trade[] = []
    const basePrice = 2011.89

    for (let i = 0; i < 20; i++) {
      const isBuy = Math.random() > 0.5
      const price = basePrice + (Math.random() * 2 - 1)
      const amount = Math.random() * 0.5 + 0.01
      const value = price * amount
      const secondsAgo = Math.floor(Math.random() * 60)

      mockTrades.push({
        id: i,
        price: Number.parseFloat(price.toFixed(2)),
        amount: Number.parseFloat(amount.toFixed(4)),
        value: Number.parseFloat(value.toFixed(2)),
        time: `${secondsAgo}s ago`,
        type: isBuy ? "buy" : "sell",
      })
    }

    // Sort by most recent
    mockTrades.sort((a, b) => {
      const aSeconds = Number.parseInt(a.time.split("s")[0])
      const bSeconds = Number.parseInt(b.time.split("s")[0])
      return aSeconds - bSeconds
    })

    setTrades(mockTrades)
  }, [])

  return (
    <div className="h-full p-1 flex flex-col">
      <h3 className="text-xs font-semibold mb-1 text-white">Market Trades</h3>

      <div className="grid grid-cols-3 text-[9px] text-[#848e9c] mb-0.5 font-medium">
        <div>Price</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Time</div>
      </div>

      <div className="overflow-hidden max-h-[calc(100%-20px)] flex-1">
        {trades.map((trade) => (
          <div key={trade.id} className="grid grid-cols-3 text-[9px] hover:bg-[#2a2e37] transition-colors">
            <div className={trade.type === "buy" ? "text-[#02c076]" : "text-[#f6465d]"}>{trade.price.toFixed(2)}</div>
            <div className="text-right">{trade.amount.toFixed(4)}</div>
            <div className="text-right text-[#848e9c]">{trade.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

