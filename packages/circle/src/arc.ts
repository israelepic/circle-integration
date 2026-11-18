export type ArcChain = "ARC-TESTNET" | "ARC";

const ARC: Partial<Record<ArcChain, { usdc: string; explorer: string }>> = {
  "ARC-TESTNET": {
    usdc: "0x3600000000000000000000000000000000000000",
    explorer: "https://explorer.testnet.arc.io",
  },
};

export function arcConfig(chain: ArcChain) {
  const c = ARC[chain];
  if (!c) throw new RangeError(`${chain} is not configured`);
  return c;
}

export const txUrl = (chain: ArcChain, hash: string) => `${arcConfig(chain).explorer}/tx/${hash}`;
export const addressUrl = (chain: ArcChain, address: string) => `${arcConfig(chain).explorer}/address/${address}`;
