// Retargeting automático de animaciones entre esqueletos humanoides arbitrarios.
// 1) Mapea huesos por nombre (Mixamo, Ready Player Me, Rigify/UAL, KayKit, UE, VRoid, genéricos)
// 2) Rellena huesos esenciales sin mapear mediante inferencia geométrica de la jerarquía
// 3) Retargetea con SkeletonUtils.retargetClip + offsets de pose de reposo calculados automáticamente

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ---------------------------------------------------------------------------
// Huesos canónicos y sinónimos (núcleo del nombre, ya sin lado ni prefijos)
// ---------------------------------------------------------------------------

const SYNONYMS = {
  hips: ['hips', 'hip', 'pelvis', 'cog'],
  spine: [], // la cadena de columna se resuelve aparte (spine/chest/upperchest)
  neck: ['neck', 'neck1', 'neck2'],
  head: ['head', 'head1'],
  shoulder: ['shoulder', 'clavicle', 'collar', 'collarbone', 'scapula'],
  upperarm: ['upperarm', 'arm', 'uparm', 'bicep', 'upperarm1'],
  lowerarm: ['lowerarm', 'forearm', 'forearm1', 'elbow'],
  hand: ['hand', 'wrist', 'palm'],
  upperleg: ['upperleg', 'upleg', 'thigh', 'hipjoint'],
  lowerleg: ['lowerleg', 'calf', 'shin', 'knee', 'leg1'],
  foot: ['foot', 'ankle'],
  toes: ['toes', 'toe', 'toebase', 'ball', 'toe0', 'toe1'],
};

const SPINE_WORDS = ['spine', 'spine1', 'spine2', 'spine3', 'spine4', 'chest', 'upperchest', 'torso', 'waist', 'abdomen', 'stomach', 'ribcage'];
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const SKIP_RE = /(^|[^a-z])(ik|ctrl|control|pole|target|twist|roll|helper|attach|slot|weapon|prop|end|tip|top|null|offset|aim|look|eye|jaw|tongue|breast|ear|hair|cloth|skirt|tail|wing|pin\d*|lips?|teeth|tooth|jiggle|phys\d*|forward|trigger)([^a-z]|$)/;

// Normaliza y separa el lado (L/R) del nombre de un hueso
export function parseBoneName(rawName) {
  let n = rawName;
  // quita espacios de nombre tipo "mixamorig:Hips", "Armature|Hips"
  n = n.substring(n.lastIndexOf(':') + 1);
  n = n.substring(n.lastIndexOf('|') + 1);
  // prefijos comunes de rigs (Mixamo, Rigify, Character Creator, ValveBiped/Source, VRoid…)
  n = n.replace(/^(valvebiped\.?bip\d*[_.]?|mixamorig|def[-_.]?|cc_base_|bip\d*[-_.]?|b[-_]|j_bip_[a-z]_|hu_)/i, '');

  let side = '';
  const tests = [
    [/(^|[\s_\-.])left([\s_\-.]|$)|^left(?=[A-Z_\-.\s]|[a-z])/i, 'L', /left/i],
    [/(^|[\s_\-.])right([\s_\-.]|$)|^right(?=[A-Z_\-.\s]|[a-z])/i, 'R', /right/i],
  ];
  for (const [re, s, rm] of tests) {
    if (re.test(n)) { side = s; n = n.replace(rm, ''); break; }
  }
  if (!side) {
    // sufijos/prefijos de una letra: .l _L l_  etc.
    let m = n.match(/[\s_\-.]([lr])[\s_\-.]?(\d*)$/i) || n.match(/^([lr])[\s_\-.]/i);
    if (m) {
      side = m[1].toUpperCase();
      n = n.replace(m[0], m[0].replace(/[lr]/i, ''));
    }
  }
  // núcleo: minúsculas, sin separadores, ceros a la izquierda fuera (spine01 -> spine1)
  let core = n.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/0+(\d)/g, '$1');
  return { core, side };
}

