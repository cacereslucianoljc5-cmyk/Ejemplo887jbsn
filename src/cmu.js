// -----------------------------------------------------------------------------
// CMU Graphics Lab Motion Capture Database — la biblioteca de mocap gratuita más
// grande que existe: 2548 movimientos capturados por la Carnegie Mellon University.
//
// CMU la publica «free for all uses» (investigación y comercial). Aquí se usa la
// conversión BVH de Bruce Hahne (cgspeed), reflejada en GitHub por
// una-dinosauria/cmu-mocap. Se transmite bajo demanda (un BVH por clip) para no
// inflar el repositorio: raw.githubusercontent.com sirve con CORS abierto, así
// que el navegador puede descargar cada animación en el momento de aplicarla.
//
// Estructura del mirror:  data/<sujeto 3 díg>/<sujeto 2 díg>_<toma>.bvh
//   p.ej. el clip "02_03"  ->  data/002/02_03.bvh
// -----------------------------------------------------------------------------
import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { captureBindPose } from './retarget.js';

// Espejos del dataset (mismo contenido). raw.githubusercontent va primero por CORS
// abierto y fiabilidad; jsDelivr (CDN) queda de reserva si GitHub falla.
const MIRRORS = [
  'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/',
  'https://cdn.jsdelivr.net/gh/una-dinosauria/cmu-mocap@master/',
];
const INDEX_PATH = 'cmu-mocap-index-text.txt';

const bvhLoader = new BVHLoader();
const clipCache = new Map(); // clipId -> { root, clip }

function pad(n, width) {
  return String(n).padStart(width, '0');
}

// Ruta relativa del BVH para un id de clip tipo "02_03" o "143_21"
function cmuBvhPath(clipId) {
  const subject = parseInt(clipId.split('_')[0], 10);
  return `data/${pad(subject, 3)}/${clipId}.bvh`;
}

// URL cruda del BVH (primer espejo) — útil para depuración
export function cmuBvhUrl(clipId) {
  return MIRRORS[0] + cmuBvhPath(clipId);
}

// Descarga una ruta relativa probando cada espejo hasta que uno responda
async function fetchFromMirrors(relPath) {
  let lastErr;
  for (const base of MIRRORS) {
    try {
      const res = await fetch(base + relPath);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('sin espejos disponibles');
}

// Convierte el texto del índice oficial en una lista de movimientos.
// Formato:
//   Subject #2 (various expressions and human behaviors)
//   02_01\twalk
export function parseCmuIndex(text) {
  const out = [];
  let subject = 0;
  let subjectDesc = '';
  const subjRe = /^Subject #(\d+)\s*\(([^)]*)\)/;
  const clipRe = /^(\d+_\d+)\s+(.*\S)?/;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/“|”/g, '"').trim();
    if (!line) continue;
    let m = line.match(subjRe);
    if (m) {
      subject = parseInt(m[1], 10);
      subjectDesc = m[2].trim();
      continue;
    }
    m = raw.match(clipRe);
    if (m) {
      const id = m[1];
      let desc = (m[2] || '').trim();
      if (!desc || /^unknown$/i.test(desc)) desc = subjectDesc || 'movimiento';
      out.push({ id, subject, subjectDesc, desc });
    }
  }
  return out;
}

// Descarga y analiza el índice completo (2548 movimientos aprox.)
export async function fetchCmuIndex() {
  const res = await fetchFromMirrors(INDEX_PATH);
  return parseCmuIndex(await res.text());
}

// Descarga un BVH y lo envuelve en una raíz utilizable por retargetClipAuto.
// Devuelve { root, clip } (cacheado por clip).
export async function loadCmuClip(clipId) {
  if (clipCache.has(clipId)) return clipCache.get(clipId);
  const res = await fetchFromMirrors(cmuBvhPath(clipId));
  const text = await res.text();
  const { skeleton, clip } = bvhLoader.parse(text);

  const root = new THREE.Group();
  root.name = 'CMU_' + clipId;
  root.add(skeleton.bones[0]);
  root.updateMatrixWorld(true);
  // pose de reposo (el BVH queda en su T-pose tras parsear) para poder reutilizar
  // el mismo origen en varios modelos sin arrastrar el último fotograma
  root.userData.restPose = captureBindPose(root);
  clip.name = clipId;

  const entry = { root, clip };
  clipCache.set(clipId, entry);
  return entry;
}
