import { Bot } from "grammy";
import { config } from "./config.js";
import { getUser, updateUser } from "./storage.js";
import * as wallets from "./wallet.js";
import {
  provider,
  erc20,
  normalizeAddress,
  getTokenInfo,
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
      ? `💼 <b>Billetera</b>\n\n<code>${address}</code>\n\n⛽ Recordá: el gas de Robinhood Chain se paga en ETH; mandá un poco de ETH a esta dirección además de tus HOOD.`
      : "💼 No tenés billetera todavía.",
    { ...HTML, reply_markup: walletMenuKeyboard() }
  );
});

bot.callbackQuery("menu:settings", async (ctx) => {
  await ctx.answerCallbackQuery();
  const { settings } = getUser(ctx.from.id);
  await ctx.editMessageText(settingsText(settings), {
    ...HTML,
    reply_markup: settingsKeyboard(),
  });
});

// ---------- Billetera ----------

bot.callbackQuery("w:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (wallets.hasWallet(ctx.from.id)) {
    pending.set(ctx.from.id, { type: "confirmCreate" });
    await ctx.reply(
      "⚠️ Ya tenés una billetera guardada. Crear una nueva la <b>reemplaza</b> (la anterior se pierde si no exportaste la clave).\n\nEscribí <b>SI</b> para confirmar, o cualquier otra cosa para cancelar.",
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
      "✅ <b>Billetera creada</b>",
      "",
      `📬 Dirección: <code>${address}</code>`,
      "",
      "🔐 <b>Frase semilla (guardala YA, no se vuelve a mostrar ni se guarda):</b>",
      `<tg-spoiler><code>${mnemonic}</code></tg-spoiler>`,
      "",
      "Mandá HOOD a esa dirección para comprar, y algo de ETH para el gas.",
    ].join("\n"),
    { ...HTML, reply_markup: mainMenuKeyboard(true) }
  );
}

bot.callbackQuery("w:import", async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "import" });
  await ctx.reply(
    "📥 Mandame la <b>clave privada</b> (empieza con 0x…).\n\n⚠️ Borrá el mensaje después de mandarlo. Usá este bot solo si lo hosteás vos.",
    HTML
  );
});

bot.callbackQuery("w:export", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!wallets.hasWallet(ctx.from.id)) {
    await ctx.reply("No tenés billetera para exportar.");
    return;
  }
  const key = wallets.getPrivateKey(ctx.from.id);
  await ctx.reply(
    `🔑 Tu clave privada:\n<tg-spoiler><code>${key}</code></tg-spoiler>\n\n⚠️ Guardala en un lugar seguro y borrá este mensaje.`,
    HTML
  );
});

bot.callbackQuery("w:balance", async (ctx) => {
  await ctx.answerCallbackQuery();
  const address = wallets.getAddress(ctx.from.id);
  if (!address) {
    await ctx.reply("No tenés billetera todavía.");
    return;
  }
  try {
    const [hood, balances] = await Promise.all([hoodInfo(), getBalances(address)]);
    await ctx.reply(
      [
        `💰 <b>Balance de</b> <code>${short(address)}</code>`,
        "",
        `⛽ ETH (gas): <b>${fmt(balances.eth, 18, 6)}</b>`,
        `🪙 ${hood.symbol}: <b>${fmt(balances.hood, hood.decimals)}</b>`,
      ].join("\n"),
      HTML
    );
  } catch (err) {
    await ctx.reply(`❌ No pude leer el balance: ${err.message}`);
  }
});

// ---------- Ajustes ----------

bot.callbackQuery("set:slip", async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "slippage" });
  await ctx.reply("📉 Mandame el slippage en % (ej: <code>1</code> o <code>2.5</code>).", HTML);
});

bot.callbackQuery("set:amounts", async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "amounts" });
  await ctx.reply(
    "💵 Mandame los montos de compra en HOOD separados por coma (ej: <code>10,50,100,500</code>). Máximo 6.",
    HTML
  );
});

// ---------- Panel de token ----------

