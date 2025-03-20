"use client"

import { useState, useEffect } from "react"
import { shortenString } from "@/lib/dex/ui/short"

interface NetworkInfoData {
  l1Settlement: string
  zkCoordination: string
  dataAvailability: string
  wallet: string
  lastBlockNumber: number
  lastProvedBlockNumber: number
  sequence: number
  circuitDaHash: string
}

export default function NetworkInfo() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfoData>({
    l1Settlement: "Mina Protocol",
    zkCoordination: "Sui",
    dataAvailability: "Walrus",
    wallet: "Auro",
    lastBlockNumber: 0,
    lastProvedBlockNumber: 0,
    sequence: 0,
    circuitDaHash: "",
  })

  useEffect(() => {
    // Simulate fetching network info
    const lastBlockNumber = 9876543
    const lastProvedBlockNumber = lastBlockNumber - Math.floor(Math.random() * 10) - 1 // A few blocks behind
    const sequence = 42789156 // A large number representing the current sequence
    const circuitDaHash = generateRandomHash() // Generate a random hash for circuit DA

    setNetworkInfo({
      l1Settlement: "Mina Protocol",
      zkCoordination: "Sui",
      dataAvailability: "Walrus",
      wallet: "Auro",
      lastBlockNumber,
      lastProvedBlockNumber,
      sequence,
      circuitDaHash,
    })
  }, [])

  return (
    <div className="h-full p-1 flex flex-col">
      <h3 className="text-xs font-semibold mb-0.5 text-white">Network Info</h3>
      <div className="text-[9px]">
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">L1 Settlement:</span>
          <span className="text-white">{networkInfo.l1Settlement}</span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">ZK Coordination:</span>
          <span className="text-white">{networkInfo.zkCoordination}</span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Data Availability:</span>
          <span className="text-white">{networkInfo.dataAvailability}</span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Wallet:</span>
          <span className="text-white">{networkInfo.wallet}</span>
        </div>

        {/* Added last block number */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Last Block:</span>
          <span className="text-[#02c076]">#{networkInfo.lastBlockNumber.toLocaleString()}</span>
        </div>

        {/* Added last proved block number */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Last Proved Block:</span>
          <span className="text-[#f0b90b]">#{networkInfo.lastProvedBlockNumber.toLocaleString()}</span>
        </div>

        {/* Added sequence */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Sequence:</span>
          <span className="text-[#1E80FF]">{networkInfo.sequence.toLocaleString()}</span>
        </div>

        {/* Added circuit DA hash */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Circuit DA Hash:</span>
          <span className="text-[#8358FF]">{shortenString(networkInfo.circuitDaHash, 4)}</span>
        </div>
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

