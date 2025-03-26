"use client";

import { useState, useEffect } from "react";
import { shortenString } from "@/lib/short";
import type {
  LastTransactionData,
  LastTransactionErrors,
  TransactionProof,
  TransactionError,
} from "@dex-example/lib";
import { suiExplorerTxUrl } from "@/lib/chain";
interface LastTransactionProps {
  txData: LastTransactionData | LastTransactionErrors | null;
}

export default function LastTransaction({ txData }: LastTransactionProps) {
  if (txData === null) {
    return (
      <div className="h-full p-1 flex items-center justify-center text-[9px] text-[#848e9c]">
        No last transaction data
      </div>
    );
  }
  const isLastTransactionData = (txData as any).digest !== undefined;
  const data = txData as LastTransactionData;

  return (
    <div className="h-full p-1 overflow-hidden flex flex-col">
      <h3 className="text-xs font-semibold mb-0.5 text-[#f0b90b]">
        Your Last Transaction
      </h3>

      {isLastTransactionData && (
        <>
          <div className="grid grid-cols-2 gap-x-1 text-[9px] mb-1">
            <div className="text-[#848e9c]">ZK coordination tx hash:</div>
            <div className="truncate text-[#f0b90b]">
              <a
                href={suiExplorerTxUrl(data.digest?.toString() ?? "")}
                className="text-accent hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {shortenString(data.digest.toString(), 10)}
              </a>
            </div>

            <div className="text-[#848e9c]">Tx prepared in:</div>
            <div className="text-white">{data.prepareTime} ms</div>

            <div className="text-[#848e9c]">Tx executed in:</div>
            <div className="text-white">{data.executeTime} ms</div>

            {data.indexTime && (
              <>
                <div className="text-[#848e9c]">Tx indexed in:</div>
                <div className="text-white">{data.indexTime} ms</div>
              </>
            )}

            <div className="text-[#848e9c]">ZK block number:</div>
            <div className="text-white">{data.blockNumber}</div>

            <div className="text-[#848e9c]">ZK sequence number:</div>
            <div className="text-white">{data.sequence}</div>

            {data.minaTxHash && (
              <>
                <div className="text-[#848e9c]">Mina tx hash:</div>
                <div className="truncate text-[#f0b90b]">
                  {shortenString(data.minaTxHash, 10)}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Transaction Errors Section */}
      {txData.errors && (
        <div className="mb-1">
          <div className="text-[9px] font-semibold mb-0.5 text-[#f6465d]">
            Transaction Errors
          </div>
          <div className="max-h-[40px] overflow-auto">
            {txData.errors.map((error, index) => (
              <div key={index} className="text-[9px] mb-0.5 flex items-start">
                <span
                  className={`mr-1 ${
                    error.severity === "error"
                      ? "text-[#f6465d]"
                      : "text-[#f7931a]"
                  }`}
                >
                  [{error.code}]
                </span>
                <span className="text-white">{error.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLastTransactionData && data.proofs && (
        <>
          <div className="text-[9px] font-semibold mb-0.5 text-white">
            Transaction Proofs
          </div>

          <div className="grid grid-cols-3 text-[9px] text-[#848e9c] mb-0.5 font-medium">
            <div>Proofs</div>
            <div>Storage Hash</div>
            <div className="text-right">Time</div>
          </div>

          <div className="overflow-hidden max-h-[calc(100%-130px)] flex-1">
            {data.proofs.map((proof) => (
              <div
                key={proof.id}
                className="grid grid-cols-3 text-[9px] hover:bg-[#2a2e37] transition-colors"
              >
                <div className="text-[#f0b90b]">{proof.proofCount}</div>
                <div className="truncate text-[#848e9c]">
                  {shortenString(proof.storageHash, 4)}
                </div>
                <div className="text-right text-[#848e9c]">{proof.time}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
