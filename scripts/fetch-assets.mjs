// Descarga los assets binarios (modelo de ejemplo + paquetes de animaciones)
// desde el repositorio de GitHub cuando no están presentes en el working tree.
// Se usa en el build de Vercel, donde solo se sube el código fuente.
import { mkdir, access, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BASE = process.env.ASSET_BASE ||
  'https://raw.githubusercontent.com/cacereslucianoljc5-cmyk/Ejemplo887jbsn/refs/heads/claude/lucid-babbage-crvo95/public/';

const FILES = [
  'models/example.glb',
  'anims/human-base-animations.glb',
  'anims/human-addon-animations.glb',
  'anims/AnimationLibrary_Godot_Standard.gltf',
  'anims/AnimationLibrary_Godot_Standard.bin',
  'anims/kaykit_knight.glb',
  'anims/meshy_walking.glb',
  'anims/meshy_running.glb',
];

const root = new URL('..', import.meta.url).pathname;

for (const rel of FILES) {
  const dest = join(root, 'public', rel);
  try {
    await access(dest);
    console.log(`[assets] ok (local): ${rel}`);
    continue;
  } catch { /* falta: descargar */ }
  const url = BASE + rel;
  console.log(`[assets] descargando ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[assets] ERROR ${res.status} al descargar ${url}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  console.log(`[assets] guardado ${rel} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}
console.log('[assets] todos los assets listos');
