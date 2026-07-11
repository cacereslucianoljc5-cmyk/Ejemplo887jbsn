import { InlineKeyboard } from "grammy";
import { config } from "./config.js";

export function mainMenuText(address) {
  return [
    "🤖 <b>HOOD Bot</b> — trading on Robinhood Chain",
    "",
    address
      ? `💼 Wallet: <code>${address}</code>`
      : "💼 You don't have a wallet yet. Create one or import yours.",
    "",
    "📥 <b>Paste the CA (contract address) of a token</b> and I'll show you the buy options.",
  ].join("\n");
}

export function mainMenuKeyboard(hasWallet) {
  const kb = new InlineKeyboard();
  if (hasWallet) {
    kb.text("💼 Wallet", "menu:wallet").text("⚙️ Settings", "menu:settings")
      .row()
      .text("💸 Withdraw", "menu:withdraw")
      .text("🔄 Refresh", "menu:refresh");
  } else {
    kb.text("🆕 Create wallet", "w:create")
      .text("📥 Import", "w:import")
      .row()
      .text("⚙️ Settings", "menu:settings");
  }
  return kb;
}

export function withdrawKeyboard() {
  return new InlineKeyboard()
    .text("💸 Withdraw ETH", "wd:eth")
    .text("💸 Withdraw WETH", "wd:weth")
    .row()
    .text("🏠 Menu", "menu:main");
}

export function walletMenuKeyboard() {
  return new InlineKeyboard()
    .text("💰 Balance", "w:balance")
    .text("🔑 Export key", "w:export")
    .row()
    .text("📥 Import another", "w:import")
    .text("🆕 Create new", "w:create")
    .row()
    .text("🏠 Menu", "menu:main");
}

export function settingsText(settings, baseSymbol = "WETH") {
  return [
    "⚙️ <b>Settings</b>",
    "",
    `📉 Slippage: <b>${(settings.slippageBps / 100).toFixed(2)}%</b>`,
    `💵 Buy amounts (${baseSymbol}): <b>${settings.buyAmounts.join(", ")}</b>`,
  ].join("\n");
}

export function settingsKeyboard() {
  return new InlineKeyboard()
    .text("📉 Change slippage", "set:slip")
    .row()
    .text("💵 Change amounts", "set:amounts")
    .row()
    .text("🏠 Menu", "menu:main");
}

export function tokenPanelKeyboard(tokenAddress, buyAmounts, baseSymbol = "WETH") {
  const kb = new InlineKeyboard();
  buyAmounts.forEach((amount, i) => {
    kb.text(`🟢 ${amount} ${baseSymbol}`, `b:${amount}:${tokenAddress}`);
    if (i % 2 === 1) kb.row();
  });
  if (buyAmounts.length % 2 === 1) kb.row();
  kb.text("🔢 Custom amount", `b:x:${tokenAddress}`).row();
  kb.text("🔴 Sell 25%", `s:25:${tokenAddress}`)
    .text("🔴 50%", `s:50:${tokenAddress}`)
    .text("🔴 100%", `s:100:${tokenAddress}`)
    .row();
  kb.text("🔄 Refresh", `r:${tokenAddress}`).text("🏠 Menu", "menu:main");
  return kb;
}

export function txLink(hash) {
  return `${config.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}
