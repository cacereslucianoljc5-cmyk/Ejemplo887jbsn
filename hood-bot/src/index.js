import { Bot } from "grammy";
import { config } from "./config.js";
import { getUser, updateUser } from "./storage.js";
import * as wallets from "./wallet.js";
import {
  provider,
  erc20,
  normalizeAddress,
  getTokenInfo,
  resolveTradeToken,
  getBalances,
  bestQuote,
  swap,
  fmt,
  parseUnits,
} from "./chain.js";
import {
  mainMenuText,
  mainMenuKeyboard,
  walletMenuKeyboard,
  settingsText,
  settingsKeyboard,
  tokenPanelKeyboard,
  txLink,
} from "./ui.js";

const bot = new Bot(config.botToken);

// Estado de "estoy esperando que escribas algo" por usuario.
const pending = new Map();

const HTML = { parse_mode: "HTML", link_preview_options: { is_disabled: true } };

function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function hoodInfo() {
  return getTokenInfo(config.hoodToken);
}

// ---------- Menús ----------

bot.command("start", async (ctx) => {
  const address = wallets.getAddress(ctx.from.id);
  await ctx.reply(mainMenuText(address), {
    ...HTML,
    reply_markup: mainMenuKeyboard(Boolean(address)),
  });
});

bot.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  const address = wallets.getAddress(ctx.from.id);
  await ctx.editMessageText(mainMenuText(address), {
    ...HTML,
    reply_markup: mainMenuKeyboard(Boolean(address)),
  });
});

bot.callbackQuery("menu:wallet", async (ctx) => {
  await ctx.answerCallbackQuery();
  const address = wallets.getAddress(ctx.from.id);
  await ctx.editMessageText(
    address
      ? `💼 <b>Wallet</b>\n\n<code>${address}</code>\n\n⛽ Reminder: gas on Robinhood Chain is paid in ETH; send a little ETH to this address in addition to your WETH.`
      : "💼 You don't have a wallet yet.",
    { ...HTML, reply_markup: walletMenuKeyboard() }
  );
});

bot.callbackQuery("menu:settings", async (ctx) => {
  await ctx.answerCallbackQuery();
  const { settings } = getUser(ctx.from.id);
  const base = await hoodInfo().catch(() => ({ symbol: "WETH" }));
  await ctx.editMessageText(settingsText(settings, base.symbol), {
    ...HTML,
    reply_markup: settingsKeyboard(),
  });
});

// ---------- Wallet ----------

bot.callbackQuery("w:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (wallets.hasWallet(ctx.from.id)) {
    pending.set(ctx.from.id, { type: "confirmCreate" });
    await ctx.reply(
      "⚠️ You already have a saved wallet. Creating a new one <b>replaces</b> it (the old one is lost if you didn't export its key).\n\nType <b>YES</b> to confirm, or anything else to cancel.",
      HTML
    );
    return;
  }
  await doCreateWallet(ctx);
});

async function doCreateWallet(ctx) {
  const { address, mnemonic } = wallets.createWallet(ctx.from.id);
  await ctx.reply(
    [
      "✅ <b>Wallet created</b>",
      "",
      `📬 Address: <code>${address}</code>`,
      "",
      "🔐 <b>Seed phrase (save it NOW — it won't be shown again and is not stored):</b>",
      `<tg-spoiler><code>${mnemonic}</code></tg-spoiler>`,
      "",
      "Send WETH to that address to buy, and some ETH for gas.",
    ].join("\n"),
    { ...HTML, reply_markup: mainMenuKeyboard(true) }
  );
}

bot.callbackQuery("w:import", async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "import" });
  await ctx.reply(
    "📥 Send me the <b>private key</b> (starts with 0x…).\n\n⚠️ Delete the message after sending it. Only use this bot if you self-host it.",
    HTML
  );
});

