// Valida el pipeline BVH -> retarget con archivos BVH reales de CMU cargados
// localmente (misma ruta de código que usa la biblioteca CMU, sin la descarga).
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const SC = process.env.BVH_DIR || '/tmp/cmu-bvh';
const FILES = [`${SC}/02_01.bvh`, `${SC}/05_01.bvh`];

if (!FILES.every(existsSync)) {
  console.log(`Saltado: faltan BVH de prueba en ${SC}.`);
  console.log('Descárgalos con, p.ej.:');
  console.log(`  mkdir -p ${SC} && for f in 002/02_01 005/05_01; do curl -sSo ${SC}/$(basename $f).bvh \\`);
  console.log('    https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/$f.bvh; done');
  process.exit(0);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('.anim-item.playing'), { timeout: 90000 });
console.log('APP LISTA:', (await page.textContent('#status')).trim());

// carga los BVH reales de CMU por el mismo camino que un drag-drop del usuario
await page.setInputFiles('#file-input', FILES);
await page.waitForFunction(
  () => window.__anima?.state?.catalog?.some((i) => i.source === 'user'),
  { timeout: 30000 },
);
const userCount = await page.evaluate(() =>
  window.__anima.state.catalog.filter((i) => i.source === 'user').length);
console.log('BVH CARGADOS (fuente "user"):', userCount);

// reproduce cada BVH y comprueba que retargetea y que hay movimiento real
for (const name of ['02_01', '05_01']) {
  await page.fill('#search', name);
  await page.waitForTimeout(300);
  const row = page.locator('.anim-item').first();
  await row.click();
  await page.waitForFunction(
    () => /retargeteada|Reproduciendo/i.test(document.querySelector('#status').textContent),
    { timeout: 30000 },
  );
  const st = (await page.textContent('#status')).trim();

  // muestrea un quaternion de hueso en dos instantes -> debe cambiar
  const q1 = await page.evaluate(() => {
    const s = window.__anima.state.model.skin.skeleton.bones;
    return s.slice(0, 6).map((b) => b.quaternion.toArray()).flat();
  });
  await page.waitForTimeout(700);
  const q2 = await page.evaluate(() => {
    const s = window.__anima.state.model.skin.skeleton.bones;
    return s.slice(0, 6).map((b) => b.quaternion.toArray()).flat();
  });
  const moved = q1.some((v, i) => Math.abs(v - q2[i]) > 1e-4);
  console.log(`CMU ${name} -> ${st} | huesos en movimiento: ${moved}`);
}

console.log('\nERRORES DE CONSOLA:', errors.length ? errors.slice(0, 8) : 'ninguno');
await browser.close();
