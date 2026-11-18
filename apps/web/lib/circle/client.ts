import "server-only";
import { createCircleClient, type ArcChain, type CircleWallets } from "@lucel/circle";
import { serverEnv } from "@/lib/env.server";
import { getSecret } from "@/lib/vault";

export class CircleNotConfigured extends Error {
  constructor() {
    super("Circle is not configured");
    this.name = "CircleNotConfigured";
  }
}

const g = globalThis as unknown as { lucelCircle?: { key: string; client: CircleWallets }; lucelCircleKeys?: { apiKey?: string; entitySecret?: string } };

export async function primeCircle() {
  g.lucelCircleKeys = { apiKey: await getSecret("CIRCLE_API_KEY"), entitySecret: await getSecret("CIRCLE_ENTITY_SECRET") };
}

export function circle(): CircleWallets {
  const apiKey = g.lucelCircleKeys?.apiKey ?? serverEnv.CIRCLE_API_KEY;
  const entitySecret = g.lucelCircleKeys?.entitySecret ?? serverEnv.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new CircleNotConfigured();
  if (g.lucelCircle?.key !== apiKey) g.lucelCircle = { key: apiKey, client: createCircleClient({ apiKey, entitySecret }) };
  return g.lucelCircle.client;
}

export function circleConfig() {
  const { CIRCLE_WALLET_SET_ID: walletSetId, CIRCLE_PAYOUT_WALLET_ID: payoutWalletId, CIRCLE_PAYOUT_WALLET_ADDRESS: payoutAddress, CIRCLE_ARC_CHAIN: chain } = serverEnv;
  if (!walletSetId || !payoutWalletId || !payoutAddress) throw new CircleNotConfigured();
  return { walletSetId, payoutWalletId, payoutAddress, chain: (chain ?? "ARC-TESTNET") as ArcChain };
}
