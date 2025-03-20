"use client"

import { useState, useEffect } from "react"

interface Order {
  id: number
  operation: "Bid" | "Ask" | "Transfer"
  amount: number
  price?: number
  time: string
  userAddress: string // Add user address field
}

export default function LastOrders() {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    // Generate mock orders
    const mockOrders: Order[] = []
    const basePrice = 2011.89

    for (let i = 0; i < 20; i++) {
      const operationTypes: ("Bid" | "Ask" | "Transfer")[] = ["Bid", "Ask", "Transfer"]
      const operation = operationTypes[Math.floor(Math.random() * 3)]
      const amount = Math.random() * 0.5 + 0.01
      const price = operation !== "Transfer" ? basePrice + (Math.random() * 2 - 1) : undefined
      const secondsAgo = Math.floor(Math.random() * 120)
      // Generate a mock Mina address in the format B62...
      const userAddress = `B62${Array.from(
        { length: 6 },
        () => "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)],
      ).join("")}...${Array.from(
        { length: 4 },
        () => "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)],
      ).join("")}`

      mockOrders.push({
        id: i,
        operation,
        amount: Number.parseFloat(amount.toFixed(4)),
        price: price ? Number.parseFloat(price.toFixed(2)) : undefined,
        time: `${secondsAgo}s ago`,
        userAddress,
      })
    }

    // Sort by most recent
    mockOrders.sort((a, b) => {
      const aSeconds = Number.parseInt(a.time.split("s")[0])
      const bSeconds = Number.parseInt(b.time.split("s")[0])
      return aSeconds - bSeconds
    })

    setOrders(mockOrders)
  }, [])

  return (
    <div className="h-full p-1 flex flex-col">
      <h3 className="text-xs font-semibold mb-0.5 text-[#f6465d]">Last Orders</h3>

      <div className="grid grid-cols-5 text-[9px] text-[#848e9c] mb-0.5 font-medium">
        <div>Operation</div>
        <div>User</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Price</div>
        <div className="text-right">Time</div>
      </div>

      <div className="overflow-hidden max-h-[calc(100%-18px)] flex-1">
        {orders.map((order) => (
          <div key={order.id} className="grid grid-cols-5 text-[9px] hover:bg-[#2a2e37] transition-colors">
            <div
              className={
                order.operation === "Bid"
                  ? "text-[#02c076]"
                  : order.operation === "Ask"
                    ? "text-[#f6465d]"
                    : "text-[#1E80FF]"
              }
            >
              {order.operation}
            </div>
            <div className="text-[#848e9c] truncate">{order.userAddress}</div>
            <div className="text-right">{order.amount.toFixed(4)}</div>
            <div className="text-right">{order.price?.toFixed(2) || "-"}</div>
            <div className="text-right text-[#848e9c]">{order.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

