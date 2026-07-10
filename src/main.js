import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { retargetClipAuto, findBestSkinnedMesh, collectBones, buildBoneMap, captureBindPose, applyBindPose } from './retarget.js';
import { autoRig } from './autorig.js';
import { PACKS, categorize, prettyName } from './packs.js';
import { PROJECTS_HTML } from './projects.js';

// ---------------------------------------------------------------------------
// Configuración de assets: en local se sirven desde /public, en despliegues
// sin binarios se recuperan del repositorio de GitHub.
// ---------------------------------------------------------------------------
const GITHUB_REPO = 'cacereslucianoljc5-cmyk/Ejemplo887jbsn';
const GITHUB_BRANCH = 'claude/lucid-babbage-crvo95';
const ASSET_FALLBACK_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/refs/heads/${GITHUB_BRANCH}/public/`;
let assetBase = '';

const EXAMPLE_MODEL = 'models/example.glb';

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
const state = {
  model: null,          // { root, skin, mixer, uid, name, ownClips: [] }
  skeletonHelper: null,
  currentAction: null,
  currentItemId: null,
  catalog: [],          // { id, source, packLabel, clipName, pretty, category, clip, sourceRoot }
  filterCat: 'Todas',
  filterText: '',
  retargetCache: new Map(),
  modelUid: 0,
  packsReady: false,
};

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
camera.position.set(2.2, 1.6, 3.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.9, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x1a1e2a, 0.7);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 2.2);
dir.position.set(3, 6, 4);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.bias = -0.0004;
scene.add(dir);

let groundGroup = new THREE.Group();
scene.add(groundGroup);
function rebuildGround(size, minY, center) {
  groundGroup.clear();
  const s = Math.max(size * 3, 2);
  const mat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(center.x, minY, center.z);
  plane.receiveShadow = true;
  groundGroup.add(plane);
  const grid = new THREE.GridHelper(s, 30, 0x3a4356, 0x1d2330);
  grid.position.set(center.x, minY + size * 0.0005, center.z);
  groundGroup.add(grid);
  groundGroup.visible = document.getElementById('opt-grid').checked;
}
rebuildGround(2, 0, new THREE.Vector3());

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(viewport);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (state.model?.mixer) state.model.mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------------------
// Cargadores
// ---------------------------------------------------------------------------
const manager = new THREE.LoadingManager();
const loadingBar = document.getElementById('loading-bar');
manager.onProgress = (_, loaded, total) => {
  loadingBar.classList.add('visible');
  loadingBar.style.width = `${Math.round((loaded / Math.max(total, 1)) * 100)}%`;
};
manager.onLoad = () => {
  loadingBar.style.width = '100%';
  setTimeout(() => { loadingBar.classList.remove('visible'); loadingBar.style.width = '0%'; }, 400);
};

const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/basis/').detectSupport(renderer);
const gltfLoader = new GLTFLoader(manager)
  .setDRACOLoader(draco)
  .setKTX2Loader(ktx2)
  .setMeshoptDecoder(MeshoptDecoder);
const fbxLoader = new FBXLoader(manager);

async function resolveAssetBase() {
  try {
    const r = await fetch('anims/meshy_walking.glb', { method: 'HEAD' });
    const type = r.headers.get('content-type') || '';
    if (r.ok && !type.includes('text/html')) { assetBase = ''; return; }
  } catch { /* sin assets locales */ }
  assetBase = ASSET_FALLBACK_BASE;
}

function loadGLTF(url) {
  return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
}
function loadFBX(url) {
  return new Promise((resolve, reject) => fbxLoader.load(url, resolve, undefined, reject));
}

// ---------------------------------------------------------------------------
// UI: estado y avisos
// ---------------------------------------------------------------------------
const statusEl = document.getElementById('status');
const statusDot = document.getElementById('status-dot');
function setStatus(text, busy = false) {
  statusEl.textContent = text;
  statusDot.classList.toggle('busy', busy);
}
let toastTimer = null;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), isError ? 6000 : 3200);
}

// ---------------------------------------------------------------------------
// Catálogo de animaciones
// ---------------------------------------------------------------------------
async function loadPacks() {
  setStatus('Cargando paquete de animaciones…', true);
  let total = 0;
  for (const pack of PACKS) {
    try {
      const gltf = await loadGLTF(assetBase + pack.url);
      const sourceRoot = gltf.scene;
      sourceRoot.updateMatrixWorld(true);
      for (const clip of gltf.animations) {
        if (!clip.tracks.length) continue;
        const pretty = prettyName(clip.name);
        state.catalog.push({
          id: `${pack.id}::${clip.name}`,
          source: 'pack',
          packLabel: pack.label,
          author: pack.author,
          clipName: clip.name,
          pretty,
          category: categorize(pretty),
          clip,
          sourceRoot,
        });
        total++;
      }
    } catch (e) {
      console.error('Error cargando pack', pack.id, e);
      toast(`No se pudo cargar el paquete «${pack.label}»`, true);
    }
  }
  state.packsReady = true;
  document.getElementById('total-badge').textContent = `(${state.catalog.length})`;
  setStatus(`Paquete listo: ${total} animaciones disponibles.`);
  renderCategories();
  renderList();
  updateModelInfo();
  autoPlayDefault(); // si ya había un modelo cargado, arranca solo
}

function visibleItems() {
  const txt = state.filterText.trim().toLowerCase();
  return state.catalog.filter((it) => {
    if (state.filterCat !== 'Todas' && it.category !== state.filterCat) return false;
    if (txt && !it.pretty.toLowerCase().includes(txt) && !it.packLabel.toLowerCase().includes(txt)) return false;
    return true;
  });
}

function renderCategories() {
  const cats = ['Todas', ...new Set(state.catalog.map((i) => i.category))];
  const el = document.getElementById('cats');
  el.innerHTML = '';
  for (const c of cats) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (state.filterCat === c ? ' active' : '');
    const n = c === 'Todas' ? state.catalog.length : state.catalog.filter((i) => i.category === c).length;
    chip.textContent = `${c} · ${n}`;
    chip.onclick = () => { state.filterCat = c; renderCategories(); renderList(); };
    el.appendChild(chip);
  }
}

function renderList() {
  const list = document.getElementById('anim-list');
  const items = visibleItems();
  document.getElementById('anim-count').textContent =
    `${items.length} animación${items.length === 1 ? '' : 'es'}${state.filterCat !== 'Todas' ? ` · ${state.filterCat}` : ''}`;
  list.innerHTML = '';
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'anim-item' + (state.currentItemId === it.id ? ' playing' : '');
    row.innerHTML = `<span class="icon">${state.currentItemId === it.id ? '▶' : '▷'}</span>
      <span class="name" title="${it.pretty}">${it.pretty}</span>
      <span class="src">${it.source === 'own' ? 'modelo' : it.source === 'user' ? 'subida' : it.packLabel.split(' ')[0]}</span>`;
    row.onclick = () => playItem(it);
    list.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------
function disposeModel() {
  if (!state.model) return;
  scene.remove(state.model.root);
  state.model.mixer?.stopAllAction();
  state.model.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].dispose();
        m.dispose();
      }
    }
  });
  if (state.skeletonHelper) { scene.remove(state.skeletonHelper); state.skeletonHelper = null; }
  state.catalog = state.catalog.filter((i) => i.source !== 'own');
  state.retargetCache.clear();
  state.currentAction = null;
  state.currentItemId = null;
  state.model = null;
}

function fitCameraToModel(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  camera.near = Math.max(maxDim / 200, 0.001);
  camera.far = maxDim * 50;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  const dist = maxDim * 1.7;
  camera.position.set(center.x + dist * 0.7, center.y + maxDim * 0.35, center.z + dist);
  controls.update();
  rebuildGround(maxDim, box.min.y, center);
  dir.position.set(center.x + maxDim * 1.5, box.max.y + maxDim * 2, center.z + maxDim * 1.2);
  const d = maxDim * 1.5;
  Object.assign(dir.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 0.1, far: maxDim * 8 });
  dir.target.position.copy(center);
  scene.add(dir.target);
  dir.shadow.camera.updateProjectionMatrix();
}

function registerModel(root, animations, name) {
  disposeModel();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
  });
  scene.add(root);

  let skin = findBestSkinnedMesh(root);
  let autoRigged = false;

  // Sin esqueleto: intentamos generarle uno automáticamente (auto-rigging)
  if (!skin) {
    try {
      setStatus('El modelo no tiene esqueleto: generando huesos y pesos automáticamente…', true);
      const rig = autoRig(root);
      skin = rig.skin;
      autoRigged = true;
      toast(`Esqueleto generado automáticamente: ${rig.boneCount} huesos para ${rig.vertexCount.toLocaleString()} vértices.`);
    } catch (e) {
      console.warn('Auto-rig falló:', e);
    }
  }

  const mixer = new THREE.AnimationMixer(root);
  state.model = {
    root, skin, mixer, name, autoRigged,
    uid: ++state.modelUid,
    ownClips: animations || [],
    bindPose: skin ? captureBindPose(root) : null,
  };

  // clips propios del modelo
  for (const clip of state.model.ownClips) {
    if (!clip.tracks.length) continue;
    const pretty = prettyName(clip.name) || 'Animación del modelo';
    state.catalog.unshift({
      id: `own${state.model.uid}::${clip.name}`,
      source: 'own',
      packLabel: 'Del modelo',
      clipName: clip.name,
      pretty,
      category: 'Del modelo',
      clip,
      sourceRoot: null,
    });
  }

  fitCameraToModel(root);
  applySkeletonToggle();
  renderCategories();
  renderList();
  updateModelInfo();

  if (!skin) {
    toast('No se pudo generar un esqueleto para este modelo (¿es humanoide de pie?). También puedes riggearlo con Meshy y volver a subirlo.', true);
    setStatus('Modelo sin esqueleto: solo visualización.');
  } else {
    setStatus(`Modelo «${name}» listo · ${skin.skeleton.bones.length} huesos${autoRigged ? ' (rig generado automáticamente)' : ''}. Animando…`);
    autoPlayDefault();
  }
}

// Al cargar un modelo, arranca solo con una animación neutra (idle o caminar)
function autoPlayDefault() {
  if (!state.model?.skin || !state.packsReady || state.currentAction) return;
  const candidates = [/^idle loop$/i, /standing idle/i, /^idle$/i, /idle loop/i, /idle/i, /walk loop/i, /walk/i];
  for (const re of candidates) {
    const item = state.catalog.find((i) => i.source === 'pack' && re.test(i.pretty));
    if (item) { playItem(item); return; }
  }
}

function updateModelInfo() {
  const el = document.getElementById('model-info');
  if (!state.model) { el.innerHTML = '<div>Sin modelo cargado.</div>'; return; }
  const { skin, name, root } = state.model;
  const box = new THREE.Box3().setFromObject(root);
  const h = box.getSize(new THREE.Vector3()).y;
  let mappingHtml = '';
  if (skin && state.packsReady) {
    const packItem = state.catalog.find((i) => i.source === 'pack');
    if (packItem) {
      try {
        const { mapped } = buildBoneMap(skin.skeleton.bones, collectBones(packItem.sourceRoot));
        const essentials = ['hips', 'spine', 'head', 'upperarm.L', 'upperarm.R', 'lowerarm.L', 'lowerarm.R',
          'hand.L', 'hand.R', 'upperleg.L', 'upperleg.R', 'lowerleg.L', 'lowerleg.R', 'foot.L', 'foot.R', 'neck'];
        const got = essentials.filter((e) => mapped.includes(e)).length;
        const pct = Math.round((got / essentials.length) * 100);
        mappingHtml = `<div>Huesos mapeados: <b>${mapped.length}</b> (${pct}% esenciales)</div>
          <div id="map-quality"><div style="width:${pct}%"></div></div>`;
      } catch { mappingHtml = '<div>Mapeo: <b>no disponible</b></div>'; }
    }
  }
  el.innerHTML = `
    <div><b>${name}</b></div>
    <div>Esqueleto: <b>${skin ? `${skin.skeleton.bones.length} huesos${state.model.autoRigged ? ' · auto-rig ✨' : ''}` : 'no tiene ✗'}</b></div>
    <div>Altura: <b>${h.toFixed(2)} u</b></div>
    ${mappingHtml}`;
}

// ---------------------------------------------------------------------------
// Reproducción con retargeting
// ---------------------------------------------------------------------------
function playItem(item, fromDemo = false) {
  if (!fromDemo) setDemo(false); // una elección manual apaga la demo automática
  if (!state.model) { toast('Primero carga un modelo (o usa el ejemplo).'); return; }
  const { skin, mixer } = state.model;

  let clip = null;
  if (item.source === 'own') {
    clip = item.clip;
  } else {
    if (!skin) { toast('El modelo no tiene esqueleto: no se pueden aplicar animaciones.', true); return; }
    const inPlace = document.getElementById('opt-inplace').checked;
    const useOffsets = document.getElementById('opt-offsets').checked;
    const key = `${state.model.uid}|${item.id}|${inPlace ? 1 : 0}|${useOffsets ? 1 : 0}`;
    clip = state.retargetCache.get(key);
    if (!clip) {
      try {
        setStatus(`Retargeteando «${item.pretty}»…`, true);
        const t0 = performance.now();
        const res = retargetClipAuto(skin, item.sourceRoot, item.clip, { inPlace, useOffsets, bindPose: state.model.bindPose });
        clip = res.clip;
        state.retargetCache.set(key, clip);
        setStatus(`«${item.pretty}» retargeteada en ${Math.round(performance.now() - t0)} ms · ${res.mappedCount} huesos mapeados.`);
      } catch (e) {
        console.error(e);
        toast(`No se pudo retargetear: ${e.message}`, true);
        setStatus('Error de retargeting.');
        return;
      }
    } else {
      setStatus(`Reproduciendo «${item.pretty}».`);
    }
  }

  const prev = state.currentAction;
  const action = mixer.clipAction(clip);
  action.reset();
  action.loop = document.getElementById('opt-loop').checked ? THREE.LoopRepeat : THREE.LoopOnce;
  action.clampWhenFinished = true;
  if (prev && prev !== action) {
    prev.fadeOut(0.25);
    action.fadeIn(0.25);
  }
  action.play();
  state.currentAction = action;
  state.currentItemId = item.id;
  renderList();
}

// Demo automática: rota animaciones del paquete cada pocos segundos
let demoTimer = null;
function setDemo(on) {
  if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  document.getElementById('btn-demo').classList.toggle('primary', on);
  if (!on) return;
  const next = () => {
    if (!state.model?.skin) return;
    const items = state.catalog.filter((i) => i.source === 'pack');
    if (items.length) playItem(items[Math.floor(Math.random() * items.length)], true);
  };
  next();
  demoTimer = setInterval(next, 5000);
}

function stopAll() {
  setDemo(false);
  if (state.currentAction) state.currentAction.fadeOut(0.2);
  setTimeout(() => {
    state.model?.mixer.stopAllAction();
    if (state.model?.bindPose) applyBindPose(state.model.bindPose);
  }, 220);
  state.currentAction = null;
  state.currentItemId = null;
  renderList();
  setStatus('Detenido.');
}

// ---------------------------------------------------------------------------
// Carga de archivos del usuario
// ---------------------------------------------------------------------------
async function handleFiles(files) {
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(file);
    try {
      setStatus(`Cargando ${file.name}…`, true);
      let root, animations;
      if (ext === 'fbx') {
        const obj = await loadFBX(url);
        root = obj; animations = obj.animations || [];
      } else if (ext === 'glb' || ext === 'gltf') {
        const gltf = await loadGLTF(url);
        root = gltf.scene; animations = gltf.animations || [];
      } else {
        toast(`Formato no soportado: .${ext}`, true);
        continue;
      }

      const skin = findBestSkinnedMesh(root);
      if (skin || !animations.length) {
        registerModel(root, animations, file.name);
        toast(`Modelo «${file.name}» cargado${animations.length ? ` con ${animations.length} animación(es) propia(s)` : ''}.`);
      } else {
        // armadura con animaciones y sin malla -> paquete de animaciones del usuario
        root.updateMatrixWorld(true);
        let added = 0;
        for (const clip of animations) {
          if (!clip.tracks.length) continue;
          const pretty = `${prettyName(clip.name)} (${file.name})`;
          state.catalog.unshift({
            id: `user::${file.name}::${clip.name}::${Date.now()}`,
            source: 'user',
            packLabel: 'Subida',
            clipName: clip.name,
            pretty,
            category: 'Subidas',
            clip,
            sourceRoot: root,
          });
          added++;
        }
        renderCategories();
        renderList();
        toast(`${added} animación(es) de «${file.name}» añadidas al catálogo.`);
        setStatus(`${added} animaciones nuevas listas para aplicar.`);
      }
    } catch (e) {
      console.error(e);
      toast(`Error cargando ${file.name}: ${e.message}`, true);
      setStatus('Error de carga.');
    } finally {
      // no revocamos inmediatamente: GLTFLoader puede seguir leyendo recursos
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }
}

// ---------------------------------------------------------------------------
// Toggles de vista
// ---------------------------------------------------------------------------
function applySkeletonToggle() {
  const on = document.getElementById('opt-skeleton').checked;
  if (state.skeletonHelper) { scene.remove(state.skeletonHelper); state.skeletonHelper = null; }
  if (on && state.model?.skin) {
    const helper = new THREE.SkeletonHelper(state.model.root);
    helper.material.depthTest = false;
    helper.renderOrder = 10;
    scene.add(helper);
    state.skeletonHelper = helper;
  }
}

// ---------------------------------------------------------------------------
// Wiring de la UI
// ---------------------------------------------------------------------------
document.getElementById('btn-example').onclick = async () => {
  try {
    setStatus('Cargando modelo de ejemplo (generado y rigueado con Meshy AI)…', true);
    const gltf = await loadGLTF(assetBase + EXAMPLE_MODEL);
    registerModel(gltf.scene, gltf.animations, 'Aventurero Meshy (ejemplo)');
  } catch (e) {
    console.error(e);
    toast(`No se pudo cargar el ejemplo: ${e.message}`, true);
  }
};
document.getElementById('btn-upload').onclick = () => document.getElementById('file-input').click();
document.getElementById('btn-upload-top').onclick = () => document.getElementById('file-input').click();
document.getElementById('mobile-left-toggle').onclick = () =>
  document.getElementById('left').classList.toggle('open');
document.getElementById('file-input').onchange = (e) => {
  document.getElementById('left').classList.remove('open'); // cerrar panel móvil al elegir archivo
  handleFiles([...e.target.files]);
};
document.getElementById('dropzone').onclick = (e) => {
  if (e.target.tagName !== 'BUTTON') document.getElementById('file-input').click();
};

const dropOverlay = document.getElementById('drop-overlay');
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; dropOverlay.classList.add('visible'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; dropOverlay.classList.remove('visible'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.remove('visible');
  if (e.dataTransfer?.files?.length) handleFiles([...e.dataTransfer.files]);
});

document.getElementById('search').oninput = (e) => { state.filterText = e.target.value; renderList(); };
document.getElementById('btn-random').onclick = () => {
  const items = visibleItems().filter((i) => i.source !== 'own' ? true : true);
  if (!items.length) return;
  playItem(items[Math.floor(Math.random() * items.length)]);
};
document.getElementById('btn-stop').onclick = stopAll;
document.getElementById('btn-demo').onclick = () => setDemo(!demoTimer);

const speedEl = document.getElementById('speed');
speedEl.oninput = () => {
  const v = parseFloat(speedEl.value);
  document.getElementById('speed-val').textContent = `${v.toFixed(1)}×`;
  if (state.model?.mixer) state.model.mixer.timeScale = v;
};
document.getElementById('opt-loop').onchange = () => {
  if (state.currentAction) {
    state.currentAction.loop = document.getElementById('opt-loop').checked ? THREE.LoopRepeat : THREE.LoopOnce;
  }
};
document.getElementById('opt-inplace').onchange = () => replayCurrent();
document.getElementById('opt-offsets').onchange = () => replayCurrent();
function replayCurrent() {
  if (!state.currentItemId) return;
  const item = state.catalog.find((i) => i.id === state.currentItemId);
  if (item) playItem(item);
}
document.getElementById('opt-skeleton').onchange = applySkeletonToggle;
document.getElementById('opt-autorotate').onchange = (e) => { controls.autoRotate = e.target.checked; controls.autoRotateSpeed = 1.5; };
document.getElementById('opt-grid').onchange = (e) => { groundGroup.visible = e.target.checked; };

const dialog = document.getElementById('projects-dialog');
document.getElementById('btn-projects').onclick = () => {
  document.getElementById('projects-body').innerHTML = PROJECTS_HTML;
  dialog.showModal();
};
document.getElementById('btn-close-dialog').onclick = () => dialog.close();
document.getElementById('btn-github').href = `https://github.com/${GITHUB_REPO}`;

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
// hook de depuración/integración (usado por scripts/e2e.mjs)
window.__anima = { state, THREE, scene };

(async function boot() {
  setStatus('Preparando assets…', true);
  await resolveAssetBase();
  await loadPacks();
  document.getElementById('btn-example').click();
})();
