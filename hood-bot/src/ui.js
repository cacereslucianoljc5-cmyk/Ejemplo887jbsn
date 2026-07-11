import { InlineKeyboard } from "grammy";
import { config } from "./config.js";

export function mainMenuText(address) {
  return [
    "🤖 <b>HOOD Bot</b> — trading en Robinhood Chain",
    "",
    address
      ? `💼 Billetera: <code>${address}</code>`
      : "💼 Todavía no tenés billetera. Creá una o importá la tuya.",
    "",
    "📥 <b>Pegá el CA (contract address) de un token</b> y te muestro las opciones de compra con HOOD, al estilo Trojan.",
  ].join("\n");
}

export function mainMenuKeyboard(hasWallet) {
  const kb = new InlineKeyboard();
  if (hasWallet) {
    kb.text("💼 Billetera", "menu:wallet").text("⚙️ Ajustes", "menu:settings");
  } else {
    kb.text("🆕 Crear billetera", "w:create")
      .text("📥 Importar", "w:import")
      .row()
      .text("⚙️ Ajustes", "menu:settings");
  }
  return kb;
}

export function walletMenuKeyboard() {
  return new InlineKeyboard()
    .text("💰 Balance", "w:balance")
    .text("🔑 Exportar clave", "w:export")
    .row()
    .text("📥 Importar otra", "w:import")
    .text("🆕 Crear nueva", "w:create")
    .row()
    .text("🏠 Menú", "menu:main");
}

export function settingsText(settings) {
  return [
    "⚙️ <b>Ajustes</b>",
    "",
    `📉 Slippage: <b>${(settings.slippageBps / 100).toFixed(2)}%</b>`,
    `💵 Montos de compra (HOOD): <b>${settings.buyAmounts.join(", ")}</b>`,
  ].join("\n");
}

export function settingsKeyboard() {
  return new InlineKeyboard()
    .text("📉 Cambiar slippage", "set:slip")
    .row()
    .text("💵 Cambiar montos", "set:amounts")
    .row()
    .text("🏠 Menú", "menu:main");
}

export function tokenPanelKeyboard(tokenAddress, buyAmounts) {
  const kb = new InlineKeyboard();
  buyAmounts.forEach((amount, i) => {
    kb.text(`🟢 ${amount} HOOD`, `b:${amount}:${tokenAddress}`);
    if (i % 2 === 1) kb.row();
  });
  if (buyAmounts.length % 2 === 1) kb.row();
  kb.text("🔢 Otro monto", `b:x:${tokenAddress}`).row();
  kb.text("🔴 Vender 25%", `s:25:${tokenAddress}`)
    .text("🔴 50%", `s:50:${tokenAddress}`)
    .text("🔴 100%", `s:100:${tokenAddress}`)
    .row();
  kb.text("🔄 Refrescar", `r:${tokenAddress}`).text("🏠 Menú", "menu:main");
  return kb;
}

export function txLink(hash) {
  return `${config.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}
