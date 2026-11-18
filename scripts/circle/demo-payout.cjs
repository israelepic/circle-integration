// Usage: node scripts/circle/demo-payout.cjs <creator id> <cents> [verified views] [node_modules dir]
const crypto = require("node:crypto");

const [creatorId, cents, views, mods] = process.argv.slice(2);
const need = (m) => require(mods ? require.resolve(m, { paths: [mods] }) : m);
const { Client } = need("pg");

if (process.env.APP_ENV === "production") throw new Error("demo payouts never run in production");
if (!/^[0-9a-f-]{36}$/i.test(creatorId || "") || !/^\d+$/.test(cents || "") || Number(cents) <= 0) {
  throw new Error("usage: demo-payout.cjs <creator uuid> <amount in cents> [verified views] [node_modules dir]");
}

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("select set_config('app.service', 'on', true)");
    const { rows } = await db.query(
      "insert into public.usdc_payouts (creator_id, source_type, source_id, verified_views, amount_minor) values ($1, 'demo', $2, $3, $4) returning id",
      [creatorId, crypto.randomUUID(), views ? Number(views) : null, Number(cents)],
    );
    await db.query("commit");
    console.log(`Queued USDC payout ${rows[0].id}`);
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
})();
