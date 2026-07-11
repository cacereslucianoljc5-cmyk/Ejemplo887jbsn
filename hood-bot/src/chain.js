import { JsonRpcProvider, Contract, formatUnits, parseUnits, isAddress, getAddress } from "ethers";
import { config } from "./config.js";

export const provider = new JsonRpcProvider(config.rpcUrl, config.chainId, {
  staticNetwork: true,
});

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Uniswap V2 (getAmountsOut + swap con soporte fee-on-transfer)
const V2_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
];

// Uniswap V3: QuoterV2, SwapRouter02, Factory y el pool
const V3_QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];
const V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];
const V3_FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
];
const V3_POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
];

export function erc20(address, signerOrProvider = provider) {
  return new Contract(address, ERC20_ABI, signerOrProvider);
}

export function router(signerOrProvider = provider) {
  return new Contract(config.router, V2_ROUTER_ABI, signerOrProvider);
}

export function normalizeAddress(text) {
  const candidate = text.trim();
  if (!isAddress(candidate)) return null;
  return getAddress(candidate);
}

const tokenInfoCache = new Map();

export async function getTokenInfo(address) {
  const key = address.toLowerCase();
  if (tokenInfoCache.has(key)) return tokenInfoCache.get(key);
  const token = erc20(address);
  const [name, symbol, decimals] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
  ]);
  const info = { address, name, symbol, decimals: Number(decimals) };
  tokenInfoCache.set(key, info);
  return info;
}

/**
 * Acepta el CA de un token O de un pool de Uniswap V3. Si es un pool, devuelve
 * el token subyacente (el lado que no es la moneda base). Así el usuario puede
 * pegar directamente la dirección que copió de DEX Screener.
 * Devuelve { address, fromPool } o lanza si no es ni token ni pool legible.
 */
export async function resolveTradeToken(address) {
  try {
    await getTokenInfo(address);
    return { address, fromPool: false };
  } catch {
    // No es un ERC-20 estándar: probamos si es un pool V3.
  }
  try {
    const pool = new Contract(address, V3_POOL_ABI, provider);
    const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);
    const baseLower = config.hoodToken.toLowerCase();
    const wethLower = config.weth.toLowerCase();
    const underlying = [token0, token1].find(
      (t) => t.toLowerCase() !== baseLower && t.toLowerCase() !== wethLower
    );
    const chosen = underlying ?? token1;
    return { address: getAddress(chosen), fromPool: true };
  } catch {
    throw new Error(
      "That CA is neither an ERC-20 token nor a pool I can read. Is the address correct?"
    );
  }
}

export async function getBalances(walletAddress, tokenAddress) {
  const calls = [
    provider.getBalance(walletAddress),
    erc20(config.hoodToken).balanceOf(walletAddress),
  ];
  if (tokenAddress) calls.push(erc20(tokenAddress).balanceOf(walletAddress));
  const [eth, hood, token] = await Promise.all(calls);
  return { eth, hood, token: token ?? null };
}

async function quoteV2(tokenIn, tokenOut, amountIn) {
  const r = router();
  const paths = [[tokenIn, tokenOut]];
  const wethLower = config.weth.toLowerCase();
  if (tokenIn.toLowerCase() !== wethLower && tokenOut.toLowerCase() !== wethLower) {
    paths.push([tokenIn, config.weth, tokenOut]);
  }
  let best = null;
  for (const path of paths) {
    try {
      const amounts = await r.getAmountsOut(amountIn, path);
      const out = amounts[amounts.length - 1];
      if (!best || out > best.amountOut) best = { kind: "v2", path, amountOut: out };
    } catch {
      // Sin pool V2 para esta ruta.
    }
  }
  return best;
}

