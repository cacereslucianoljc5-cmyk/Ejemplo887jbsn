import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createWalletClient, custom, formatEther } from 'viem';
import {
  ADD_CHAIN_PARAMS, CHAIN_ID, CHAIN_ID_HEX, publicClient, robinhoodChain,
} from './chain.js';

const WalletCtx = createContext(null);
export const useWallet = () => useContext(WalletCtx);

function getEth() {
  return typeof window !== 'undefined' ? window.ethereum : undefined;
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const refreshBalance = useCallback(async (addr) => {
    const a = addr || address;
    if (!a) return;
    try {
      const bal = await publicClient.getBalance({ address: a });
      setBalance(formatEther(bal));
    } catch { /* ignore */ }
  }, [address]);

  const ensureChain = useCallback(async () => {
    const eth = getEth();
    if (!eth) throw new Error('no wallet');
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if (e && (e.code === 4902 || e.code === -32603)) {
        await eth.request({ method: 'wallet_addEthereumChain', params: [ADD_CHAIN_PARAMS] });
      } else {
        throw e;
      }
    }
  }, []);

  const walletClient = useCallback(() => {
    const eth = getEth();
    if (!eth || !address) return null;
    return createWalletClient({ account: address, chain: robinhoodChain, transport: custom(eth) });
  }, [address]);

  const connect = useCallback(async () => {
    setError('');
    const eth = getEth();
    if (!eth) {
      setError('No EVM wallet found. Install MetaMask or Rabby to continue.');
      window.open('https://metamask.io/download/', '_blank', 'noopener');
      return;
    }
    setConnecting(true);
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0];
      if (!addr) throw new Error('no account');
      await ensureChain();
      const cid = await eth.request({ method: 'eth_chainId' });
      setAddress(addr);
      setChainId(parseInt(cid, 16));
      refreshBalance(addr);
    } catch (e) {
      setError(e?.shortMessage || e?.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, [ensureChain, refreshBalance]);

  const disconnect = useCallback(() => {
    setAddress(null); setBalance(null); setChainId(null);
  }, []);

  // React to wallet account / network changes.
  useEffect(() => {
    const eth = getEth();
    if (!eth?.on) return;
    const onAccounts = (accs) => {
      if (!accs?.length) { disconnect(); return; }
      setAddress(accs[0]); refreshBalance(accs[0]);
    };
    const onChain = (cid) => setChainId(parseInt(cid, 16));
    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    // eager reconnect if already authorized
    eth.request({ method: 'eth_accounts' }).then((accs) => {
      if (accs?.length) {
        setAddress(accs[0]);
        eth.request({ method: 'eth_chainId' }).then((c) => setChainId(parseInt(c, 16)));
        refreshBalance(accs[0]);
      }
    }).catch(() => {});
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [disconnect, refreshBalance]);

  const wrongNetwork = address && chainId != null && chainId !== CHAIN_ID;

  const value = {
    address, chainId, balance, connecting, error, wrongNetwork,
    connect, disconnect, ensureChain, walletClient, refreshBalance,
  };
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
