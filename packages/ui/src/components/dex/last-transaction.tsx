"use client"

import { useState, useEffect } from "react"
import { shortenString } from "@/lib/dex/ui/short"

interface TransactionProof {
  id: number
  proofCount: number
  storageHash: string
  time: string
}

interface TransactionError {
  code: string
  message: string
  severity: "warning" | "error"
}

interface LastTransactionData {
  prepareTime: number
  executeTime: number
  indexTime: number
  zkBlockNumber: number
  zkCoordinationHash: string
  txHash: string
  proofs: TransactionProof[]
  errors: TransactionError[]
  hasErrors: boolean
}

export default function LastTransaction() {
  const [txData, setTxData] = useState<LastTransactionData | null>(null)

  useEffect(() => {
    // Generate mock transaction data
    const mockProofs: TransactionProof[] = []

    for (let i = 0; i < 3; i++) {
      const proofCount = Math.floor(Math.random() * 5) + 1
      const storageHash = generateRandomHash()
      const secondsAgo = Math.floor(Math.random() * 60)

      mockProofs.push({
        id: i,
        proofCount,
        storageHash,
        time: `${secondsAgo}s ago`,
      })
    }

    // Generate mock errors (randomly decide if there are errors)
    const hasErrors = Math.random() > 0.5
    const mockErrors: TransactionError[] = []

    if (hasErrors) {
      mockErrors.push({
        code: "E1001",
        message: "Insufficient balance for gas fees",
        severity: "error",
      })

      if (Math.random() > 0.5) {
        mockErrors.push({
          code: "W2003",
          message: "High network congestion, increased latency",
          severity: "warning",
        })
      }
    }

    const mockTxData: LastTransactionData = {
      prepareTime: 1042,
      executeTime: 682,
      indexTime: 2299,
      zkBlockNumber: 1234567,
      zkCoordinationHash: generateRandomHash(),
      txHash: generateRandomHash(),
      proofs: mockProofs,
      errors: mockErrors,
      hasErrors,
    }

    setTxData(mockTxData)
  }, [])

  if (!txData) {
    return (
      <div className="h-full p-1 flex items-center justify-center text-[9px] text-[#848e9c]">
        Loading transaction data...
      </div>
    )
  }

  return (
    <div className="h-full p-1 overflow-hidden flex flex-col">
      <h3 className="text-xs font-semibold mb-0.5 text-[#f0b90b]">Your Last Transaction</h3>

      <div className="grid grid-cols-2 gap-x-1 text-[9px] mb-1">
        <div className="text-[#848e9c]">Tx prepared in:</div>
        <div className="text-white">{txData.prepareTime} ms</div>

        <div className="text-[#848e9c]">Tx executed in:</div>
        <div className="text-white">{txData.executeTime} ms</div>

        <div className="text-[#848e9c]">Tx indexed in:</div>
        <div className="text-white">{txData.indexTime} ms</div>

        <div className="text-[#848e9c]">ZK block number:</div>
        <div className="text-white">{txData.zkBlockNumber}</div>

        <div className="text-[#848e9c]">ZK coordination hash:</div>
        <div className="truncate text-[#f0b90b]">{shortenString(txData.zkCoordinationHash, 4)}</div>

        <div className="text-[#848e9c]">Mina tx hash:</div>
        <div className="truncate text-[#f0b90b]">{shortenString(txData.txHash, 4)}</div>
      </div>

      {/* Transaction Errors Section */}
      {txData.hasErrors && (
        <div className="mb-1">
          <div className="text-[9px] font-semibold mb-0.5 text-[#f6465d]">Transaction Errors</div>
          <div className="max-h-[40px] overflow-auto">
            {txData.errors.map((error, index) => (
              <div key={index} className="text-[9px] mb-0.5 flex items-start">
                <span className={`mr-1 ${error.severity === "error" ? "text-[#f6465d]" : "text-[#f7931a]"}`}>
                  [{error.code}]
                </span>
                <span className="text-white">{error.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[9px] font-semibold mb-0.5 text-white">Transaction Proofs</div>

      <div className="grid grid-cols-3 text-[9px] text-[#848e9c] mb-0.5 font-medium">
        <div>Proofs</div>
        <div>Storage Hash</div>
        <div className="text-right">Time</div>
      </div>

      <div className="overflow-hidden max-h-[calc(100%-130px)] flex-1">
        {txData.proofs.map((proof) => (
          <div key={proof.id} className="grid grid-cols-3 text-[9px] hover:bg-[#2a2e37] transition-colors">
            <div className="text-[#f0b90b]">{proof.proofCount}</div>
            <div className="truncate text-[#848e9c]">{shortenString(proof.storageHash, 4)}</div>
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

