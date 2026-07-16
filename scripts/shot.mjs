import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4188/';
const out = process.argv[3] || 'docs/landing-full.png';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(1800);
// scroll through to trigger GSAP reveals so nothing is left hidden in the shot
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
const H = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < H; y += 420) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y);
  await p.waitForTimeout(140);
}
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(700);
await p.screenshot({ path: out, fullPage: true });
console.log('saved', out);
await b.close();
