export function formatBalance(
  num: number | bigint | undefined,
  digits: number = 4
): string {
  if (num === undefined) return "-";
  const fixed = (Number(BigInt(num) / 1_000n) / 1_000_000).toLocaleString(
    undefined,
    {
      maximumSignificantDigits: digits,
    }
  );
  return fixed;
}

export function formatPrice(
  num: number | bigint | string | undefined,
  digits: number = 4
): string {
  if (num === undefined) return "-";
  const fixed = Number(num).toLocaleString(undefined, {
    maximumSignificantDigits: digits,
  });
  return fixed;
}
