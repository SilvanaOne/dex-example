import {
  PrivateKey,
  Field,
  VerificationKey,
  Mina,
  AccountUpdate,
  PublicKey,
  Cache,
  verify,
} from "o1js";
import { DEXContract } from "./contracts/contract.js";
import { DEXProof, DEXProgram } from "./contracts/rollup.js";
import {
  fetchMinaAccount,
  initBlockchain,
  accountBalanceMina,
  Memory,
  sendTx,
  pinJSON,
} from "@silvana-one/mina-utils";
import { getProverSecretKey } from "./proof.js";
import { submitMinaTx } from "./proof.js";
const chain = process.env.MINA_CHAIN! as
  | "local"
  | "devnet"
  | "zeko"
  | "mainnet";
if (
  chain !== "local" &&
  chain !== "devnet" &&
  chain !== "zeko" &&
  chain !== "mainnet"
) {
  throw new Error(`Invalid chain: ${chain}`);
}

const expectedTxStatus = "pending";
let vkContract: VerificationKey | undefined = undefined;
let vkProgram: VerificationKey | undefined = undefined;
let nonce: number = 0;

export async function settleMinaContract(params: {
  poolPublicKey: string;
  adminPrivateKey: string;
  proof: DEXProof;
}): Promise<string> {
  const { proof } = params;
  console.time("settle");
  await getProverSecretKey();
  await initBlockchain(chain);

  const CONTRACT_VERIFICATION_KEY_HASH =
    process.env.CONTRACT_VERIFICATION_KEY_HASH;
  const CONTRACT_VERIFICATION_KEY_DATA =
    process.env.CONTRACT_VERIFICATION_KEY_DATA;

  if (!CONTRACT_VERIFICATION_KEY_HASH || !CONTRACT_VERIFICATION_KEY_DATA) {
    throw new Error(
      "CONTRACT_VERIFICATION_KEY_HASH or CONTRACT_VERIFICATION_KEY_DATA is not set"
    );
  }

  const verificationKey = new VerificationKey({
    hash: Field(BigInt(CONTRACT_VERIFICATION_KEY_HASH)),
    data: CONTRACT_VERIFICATION_KEY_DATA,
  });

  console.log("Compiling DEX Contract");
  console.time("compile");
  if (!vkContract) {
    const cache: Cache = Cache.FileSystem("./cache");
    const { verificationKey: vkp } = await DEXProgram.compile({ cache });
    vkProgram = vkp;
    const { verificationKey: vkc } = await DEXContract.compile({ cache });
    vkContract = vkc;
  }
  if (
    vkContract.data !== verificationKey.data ||
    vkContract.hash.toJSON() !== verificationKey.hash.toJSON()
  ) {
    throw new Error("Verification key mismatch");
  }
  console.timeEnd("compile");

  const adminPrivateKey = PrivateKey.fromBase58(params.adminPrivateKey);
  const admin = adminPrivateKey.toPublicKey();
  const poolPublicKey = PublicKey.fromBase58(params.poolPublicKey);
  const pool = poolPublicKey;

  console.log("DEX contract address:", pool.toBase58());

  console.log(
    "Admin",
    admin.toBase58(),
    "balance:",
    await accountBalanceMina(admin)
  );

  const dex = new DEXContract(pool);
  const startTx = Number(proof.publicInput.sequence.toBigInt());
  const endTx = Number(proof.publicOutput.sequence.toBigInt()) - 1;
  const txs_number = endTx - startTx + 1;
  const blockNumber = Number(proof.publicInput.blockNumber.toBigInt());
  console.log("blockNumber", blockNumber);
  const memo = `block ${blockNumber} (${txs_number} ${
    txs_number === 1 ? "tx" : "txs"
  }: ${startTx} - ${endTx})`.substring(0, 30);
  console.log("memo", memo);

  if (!vkProgram) {
    throw new Error("Verification key is not set");
  }

  const ok = await verify(proof, vkProgram);
  console.log("ok", ok);
  if (!ok) {
    throw new Error("Proof is not valid");
  }

  await fetchMinaAccount({ publicKey: admin, force: true });
  await fetchMinaAccount({ publicKey: pool, force: true });

  const adminNonce = Number(Mina.getAccount(admin).nonce.toBigint());
  nonce = Math.max(nonce + 1, adminNonce);

  const tx = await Mina.transaction(
    {
      sender: admin,
      fee: 100_000_000,
      memo,
      nonce,
    },
    async () => {
      await dex.settle(proof);
    }
  );
  await tx.prove();
  const sentTx = await sendTx({
    tx: tx.sign([adminPrivateKey]),
    description: "settle",
    wait: false,
    verbose: true,
  });
  if (sentTx?.status !== expectedTxStatus) {
    console.error("sentTx", sentTx);
    throw new Error(`Deploy DEX Contract failed: ${sentTx?.status}`);
  }
  const hash = sentTx?.hash;
  console.timeEnd("settle");
  await submitMinaTx({
    blockNumber,
    minaTx: hash,
  });
  return hash;
}
