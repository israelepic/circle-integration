import "server-only";
import { toCircleError, type CircleWallets } from "./client";
import { usdcToMinor } from "./money";
import type { ArcChain } from "./arc";

export async function createArcWallet(
  client: CircleWallets,
  input: { walletSetId: string; chain: ArcChain; refId: string; name: string; idempotencyKey: string },
) {
  try {
    const res = await client.createWallets({
      walletSetId: input.walletSetId,
      blockchains: [input.chain],
      count: 1,
      accountType: "EOA",
      metadata: [{ name: input.name, refId: input.refId }],
      idempotencyKey: input.idempotencyKey,
    });
    const w = res.data?.wallets?.[0];
    if (!w) throw new Error("no wallet returned");
    return { walletId: w.id, address: w.address };
  } catch (err) {
    throw toCircleError(err, "create wallet");
  }
}

export async function usdcBalanceMinor(client: CircleWallets, walletId: string, usdcAddress: string): Promise<number> {
  try {
    const res = await client.getWalletTokenBalance({ id: walletId });
    const b = res.data?.tokenBalances?.find((t) => t.token?.tokenAddress?.toLowerCase() === usdcAddress.toLowerCase() || t.token?.symbol === "USDC");
    return b ? usdcToMinor(b.amount) : 0;
  } catch (err) {
    throw toCircleError(err, "get balance");
  }
}
