import { OperationNames, SequenceData } from "./types.js";
import { fetchSequenceData } from "./fetch.js";
import { deserializeIndexedMerkleMap } from "@silvana-one/storage";
import { DEXMap } from "./contracts/provable-types.js";
import { DEXProgram } from "./contracts/rollup.js";

export async function proveSequence(params: { sequenceData: SequenceData }) {
  const { sequenceData } = params;
  const {
    blockNumber,
    sequence,
    operation,
    map: serializedIndexedMap,
  } = sequenceData;
  console.log("proveSequence", {
    blockNumber,
    sequence,
    operation: OperationNames[operation.operation],
  });
  const map = deserializeIndexedMerkleMap({
    serializedIndexedMap,
    type: DEXMap,
  });
  console.log("map root", map?.root.toBigInt());
  console.log("map length", map?.length.toBigInt());
}
