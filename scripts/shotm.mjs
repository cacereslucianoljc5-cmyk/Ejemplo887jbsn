import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:4188/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(1500);
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
const H = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < H; y += 380) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(120); }
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(600);
await p.screenshot({ path: 'docs/landing-mobile.png', fullPage: true });
console.log('ok');
await b.close();
