import { createPublicClient, defineChain, http } from 'viem';

// Robinhood Chain — Arbitrum Orbit L2, native gas token ETH.
// Verified from docs.robinhood.com/chain: chainId 4663, public RPC + Blockscout.
export const CHAIN_ID = 4663;
export const CHAIN_ID_HEX = '0x1237';
export const PUBLIC_RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const EXPLORER = 'https://robinhoodchain.blockscout.com';
export const DOCS_URL = 'https://docs.robinhood.com/chain/';
// Official canonical bridge (Ethereum <-> Robinhood Chain).
export const BRIDGE_URL =
  'https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum';

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [PUBLIC_RPC] } },
  blockExplorers: { default: { name: 'Blockscout', url: EXPLORER } },
});

// Read-only client (no wallet needed) for live chain data.
export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(PUBLIC_RPC),
});

export const ADD_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [PUBLIC_RPC],
  blockExplorerUrls: [EXPLORER],
};

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
export const txUrl = (h) => `${EXPLORER}/tx/${h}`;
export const addrUrl = (a) => `${EXPLORER}/address/${a}`;
