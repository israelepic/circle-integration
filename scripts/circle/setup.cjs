// Usage:
//   node scripts/circle/setup.cjs secret [node_modules dir]
//   node scripts/circle/setup.cjs init   [node_modules dir]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const args = process.argv.slice(2);
const mode = args.find((a) => ["secret", "init"].includes(a));
const mods = args.find((a) => !["secret", "init"].includes(a));
const need = (m) => require(mods ? require.resolve(m, { paths: [mods] }) : m);
const sdk = need("@circle-fin/developer-controlled-wallets");

async function main() {
  if (mode === "secret") return sdk.generateEntitySecret();
  if (mode !== "init") throw new Error("usage: setup.cjs secret|init [node_modules dir]");

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are required");
  if (!apiKey.startsWith("TEST_API_KEY:")) throw new Error("Use a test API key for Arc Testnet");

  const dir = process.env.CIRCLE_RECOVERY_DIR || os.homedir();
  const recovery = path.join(dir, "lucel-circle-recovery.dat");
  if (!fs.existsSync(recovery)) {
    const r = await sdk.registerEntitySecretCiphertext({ apiKey, entitySecret });
    fs.writeFileSync(recovery, r.data?.recoveryFile ?? "", { mode: 0o600 });
    console.log(`Entity secret registered. Recovery file: ${recovery}`);
  }

  const client = sdk.initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const set = await client.createWalletSet({ name: "Lucel" });
  const walletSetId = set.data?.walletSet?.id;
  const w = await client.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: 1,
    accountType: "EOA",
    metadata: [{ name: "Lucel payouts", refId: "lucel-payouts" }],
  });
  const wallet = w.data?.wallets?.[0];
  console.log("");
  console.log(`CIRCLE_WALLET_SET_ID=${walletSetId}`);
  console.log(`CIRCLE_PAYOUT_WALLET_ID=${wallet.id}`);
  console.log(`CIRCLE_PAYOUT_WALLET_ADDRESS=${wallet.address}`);
  console.log(`CIRCLE_ARC_CHAIN=ARC-TESTNET`);
  console.log(`\nFund ${wallet.address} with test USDC at https://faucet.circle.com (Arc Testnet).`);
}

main().catch((e) => {
  console.error(e?.response?.status ? `Circle error (HTTP ${e.response.status})` : e.message);
  process.exit(1);
});
