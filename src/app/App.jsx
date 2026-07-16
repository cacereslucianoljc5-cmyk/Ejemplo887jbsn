import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Rocket, Wallet, Coins, Sparks, GraphUp, StatUp, ArrowRight, ArrowUpRight,
  FastArrowRight, DataTransferBoth, RefreshDouble, Trophy, Flash, ShieldCheck,
  Plus, Timer, Lock, Leaf, Community, Percentage, EvChargeAlt,
  Twitter, Discord, Book, NavArrowDown, DollarCircle, Cube, Spark,
  OpenNewWindow, WarningTriangle, Xmark, Globe,
} from 'iconoir-react';
import Logo, { Mark } from './Logo.jsx';
import { useReveal } from './useReveal.js';
import { WalletProvider, useWallet } from './wallet.jsx';
import { CreateModal, PortfolioModal } from './Modals.jsx';
import { useLiveChain } from './hooks.js';
import { BRIDGE_URL, DOCS_URL, EXPLORER, shortAddr } from './chain.js';
import { localLogo, logoFallback } from './tokenArt.js';

// lightweight UI action context (open modals, external links)
const UI = createContext({ openCreate() {}, openPortfolio() {} });
const useUI = () => useContext(UI);

/* ---------------- data ---------------- */
const NAV = ['Board', 'Create', 'Bridge', 'Portfolio', 'Docs', 'FAQ'];

const TICKER = [
  { n: 'PERCH', c: '+412%' }, { n: 'ROOST', c: '+88%' }, { n: 'QUILL', c: '+1240%' },
  { n: 'NEST', c: '+57%' }, { n: 'TALON', c: '+319%' }, { n: 'PLUME', c: '+204%' },
  { n: 'SWIFT', c: '+76%' }, { n: 'WREN', c: '+933%' },
];

const TABS = ['New drops', 'Trending', 'Migrated', 'Top on-chain'];

const TOKENS = {
  'New drops': [
    { nm: 'Perch', tk: 'PERCH', i: 'P', col: '#CCFF01', badge: 'Fresh', mc: '$14.2K', chg: '+42%', prog: 18, rep: 62 },
    { nm: 'Fledgling', tk: 'FLDG', i: 'F', col: '#0B0B0C', badge: 'Fresh', mc: '$8.9K', chg: '+17%', prog: 11, rep: 24 },
    { nm: 'Skylark', tk: 'LARK', i: 'S', col: '#B6E600', badge: 'Fresh', mc: '$31.7K', chg: '+128%', prog: 39, rep: 140 },
    { nm: 'Quiver', tk: 'QUIV', i: 'Q', col: '#0B0B0C', badge: 'Fresh', mc: '$5.1K', chg: '+9%', prog: 6, rep: 12 },
    { nm: 'Talon', tk: 'TALON', i: 'T', col: '#CCFF01', badge: 'Fresh', mc: '$22.4K', chg: '+63%', prog: 27, rep: 88 },
    { nm: 'Downy', tk: 'DOWN', i: 'D', col: '#B6E600', badge: 'Fresh', mc: '$3.3K', chg: '+4%', prog: 4, rep: 7 },
  ],
  'Trending': [
    { nm: 'Wren', tk: 'WREN', i: 'W', col: '#CCFF01', badge: 'Hot', mc: '$284K', chg: '+933%', prog: 71, rep: 1204 },
    { nm: 'Roost', tk: 'ROOST', i: 'R', col: '#0B0B0C', badge: 'Hot', mc: '$196K', chg: '+318%', prog: 64, rep: 842 },
    { nm: 'Plume', tk: 'PLUME', i: 'P', col: '#B6E600', badge: 'Hot', mc: '$341K', chg: '+204%', prog: 88, rep: 1567 },
    { nm: 'Swift', tk: 'SWIFT', i: 'S', col: '#0B0B0C', badge: 'Hot', mc: '$77.5K', chg: '+76%', prog: 44, rep: 402 },
    { nm: 'Kestrel', tk: 'KSTR', i: 'K', col: '#CCFF01', badge: 'Hot', mc: '$122K', chg: '+151%', prog: 58, rep: 690 },
    { nm: 'Feather', tk: 'FTHR', i: 'F', col: '#B6E600', badge: 'Hot', mc: '$203K', chg: '+289%', prog: 74, rep: 913 },
  ],
  'Migrated': [
    { nm: 'Quill', tk: 'QUILL', i: 'Q', col: '#CCFF01', badge: 'Migrated', mig: true, mc: '$1.9M', chg: '+1240%', prog: 100, rep: 5210 },
    { nm: 'Talonhood', tk: 'TLNH', i: 'T', col: '#0B0B0C', badge: 'Migrated', mig: true, mc: '$864K', chg: '+742%', prog: 100, rep: 3140 },
    { nm: 'Nest', tk: 'NEST', i: 'N', col: '#B6E600', badge: 'Migrated', mig: true, mc: '$612K', chg: '+430%', prog: 100, rep: 2088 },
    { nm: 'Aerie', tk: 'AERIE', i: 'A', col: '#0B0B0C', badge: 'Migrated', mig: true, mc: '$1.2M', chg: '+980%', prog: 100, rep: 4402 },
    { nm: 'Glide', tk: 'GLIDE', i: 'G', col: '#CCFF01', badge: 'Migrated', mig: true, mc: '$540K', chg: '+366%', prog: 100, rep: 1770 },
    { nm: 'Updraft', tk: 'UP', i: 'U', col: '#B6E600', badge: 'Migrated', mig: true, mc: '$2.4M', chg: '+1610%', prog: 100, rep: 6021 },
  ],
  'Top on-chain': [
    { nm: 'Updraft', tk: 'UP', i: 'U', col: '#CCFF01', badge: 'Live', mc: '$2.4M', chg: '+1610%', prog: 100, rep: 6021 },
    { nm: 'Quill', tk: 'QUILL', i: 'Q', col: '#0B0B0C', badge: 'Live', mc: '$1.9M', chg: '+1240%', prog: 100, rep: 5210 },
    { nm: 'Aerie', tk: 'AERIE', i: 'A', col: '#B6E600', badge: 'Live', mc: '$1.2M', chg: '+980%', prog: 100, rep: 4402 },
    { nm: 'Talonhood', tk: 'TLNH', i: 'T', col: '#0B0B0C', badge: 'Live', mc: '$864K', chg: '+742%', prog: 100, rep: 3140 },
    { nm: 'Nest', tk: 'NEST', i: 'N', col: '#CCFF01', badge: 'Live', mc: '$612K', chg: '+430%', prog: 100, rep: 2088 },
    { nm: 'Glide', tk: 'GLIDE', i: 'G', col: '#B6E600', badge: 'Live', mc: '$540K', chg: '+366%', prog: 100, rep: 1770 },
  ],
};