bot.callbackQuery("w:export", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!wallets.hasWallet(ctx.from.id)) {
    await ctx.reply("You don't have a wallet to export.");
    return;
  }
  const key = wallets.getPrivateKey(ctx.from.id);
  await ctx.reply(
    `🔑 Your private key:\n<tg-spoiler><code>${key}</code></tg-spoiler>\n\n⚠️ Store it somewhere safe and delete this message.`,
    HTML
  );
});

bot.callbackQuery("w:balance", async (ctx) => {
  await ctx.answerCallbackQuery();
  const address = wallets.getAddress(ctx.from.id);
  if (!address) {
    await ctx.reply("You don't have a wallet yet.");
    return;
  }
  try {
    const [hood, balances] = await Promise.all([hoodInfo(), getBalances(address)]);
    await ctx.reply(
      [
        `💰 <b>Balance of</b> <code>${short(address)}</code>`,
        "",
        `⛽ ETH (gas): <b>${fmt(balances.eth, 18, 6)}</b>`,
        `🪙 ${hood.symbol}: <b>${fmt(balances.hood, hood.decimals)}</b>`,
      ].join("\n"),
      HTML
    );
  } catch (err) {
    await ctx.reply(`❌ Couldn't read the balance: ${err.message}`);
  }
});

// ---------- Settings ----------

bot.callbackQuery("set:slip", async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "slippage" });
  await ctx.reply("📉 Send me the slippage in % (e.g. <code>1</code> or <code>2.5</code>).", HTML);
});

bot.callbackQuery("set:amounts", async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "amounts" });
  await ctx.reply(
    "💵 Send me the buy amounts in WETH separated by commas (e.g. <code>0.01,0.05,0.1,0.5</code>). Max 6.",
    HTML
  );
});

// ---------- Token panel ----------

async function renderTokenPanel(ctx, tokenAddress, { edit = false } = {}) {
  const userId = ctx.from.id;
  const walletAddress = wallets.getAddress(userId);
  const { settings } = getUser(userId);

  const [hood, token] = await Promise.all([hoodInfo(), getTokenInfo(tokenAddress)]);

  if (tokenAddress.toLowerCase() === config.hoodToken.toLowerCase()) {
    await ctx.reply("That CA is the base token itself 🙂 — paste the CA of the token you want to buy.");
    return;
  }

  // Reference price: how much of the target token 1 base unit buys.
  let priceLine = "💱 Price: no liquidity detected";
  try {
    const oneHood = parseUnits("1", hood.decimals);
    const q = await bestQuote(config.hoodToken, tokenAddress, oneHood);
    const route =
      q.kind === "v3"
        ? `Uniswap V3 · ${q.fee / 10000}%`
        : q.path.length === 2
          ? "Uniswap V2"
          : "Uniswap V2 · via WETH";
    priceLine = `💱 1 ${hood.symbol} ≈ <b>${fmt(q.amountOut, token.decimals)} ${token.symbol}</b> (${route})`;
  } catch {
    // Shows "no liquidity"; the buy buttons still validate at execution time.
  }

  const lines = [
    `🪙 <b>${token.name} (${token.symbol})</b>`,
    `<code>${token.address}</code>`,
    "",
    priceLine,
  ];

  if (walletAddress) {
    const balances = await getBalances(walletAddress, tokenAddress);
    lines.push(
      "",
      `💼 Your ${hood.symbol}: <b>${fmt(balances.hood, hood.decimals)}</b>`,
      `📦 Your ${token.symbol}: <b>${fmt(balances.token, token.decimals)}</b>`,
      `⛽ ETH: <b>${fmt(balances.eth, 18, 6)}</b>`
    );
  } else {
    lines.push("", "⚠️ Create or import a wallet to be able to buy.");
  }

  lines.push("", `How much ${hood.symbol} do you want to spend?`);

  const options = {
    ...HTML,
    reply_markup: tokenPanelKeyboard(token.address, settings.buyAmounts, hood.symbol),
  };
  if (edit) {
    await ctx.editMessageText(lines.join("\n"), options);
  } else {
    await ctx.reply(lines.join("\n"), options);
  }
}

