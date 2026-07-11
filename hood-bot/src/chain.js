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

const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
];

export function erc20(address, signerOrProvider = provider) {
  return new Contract(address, ERC20_ABI, signerOrProvider);
}

export function router(signerOrProvider = provider) {
  return new Contract(config.router, ROUTER_ABI, signerOrProvider);
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

export async function getBalances(walletAddress, tokenAddress) {
  const calls = [
    provider.getBalance(walletAddress),
    erc20(config.hoodToken).balanceOf(walletAddress),
  ];
  if (tokenAddress) calls.push(erc20(tokenAddress).balanceOf(walletAddress));
  const [eth, hood, token] = await Promise.all(calls);
  return { eth, hood, token: token ?? null };
}

/**
 * Prueba las rutas HOOD→token directa y vía WETH, devuelve la mejor.
 * (Lo mismo sirve para vender, invirtiendo tokenIn/tokenOut.)
 */
export async function bestQuote(tokenIn, tokenOut, amountIn) {
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
      if (!best || out > best.amountOut) best = { path, amountOut: out };
    } catch {
      // Sin pool para esta ruta; probamos la siguiente.
    }
  }
  if (!best) {
    throw new Error(
      "No encontré liquidez para ese par (ni ruta directa ni vía WETH). ¿El CA es correcto?"
    );
  }
  return best;
}

async function ensureAllowance(signer, tokenAddress, amount) {
  const token = erc20(tokenAddress, signer);
  const current = await token.allowance(signer.address, config.router);
  if (current >= amount) return null;
  const tx = await token.approve(config.router, (1n << 256n) - 1n);
  await tx.wait();
  return tx.hash;
}

/**
 * Ejecuta un swap exact-in con protección de slippage.
 * Devuelve { txHash, amountOutMin, quote }.
 */
export async function swap(signer, tokenIn, tokenOut, amountIn, slippageBps) {
  const quote = await bestQuote(tokenIn, tokenOut, amountIn);
  const amountOutMin = (quote.amountOut * BigInt(10000 - slippageBps)) / 10000n;

  await ensureAllowance(signer, tokenIn, amountIn);

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const tx = await router(signer).swapExactTokensForTokensSupportingFeeOnTransferTokens(
    amountIn,
    amountOutMin,
    quote.path,
    signer.address,
    deadline
  );
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`La transacción falló: ${tx.hash}`);
  return { txHash: tx.hash, amountOutMin, quote };
}

export function fmt(amount, decimals, maxFrac = 4) {
  const value = Number(formatUnits(amount, decimals));
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

export { formatUnits, parseUnits };