const STEPS = [
  { ic: Wallet, n: '01', t: 'Connect', d: 'Link your Robinhood EVM wallet. No sign-up, no gatekeeping — just connect and go.' },
  { ic: Sparks, n: '02', t: 'Create the drop', d: 'Name it, add art, hit launch. Your token is live and tradeable in seconds — no liquidity to seed.' },
  { ic: GraphUp, n: '03', t: 'Trade the curve', d: 'Every buy walks up the bonding curve, every sell walks it down. Price is fair, transparent, on-chain.' },
  { ic: Trophy, n: '04', t: 'Graduate at 9.9 ETH', d: 'Hit the threshold and the token auto-migrates to the DEX with locked liquidity. It has fledged.' },
];

const CURVE_LI = [
  { ic: Coins, t: 'No liquidity to seed', d: 'The curve is the market maker. Launch with nothing and let buyers price it.' },
  { ic: ShieldCheck, t: 'Rug-resistant by design', d: 'Liquidity locks automatically on graduation. No dev-drained pools.' },
  { ic: Flash, t: 'Instant, on Robinhood Chain', d: 'EVM L2 settlement means sub-cent gas and blocks that confirm before you blink.' },
];

const STATS = [
  { v: '31,204', k: 'Tokens fledged' },
  { v: '$182', u: 'M', k: 'Lifetime volume' },
  { v: '9.9', u: ' ETH', k: 'Graduation threshold' },
  { v: '$0.003', k: 'Avg. gas per trade' },
];