function fingerSlot(core, side) {
  // p.ej. "handthumb1", "fthumb1", "thumb1", "findex2"
  let c = core.replace(/^hand/, '').replace(/^f(?=(thumb|index|middle|ring|pinky|little))/, '');
  c = c.replace(/^little/, 'pinky');
  for (const f of FINGERS) {
    if (c.startsWith(f)) {
      const num = c.slice(f.length).match(/^(\d)/);
      if (num) {
        const i = parseInt(num[1], 10);
        if (i >= 1 && i <= 3 && side) return `${f}${i}.${side}`;
      }
    }
  }
  return null;
}

// Asigna cada hueso de la lista a un slot canónico. Devuelve Map<slot, bone>.
export function slotBones(bones) {
  const slots = new Map();
  const info = bones.map((b) => ({ bone: b, ...parseBoneName(b.name), depth: boneDepth(b) }));

  const put = (slot, entry) => {
    const prev = slots.get(slot);
    if (!prev || entry.depth < prev.depth) slots.set(slot, entry);
  };

  const spines = [];
  const SIDED = ['upperarm', 'lowerarm', 'hand', 'shoulder', 'upperleg', 'lowerleg', 'foot', 'toes'];

  const tryMatch = (core, side, e) => {
    if (!core || core === 'root' || core === 'armature' || core === 'rootnode') return true; // consumido, sin slot
    if (SKIP_RE.test(' ' + core + ' ') && !/^(toe|toes|toebase)$/.test(core)) return true;

    const finger = fingerSlot(core, side);
    if (finger) { put(finger, e); return true; }

    if (SPINE_WORDS.includes(core)) { spines.push(e); return true; }

    // "leg" simple es ambiguo: Mixamo usa Leg=pantorrilla (existe UpLeg); otros rigs Leg=muslo
    let synonymCore = core;
    let forcedSlot = null;
    if (core === 'leg') {
      const hasUp = info.some((o) => o.side === side && ['upleg', 'upperleg', 'thigh'].includes(o.core));
      forcedSlot = hasUp ? 'lowerleg' : 'upperleg';
    }

    for (const [slot, words] of Object.entries(SYNONYMS)) {
      if (forcedSlot ? slot !== forcedSlot : !words.includes(synonymCore)) continue;
      const finalSlot = slot;
      if (SIDED.includes(finalSlot)) {
        let s = side;
        if (!s) {
          // sin lado detectable: intenta por posición X mundial
          const x = worldX(e.bone);
          if (Math.abs(x) < 1e-6) return false;
          s = x > 0 ? 'L' : 'R';
        }
        put(`${finalSlot}.${s}`, e);
      } else {
        put(finalSlot, e);
      }
      return true;
    }
    return false;
  };

  for (const e of info) {
    if (tryMatch(e.core, e.side, e)) continue;
    // GLTFLoader elimina los puntos de los nombres ("upperarm.l" -> "upperarml"):
    // reintenta interpretando una l/r final pegada como lado
    if (!e.side && /[lr]$/.test(e.core)) {
      const side = e.core.slice(-1).toUpperCase();
      if (tryMatch(e.core.slice(0, -1), side, e)) continue;
    }
  }

  // Cadena de columna por profundidad: 1->spine, 2->spine+chest, 3+->spine/chest/upperchest
  spines.sort((a, b) => a.depth - b.depth);
  if (spines.length === 1) put('spine', spines[0]);
  else if (spines.length === 2) { put('spine', spines[0]); put('chest', spines[1]); }
  else if (spines.length >= 3) {
    put('spine', spines[0]);
    put('chest', spines[Math.floor(spines.length / 2)]);
    put('upperchest', spines[spines.length - 1]);
  }

  const out = new Map();
  for (const [slot, e] of slots) out.set(slot, e.bone);
  return out;
}

