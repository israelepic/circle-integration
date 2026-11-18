export function minorToUsdc(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new RangeError("amount must be a whole, positive number of cents");
  return `${Math.floor(amountMinor / 100)}.${(amountMinor % 100).toString().padStart(2, "0")}`;
}

// Rounds down so a balance is never overstated.
export function usdcToMinor(amount: string): number {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new RangeError("invalid USDC amount");
  const [whole, frac = ""] = amount.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}
