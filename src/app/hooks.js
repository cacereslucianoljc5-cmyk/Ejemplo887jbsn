import { useEffect, useState } from 'react';
import { formatGwei } from 'viem';
import { publicClient } from './chain.js';

// Live Robinhood Chain data — real reads from the public RPC, polled.
export function useLiveChain(intervalMs = 10000) {
  const [data, setData] = useState({ block: null, gwei: null, ok: false });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [block, gas] = await Promise.all([
          publicClient.getBlockNumber(),
          publicClient.getGasPrice(),
        ]);
        if (!alive) return;
        const g = Number(formatGwei(gas));
        setData({ block: Number(block), gwei: g < 0.01 ? g.toFixed(4) : g.toFixed(3), ok: true });
      } catch {
        if (alive) setData((d) => ({ ...d, ok: false }));
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);
  return data;
}

const KEY = 'fledge:tokens';
export function loadTokens() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveToken(t) {
  const list = loadTokens();
  list.unshift(t);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  return list;
}
