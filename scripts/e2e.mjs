// Prueba E2E: carga la app, espera el ejemplo, aplica animaciones de cada pack
// y comprueba que los huesos se mueven de verdad.
import { chromium } from 'playwright';

const SHOTS = '/tmp/claude-0/-home-user/ccf2a8f1-2401-5a5f-8b78-b041bf288819/scratchpad/shots';
import { mkdirSync } from 'node:fs';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });

// espera a que carguen los packs y el modelo de ejemplo
await page.waitForFunction(() => {
  const s = document.getElementById('status')?.textContent || '';
  return /Modelo .* listo/.test(s);
}, { timeout: 90000 });

const status0 = await page.textContent('#status');
console.log('STATUS tras carga:', status0);
console.log('MODEL INFO:', (await page.textContent('#model-info')).replace(/\s+/g, ' '));
const totalBadge = await page.textContent('#total-badge');
console.log('TOTAL ANIMS:', totalBadge);

await page.screenshot({ path: SHOTS + '/01-loaded.png' });

// utilidades para muestrear el movimiento de un hueso
async function samplePose() {
  return page.evaluate(() => {
    // busca el primer SkinnedMesh de la escena a través del canvas three
    const objs = [];
    // truco: three no expone la escena; muestreamos píxeles no — en su lugar
    // guardamos quaternions vía window.__scene si existe
    return null;
  });
}

// reproduce N animaciones distintas haciendo clic en la lista
async function playByName(name) {
  await page.fill('#search', name);
  await page.waitForTimeout(300);
  const count = await page.locator('.anim-item').count();
  if (!count) { console.log(`PLAY [${name}] -> SIN RESULTADOS`); return null; }
  const first = page.locator('.anim-item').first();
  const label = await first.locator('.name').textContent();
  await first.click();
  await page.waitForTimeout(2500);
  const st = await page.textContent('#status');
  console.log(`PLAY [${name}] ->`, label, '| status:', st.trim());
  return label;
}

await playByName('Walk Loop');           // UAL
await page.screenshot({ path: SHOTS + '/02-walk.png' });
await playByName('Sword');               // Mesh2Motion / UAL
await page.screenshot({ path: SHOTS + '/03-attack.png' });
await playByName('Dance');
await page.screenshot({ path: SHOTS + '/04-dance.png' });
await playByName('2H Melee Attack Spin'); // KayKit
await page.screenshot({ path: SHOTS + '/05-kaykit.png' });
await playByName('clip0');               // clip propio del modelo (Meshy)

// comprueba que el canvas cambia entre frames (hay movimiento)
await page.fill('#search', 'Run');
await page.waitForTimeout(200);
await page.locator('.anim-item').first().click();
await page.waitForTimeout(800);
const shot1 = await page.locator('#viewport canvas').screenshot();
await page.waitForTimeout(600);
const shot2 = await page.locator('#viewport canvas').screenshot();
const diff = Buffer.compare(shot1, shot2) !== 0;
console.log('CANVAS CAMBIA ENTRE FRAMES (animación viva):', diff);

// esqueleto visible
await page.check('#opt-skeleton');
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '/06-skeleton.png' });

// categorías
const chips = await page.locator('.chip').allTextContents();
console.log('CATEGORIAS:', chips.join(' | '));

console.log('\nERRORES DE CONSOLA:', errors.length ? errors.slice(0, 10) : 'ninguno');
await browser.close();
