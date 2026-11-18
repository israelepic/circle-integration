import "server-only";
import { CircleError, addressUrl, createArcWallet, getUsdcTransfer, sendUsdc, txUrl, usdcBalanceMinor, arcConfig } from "@lucel/circle";
import { circle, circleConfig, primeCircle } from "@/lib/circle/client";
import { asService, withUser } from "@/lib/db";

// Every Circle write uses an idempotency key stored before the call, so a retry never pays twice.

const MAX_ATTEMPTS = 8;
const backoffMs = (attempts: number) => Math.min(60_000 * 2 ** attempts, 6 * 3_600_000);
const short = (err: unknown) => (err instanceof CircleError ? err.message : "unexpected error").slice(0, 300);

interface WalletRow {
  creator_id: string;
  create_key: string;
  wallet_id: string | null;
  address: string | null;
  status: string;
}

export async function ensureUsdcWallet(creatorId: string) {
  const row = await asService(async (db) => {
    await db.query("insert into public.creator_usdc_wallets (creator_id, chain) values ($1, $2) on conflict (creator_id) do nothing", [creatorId, circleConfig().chain]);
    return (await db.query<WalletRow>("select creator_id, create_key, wallet_id, address, status from public.creator_usdc_wallets where creator_id = $1", [creatorId])).rows[0]!;
  });
  if (row.status === "active" && row.address) return row;

  const { walletSetId, chain } = circleConfig();
  try {
    const w = await createArcWallet(circle(), { walletSetId, chain, refId: creatorId, name: `creator-${creatorId}`, idempotencyKey: row.create_key });
    return await asService(
      async (db) =>
        (
          await db.query<WalletRow>(
            "update public.creator_usdc_wallets set wallet_id = $2, address = $3, status = 'active', last_error = null where creator_id = $1 returning creator_id, create_key, wallet_id, address, status",
            [creatorId, w.walletId, w.address],
          )
        ).rows[0]!,
    );
  } catch (err) {
    await asService((db) => db.query("update public.creator_usdc_wallets set last_error = $2 where creator_id = $1", [creatorId, short(err)]));
    throw err;
  }
}

export interface QueueUsdcPayout {
  creatorId: string;
  sourceType: "slot" | "gig_post" | "demo";
  sourceId: string;
  verifiedViews?: number;
  amountMinor: number;
}

// Called once views are verified. A repeated source is ignored.
export async function queueUsdcPayout(p: QueueUsdcPayout) {
  if (!Number.isSafeInteger(p.amountMinor) || p.amountMinor <= 0) throw new RangeError("amount must be whole, positive cents");
  return asService(
    async (db) =>
      (
        await db.query<{ id: string }>(
          `insert into public.usdc_payouts (creator_id, source_type, source_id, verified_views, amount_minor)
           values ($1, $2, $3, $4, $5) on conflict (source_type, source_id) do nothing returning id`,
          [p.creatorId, p.sourceType, p.sourceId, p.verifiedViews ?? null, p.amountMinor],
        )
      ).rows[0]?.id ?? null,
  );
}

interface DueRow {
  id: string;
  creator_id: string;
  amount_minor: string;
  status: "queued" | "sent";
  transfer_key: string;
  transaction_id: string | null;
  attempts: number;
}

export async function runUsdcPayoutJobs({ limit = 20 } = {}) {
  await primeCircle();
  const { payoutWalletId, payoutAddress, chain } = circleConfig();
  // Moving next_attempt_at forward leases the row to this run.
  const due = await asService(
    async (db) =>
      (
        await db.query<DueRow>(
          `update public.usdc_payouts u set next_attempt_at = now() + interval '5 minutes'
           where u.id in (select id from public.usdc_payouts where status in ('queued', 'sent') and next_attempt_at <= now()
                          order by next_attempt_at limit $1 for update skip locked)
           returning u.id, u.creator_id, u.amount_minor, u.status, u.transfer_key, u.transaction_id, u.attempts`,
          [limit],
        )
      ).rows,
  );

  let sent = 0;
  let paid = 0;
  let failed = 0;
  for (const r of due) {
    try {
      if (r.status === "queued") {
        const wallet = await ensureUsdcWallet(r.creator_id);
        const amount = Number(r.amount_minor);
        if ((await usdcBalanceMinor(circle(), payoutWalletId, arcConfig(chain).usdc)) < amount) throw new Error("payout wallet balance too low");
        const t = await sendUsdc(circle(), { fromAddress: payoutAddress, toAddress: wallet.address!, amountMinor: amount, chain, idempotencyKey: r.transfer_key, refId: r.id });
        await asService((db) =>
          db.query("update public.usdc_payouts set status = 'sent', transaction_id = $2, sent_at = now(), attempts = attempts + 1, last_error = null, next_attempt_at = now() + interval '15 seconds' where id = $1", [r.id, t.transactionId]),
        );
        sent++;
      } else if (r.transaction_id) {
        const t = await getUsdcTransfer(circle(), r.transaction_id);
        if (!t) continue;
        await asService((db) =>
          db.query(
            `update public.usdc_payouts set status = $2, provider_state = $3, tx_hash = coalesce($4, tx_hash),
               paid_at = case when $2 = 'paid' then now() else paid_at end,
               last_error = case when $2 = 'failed' then left($5, 300) else last_error end,
               next_attempt_at = now() + interval '15 seconds'
             where id = $1`,
            [r.id, t.status, t.providerState, t.txHash, t.errorReason],
          ),
        );
        if (t.status === "paid") paid++;
        if (t.status === "failed") failed++;
      }
    } catch (err) {
      const giveUp = r.status === "queued" && r.attempts + 1 >= MAX_ATTEMPTS;
      await asService((db) =>
        db.query("update public.usdc_payouts set attempts = attempts + 1, last_error = $2, status = case when $3 then 'failed' else status end, next_attempt_at = now() + ($4 || ' milliseconds')::interval where id = $1", [
          r.id,
          err instanceof Error ? err.message.slice(0, 300) : short(err),
          giveUp,
          String(backoffMs(r.attempts + 1)),
        ]),
      );
      if (giveUp) failed++;
    }
  }
  return { claimed: due.length, sent, paid, failed };
}

export async function getUsdcView(userId: string) {
  const { wallet, payouts } = await withUser(userId, async (db) => ({
    wallet: (await db.query<{ wallet_id: string | null; address: string | null; chain: string; status: string }>("select wallet_id, address, chain, status from public.creator_usdc_wallets")).rows[0] ?? null,
    payouts: (
      await db.query<{ id: string; amount_minor: string; status: string; tx_hash: string | null; created_at: string; paid_at: string | null }>(
        "select id, amount_minor, status, tx_hash, created_at, paid_at from public.usdc_payouts order by created_at desc limit 10",
      )
    ).rows,
  }));
  if (!wallet || wallet.status !== "active" || !wallet.wallet_id || !wallet.address) return { on: false as const };

  await primeCircle();
  const { chain } = circleConfig();
  const balanceMinor = await usdcBalanceMinor(circle(), wallet.wallet_id, arcConfig(chain).usdc).catch(() => null);
  return {
    on: true as const,
    balanceMinor,
    addressUrl: addressUrl(chain, wallet.address),
    payouts: payouts.map((p) => ({
      id: p.id,
      amountMinor: Number(p.amount_minor),
      status: p.status,
      at: p.paid_at ?? p.created_at,
      txUrl: p.tx_hash ? txUrl(chain, p.tx_hash) : null,
    })),
  };
}
