import crypto from "node:crypto";
import { Wallet } from "ethers";
import { config } from "./config.js";
import { getUser, updateUser } from "./storage.js";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function deriveKey(salt) {
  return crypto.scryptSync(config.encryptionKey, salt, 32, SCRYPT_PARAMS);
}

function encrypt(plaintext) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: encrypted.toString("hex"),
  };
}

function decrypt({ salt, iv, tag, data }) {
  const key = deriveKey(Buffer.from(salt, "hex"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function hasWallet(telegramId) {
  return Boolean(getUser(telegramId).wallet);
}

export function getAddress(telegramId) {
  return getUser(telegramId).wallet?.address ?? null;
}

export function createWallet(telegramId) {
  const wallet = Wallet.createRandom();
  updateUser(telegramId, (user) => {
    user.wallet = { address: wallet.address, ...encrypt(wallet.privateKey) };
  });
  // La frase semilla solo se muestra una vez, nunca se guarda.
  return { address: wallet.address, mnemonic: wallet.mnemonic?.phrase ?? null };
}

export function importWallet(telegramId, privateKey) {
  const key = privateKey.trim();
  const wallet = new Wallet(key.startsWith("0x") ? key : `0x${key}`);
  updateUser(telegramId, (user) => {
    user.wallet = { address: wallet.address, ...encrypt(wallet.privateKey) };
  });
  return { address: wallet.address };
}

export function getPrivateKey(telegramId) {
  const stored = getUser(telegramId).wallet;
  if (!stored) throw new Error("No wallet for this user.");
  return decrypt(stored);
}

export function getSigner(telegramId, provider) {
  return new Wallet(getPrivateKey(telegramId), provider);
}