function boneDepth(b) {
  let d = 0, p = b.parent;
  while (p) { d++; p = p.parent; }
  return d;
}
function worldX(b) {
  return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).x;
}
function worldPos(b) {
  return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
}

// ---------------------------------------------------------------------------
// Inferencia geométrica para esqueletos con nombres no reconocibles
// ---------------------------------------------------------------------------

function chainDown(bone, filter) {
  // cadena descendente siguiendo siempre el primer hijo que sea hueso válido
  const chain = [];
  let cur = bone;
  while (cur) {
    chain.push(cur);
    const kids = cur.children.filter(filter);
    cur = kids.length === 1 ? kids[0] : null;
  }
  return chain;
}

export function inferSkeleton(bones, slots) {
  const isB = (o) => bones.includes(o);
  if (!slots.get('hips')) {
    // cadera: primer hueso (menor profundidad) con >=2 sub-cadenas que bajan y una que sube
    let best = null;
    for (const b of bones) {
      const kids = b.children.filter(isB);
      if (kids.length < 2) continue;
      const y = worldPos(b).y;
      const down = kids.filter((k) => worldPos(k).y < y - 1e-6);
      const up = kids.filter((k) => worldPos(k).y >= y - 1e-6);
      if (down.length >= 2 && (up.length >= 1 || kids.length >= 3)) {
        if (!best || boneDepth(b) < boneDepth(best)) best = b;
      }
    }
    if (best) slots.set('hips', best);
  }
  const hips = slots.get('hips');
  if (!hips) return slots;

  const kids = hips.children.filter(isB);
  const hipsY = worldPos(hips).y;
  const legs = kids.filter((k) => worldPos(k).y < hipsY - 1e-6);
  const others = kids.filter((k) => !legs.includes(k));

  // piernas
  if (legs.length >= 2 && !slots.get('upperleg.L') && !slots.get('upperleg.R')) {
    legs.sort((a, b) => worldX(b) - worldX(a)); // +X = izquierda (convención glTF, mirando a +Z)
    const [lLeg, rLeg] = [legs[0], legs[legs.length - 1]];
    for (const [leg, side] of [[lLeg, 'L'], [rLeg, 'R']]) {
      const chain = chainDown(leg, isB);
      const names = ['upperleg', 'lowerleg', 'foot', 'toes'];
      for (let i = 0; i < Math.min(chain.length, 4); i++) {
        if (!slots.get(`${names[i]}.${side}`)) slots.set(`${names[i]}.${side}`, chain[i]);
      }
    }
  }

  // columna hacia arriba: buscar el punto donde se ramifica en brazos + cabeza
  if (others.length && !slots.get('head')) {
    let spineChain = [];
    let cur = others.sort((a, b) => worldPos(b).y - worldPos(a).y)[0];
    while (cur) {
      spineChain.push(cur);
      const ck = cur.children.filter(isB);
      if (ck.length >= 2) {
        // ramificación: brazos a los lados, cuello/cabeza arriba
        const sorted = [...ck].sort((a, b) => worldX(b) - worldX(a));
        const lArm = sorted[0], rArm = sorted[sorted.length - 1];
        const mid = ck.filter((c) => c !== lArm && c !== rArm);
        for (const [arm, side] of [[lArm, 'L'], [rArm, 'R']]) {
          if (Math.abs(worldX(arm)) < 1e-6) continue;
          const chain = chainDown(arm, isB);
          const long = chain.length >= 4 ? ['shoulder', 'upperarm', 'lowerarm', 'hand'] : ['upperarm', 'lowerarm', 'hand'];
          for (let i = 0; i < Math.min(chain.length, long.length); i++) {
            if (!slots.get(`${long[i]}.${side}`)) slots.set(`${long[i]}.${side}`, chain[i]);
          }
        }
        if (mid.length) {
          const neckChain = chainDown(mid[0], isB);
          if (!slots.get('neck')) slots.set('neck', neckChain[0]);
          if (neckChain[1] && !slots.get('head')) slots.set('head', neckChain[1]);
        }
        break;
      }
      cur = ck[0] || null;
    }
    if (spineChain.length && !slots.get('spine')) slots.set('spine', spineChain[0]);
    if (spineChain.length >= 2 && !slots.get('chest')) slots.set('chest', spineChain[spineChain.length - 1]);
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Construcción del mapa destino->origen y retarget
// ---------------------------------------------------------------------------

export function collectBones(root) {
  // Sirve tanto para modelos con SkinnedMesh como para GLB de solo armadura
  const bones = [];
  const seen = new Set();
  root.traverse((o) => {
    if (o.isBone && !seen.has(o)) { seen.add(o); bones.push(o); }
  });
  if (!bones.length) {
    // armadura exportada sin skin: todos los Object3D con nombre bajo un nodo "Armature"/raíz
    root.traverse((o) => {
      if (!seen.has(o) && o.name && !o.isMesh && !o.isCamera && !o.isLight && o !== root) {
        seen.add(o); bones.push(o);
      }
    });
  }
  return bones;
}

export function buildBoneMap(targetBones, sourceBones) {
  const tSlots = inferSkeleton(targetBones, slotBones(targetBones));
  const sSlots = inferSkeleton(sourceBones, slotBones(sourceBones));
  const names = {};
  const mapped = [];
  for (const [slot, tBone] of tSlots) {
    const sBone = sSlots.get(slot);
    if (sBone) { names[tBone.name] = sBone.name; mapped.push(slot); }
  }
  return { names, mapped, tSlots, sSlots };
}

// Instantánea de la pose de carga (bind) de todos los huesos. Se usa en lugar de
// Skeleton.pose(), que calcula mal los locales cuando el hueso raíz cuelga de un
// nodo con escala/rotación (p.ej. Armature a 0.01 en exportaciones tipo FBX).
export function captureBindPose(root) {
  const snap = [];
  const bones = collectBones(root);
  for (const b of bones) {
    snap.push({
      bone: b,
      position: b.position.clone(),
      quaternion: b.quaternion.clone(),
      scale: b.scale.clone(),
    });
  }
  return snap;
}

export function applyBindPose(snap) {
  for (const s of snap) {
    s.bone.position.copy(s.position);
    s.bone.quaternion.copy(s.quaternion);
    s.bone.scale.copy(s.scale);
  }
}

function restWorldQuaternions(bones) {
  const map = new Map();
  for (const b of bones) {
    const q = new THREE.Quaternion();
    b.getWorldQuaternion(q);
    map.set(b.name, q.clone());
  }
  return map;
}

/**
 * Retargetea un clip de una armadura origen a un modelo destino.
 * @param {THREE.SkinnedMesh} targetSkin skinned mesh del modelo destino (en pose bind)
 * @param {THREE.Object3D} sourceRoot raíz de la escena/armadura origen (en pose de reposo)
 * @param {THREE.AnimationClip} clip clip de la armadura origen
 * @param {object} opts { inPlace, useOffsets }
 */
export function retargetClipAuto(targetSkin, sourceRoot, clip, opts = {}) {
  const targetBones = targetSkin.skeleton.bones;
  const sourceBones = collectBones(sourceRoot);

  const { names, mapped, tSlots, sSlots } = buildBoneMap(targetBones, sourceBones);
  if (!names || Object.keys(names).length < 3) {
    throw new Error('No se pudieron mapear suficientes huesos entre el modelo y la animación');
  }

  // pose de reposo en ambos lados: restaurar la pose de carga (bind) del destino.
  // No usamos Skeleton.pose() porque calcula mal los locales con armaduras escaladas.
  let sceneRoot = targetSkin;
  while (sceneRoot.parent) sceneRoot = sceneRoot.parent;
  if (opts.bindPose) applyBindPose(opts.bindPose);
  // Fuentes reutilizables (BVH/CMU) traen su pose de reposo: retargetClip deja la
  // armadura origen en su último fotograma, así que la restauramos antes de leer
  // las rotaciones base. Los paquetes GLTF no llevan restPose -> comportamiento intacto.
  if (sourceRoot.userData && sourceRoot.userData.restPose) applyBindPose(sourceRoot.userData.restPose);
  sceneRoot.updateMatrixWorld(true);
  sourceRoot.updateMatrixWorld(true);

  // escala de traslación de cadera: altura de cadera destino / origen.
  // Además, offset reposo-a-reposo para que la cadera del destino quede en SU
  // posición de descanso (modelos cuyo suelo no está en y=0 flotaban o se hundían).
  const tHips = tSlots.get('hips');
  const sHips = sSlots.get('hips');
  let scale = 1;
  let hipPosition;
  if (tHips && sHips) {
    const tFeet = lowestY(targetBones);
    const sFeet = lowestY(sourceBones);
    const tPos = worldPos(tHips);
    const sPos = worldPos(sHips);
    const tH = tPos.y - tFeet;
    const sH = sPos.y - sFeet;
    if (tH > 1e-6 && sH > 1e-6) scale = tH / sH;
    // en reposo: cadera_destino = cadera_origen*escala + offset  =>  offset/escala:
    hipPosition = new THREE.Vector3(
      tPos.x / scale - sPos.x,
      tPos.y / scale - sPos.y,
      tPos.z / scale - sPos.z,
    );
  }

  // offsets de reposo: inv(rot_reposo_origen) * rot_reposo_destino por hueso
  const localOffsets = {};
  if (opts.useOffsets !== false) {
    const sRest = restWorldQuaternions(sourceBones);
    const qs = new THREE.Quaternion(), qt = new THREE.Quaternion();
    for (const [tName, sName] of Object.entries(names)) {
      const tBone = targetBones.find((b) => b.name === tName);
      const sQ = sRest.get(sName);
      if (!tBone || !sQ) continue;
      tBone.getWorldQuaternion(qt);
      qs.copy(sQ).invert().multiply(qt);
      const m = new THREE.Matrix4().makeRotationFromQuaternion(qs.clone());
      localOffsets[tName] = m;
    }
  }

  const sourceForRetarget = sourceRoot;
  if (!sourceForRetarget.skeleton) {
    sourceForRetarget.skeleton = {
      bones: sourceBones,
      pose() {},
      getBoneByName(name) { return sourceBones.find((b) => b.name === name); },
    };
  }

  const hipInfluence = opts.inPlace ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 1, 1);

  const retargeted = SkeletonUtils.retargetClip(targetSkin, sourceForRetarget, clip, {
    names,
    hip: sHips ? sHips.name : 'Hips',
    scale,
    hipInfluence,
    hipPosition,
    localOffsets,
    preserveBonePositions: true,
    preserveBoneMatrix: true,
    fps: 30,
  });

  // renombra pistas ".bones[X]" -> "X" para poder enlazar el mixer a la raíz del modelo
  for (const track of retargeted.tracks) {
    track.name = track.name.replace(/^\.bones\[(.+?)\]/, '$1');
  }
  retargeted.name = clip.name;

  // restaurar pose bind tras el proceso
  if (opts.bindPose) applyBindPose(opts.bindPose);
  if (sourceRoot.userData && sourceRoot.userData.restPose) applyBindPose(sourceRoot.userData.restPose);
  sceneRoot.updateMatrixWorld(true);
  sourceRoot.updateMatrixWorld(true);

  return { clip: retargeted, mappedCount: mapped.length, targetBoneCount: targetBones.length, mappedSlots: mapped };
}

function lowestY(bones) {
  let min = Infinity;
  for (const b of bones) min = Math.min(min, worldPos(b).y);
  return Math.min(min, 0);
}

export function findBestSkinnedMesh(root) {
  let best = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) {
      if (!best || o.skeleton.bones.length > best.skeleton.bones.length) best = o;
    }
  });
  return best;
}
