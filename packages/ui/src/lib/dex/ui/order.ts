export type TransactionType = "buy" | "sell" | "transfer" | "stake" | "borrow";

export async function prepareOrderPayload({
  user,
  amount,
  price,
  recipient,
  duration,
  collateralAmount,
  type,
}: {
  user: string;
  amount: number;
  price?: number;
  recipient?: string;
  duration?: number;
  collateralAmount?: number;
  type: TransactionType;
}) {
  // Mock implementation
  const amountBigint = BigInt(Math.floor(amount * 1_000_000_000));
  const priceBigint = price ? BigInt(Math.floor(price * 1_000_000_000)) : 0n;
  const durationBigint = duration ? BigInt(duration) : 0n;
  const collateralBigint = collateralAmount
    ? BigInt(Math.floor(collateralAmount * 1_000_000_000))
    : 0n;
  const nonce = 1n;

  // Mock payload
  const payload = [
    amountBigint.toString(),
    priceBigint.toString(),
    durationBigint.toString(),
    collateralBigint.toString(),
    nonce.toString(),
  ];

  return {
    payload,
    amount: amountBigint,
    price: priceBigint,
    duration: durationBigint,
    collateral: collateralBigint,
    nonce,
    recipient: recipient || user,
  };
}

export async function order({
  user,
  amount,
  price,
  recipient,
  duration,
  collateral,
  nonce,
  signature,
  payload,
  type,
  key,
}: {
  user: string;
  amount: bigint;
  price: bigint;
  recipient: string;
  duration?: bigint;
  collateral?: bigint;
  nonce: bigint;
  signature: string;
  payload: string[];
  type: TransactionType;
  key?: string;
}) {
  // Mock implementation
  return {
    digest: `0x${Math.random().toString(16).substring(2, 34)}`,
    prepareDelay: Math.floor(Math.random() * 100),
    executeDelay: Math.floor(Math.random() * 200),
  };
}
