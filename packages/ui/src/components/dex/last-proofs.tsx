"use client"

import { useState, useEffect } from "react"
import { shortenString } from "@/lib/dex/ui/short"

interface Proof {
  id: number
  txHash: string
  proofCount: number
  blockNumber: number
  storageHash: string
  time: string
}

export default function LastProofs() {
  const [proofs, setProofs] = useState<Proof[]>([])

  useEffect(() => {
    // Generate mock proofs
    const mockProofs: Proof[] = []
    const blockNumber = 1234567 // Starting block number

    for (let i = 0; i < 15; i++) {
      const proofCount = Math.floor(Math.random() * 10) + 1
      const txHash = generateRandomHash()
      const storageHash = generateRandomHash()
      const secondsAgo = Math.floor(Math.random() * 300)

      mockProofs.push({
        id: i,
        txHash,
        proofCount,
        blockNumber: blockNumber - i, // Decreasing block number for each older proof
        storageHash,
        time: `${secondsAgo}s ago`,
      })
    }

    // Sort by most recent
    mockProofs.sort((a, b) => {
      const aSeconds = Number.parseInt(a.time.split("s")[0])
      const bSeconds = Number.parseInt(b.time.split("s")[0])
      return aSeconds - bSeconds
    })

    setProofs(mockProofs)
  }, [])

  return (
    <div className="h-full p-1 flex flex-col">
      <h3 className="text-xs font-semibold mb-0.5 text-[#8358FF]">Last Proofs</h3>

      <div className="grid grid-cols-5 text-[9px] text-[#848e9c] mb-0.5 font-medium">
        <div>Tx Hash</div>
        <div>Block</div>
        <div>DA Hash</div>
        <div className="text-right">Tx Count</div>
        <div className="text-right">Time</div>
      </div>

      <div className="overflow-hidden max-h-[calc(100%-18px)] flex-1">
        {proofs.map((proof) => (
          <div key={proof.id} className="grid grid-cols-5 text-[9px] hover:bg-[#2a2e37] transition-colors">
            <div className="truncate text-[#8358FF]">{shortenString(proof.txHash, 4)}</div>
            <div>{proof.blockNumber}</div>
            <div className="truncate text-[#848e9c]">{shortenString(proof.storageHash, 4)}</div>
            <div className="text-right text-[#8358FF]">{proof.proofCount}</div>
            <div className="text-right text-[#848e9c]">{proof.time}</div>
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