const FAQ = [
  { q: 'What is Fledge?', a: 'Fledge is the #1 token launchpad on Robinhood Chain. You create a token in seconds — it trades instantly on a bonding curve, and once it reaches 9.9 ETH of liquidity it automatically graduates to the DEX. No presale, no team allocation, no seeded liquidity.' },
  { q: 'What is a bonding curve?', a: 'A bonding curve is an automated market that prices a token purely from supply. Each purchase moves the price up along the curve and each sale moves it down, so there is always liquidity and always a fair, transparent price — no order book, no market maker needed.' },
  { q: 'What does "graduating at 9.9 ETH" mean?', a: 'When a token accumulates 9.9 ETH of liquidity on its curve, Fledge automatically deploys it to the DEX and locks the liquidity. The token has "fledged" — it now trades on the open market with a protected pool.' },
  { q: 'Why Robinhood Chain and not mainnet?', a: 'Robinhood Chain is an Ethereum EVM L2. You get the same wallets, the same tooling and the same security assumptions as Ethereum, but gas is a fraction of a cent and confirmation is near-instant — which is exactly what a launchpad needs.' },
  { q: 'How does the bridge work?', a: 'Robinhood Chain is an Arbitrum L2, so you move funds with the canonical Ethereum ⇄ Robinhood Chain bridge (or a partner route). Bring ETH, USDC or USDT over from Ethereum and start launching — the Bridge button opens the official portal.' },
  { q: 'What can I pay with?', a: 'Everything settles on Robinhood Chain. You trade and launch with ETH, USDC or USDT held on the Robinhood EVM L2 — the cheapest way to move on the network.' },
];

const ASSETS = ['ETH', 'USDC', 'USDT'];

