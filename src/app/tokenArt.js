// Deterministic token logos. Primary source is the committed PNG in
// public/tokens/<TICKER>.png; if that isn't present in a given deploy, the
// <img> onError falls back to Pollinations.ai with the SAME prompt + seed the
// PNGs were generated from (scripts/gen-token-logos.sh), so the logo is
// visually identical either way — free, no API key (same engine AgentHood uses).

const STYLE =
  'flat vector mascot emblem logo, bold thick black outlines, bright acid lime green and black, solid off-white background, centered, minimalist sticker, no text, no letters, high contrast, crypto coin logo';

// ticker -> [seed, subject]  (mirrors gen-token-logos.sh)
const SUBJECTS = {
  PERCH: [11, 'a robin bird perched on a small branch'],
  FLDG: [12, 'a cute fluffy baby bird chick hatching'],
  LARK: [13, 'a skylark songbird singing with music notes'],
  QUIV: [14, 'a quiver full of arrows, robin hood style'],
  TALON: [15, 'a sharp eagle talon claw grabbing'],
  DOWN: [16, 'a soft fluffy down feather'],
  WREN: [17, 'a tiny round wren bird'],
  ROOST: [18, 'a bird roosting on a perch at night with a moon'],
  PLUME: [19, 'an elegant curved feather plume'],
  SWIFT: [20, 'a fast swift bird diving in flight, motion lines'],
  KSTR: [21, 'a fierce kestrel falcon head'],
  FTHR: [22, 'a single detailed feather'],
  QUILL: [23, 'a quill pen feather with an ink drop'],
  TLNH: [24, 'an eagle wearing a small robin hood hat'],
  NEST: [25, 'a cozy bird nest with three eggs'],
  AERIE: [26, 'a majestic eagle nest high on a cliff'],
  GLIDE: [27, 'a bird gliding with wings spread wide'],
  UP: [28, 'an upward rocket made of feathers launching, arrow up'],
};

export function localLogo(ticker) {
  return `${import.meta.env.BASE_URL}tokens/${ticker}.png`;
}

export function remoteLogo(ticker) {
  const e = SUBJECTS[ticker];
  if (!e) return localLogo(ticker);
  const prompt = `${e[1]}, ${STYLE}`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=256&height=256&seed=${e[0]}&nologo=true&model=flux&referrer=fledge`;
}

// onError handler: swap to the Pollinations fallback exactly once.
export function logoFallback(e, ticker) {
  const el = e.currentTarget;
  if (el.dataset.fb) return;
  el.dataset.fb = '1';
  el.src = remoteLogo(ticker);
}
