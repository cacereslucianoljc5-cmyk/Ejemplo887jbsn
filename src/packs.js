// Paquetes de animaciones incluidos (todos con licencia CC0 / generados con la cuenta del usuario)
// y categorización automática de clips en español.

export const PACKS = [
  {
    id: 'm2m-base',
    label: 'Mesh2Motion Base',
    author: 'Mesh2Motion',
    license: 'CC0 1.0',
    url: 'anims/human-base-animations.glb',
  },
  {
    id: 'm2m-addon',
    label: 'Mesh2Motion Addon',
    author: 'Mesh2Motion',
    license: 'CC0 1.0',
    url: 'anims/human-addon-animations.glb',
  },
  {
    id: 'ual',
    label: 'Universal Animation Library',
    author: 'Quaternius',
    license: 'CC0 1.0',
    url: 'anims/AnimationLibrary_Godot_Standard.gltf',
  },
  {
    id: 'kaykit',
    label: 'KayKit Adventurers',
    author: 'Kay Lousberg',
    license: 'CC0 1.0',
    url: 'anims/kaykit_knight.glb',
  },
  {
    id: 'meshy-walk',
    label: 'Meshy Rigging',
    author: 'Meshy AI (auto-rigging)',
    license: 'Generada por el usuario',
    url: 'anims/meshy_walking.glb',
  },
  {
    id: 'meshy-run',
    label: 'Meshy Rigging',
    author: 'Meshy AI (auto-rigging)',
    license: 'Generada por el usuario',
    url: 'anims/meshy_running.glb',
  },
];

const CATEGORY_RULES = [
  ['Locomoción', /walk|run|jog|sprint|crouch|strafe|swim|climb|roll|dodge|jump|land|fall|caminar|correr/i],
  ['Combate', /attack|punch|kick|sword|melee|ranged|shoot|shooting|pistol|block|spell|throw|aim|reload|hit|death|die|dualwield|golpe|muerte/i],
  ['Baile y emotes', /dance|cheer|celebrat|wave|clap|baile|bow$|angry|confused|greeting|victory|emote|salute|yes$|no$/i],
  ['Idle y poses', /idle|pose|tpose|t-pose|breath|stand|sleep/i],
  ['Interacción', /sit|lie|pick|interact|use|fix|drive|push|talk|table|kneel|sentar|farm|harvest|consume|chest|water|plant|zombie|crawl|glide|fly/i],
];

export function categorize(clipName) {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(clipName)) return cat;
  }
  return 'Otras';
}

// nombre legible: "2H_Melee_Attack_Spin" -> "2H Melee Attack Spin"
export function prettyName(name) {
  return name
    .replace(/^Armature\|?/i, '')
    .replace(/\|baselayer$/i, '')
    .replace(/[_|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