async function renderTokenPanel(ctx, tokenAddress, { edit = false } = {}) {
  const userId = ctx.from.id;
  const walletAddress = wallets.getAddress(userId);
  const { settings } = getUser(userId);

  const [hood, token] = await Promise.all([hoodInfo(), getTokenInfo(tokenAddress)]);

  if (tokenAddress.toLowerCase() === config.hoodToken.toLowerCase()) {
    await ctx.reply("Ese CA es el propio token HOOD 🙂 — pegá el CA del token que querés comprar.");
    return;
  }

  // Precio de referencia: cuánto sale 1 HOOD en el token destino.
  let priceLine = "💱 Precio: sin liquidez detectada";
  try {
    const oneHood = parseUnits("1", hood.decimals);
    const q = await bestQuote(config.hoodToken, tokenAddress, oneHood);
    const route = q.path.length === 2 ? "directa" : "vía WETH";
    priceLine = `💱 1 ${hood.symbol} ≈ <b>${fmt(q.amountOut, token.decimals)} ${token.symbol}</b> (ruta ${route})`;
  } catch {
    // Se muestra "sin liquidez"; los botones de compra igual validan al ejecutar.
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
      `💼 Tus ${hood.symbol}: <b>${fmt(balances.hood, hood.decimals)}</b>`,
      `📦 Tus ${token.symbol}: <b>${fmt(balances.token, token.decimals)}</b>`,
      `⛽ ETH: <b>${fmt(balances.eth, 18, 6)}</b>`
    );
  } else {
    lines.push("", "⚠️ Creá o importá una billetera para poder comprar.");
  }

  lines.push("", `¿Cuántos ${hood.symbol} querés gastar?`);

  const options = {
    ...HTML,
    reply_markup: tokenPanelKeyboard(token.address, settings.buyAmounts),
  };
  if (edit) {
    await ctx.editMessageText(lines.join("\n"), options);
  } else {
    await ctx.reply(lines.join("\n"), options);
  }
}

bot.callbackQuery(/^r:(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Actualizando…" });
  try {
    await renderTokenPanel(ctx, ctx.match[1], { edit: true });
  } catch (err) {
    if (!/message is not modified/i.test(err.message ?? "")) {
      await ctx.reply(`❌ ${err.message}`);
    }
  }
});

// ---------- Comprar ----------

bot.callbackQuery(/^b:x:(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  pending.set(ctx.from.id, { type: "customBuy", token: ctx.match[1] });
  await ctx.reply("🔢 ¿Cuántos HOOD querés gastar? Mandame solo el número.");
});

bot.callbackQuery(/^b:([0-9]*\.?[0-9]+):(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await executeBuy(ctx, ctx.match[2], ctx.match[1]);
});

async function executeBuy(ctx, tokenAddress, hoodAmountText) {
  const userId = ctx.from.id;
  if (!wallets.hasWallet(userId)) {
    await ctx.reply("⚠️ Primero creá o importá una billetera (/start).");
    return;
  }
  const { settings } = getUser(userId);
  let status;
  try {
    const [hood, token] = await Promise.all([hoodInfo(), getTokenInfo(tokenAddress)]);
    const amountIn = parseUnits(hoodAmountText, hood.decimals);
    if (amountIn <= 0n) throw new Error("El monto tiene que ser mayor a 0.");

    const signer = wallets.getSigner(userId, provider);
    const balance = await erc20(config.hoodToken).balanceOf(signer.address);
    if (balance < amountIn) {
      throw new Error(
        `Saldo insuficiente: tenés ${fmt(balance, hood.decimals)} ${hood.symbol} y querés gastar ${hoodAmountText}.`
      );
    }

    status = await ctx.reply(
      `⏳ Comprando ${token.symbol} con ${hoodAmountText} ${hood.symbol}…`
    );
    const result = await swap(signer, config.hoodToken, tokenAddress, amountIn, settings.slippageBps);

    await ctx.api.editMessageText(
      status.chat.id,
      status.message_id,
      [
        `✅ <b>Compra ejecutada</b>`,
        "",
        `🟢 Gastaste: <b>${hoodAmountText} ${hood.symbol}</b>`,
        `📦 Mínimo garantizado: <b>${fmt(result.amountOutMin, token.decimals)} ${token.symbol}</b>`,
        `🔗 <a href="${txLink(result.txHash)}">Ver transacción</a>`,
      ].join("\n"),
      HTML
    );
  } catch (err) {
    const message = `❌ Compra fallida: ${err.shortMessage ?? err.message}`;
    if (status) {
      await ctx.api.editMessageText(status.chat.id, status.message_id, message);
    } else {
      await ctx.reply(message);
    }
  }
}

// ---------- Vender ----------

