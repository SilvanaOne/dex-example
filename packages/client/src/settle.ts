import {
  PrivateKey,
  Field,
  VerificationKey,
  Mina,
  AccountUpdate,
  PublicKey,
  Cache,
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
let vk: VerificationKey | undefined = undefined;

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
  if (!vk) {
    const cache: Cache = Cache.FileSystem("./cache");
    await DEXProgram.compile({ cache });
    const { verificationKey } = await DEXContract.compile({ cache });
    vk = verificationKey;
  }
  if (vk.data !== verificationKey.data) {
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

  await fetchMinaAccount({ publicKey: admin, force: true });
  await fetchMinaAccount({ publicKey: pool, force: true });
  const dex = new DEXContract(pool);
  const txs_number = Number(
    proof.publicOutput.sequence.toBigInt() -
      proof.publicInput.sequence.toBigInt() +
      1n
  );

  const tx = await Mina.transaction(
    {
      sender: admin,
      fee: 100_000_000,
      memo: `Settle DEX Contract (${txs_number} txs)`.substring(0, 30),
    },
    async () => {
      await dex.settle(proof);
    }
  );
  await tx.prove();
  const sentTx = await sendTx({
    tx: tx.sign([adminPrivateKey]),
    description: "settle",
    wait: true,
    verbose: true,
  });
  if (sentTx?.status !== expectedTxStatus) {
    console.error("sentTx", sentTx);
    throw new Error(`Deploy DEX Contract failed: ${sentTx?.status}`);
  }
  const hash = sentTx?.hash;
  console.timeEnd("settle");
  return hash;
}