async function quoteV3(tokenIn, tokenOut, amountIn) {
  const quoter = new Contract(config.v3Quoter, V3_QUOTER_ABI, provider);
  const factory = new Contract(config.v3Factory, V3_FACTORY_ABI, provider);
  let best = null;
  for (const fee of config.v3FeeTiers) {
    try {
      // getPool evita gastar una llamada de quote donde no hay pool.
      const pool = await factory.getPool(tokenIn, tokenOut, fee);
      if (pool === "0x0000000000000000000000000000000000000000") continue;
      const res = await quoter.quoteExactInputSingle.staticCall({
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      });
      const out = res[0];
      if (!best || out > best.amountOut) best = { kind: "v3", fee, amountOut: out };
    } catch {
      // Sin pool/liquidez para este fee tier.
    }
  }
  return best;
}

/**
 * Cotiza el swap por Uniswap V2 y V3 y devuelve la mejor opción.
 * Devuelve { kind: "v2"|"v3", amountOut, path?(v2), fee?(v3) }.
 */
export async function bestQuote(tokenIn, tokenOut, amountIn) {
  const [v2, v3] = await Promise.all([
    quoteV2(tokenIn, tokenOut, amountIn),
    quoteV3(tokenIn, tokenOut, amountIn),
  ]);
  const options = [v2, v3].filter(Boolean);
  if (!options.length) {
    throw new Error(
      "No liquidity found for that pair on Uniswap V2 or V3. Is the CA correct?"
    );
  }
  return options.reduce((a, b) => (b.amountOut > a.amountOut ? b : a));
}

async function ensureAllowance(signer, tokenAddress, spender, amount) {
  const token = erc20(tokenAddress, signer);
  const current = await token.allowance(signer.address, spender);
  if (current >= amount) return null;
  const tx = await token.approve(spender, (1n << 256n) - 1n);
  await tx.wait();
  return tx.hash;
}

/**
 * Ejecuta un swap exact-in con protección de slippage, por V2 o V3 según
 * cuál dé mejor precio. Devuelve { txHash, amountOutMin, quote }.
 */
export async function swap(signer, tokenIn, tokenOut, amountIn, slippageBps) {
  const quote = await bestQuote(tokenIn, tokenOut, amountIn);
  const amountOutMin = (quote.amountOut * BigInt(10000 - slippageBps)) / 10000n;

  let tx;
  if (quote.kind === "v3") {
    await ensureAllowance(signer, tokenIn, config.v3Router, amountIn);
    const v3 = new Contract(config.v3Router, V3_ROUTER_ABI, signer);
    tx = await v3.exactInputSingle({
      tokenIn,
      tokenOut,
      fee: quote.fee,
      recipient: signer.address,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0n,
    });
  } else {
    await ensureAllowance(signer, tokenIn, config.router, amountIn);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    tx = await router(signer).swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amountIn,
      amountOutMin,
      quote.path,
      signer.address,
      deadline
    );
  }
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`La transacción falló: ${tx.hash}`);
  return { txHash: tx.hash, amountOutMin, quote };
}

// Envía ETH nativo. amount = null significa "todo menos una reserva de gas".
export async function transferEth(signer, to, amount) {
  let value = amount;
  if (value === null) {
    const [balance, fee] = await Promise.all([
      provider.getBalance(signer.address),
      provider.getFeeData(),
    ]);
    const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
    const reserve = 21000n * gasPrice * 2n; // margen para cubrir el gas del envío
    value = balance > reserve ? balance - reserve : 0n;
  }
  if (value <= 0n) throw new Error("Insufficient ETH balance to withdraw.");
  const tx = await signer.sendTransaction({ to, value });
  await tx.wait();
  return tx.hash;
}

// Envía un token ERC-20 (ej: WETH). amount = null significa "todo el balance".
export async function transferToken(signer, tokenAddress, to, amount) {
  const token = erc20(tokenAddress, signer);
  let value = amount;
  if (value === null) value = await token.balanceOf(signer.address);
  if (value <= 0n) throw new Error("Insufficient balance to withdraw.");
  const tx = await token.transfer(to, value);
  await tx.wait();
  return tx.hash;
}

export function fmt(amount, decimals, maxFrac = 4) {
  const value = Number(formatUnits(amount, decimals));
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

export { formatUnits, parseUnits };
