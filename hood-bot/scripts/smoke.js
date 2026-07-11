// Smoke test: verifica que los módulos cargan y que el cifrado de billeteras
// funciona de punta a punta, sin tocar Telegram ni la red.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hood-bot-smoke-"));
process.env.TELEGRAM_BOT_TOKEN = "0:dummy";
process.env.WALLET_ENCRYPTION_KEY = "clave-de-prueba-solo-para-smoke";
process.env.HOOD_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
process.env.WETH_ADDRESS = "0x0000000000000000000000000000000000000002";
process.env.UNISWAP_V2_ROUTER = "0x0000000000000000000000000000000000000003";
process.env.DATA_DIR = dataDir;

const { config } = await import("../src/config.js");
const wallets = await import("../src/wallet.js");
const { getUser, updateUser } = await import("../src/storage.js");
const { normalizeAddress, fmt } = await import("../src/chain.js");

function assert(condition, message) {
  if (!condition) throw new Error(`SMOKE FAIL: ${message}`);
}

assert(config.chainId === 4663, "chainId default");
assert(config.defaultBuyAmounts.length === 4, "montos default");

// Crear billetera + roundtrip de cifrado
const created = wallets.createWallet(111);
assert(/^0x[0-9a-fA-F]{40}$/.test(created.address), "dirección válida");
assert(created.mnemonic.split(" ").length >= 12, "mnemonic presente");
const pk = wallets.getPrivateKey(111);
assert(/^0x[0-9a-f]{64}$/i.test(pk), "clave privada descifrada");

// Importar esa misma clave en otro usuario
const imported = wallets.importWallet(222, pk);
assert(imported.address === created.address, "import reproduce la dirección");

// El JSON en disco no contiene la clave en claro
const raw = fs.readFileSync(path.join(dataDir, "store.json"), "utf8");
assert(!raw.includes(pk.slice(2)), "clave privada NO está en claro en disco");

// Settings
updateUser(111, (u) => (u.settings.slippageBps = 250));
assert(getUser(111).settings.slippageBps === 250, "settings persisten");

// Helpers
assert(normalizeAddress(" 0x0000000000000000000000000000000000000001 "), "normalizeAddress ok");
assert(normalizeAddress("no-es-una-address") === null, "rechaza texto");
assert(fmt(1500000000000000000n, 18) === "1.5", "fmt formatea");

fs.rmSync(dataDir, { recursive: true, force: true });
console.log("✅ Smoke test OK");
process.exit(0);