bot.callbackQuery(/^r:(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Refreshing…" });
  try {
    await renderTokenPanel(ctx, ctx.match[1], { edit: true });
  } catch (err) {
    if (!/message is not modified/i.test(err.message ?? "")) {
      await ctx.reply(`❌ ${err.message}`);
    }
  }
});

// ---------- Buy ----------

bot.callbackQuery(/^b:x:(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "customBuy", token: ctx.match[1] });
  await ctx.reply("🔢 How much WETH do you want to spend? Send just the number.");
});

bot.callbackQuery(/^b:([0-9]*\.?[0-9]+):(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await executeBuy(ctx, ctx.match[2], ctx.match[1]);
});

async function executeBuy(ctx, tokenAddress, hoodAmountText) {
  const userId = ctx.from.id;
  if (!wallets.hasWallet(userId)) {
    await ctx.reply("⚠️ First create or import a wallet (/start).");
    return;
  }
  const { settings } = getUser(userId);
  let status;
  try {
    const [hood, token] = await Promise.all([hoodInfo(), getTokenInfo(tokenAddress)]);
    const amountIn = parseUnits(hoodAmountText, hood.decimals);
    if (amountIn <= 0n) throw new Error("The amount must be greater than 0.");

    const signer = wallets.getSigner(userId, provider);
    const balance = await erc20(config.hoodToken).balanceOf(signer.address);
    if (balance < amountIn) {
      throw new Error(
        `Insufficient balance: you have ${fmt(balance, hood.decimals)} ${hood.symbol} and want to spend ${hoodAmountText}.`
      );
    }

    status = await ctx.reply(
      `⏳ Buying ${token.symbol} with ${hoodAmountText} ${hood.symbol}…`
    );
    const result = await swap(signer, config.hoodToken, tokenAddress, amountIn, settings.slippageBps);

    await ctx.api.editMessageText(
      status.chat.id,
      status.message_id,
      [
        `✅ <b>Buy executed</b>`,
        "",
        `🟢 Spent: <b>${hoodAmountText} ${hood.symbol}</b>`,
        `📦 Guaranteed minimum: <b>${fmt(result.amountOutMin, token.decimals)} ${token.symbol}</b>`,
        `🔗 <a href="${txLink(result.txHash)}">View transaction</a>`,
      ].join("\n"),
      HTML
    );
  } catch (err) {
    const message = `❌ Buy failed: ${err.shortMessage ?? err.message}`;
    if (status) {
      await ctx.api.editMessageText(status.chat.id, status.message_id, message);
    } else {
      await ctx.reply(message);
    }
  }
}

// ---------- Sell ----------

bot.callbackQuery(/^s:(25|50|100):(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const percent = BigInt(ctx.match[1]);
  const tokenAddress = ctx.match[2];
  const userId = ctx.from.id;
  if (!wallets.hasWallet(userId)) {
    await ctx.reply("⚠️ First create or import a wallet (/start).");
    return;
  }
  const { settings } = getUser(userId);
  let status;
  try {
    const [hood, token] = await Promise.all([hoodInfo(), getTokenInfo(tokenAddress)]);
    const signer = wallets.getSigner(userId, provider);
    const balance = await erc20(tokenAddress).balanceOf(signer.address);
    const amountIn = (balance * percent) / 100n;
    if (amountIn <= 0n) throw new Error(`You don't have any ${token.symbol} to sell.`);

    status = await ctx.reply(`⏳ Selling ${percent}% of your ${token.symbol}…`);
    const result = await swap(signer, tokenAddress, config.hoodToken, amountIn, settings.slippageBps);

    await ctx.api.editMessageText(
      status.chat.id,
      status.message_id,
      [
        `✅ <b>Sell executed</b>`,
        "",
        `🔴 Sold: <b>${fmt(amountIn, token.decimals)} ${token.symbol}</b> (${percent}%)`,
        `🪙 Guaranteed minimum: <b>${fmt(result.amountOutMin, hood.decimals)} ${hood.symbol}</b>`,
        `🔗 <a href="${txLink(result.txHash)}">View transaction</a>`,
      ].join("\n"),
      HTML
    );
  } catch (err) {
    const message = `❌ Sell failed: ${err.shortMessage ?? err.message}`;
    if (status) {
      await ctx.api.editMessageText(status.chat.id, status.message_id, message);
    } else {
      await ctx.reply(message);
    }
  }
});

