// Auto-rigging experimental en el navegador para mallas humanoides SIN esqueleto.
// 1) Analiza la malla por cortes horizontales para localizar entrepierna, torso,
//    línea de hombros, brazos, piernas y cabeza (asume personaje de pie, eje Y arriba,
//    en T-pose o A-pose, aproximadamente simétrico en X).
// 2) Genera una jerarquía de huesos con nombres estilo Mixamo (Hips, Spine, LeftArm…)
//    para que el mapeador de retargeting los reconozca directamente.
// 3) Calcula pesos de piel por distancia vértice→segmento de hueso (máx. 4 huesos,
//    normalizados, con penalización para el lado contrario del cuerpo).

import * as THREE from 'three';

const MAX_VERTS = 800000;

export function autoRig(root) {
  root.updateMatrixWorld(true);

  // --- recolectar mallas y vértices en espacio mundial -----------------------
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) meshes.push(o); });
  if (!meshes.length) throw new Error('El modelo no tiene mallas');

  let totalVerts = 0;
  for (const m of meshes) totalVerts += m.geometry.attributes.position.count;
  if (totalVerts > MAX_VERTS) throw new Error(`Demasiados vértices para auto-rig (${totalVerts})`);

  const v = new THREE.Vector3();
  const world = new Float32Array(totalVerts * 3);
  let w = 0;
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      world[w++] = v.x; world[w++] = v.y; world[w++] = v.z;
    }
  }

  // --- análisis por cortes ----------------------------------------------------
  const box = new THREE.Box3();
  for (let i = 0; i < totalVerts; i++) box.expandByPoint(v.set(world[i * 3], world[i * 3 + 1], world[i * 3 + 2]));
  const minY = box.min.y, H = box.max.y - box.min.y;
  if (H <= 0) throw new Error('Malla degenerada');

  const N = 100;
  const slices = Array.from({ length: N }, () => ({
    n: 0, maxAbsX: 0, hasCenter: false, sumZ: 0,
    nL: 0, sumXL: 0, sumZL: 0, nR: 0, sumXR: 0, sumZR: 0,
  }));
  const step = Math.max(1, Math.floor(totalVerts / 60000)); // muestreo para el análisis
  for (let i = 0; i < totalVerts; i += step) {
    const x = world[i * 3], y = world[i * 3 + 1], z = world[i * 3 + 2];
    const si = Math.min(N - 1, Math.max(0, Math.floor(((y - minY) / H) * N)));
    const s = slices[si];
    s.n++;
    s.sumZ += z;
    const ax = Math.abs(x);
    if (ax > s.maxAbsX) s.maxAbsX = ax;
    if (ax < 0.025 * H) s.hasCenter = true;
    if (x > 0) { s.nL++; s.sumXL += x; s.sumZL += z; }
    else { s.nR++; s.sumXR += x; s.sumZR += z; }
  }
  const sliceY = (si) => minY + ((si + 0.5) / N) * H;

  // entrepierna: primer corte (desde 8%H hacia arriba) con vértices centrales
  let crotchSi = -1;
  for (let si = Math.floor(N * 0.08); si < N * 0.7; si++) {
    if (slices[si].n > 3 && slices[si].hasCenter) { crotchSi = si; break; }
  }
  if (crotchSi < 0) throw new Error('No se detectó estructura de piernas (¿es humanoide de pie?)');
  const crotchY = sliceY(crotchSi);

  // ancho de torso: percentil de |x| justo encima de la entrepierna
  const torsoSi = Math.min(N - 1, crotchSi + Math.floor(N * 0.08));
  const torsoW = Math.max(slices[torsoSi].maxAbsX * 0.55, 0.06 * H);

  // línea de hombros/brazos: corte más ancho en la mitad superior
  let shoulderSi = Math.floor(N * 0.78);
  let bestW = 0;
  for (let si = Math.floor(N * 0.55); si < Math.floor(N * 0.95); si++) {
    if (slices[si].n > 3 && slices[si].maxAbsX > bestW) { bestW = slices[si].maxAbsX; shoulderSi = si; }
  }
  let shoulderY = Math.min(Math.max(sliceY(shoulderSi), minY + 0.68 * H), minY + 0.88 * H);

  // --- brazos: agrupar vértices exteriores por lado ---------------------------
  const arm = { L: [], R: [] };
  for (let i = 0; i < totalVerts; i += step) {
    const x = world[i * 3], y = world[i * 3 + 1], z = world[i * 3 + 2];
    if (y > crotchY + 0.25 * H && Math.abs(x) > torsoW * 1.25) {
      arm[x > 0 ? 'L' : 'R'].push([x, y, z]);
    }
  }
  const armChain = (pts, sideSign) => {
    if (pts.length < 25) {
      // sin brazos detectables: colocación por proporciones (T-pose estándar)
      const sx = sideSign * torsoW * 1.05;
      return {
        shoulder: new THREE.Vector3(sx, shoulderY, 0),
        elbow: new THREE.Vector3(sx + sideSign * 0.16 * H, shoulderY, 0),
        hand: new THREE.Vector3(sx + sideSign * 0.32 * H, shoulderY, 0),
      };
    }
    // hombro = punto más interno; mano = el más alejado del hombro
    let sh = pts[0];
    for (const p of pts) if (Math.abs(p[0]) < Math.abs(sh[0])) sh = p;
    const shoulder = new THREE.Vector3(sideSign * Math.max(Math.abs(sh[0]) * 0.92, torsoW), Math.min(sh[1], shoulderY + 0.04 * H), sh[2]);
    let hand = pts[0], dmax = -1;
    for (const p of pts) {
      const d = (p[0] - shoulder.x) ** 2 + (p[1] - shoulder.y) ** 2 + (p[2] - shoulder.z) ** 2;
      if (d > dmax) { dmax = d; hand = p; }
    }
    const handV = new THREE.Vector3(hand[0], hand[1], hand[2]);
    // la muñeca queda un poco antes del extremo (el extremo son los dedos)
    const wrist = shoulder.clone().lerp(handV, 0.82);
    const elbow = shoulder.clone().lerp(handV, 0.45);
    return { shoulder, elbow, hand: wrist };
  };
  const armL = armChain(arm.L, 1);
  const armR = armChain(arm.R, -1);
  shoulderY = Math.max(armL.shoulder.y, armR.shoulder.y);

  // --- cabeza y cuello ---------------------------------------------------------
  let topY = minY + H;
  const chestY = shoulderY - 0.06 * H;
  const neckY = shoulderY + 0.02 * H;
  const headY = neckY + (minY + H - neckY) * 0.38;

  // --- piernas ------------------------------------------------------------------
  const legSi = Math.max(0, crotchSi - Math.floor(N * 0.04));
  const sL = slices[legSi], sR = slices[legSi];
  const legXL = sL.nL ? (sL.sumXL / sL.nL) : torsoW * 0.5;
  const legXR = sR.nR ? (sR.sumXR / sR.nR) : -torsoW * 0.5;
  const hipsY = crotchY + 0.06 * H;
  const ankleSi = Math.floor(N * 0.06);
  const sA = slices[ankleSi];
  const ankleY = minY + 0.07 * H;
  const ankleZL = sA.nL ? sA.sumZL / sA.nL : 0;
  const ankleZR = sA.nR ? sA.sumZR / sA.nR : 0;
  // dirección "adelante" del pie: hacia dónde se extiende la base respecto al tobillo
  const baseZ = slices[1].n ? slices[1].sumZ / slices[1].n : 0;
  const hipsZ = slices[crotchSi].n ? slices[crotchSi].sumZ / slices[crotchSi].n : 0;
  const fwd = Math.sign(baseZ - hipsZ) || 1;

  const P = {
    hips: new THREE.Vector3(0, hipsY, hipsZ),
    spine: new THREE.Vector3(0, hipsY + (chestY - hipsY) * 0.33, hipsZ),
    spine1: new THREE.Vector3(0, hipsY + (chestY - hipsY) * 0.66, hipsZ),
    spine2: new THREE.Vector3(0, chestY, hipsZ),
    neck: new THREE.Vector3(0, neckY, hipsZ),
    head: new THREE.Vector3(0, headY, hipsZ),
    headTop: new THREE.Vector3(0, topY, hipsZ),
    upLegL: new THREE.Vector3(legXL, hipsY - 0.02 * H, hipsZ),
    upLegR: new THREE.Vector3(legXR, hipsY - 0.02 * H, hipsZ),
    ankleL: new THREE.Vector3(legXL, ankleY, ankleZL),
    ankleR: new THREE.Vector3(legXR, ankleY, ankleZR),
  };
  P.kneeL = P.upLegL.clone().lerp(P.ankleL, 0.5);
  P.kneeR = P.upLegR.clone().lerp(P.ankleR, 0.5);
  P.toeL = new THREE.Vector3(legXL, minY + 0.015 * H, ankleZL + fwd * 0.1 * H);
  P.toeR = new THREE.Vector3(legXR, minY + 0.015 * H, ankleZR + fwd * 0.1 * H);

  // --- construir jerarquía de huesos (nombres Mixamo, rotación identidad) ------
  const defs = [
    ['Hips', null, P.hips],
    ['Spine', 'Hips', P.spine],
    ['Spine1', 'Spine', P.spine1],
    ['Spine2', 'Spine1', P.spine2],
    ['Neck', 'Spine2', P.neck],
    ['Head', 'Neck', P.head],
    ['LeftArm', 'Spine2', armL.shoulder],
    ['LeftForeArm', 'LeftArm', armL.elbow],
    ['LeftHand', 'LeftForeArm', armL.hand],
    ['RightArm', 'Spine2', armR.shoulder],
    ['RightForeArm', 'RightArm', armR.elbow],
    ['RightHand', 'RightForeArm', armR.hand],
    ['LeftUpLeg', 'Hips', P.upLegL],
    ['LeftLeg', 'LeftUpLeg', P.kneeL],
    ['LeftFoot', 'LeftLeg', P.ankleL],
    ['LeftToeBase', 'LeftFoot', P.toeL],
    ['RightUpLeg', 'Hips', P.upLegR],
    ['RightLeg', 'RightUpLeg', P.kneeR],
    ['RightFoot', 'RightLeg', P.ankleR],
    ['RightToeBase', 'RightFoot', P.toeR],
  ];
  const boneByName = new Map();
  const bones = [];
  for (const [name, parentName, worldPos] of defs) {
    const b = new THREE.Bone();
    b.name = name;
    const parent = parentName ? boneByName.get(parentName) : null;
    const parentPos = parent ? defs.find((d) => d[0] === parentName)[2] : new THREE.Vector3();
    b.position.copy(worldPos).sub(parentPos);
    (parent || root).add(b);
    boneByName.set(name, b);
    bones.push(b);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  // --- segmentos para el cálculo de pesos ---------------------------------------
  const segs = []; // { idx, a, b, side (0 centro, +1 izq, -1 der), scale }
  const addSeg = (name, a, b, side = 0) => segs.push({ idx: bones.findIndex((x) => x.name === name), a, b, side });
  addSeg('Hips', P.upLegR.clone().lerp(P.hips, 0.5), P.upLegL.clone().lerp(P.hips, 0.5));
  addSeg('Spine', P.spine, P.spine1);
  addSeg('Spine1', P.spine1, P.spine2);
  addSeg('Spine2', P.spine2, P.neck);
  addSeg('Neck', P.neck, P.head);
  addSeg('Head', P.head, P.headTop);
  addSeg('LeftArm', armL.shoulder, armL.elbow, 1);
  addSeg('LeftForeArm', armL.elbow, armL.hand, 1);
  addSeg('LeftHand', armL.hand, armL.hand.clone().lerp(armL.shoulder, -0.22), 1);
  addSeg('RightArm', armR.shoulder, armR.elbow, -1);
  addSeg('RightForeArm', armR.elbow, armR.hand, -1);
  addSeg('RightHand', armR.hand, armR.hand.clone().lerp(armR.shoulder, -0.22), -1);
  addSeg('LeftUpLeg', P.upLegL, P.kneeL, 1);
  addSeg('LeftLeg', P.kneeL, P.ankleL, 1);
  addSeg('LeftFoot', P.ankleL, P.toeL, 1);
  addSeg('LeftToeBase', P.toeL, new THREE.Vector3(P.toeL.x, P.toeL.y, P.toeL.z + fwd * 0.04 * H), 1);
  addSeg('RightUpLeg', P.upLegR, P.kneeR, -1);
  addSeg('RightLeg', P.kneeR, P.ankleR, -1);
  addSeg('RightFoot', P.ankleR, P.toeR, -1);
  addSeg('RightToeBase', P.toeR, new THREE.Vector3(P.toeR.x, P.toeR.y, P.toeR.z + fwd * 0.04 * H), -1);

  const segDist = (px, py, pz, s) => {
    const ax = s.a.x, ay = s.a.y, az = s.a.z;
    const bx = s.b.x, by = s.b.y, bz = s.b.z;
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const len2 = abx * abx + aby * aby + abz * abz;
    let t = len2 > 0 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dx = px - (ax + abx * t), dy = py - (ay + aby * t), dz = pz - (az + abz * t);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // --- asignar pesos a cada malla y convertirla en SkinnedMesh ------------------
  const margin = 0.02 * H;
  const skinnedMeshes = [];
  let base = 0;
  for (const m of meshes) {
    const count = m.geometry.attributes.position.count;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    const cand = [];
    for (let i = 0; i < count; i++) {
      const gx = world[(base + i) * 3], gy = world[(base + i) * 3 + 1], gz = world[(base + i) * 3 + 2];
      cand.length = 0;
      for (const s of segs) {
        let d = segDist(gx, gy, gz, s);
        // penaliza huesos del lado contrario del cuerpo
        if (s.side === 1 && gx < -margin) d *= 3;
        else if (s.side === -1 && gx > margin) d *= 3;
        cand.push([d, s.idx]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      let sum = 0;
      const eps = 0.015 * H;
      for (let k = 0; k < 4; k++) {
        const wgt = 1 / Math.pow(cand[k][0] + eps, 4);
        skinIndex[i * 4 + k] = cand[k][1];
        skinWeight[i * 4 + k] = wgt;
        sum += wgt;
      }
      for (let k = 0; k < 4; k++) skinWeight[i * 4 + k] /= sum;
    }
    base += count;

    m.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    m.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));

    const sm = new THREE.SkinnedMesh(m.geometry, m.material);
    sm.name = m.name || 'autorig_mesh';
    sm.castShadow = true;
    sm.frustumCulled = false;
    m.parent.add(sm);
    sm.position.copy(m.position);
    sm.quaternion.copy(m.quaternion);
    sm.scale.copy(m.scale);
    sm.updateMatrixWorld(true);
    sm.bind(skeleton, sm.matrixWorld.clone());
    m.parent.remove(m);
    skinnedMeshes.push(sm);
  }
  root.updateMatrixWorld(true);

  return {
    skin: skinnedMeshes[0],
    skeleton,
    boneCount: bones.length,
    vertexCount: totalVerts,
  };
}
