"use client";

import { useState, useEffect } from "react";
import { shortenString } from "@/lib/dex/ui/short";
import { NetworkInfoData } from "@/lib/dex/ui/types";

interface NetworkInfoProps {
  networkInfo?: NetworkInfoData;
}

export default function NetworkInfo({ networkInfo }: NetworkInfoProps) {
  if (!networkInfo) {
    return (
      <div className="h-full p-1 flex items-center justify-center text-[9px] text-[#848e9c]">
        Getting Network Info...
      </div>
    );
  }
  return (
    <div className="h-full p-1 flex flex-col">
      <h3 className="text-xs font-semibold mb-0.5 text-white">Network Info</h3>
      <div className="text-[9px]">
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">L1 Settlement:</span>
          <span className="text-white">{networkInfo?.l1Settlement ?? "-"}</span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Mina Chain ID:</span>
          <span className="text-white">{networkInfo?.minaChainId ?? "-"}</span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Mina Contract:</span>
          <span className="text-white">
            {shortenString(networkInfo?.minaContractAddress ?? "", 10)}
          </span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Mina Circuit ID:</span>
          <span className="text-white">
            {shortenString(networkInfo?.minaCircuitId ?? "", 10)}
          </span>
        </div>

        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">ZK Coordination:</span>
          <span className="text-white">
            {networkInfo?.zkCoordination ?? "-"}
          </span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Sui Address:</span>
          <span className="text-white">
            {shortenString(networkInfo?.suiAddress ?? "", 10)}
          </span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Data Availability:</span>
          <span className="text-white">
            {networkInfo?.dataAvailability ?? "-"}
          </span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Wallet:</span>
          <span className="text-white">{networkInfo?.wallet ?? "-"}</span>
        </div>

        {/* Added last block number */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Last Block:</span>
          <span className="text-[#02c076]">
            #{networkInfo?.lastBlockNumber?.toLocaleString() ?? "-"}
          </span>
        </div>

        {/* Added last proved block number */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Last Proved Block:</span>
          <span className="text-[#f0b90b]">
            #{networkInfo?.lastProvedBlockNumber?.toLocaleString() ?? "-"}
          </span>
        </div>

        {/* Added sequence */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Sequence:</span>
          <span className="text-[#1E80FF]">
            {networkInfo?.sequence?.toLocaleString() ?? "-"}
          </span>
        </div>

        {/* Added circuit DA hash */}
        <div className="flex justify-between mb-0.5">
          <span className="text-[#848e9c]">Circuit DA Hash:</span>
          <span className="text-[#8358FF]">
            {shortenString(networkInfo?.circuitDaHash ?? "", 10)}
          </span>
        </div>
      </div>
    </div>
  );
}
