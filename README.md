# Circle integration

USDC payouts on Arc for Lucel, built on Circle Developer-Controlled Wallets.

A creator turns on USDC payouts and Lucel creates a wallet for them on Arc. When their views on a campaign are
verified, the payout is recorded and sent in USDC from Lucel's payout wallet. Each payout is followed to completion
and shown on the creator's Wallet with a link to the transaction.

## Structure

```
packages/circle/                        Circle client, Arc config, wallets, transfers
packages/db/migrations/                 creator_usdc_wallets, usdc_payouts
apps/web/lib/circle/client.ts           client and config for the web app
apps/web/lib/payouts/usdc.ts            wallet creation, payout queue, payout job, Wallet data
apps/web/lib/payouts/usdc-actions.ts    "Turn on" server action
apps/web/components/wallet/             Wallet card
apps/web/content/usdc.ts                copy
scripts/circle/                         one-time setup and a demo payout
```

## Circle products

| Product | Use | Code |
| --- | --- | --- |
| Developer-Controlled Wallets | Client setup | `packages/circle/src/client.ts` |
| Developer-Controlled Wallets | Entity secret, wallet set, payout wallet | `scripts/circle/setup.cjs` |
| Developer-Controlled Wallets | A wallet on Arc per creator | `packages/circle/src/wallets.ts`, `ensureUsdcWallet` |
| USDC | Creator payouts | `packages/circle/src/transfers.ts`, `runUsdcPayoutJobs` |
| Transactions API | Payout status and onchain hash | `getUsdcTransfer` |
| Balances API | Payout wallet check, creator balance | `usdcBalanceMinor` |
| Arc | Settlement chain, USDC as gas | `packages/circle/src/arc.ts` |

## Payout flow

1. `turnOnUsdc` creates the creator's wallet. The idempotency key is stored first, so a retry never creates a second one.
2. `queueUsdcPayout` records a payout when views are verified. One payout per verified source.
3. `runUsdcPayoutJobs` runs on the cron tick. It checks the payout wallet balance, sends USDC with the stored key, and
   follows the transaction until it completes. Failures back off and stop after 8 attempts.
4. `getUsdcView` returns the balance and recent payouts for the Wallet card.

Amounts are stored in cents.

## Environment

```
CIRCLE_API_KEY
CIRCLE_ENTITY_SECRET
CIRCLE_WALLET_SET_ID
CIRCLE_PAYOUT_WALLET_ID
CIRCLE_PAYOUT_WALLET_ADDRESS
CIRCLE_ARC_CHAIN=ARC-TESTNET
```

The API key and entity secret are read from the key vault first, then the environment.

## Setup on Arc Testnet

1. Create a test API key in the Circle Developer Console.
2. `node scripts/circle/setup.cjs secret packages/circle/node_modules` and set `CIRCLE_ENTITY_SECRET`.
3. `node scripts/circle/setup.cjs init packages/circle/node_modules` and set the printed values.
4. Fund the payout wallet at https://faucet.circle.com (Arc Testnet).
5. Apply the migration with `scripts/db/migrate.sh "$DATABASE_URL"`.
6. `node scripts/circle/demo-payout.cjs <creator id> 840 12000 apps/web/node_modules`, then run the cron tick.

## Tests

```
pnpm --filter @lucel/circle test
```
