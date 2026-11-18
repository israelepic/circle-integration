import "server-only";
import { toCircleError, type CircleWallets } from "./client";
import { arcConfig, type ArcChain } from "./arc";
import { minorToUsdc } from "./money";
import { transferStatus } from "./status";

export async function sendUsdc(
  client: CircleWallets,
  input: { fromAddress: string; toAddress: string; amountMinor: number; chain: ArcChain; idempotencyKey: string; refId: string },
) {
  try {
    const res = await client.createTransaction({
      walletAddress: input.fromAddress,
      tokenAddress: arcConfig(input.chain).usdc,
      blockchain: input.chain,
      destinationAddress: input.toAddress,
      amount: [minorToUsdc(input.amountMinor)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      idempotencyKey: input.idempotencyKey,
      refId: input.refId,
    });
    if (!res.data?.id) throw new Error("no transaction id");
    return { transactionId: res.data.id, status: transferStatus(res.data.state) };
  } catch (err) {
    throw toCircleError(err, "send usdc");
  }
}

export async function getUsdcTransfer(client: CircleWallets, transactionId: string) {
  try {
    const t = (await client.getTransaction({ id: transactionId })).data?.transaction;
    if (!t) return null;
    return { status: transferStatus(t.state), providerState: t.state, txHash: t.txHash ?? null, errorReason: t.errorReason ?? null };
  } catch (err) {
    throw toCircleError(err, "get transaction");
  }
}