// ---------- Free text: CAs and pending replies ----------

bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const waiting = pending.get(userId);

  if (waiting) {
    pending.delete(userId);
    switch (waiting.type) {
      case "confirmCreate": {
        if (text.trim().toUpperCase() === "YES") {
          await doCreateWallet(ctx);
        } else {
          await ctx.reply("👍 Cancelled, your current wallet is untouched.");
        }
        return;
      }
      case "import": {
        try {
          const { address } = wallets.importWallet(userId, text);
          await ctx.reply(
            `✅ Wallet imported: <code>${address}</code>\n\n⚠️ Delete your message containing the private key.`,
            { ...HTML, reply_markup: mainMenuKeyboard(true) }
          );
        } catch {
          await ctx.reply("❌ That private key is not valid. Try again from the menu.");
        }
        return;
      }
      case "customBuy": {
        if (!/^[0-9]*\.?[0-9]+$/.test(text)) {
          await ctx.reply("❌ Send just a number (e.g. 0.05 or 0.1).");
          return;
        }
        await executeBuy(ctx, waiting.token, text);
        return;
      }
      case "slippage": {
        const value = Number(text.replace(",", "."));
        if (!Number.isFinite(value) || value <= 0 || value > 50) {
          await ctx.reply("❌ Invalid slippage. Use a number between 0.1 and 50.");
          return;
        }
        updateUser(userId, (u) => {
          u.settings.slippageBps = Math.round(value * 100);
        });
        await ctx.reply(`✅ Slippage set to ${value}%.`);
        return;
      }
      case "amounts": {
        const amounts = text
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[0-9]*\.?[0-9]+$/.test(s) && Number(s) > 0)
          .slice(0, 6);
        if (!amounts.length) {
          await ctx.reply("❌ I didn't understand the amounts. Example: <code>0.01,0.05,0.1,0.5</code>", HTML);
          return;
        }
        updateUser(userId, (u) => {
          u.settings.buyAmounts = amounts;
        });
        await ctx.reply(`✅ Buy amounts: ${amounts.join(", ")} WETH.`);
        return;
      }
    }
  }

  // Is it a contract address?
  const address = normalizeAddress(text);
  if (address) {
    try {
      // Accepts both a token CA and a pool CA (resolves it to the token).
      const resolved = await resolveTradeToken(address);
      if (resolved.fromPool) {
        await ctx.reply(
          `🔎 Detected that you pasted a <b>pool</b>. The token is <code>${resolved.address}</code>`,
          HTML
        );
      }
      await renderTokenPanel(ctx, resolved.address);
    } catch (err) {
      await ctx.reply(`❌ ${err.shortMessage ?? err.message}`);
    }
    return;
  }

  await ctx.reply(
    "🤔 I didn't understand. Paste a <b>token CA</b> (0x…) to buy, or use /start for the menu.",
    HTML
  );
});

// ---------- Startup ----------

bot.catch((err) => {
  console.error("Unhandled error:", err.error ?? err);
});

console.log(`HOOD Bot starting — network ${config.chainId} (${config.rpcUrl})`);
bot.start({
  onStart: (me) => console.log(`Bot connected as @${me.username}`),
});