bot.callbackQuery(/^s:(25|50|100):(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const percent = BigInt(ctx.match[1]);
  const tokenAddress = ctx.match[2];
  const userId = ctx.from.id;
  if (!wallets.hasWallet(userId)) {
    await ctx.reply("⚠️ Primero creá o importá una billetera (/start).");
    return;
  }
  const { settings } = getUser(userId);
  let status;
  try {
    const [hood, token] = await Promise.all([hoodInfo(), getTokenInfo(tokenAddress)]);
    const signer = wallets.getSigner(userId, provider);
    const balance = await erc20(tokenAddress).balanceOf(signer.address);
    const amountIn = (balance * percent) / 100n;
    if (amountIn <= 0n) throw new Error(`No tenés ${token.symbol} para vender.`);

    status = await ctx.reply(`⏳ Vendiendo ${percent}% de tus ${token.symbol}…`);
    const result = await swap(signer, tokenAddress, config.hoodToken, amountIn, settings.slippageBps);

    await ctx.api.editMessageText(
      status.chat.id,
      status.message_id,
      [
        `✅ <b>Venta ejecutada</b>`,
        "",
        `🔴 Vendiste: <b>${fmt(amountIn, token.decimals)} ${token.symbol}</b> (${percent}%)`,
        `🪙 Mínimo garantizado: <b>${fmt(result.amountOutMin, hood.decimals)} ${hood.symbol}</b>`,
        `🔗 <a href="${txLink(result.txHash)}">Ver transacción</a>`,
      ].join("\n"),
      HTML
    );
  } catch (err) {
    const message = `❌ Venta fallida: ${err.shortMessage ?? err.message}`;
    if (status) {
      await ctx.api.editMessageText(status.chat.id, status.message_id, message);
    } else {
      await ctx.reply(message);
    }
  }
});

// ---------- Texto libre: CAs y respuestas pendientes ----------

bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const waiting = pending.get(userId);

  if (waiting) {
    pending.delete(userId);
    switch (waiting.type) {
      case "confirmCreate": {
        if (text.toUpperCase() === "SI" || text.toUpperCase() === "SÍ") {
          await doCreateWallet(ctx);
        } else {
          await ctx.reply("👍 Cancelado, tu billetera actual sigue intacta.");
        }
        return;
      }
      case "import": {
        try {
          const { address } = wallets.importWallet(userId, text);
          await ctx.reply(
            `✅ Billetera importada: <code>${address}</code>\n\n⚠️ Borrá tu mensaje con la clave privada.`,
            { ...HTML, reply_markup: mainMenuKeyboard(true) }
          );
        } catch {
          await ctx.reply("❌ Esa clave privada no es válida. Probá de nuevo desde el menú.");
        }
        return;
      }
      case "customBuy": {
        if (!/^[0-9]*\.?[0-9]+$/.test(text)) {
          await ctx.reply("❌ Mandame solo un número (ej: 25 o 12.5).");
          return;
        }
        await executeBuy(ctx, waiting.token, text);
        return;
      }
      case "slippage": {
        const value = Number(text.replace(",", "."));
        if (!Number.isFinite(value) || value <= 0 || value > 50) {
          await ctx.reply("❌ Slippage inválido. Usá un número entre 0.1 y 50.");
          return;
        }
        updateUser(userId, (u) => {
          u.settings.slippageBps = Math.round(value * 100);
        });
        await ctx.reply(`✅ Slippage configurado en ${value}%.`);
        return;
      }
      case "amounts": {
        const amounts = text
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[0-9]*\.?[0-9]+$/.test(s) && Number(s) > 0)
          .slice(0, 6);
        if (!amounts.length) {
          await ctx.reply("❌ No entendí los montos. Ejemplo: <code>10,50,100,500</code>", HTML);
          return;
        }
        updateUser(userId, (u) => {
          u.settings.buyAmounts = amounts;
        });
        await ctx.reply(`✅ Montos de compra: ${amounts.join(", ")} HOOD.`);
        return;
      }
    }
  }

  // ¿Es un contract address?
  const address = normalizeAddress(text);
  if (address) {
    try {
      await renderTokenPanel(ctx, address);
    } catch (err) {
      await ctx.reply(
        `❌ No pude leer ese contrato como token ERC-20: ${err.shortMessage ?? err.message}`
      );
    }
    return;
  }

  await ctx.reply(
    "🤔 No entendí. Pegá el <b>CA de un token</b> (0x…) para comprar, o usá /start para el menú.",
    HTML
  );
});

// ---------- Arranque ----------

bot.catch((err) => {
  console.error("Error no manejado:", err.error ?? err);
});

console.log(`HOOD Bot arrancando — red ${config.chainId} (${config.rpcUrl})`);
bot.start({
  onStart: (me) => console.log(`Bot conectado como @${me.username}`),
});
