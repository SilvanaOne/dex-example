import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Transaction } from "@mysten/sui/transactions";
import { SignatureWithBytes } from "@mysten/sui/cryptography";
import { suiClient } from "./sui-client.js";

export async function buildPublishTx(params: {
  modules: string[];
  dependencies: string[];
  address: string;
  keypair: Secp256k1Keypair;
}): Promise<SignatureWithBytes> {
  const { modules, dependencies, address, keypair } = params;
  const tx = new Transaction();
  const publishedTx = tx.publish({
    modules,
    dependencies,
  });
  tx.transferObjects(
    [
      {
        Result: publishedTx.Result,
      },
    ],
    address
  );
  const paginatedCoins = await suiClient.getCoins({
    owner: address,
  });
  const coins = paginatedCoins.data.map((coin) => {
    return {
      objectId: coin.coinObjectId,
      version: coin.version,
      digest: coin.digest,
    };
  });
  //console.log("coins", coins);

  tx.setSender(address);
  tx.setGasOwner(address);
  tx.setGasPayment(coins);
  //console.log("tx", await tx.toJSON());
  tx.setGasBudget(100_000_000);

  console.log("tx", await tx.toJSON());
  console.time("sign");
  const signedTx = await tx.sign({
    signer: keypair,
    client: suiClient,
  });
  console.timeEnd("sign");
  return signedTx;
}
