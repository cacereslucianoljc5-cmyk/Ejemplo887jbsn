// Arnés de prueba del mapeador de huesos: reconstruye jerarquías desde los GLB
// (con la misma sanitización de nombres que aplica GLTFLoader) y verifica los slots.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { slotBones, inferSkeleton, buildBoneMap } from '../src/retarget.js';

function glbJson(path) {
  const buf = readFileSync(path);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString());
}

// misma sanitización que GLTFLoader/PropertyBinding.sanitizeNodeName
const sanitize = (n) => n.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');

function buildBones(path) {
  const g = glbJson(path);
  const nodes = g.nodes || [];
  const jointSet = new Set((g.skins || []).flatMap((s) => s.joints));
  const objs = nodes.map((n, i) => {
    const o = jointSet.size ? (jointSet.has(i) ? new THREE.Bone() : new THREE.Object3D()) : new THREE.Object3D();
    o.name = sanitize(n.name || `node${i}`);
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Object3D();
  (g.scenes?.[0]?.nodes || []).forEach((i) => root.add(objs[i]));
  root.updateMatrixWorld(true);
  const bones = jointSet.size
    ? [...jointSet].map((i) => objs[i])
    : objs.filter((o, i) => o.name && !(nodes[i].mesh >= 0) && objs[i].parent);
  return { root, bones };
}

const files = process.argv.slice(2);
for (const f of files) {
  const { bones } = buildBones(f);
  const slots = inferSkeleton(bones, slotBones(bones));
  console.log('\n===', f, `(${bones.length} huesos)`);
  const inv = new Map();
  for (const [slot, bone] of [...slots.entries()].sort()) inv.set(slot, bone.name);
  console.log([...inv.entries()].map(([s, n]) => `${s}=${n}`).join('  '));
}

if (files.length === 2) {
  const t = buildBones(files[0]);
  const s = buildBones(files[1]);
  const { names, mapped } = buildBoneMap(t.bones, s.bones);
  console.log(`\nMAPA ${files[0]} <- ${files[1]}: ${mapped.length} slots`);
  console.log(mapped.sort().join(', '));
  console.log(names);
}