/* ---------------- sections ---------------- */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const w = useWallet();
  const ui = useUI();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const go = (label) => {
    if (label === 'Create') ui.openCreate();
    else if (label === 'Portfolio') ui.openPortfolio();
    else if (label === 'Docs') window.open(DOCS_URL, '_blank', 'noopener');
    else document.getElementById(label.toLowerCase())?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container nav-inner">
        <a href="#top" aria-label="Fledge home"><Logo /></a>
        <div className="nav-links">
          {NAV.map((l) => <button key={l} className="navlink" onClick={() => go(l)}>{l}</button>)}
        </div>
        <div className="nav-cta">
          {w.address ? (
            <>
              {w.wrongNetwork && (
                <button className="net-warn" onClick={w.ensureChain} title="Switch to Robinhood Chain">
                  <WarningTriangle /> Wrong network
                </button>
              )}
              <button className="wallet-chip" onClick={ui.openPortfolio}>
                <span className="wc-dot" />
                {w.balance != null ? `${Number(w.balance).toFixed(3)} ETH · ` : ''}{shortAddr(w.address)}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" style={{ padding: '11px 20px', fontSize: 15 }} onClick={w.connect} disabled={w.connecting}>
              <Wallet /> {w.connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  const ui = useUI();
  const toBoard = () => document.getElementById('board')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <header className="hero" id="top">
      <div className="hero-grid" />
      <div className="container hero-inner">
        <div className="hero-copy">
          <span className="hero-badge" data-anim><b>★</b> #1 Launchpad on Robinhood Chain</span>
          <h1 className="h-mega" style={{ marginTop: 22 }}>
            <span data-anim style={{ display: 'block' }}>Every launch</span>
            <span data-anim style={{ display: 'block' }}>takes <span className="hl">flight.</span></span>
          </h1>
          <p className="lead" data-anim>
            Create a token in seconds. It trades instantly on a bonding curve and
            graduates to the DEX at <b style={{ color: 'var(--ink)' }}>9.9&nbsp;ETH</b> — all on
            Robinhood’s EVM L2, where gas is a rounding error.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" data-anim onClick={ui.openCreate}><Rocket /> Launch a token</button>
            <button className="btn btn-ghost btn-lg" data-anim onClick={toBoard}><GraphUp /> Explore the board</button>
          </div>
          <div className="hero-chips">
            <span className="pill" data-anim><Cube /> Robinhood EVM L2</span>
            <span className="pill" data-anim><DataTransferBoth /> Ethereum ⇄ L2 bridge</span>
            <span className="pill" data-anim><DollarCircle /> ETH · USDC · USDT</span>
          </div>
        </div>

        <div className="hero-visual" data-anim>
          <div className="token-card tc-main">
            <div className="tc-head">
              <img className="tc-avatar" src={localLogo('QUILL')} onError={(e) => logoFallback(e, 'QUILL')} alt="Quill logo" width={52} height={52} />
              <div>
                <div className="tc-name">Quill</div>
                <div className="tc-ticker">$QUILL · Robinhood Chain</div>
              </div>
            </div>
            <div className="tc-price">
              <span className="big">$0.0184</span>
              <span className="tc-chg">▲ 124%</span>
            </div>
            <div className="tc-progress">
              <div className="bar"><div className="fill" /></div>
              <div className="row"><span>7.3 / 9.9 ETH to graduate</span><span>74%</span></div>
            </div>
          </div>
          <div className="token-card tc-mini tc-a">
            <div className="lbl">Market cap</div>
            <div className="val">$1.9M</div>
          </div>
          <div className="token-card tc-mini tc-b">
            <div className="lbl">Holders</div>
            <div className="val">5,210</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {items.map((t, i) => (
          <span className="ticker-item" key={i}>
            <Spark width={16} height={16} color="#CCFF01" />
            <b>${t.n}</b> <span className="up">{t.c}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Board() {
  const [tab, setTab] = useState(TABS[0]);
  const list = TOKENS[tab];
  const live = useLiveChain();
  return (
    <section className="section" id="board">
      <div className="container">
        <span className="eyebrow" data-anim><span className="dot" /> The board</span>
        <h2 className="h1" style={{ marginTop: 16, maxWidth: '16ch' }} data-anim>
          Watch every drop go live.
        </h2>
        <div className="live-strip" data-anim>
          <span className={`live-dot ${live.ok ? 'on' : ''}`} />
          <b>Robinhood Chain</b>
          <span>·</span>
          <span>{live.block != null ? `block #${live.block.toLocaleString()}` : 'connecting…'}</span>
          <span>·</span>
          <span>gas {live.gwei != null ? `${live.gwei} gwei` : '—'}</span>
          <span className="live-note">live from the public RPC</span>
        </div>
        <div className="board-tabs">
          {TABS.map((t) => (
            <button key={t} className={`board-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} data-anim>
              {t}<span className="n">{TOKENS[t].length}</span>
            </button>
          ))}
        </div>
        <div className="board-grid">
          {list.map((tok) => (
            <article className="tcard" key={tok.tk} data-anim>
              <div className="tcard-top">
                <img className="tcard-av" src={localLogo(tok.tk)} onError={(e) => logoFallback(e, tok.tk)} alt={`${tok.nm} logo`} loading="lazy" width={46} height={46} />
                <div>
                  <div className="tcard-nm">{tok.nm}</div>
                  <div className="tcard-tk">${tok.tk}</div>
                </div>
                <span className={`tcard-badge ${tok.mig ? 'mig' : ''}`}>{tok.badge}</span>
              </div>
              <div className="tcard-stats">
                <div className="tcard-stat">
                  <div className="k">Market cap</div>
                  <div className="v">{tok.mc}</div>
                </div>
                <div className="tcard-stat" style={{ textAlign: 'right' }}>
                  <div className="k">24h</div>
                  <div className="v pos">{tok.chg}</div>
                </div>
              </div>
              <div className="tcard-bar"><div className="tcard-fill" style={{ width: `${tok.prog}%` }} /></div>
              <div className="tcard-mc">
                <span>{tok.prog === 100 ? 'Graduated to DEX' : `${tok.prog}% to 9.9 ETH`}</span>
                <span>{tok.rep} holders</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="section" id="create" style={{ paddingTop: 0 }}>
      <div className="container">
        <span className="eyebrow" data-anim><span className="dot" /> How it works</span>
        <h2 className="h1" style={{ marginTop: 16, maxWidth: '18ch' }} data-anim>
          From idea to on-chain in four moves.
        </h2>
        <div className="steps">
          {STEPS.map((s, i) => {
            const Ic = s.ic;
            return (
              <div className="step" key={s.n} data-anim>
                <div className="step-n">{s.n}</div>
                <div className="step-ic"><Ic /></div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                {i < STEPS.length - 1 && <FastArrowRight className="step-line" width={22} height={22} />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Curve() {
  return (
    <section className="section dark-band">
      <div className="container curve-wrap">
        <div>
          <span className="eyebrow" data-anim><span className="dot" /> The bonding curve</span>
          <h2 className="h1" style={{ marginTop: 16, color: 'var(--paper)' }} data-anim>
            Price discovery,<br />on autopilot.
          </h2>
          <p className="lead" style={{ marginTop: 20 }} data-anim>
            No presale. No seeded pool. The curve is the market — every trade prices
            the token in real time until it graduates.
          </p>
          <div className="curve-list">
            {CURVE_LI.map((c) => {
              const Ic = c.ic;
              return (
                <div className="curve-li" key={c.t} data-anim>
                  <div className="ic"><Ic /></div>
                  <div>
                    <h4>{c.t}</h4>
                    <p>{c.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="curve-box" data-anim>
          <svg className="curve-svg" viewBox="0 0 400 260" fill="none">
            <defs>
              <linearGradient id="cg" x1="0" y1="260" x2="400" y2="0">
                <stop offset="0" stopColor="#B6E600" />
                <stop offset="1" stopColor="#CCFF01" />
              </linearGradient>
              <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(204,255,1,.28)" />
                <stop offset="1" stopColor="rgba(204,255,1,0)" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1="0" y1={52 * i + 4} x2="400" y2={52 * i + 4} stroke="rgba(255,255,255,.07)" />
            ))}
            <path d="M8 250 C 150 244, 250 190, 392 20 L 392 256 L 8 256 Z" fill="url(#cf)" />
            <path d="M8 250 C 150 244, 250 190, 392 20" stroke="url(#cg)" strokeWidth="5" strokeLinecap="round" />
            <circle cx="392" cy="20" r="8" fill="#CCFF01" />
            <circle cx="290" cy="150" r="6" fill="#0B0B0C" stroke="#CCFF01" strokeWidth="3" />
          </svg>
          <div className="curve-stats">
            <div className="cstat"><div className="k">Start price</div><div className="v">$0.0000</div></div>
            <div className="cstat"><div className="k">Graduates at</div><div className="v">9.9 ETH</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bridge() {
  const openBridge = () => window.open(BRIDGE_URL, '_blank', 'noopener');
  return (
    <section className="section" id="bridge">
      <div className="container" style={{ textAlign: 'center' }}>
        <span className="eyebrow" data-anim><span className="dot" /> The bridge</span>
        <h2 className="h1" style={{ marginTop: 16, maxWidth: '20ch', marginInline: 'auto' }} data-anim>
          Ethereum ⇄ Robinhood Chain, in two clicks.
        </h2>
        <p className="lead" data-anim style={{ maxWidth: '52ch', margin: '18px auto 0' }}>
          Robinhood Chain is an Arbitrum L2. Move ETH, USDC and USDT from Ethereum
          through the canonical bridge and start launching with near-zero gas.
        </p>

        <div className="bridge-card" data-anim>
          <div className="bridge-row">
            <div className="bridge-side" style={{ textAlign: 'left' }}>
              <div className="k">From</div>
              <div className="v">1.00 ETH</div>
              <div className="bridge-chain"><Globe width={15} height={15} /> Ethereum</div>
            </div>
            <div className="bridge-token"><Globe color="#0B0B0C" /></div>
          </div>
          <div className="bridge-swap"><DataTransferBoth /></div>
          <div className="bridge-row">
            <div className="bridge-side" style={{ textAlign: 'left' }}>
              <div className="k">To</div>
              <div className="v">1.00 ETH</div>
              <div className="bridge-chain"><Cube width={15} height={15} /> Robinhood Chain</div>
            </div>
            <div className="bridge-token"><Cube color="#0B0B0C" /></div>
          </div>
          <div className="bridge-meta">
            <span>Route <b>Canonical (Arbitrum)</b></span>
            <span>Gas token <b>ETH</b></span>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 22 }} onClick={openBridge}>
            <OpenNewWindow /> Open the official bridge
          </button>
          <div className="bridge-assets">
            {ASSETS.map((a) => <span className="pill" key={a}><Coins /> {a}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="stats-grid">
          {STATS.map((s) => (
            <div className="stat" key={s.k} data-anim>
              <div className="v">{s.v}{s.u && <span className="u">{s.u}</span>}</div>
              <div className="k">{s.k}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <span className="eyebrow" data-anim><span className="dot" /> Why Fledge</span>
        <h2 className="h1" style={{ marginTop: 16, maxWidth: '16ch' }} data-anim>
          Built cheap, fast and fair.
        </h2>
        <div className="bento">
          <div className="bcard wide bcard-ink" data-anim>
            <div className="ic"><EvChargeAlt /></div>
            <h3>Gas that rounds to zero</h3>
            <p>Robinhood Chain is an Ethereum L2, so every launch, buy and sell settles for a fraction of a cent — no more choosing between shipping and affording gas.</p>
            <div className="huge" style={{ marginTop: 26, color: 'var(--lime)' }}>$0.003<span style={{ fontSize: '.42em' }}> / trade</span></div>
          </div>
          <div className="bcard tall bcard-lime" data-anim>
            <div className="ic"><Timer /></div>
            <h3>Live in seconds</h3>
            <p>No liquidity to seed, no forms. Name it, launch it, trade it — the curve does the rest.</p>
          </div>
          <div className="bcard third" data-anim>
            <div className="ic"><Lock /></div>
            <h3>Locked on graduation</h3>
            <p>Liquidity locks automatically at 9.9 ETH. Rug-resistant by design.</p>
          </div>
          <div className="bcard third" data-anim>
            <div className="ic"><DataTransferBoth /></div>
            <h3>Cross-chain</h3>
            <p>Bridge ETH, USDC and USDT between Ethereum and Robinhood Chain.</p>
          </div>
          <div className="bcard third" data-anim>
            <div className="ic"><Community /></div>
            <h3>Every launch is a drop</h3>
            <p>A live board, holder counts and a feed that never sleeps.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section" id="faq" style={{ paddingTop: 0 }}>
      <div className="container">
        <span className="eyebrow" data-anim><span className="dot" /> FAQ</span>
        <h2 className="h1" style={{ marginTop: 16 }} data-anim>Questions, answered.</h2>
        <div className="faq-list">
          {FAQ.map((f, i) => (
            <div className={`faq-item ${open === i ? 'open' : ''}`} key={i} data-anim>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                {f.q}
                <span className="plus"><Plus /></span>
              </button>
              <div className="faq-a" style={{ maxHeight: open === i ? 320 : 0 }}>
                <div className="faq-a-inner">{f.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const ui = useUI();
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="cta-box" data-anim>
          <div className="glow" />
          <h2 className="h-mega" style={{ fontSize: 'clamp(40px, 7vw, 92px)' }}>Give it wings.</h2>
          <p className="lead">Your token is one click from the chain. Launch it on Robinhood Chain and watch it fledge.</p>
          <div className="cta-actions">
            <button className="btn btn-primary btn-lg" onClick={ui.openCreate}><Rocket /> Launch a token</button>
            <a className="btn btn-lg" href={DOCS_URL} target="_blank" rel="noopener" style={{ background: 'transparent', color: 'var(--paper)', border: '1.5px solid rgba(255,255,255,.25)' }}>
              <Book /> Read the docs
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { h: 'Product', links: ['Board', 'Create', 'Bridge', 'Portfolio'] },
    { h: 'Resources', links: ['Docs', 'FAQ', 'Bonding curve', 'Status'] },
    { h: 'Company', links: ['About', 'Brand', 'Careers', 'Terms'] },
  ];
  return (
    <footer>
      <div className="container">
        <div className="foot-top">
          <div className="foot-brand">
            <Logo />
            <p className="lead">The launchpad on Robinhood Chain. Every launch takes flight.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <a className="pill" href="https://x.com" target="_blank" rel="noopener" aria-label="Twitter"><Twitter /></a>
              <a className="pill" href="https://discord.com" target="_blank" rel="noopener" aria-label="Discord"><Discord /></a>
              <a className="pill" href={DOCS_URL} target="_blank" rel="noopener" aria-label="Docs"><Book /></a>
              <a className="pill" href={EXPLORER} target="_blank" rel="noopener" aria-label="Explorer"><Globe /></a>
            </div>
          </div>
          {cols.map((c) => (
            <div className="foot-col" key={c.h}>
              <h5>{c.h}</h5>
              {c.links.map((l) => <a key={l} href="#">{l}</a>)}
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>© 2026 Fledge Labs · Built on Robinhood Chain</span>
          <span>Not financial advice. Every launch is a drop.</span>
        </div>
      </div>
    </footer>
  );
}

function AppInner() {
  const scope = useRef(null);
  useReveal(scope);
  const [modal, setModal] = useState(null); // 'create' | 'portfolio' | null
  const ui = {
    openCreate: () => setModal('create'),
    openPortfolio: () => setModal('portfolio'),
  };
  return (
    <UI.Provider value={ui}>
      <div ref={scope}>
        <Nav />
        <Hero />
        <Ticker />
        <Board />
        <Steps />
        <Curve />
        <Bridge />
        <Stats />
        <Features />
        <Faq />
        <CTA />
        <Footer />
      </div>
      {modal === 'create' && <CreateModal onClose={() => setModal(null)} />}
      {modal === 'portfolio' && <PortfolioModal onClose={() => setModal(null)} />}
    </UI.Provider>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AppInner />
    </WalletProvider>
  );
}
