"use client"

import { useState, useEffect } from "react"
import { shortenString } from "@/lib/dex/ui/short"

interface L1Transaction {
  id: number
  txHash: string
  dataAvailabilityHash: string
  blockNumber: number
  userTxCount: number
  time: string
}

export default function LastL1Txs() {
  const [transactions, setTransactions] = useState<L1Transaction[]>([])

  useEffect(() => {
    // Generate mock L1 transactions
    const mockTransactions: L1Transaction[] = []
    const blockNumber = 9876543 // Starting block number for L1 transactions

    for (let i = 0; i < 15; i++) {
      const txHash = generateRandomHash()
      const dataAvailabilityHash = generateRandomHash()
      const userTxCount = Math.floor(Math.random() * 50) + 1
      const secondsAgo = Math.floor(Math.random() * 600)

      mockTransactions.push({
        id: i,
        txHash,
        dataAvailabilityHash,
        blockNumber: blockNumber - i, // Decreasing block number for each older transaction
        userTxCount,
        time: `${secondsAgo}s ago`,
      })
    }

    // Sort by most recent
    mockTransactions.sort((a, b) => {
      const aSeconds = Number.parseInt(a.time.split("s")[0])
      const bSeconds = Number.parseInt(b.time.split("s")[0])
      return aSeconds - bSeconds
    })

    setTransactions(mockTransactions)
  }, [])

  return (
    <div className="h-full p-1 flex flex-col">
      <h3 className="text-xs font-semibold mb-0.5 text-[#02c076]">Last L1 Transactions</h3>

      <div className="grid grid-cols-5 text-[9px] text-[#848e9c] mb-0.5 font-medium">
        <div>Tx Hash</div>
        <div>Block</div>
        <div>DA Hash</div>
        <div className="text-right">Tx Count</div>
        <div className="text-right">Time</div>
      </div>

      <div className="overflow-hidden max-h-[calc(100%-18px)] flex-1">
        {transactions.map((tx) => (
          <div key={tx.id} className="grid grid-cols-5 text-[9px] hover:bg-[#2a2e37] transition-colors">
            <div className="truncate text-[#02c076]">{shortenString(tx.txHash, 4)}</div>
            <div>{tx.blockNumber}</div>
            <div className="truncate text-[#848e9c]">{shortenString(tx.dataAvailabilityHash, 4)}</div>
            <div className="text-right">{tx.userTxCount}</div>
            <div className="text-right text-[#848e9c]">{tx.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function generateRandomHash(): string {
  const chars = "0123456789abcdef"
  let hash = "0x"
  for (let i = 0; i < 16; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)]
  }
  return hash
}

