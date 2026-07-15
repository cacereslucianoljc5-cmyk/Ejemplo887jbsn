# ▲ Fledge — the launchpad on Robinhood Chain

**Every launch takes flight.**

Fledge is a landing page for a token launchpad built on **Robinhood Chain**
(an Ethereum EVM L2). Create a token in seconds — it trades instantly on a
**bonding curve** and automatically **graduates to the DEX at 9.9 ETH**, with a
built-in **bridge between Robinhood EVM L2 and Solana**.

This repo contains the marketing **landing page** (design + copy + motion).
The app/utility (board, create, bridge, portfolio) is a separate phase.

## Stack

- **Vite + React** (`src/app/`)
- **GSAP** (ScrollTrigger) — entry animations, element by element, on every section
- **Iconoir** — line-icon set (deliberately uncommon)
- Hand-written CSS design system (`src/app/index.css`)

## Design

- Palette **70 / 20 / 10** → 70% paper white · 20% ink (near-black) · 10% acid
  lime `#CCFF01` — the single accent. White background, lots of lime, ink for
  contrast panels. Uncommon for crypto landings on purpose.
- Type: **Clash Display** (display), **General Sans** (UI), **Space Mono**
  (numbers). Large, high-visibility scale throughout.

## Sections

Nav · Hero · live ticker · **Board** (New drops / Trending / Migrated / Top
on-chain) · How it works · **Bonding curve** · **Bridge** (Robinhood L2 ⇄
Solana) · Stats · Features (bento) · FAQ · CTA · Footer.

## Develop

```bash
npm install
npm run dev      # local dev
npm run build    # production build → dist/
npm run preview  # preview the build
```

Screenshots of the current build live in `docs/landing-full.png` and
`docs/landing-mobile.png`.
