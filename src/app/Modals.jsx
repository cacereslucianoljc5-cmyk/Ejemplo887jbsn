import React, { useEffect, useState } from 'react';
import { parseUnits } from 'viem';
import { Xmark, Rocket, Wallet, OpenNewWindow, CheckCircle, WarningTriangle, Copy } from 'iconoir-react';
import { useWallet } from './wallet.jsx';
import { publicClient, addrUrl, txUrl, shortAddr, CHAIN_ID } from './chain.js';
import { loadTokens, saveToken } from './hooks.js';
import artifact from './token-artifact.json';

function Overlay({ title, sub, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close"><Xmark /></button>
        <h3 className="modal-title">{title}</h3>
        {sub && <p className="modal-sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

export function CreateModal({ onClose }) {
  const w = useWallet();
  const [form, setForm] = useState({ name: '', symbol: '', supply: '1000000000', decimals: '18' });
  const [phase, setPhase] = useState('form'); // form | signing | mining | done | error
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && /^[A-Za-z0-9]{2,10}$/.test(form.symbol.trim()) && Number(form.supply) > 0;

  const deploy = async () => {
    setErr('');
    if (!w.address) { await w.connect(); return; }
    if (w.wrongNetwork) { try { await w.ensureChain(); } catch { setErr('Switch to Robinhood Chain to continue.'); return; } }
    const client = w.walletClient();
    if (!client) { setErr('Wallet unavailable.'); return; }
    try {
      setPhase('signing');
      const decimals = Number(form.decimals);
      const supplyRaw = parseUnits(String(form.supply).replace(/,/g, ''), decimals);
      const hash = await client.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [form.name.trim(), form.symbol.trim().toUpperCase(), decimals, supplyRaw],
      });
      setPhase('mining');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const rec = {
        address: receipt.contractAddress, hash,
        name: form.name.trim(), symbol: form.symbol.trim().toUpperCase(),
        supply: form.supply, decimals, ts: Date.now(),
      };
      saveToken(rec);
      setResult(rec);
      setPhase('done');
      w.refreshBalance();
    } catch (e) {
      setErr(e?.shortMessage || e?.details || e?.message || 'Deploy failed');
      setPhase('error');
    }
  };

  return (
    <Overlay title="Launch a token" sub="Deploys a real ERC-20 on Robinhood Chain — you sign, you own the whole supply." onClose={onClose}>
      {(phase === 'form' || phase === 'error') && (
        <>
          <div className="field">
            <label>Token name</label>
            <input value={form.name} onChange={set('name')} placeholder="Skylark" maxLength={32} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Ticker</label>
              <input value={form.symbol} onChange={set('symbol')} placeholder="LARK" maxLength={10} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="field">
              <label>Decimals</label>
              <input value={form.decimals} onChange={set('decimals')} inputMode="numeric" />
            </div>
          </div>
          <div className="field">
            <label>Total supply</label>
            <input value={form.supply} onChange={set('supply')} inputMode="numeric" placeholder="1000000000" />
          </div>
          {(err || w.error) && <div className="modal-err"><WarningTriangle /> {err || w.error}</div>}
          <button className="btn btn-primary btn-lg modal-cta" onClick={deploy} disabled={!valid && !!w.address}>
            {!w.address ? <><Wallet /> Connect wallet to launch</> : <><Rocket /> Launch on Robinhood Chain</>}
          </button>
          <p className="modal-fine">Real transaction · you pay a few cents of gas in ETH · nothing is minted after deploy.</p>
        </>
      )}
      {phase === 'signing' && <Pending label="Confirm the deployment in your wallet…" />}
      {phase === 'mining' && <Pending label="Deploying on Robinhood Chain…" spin />}
      {phase === 'done' && result && (
        <div className="deploy-done">
          <div className="done-ic"><CheckCircle /></div>
          <div className="done-h">{result.name} (${result.symbol}) is live.</div>
          <div className="done-row">
            <span>Contract</span>
            <code>{shortAddr(result.address)}</code>
            <button className="mini-copy" onClick={() => navigator.clipboard?.writeText(result.address)} aria-label="Copy"><Copy /></button>
          </div>
          <div className="done-actions">
            <a className="btn btn-dark" href={addrUrl(result.address)} target="_blank" rel="noopener"><OpenNewWindow /> View token</a>
            <a className="btn btn-ghost" href={txUrl(result.hash)} target="_blank" rel="noopener">Deploy tx</a>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function Pending({ label, spin }) {
  return (
    <div className="pending">
      <div className={`spinner ${spin ? 'go' : ''}`} />
      <p>{label}</p>
    </div>
  );
}

export function PortfolioModal({ onClose }) {
  const w = useWallet();
  const [tokens, setTokens] = useState([]);
  useEffect(() => { setTokens(loadTokens()); }, []);
  return (
    <Overlay title="Portfolio" sub="Your wallet on Robinhood Chain and the tokens you've launched." onClose={onClose}>
      {!w.address ? (
        <button className="btn btn-primary btn-lg modal-cta" onClick={w.connect}><Wallet /> Connect wallet</button>
      ) : (
        <>
          <div className="pf-card">
            <div className="pf-row"><span>Address</span><a href={addrUrl(w.address)} target="_blank" rel="noopener"><code>{shortAddr(w.address)}</code></a></div>
            <div className="pf-row"><span>Network</span><b style={{ color: w.wrongNetwork ? '#c0392b' : 'inherit' }}>{w.wrongNetwork ? 'Wrong network' : 'Robinhood Chain'}</b></div>
            <div className="pf-row"><span>Balance</span><b>{w.balance != null ? `${Number(w.balance).toFixed(5)} ETH` : '—'}</b></div>
          </div>
          <div className="pf-h">Tokens you launched</div>
          {tokens.length === 0 ? (
            <p className="modal-fine">Nothing yet. Launch your first token from Create.</p>
          ) : (
            <div className="pf-list">
              {tokens.map((t) => (
                <a className="pf-token" key={t.address} href={addrUrl(t.address)} target="_blank" rel="noopener">
                  <div className="pf-token-av">{t.symbol.slice(0, 1)}</div>
                  <div className="pf-token-nm"><b>{t.name}</b><span>${t.symbol}</span></div>
                  <code>{shortAddr(t.address)}</code>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </Overlay>
  );
}
