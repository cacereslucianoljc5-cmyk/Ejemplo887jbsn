import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const DB_FILE = path.join(config.dataDir, "store.json");

let db = null;

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    db = { users: {} };
  }
  if (!db.users) db.users = {};
  return db;
}

function save() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

export function getUser(telegramId) {
  const users = load().users;
  const id = String(telegramId);
  if (!users[id]) {
    users[id] = {
      wallet: null,
      settings: {
        slippageBps: config.defaultSlippageBps,
        buyAmounts: [...config.defaultBuyAmounts],
      },
      // positions[tokenAddress] = { symbol, decimals, costWeth, tokens } (bigints como string)
      positions: {},
    };
    save();
  }
  if (!users[id].positions) users[id].positions = {};
  return users[id];
}

export function updateUser(telegramId, mutate) {
  const user = getUser(telegramId);
  mutate(user);
  save();
  return user;
}
