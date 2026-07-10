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
  ['Acrobacias', /cartwheel|flip|handstand|acrobat|tumble|somersault|backflip|frontflip|gymnast|breakdance|handspring|vault/i],
  ['Deportes', /basketball|soccer|football|golf|tennis|baseball|volleyball|bowling|frisbee|dribble|sport|boxing|box\b|skateboard|hockey|racket/i],
  ['Combate', /attack|punch|kick|sword|melee|ranged|shoot|shooting|pistol|block|spell|throw|aim|reload|hit|death|die|dualwield|fight|martial|karate|golpe|muerte/i],
  ['Baile y emotes', /dance|salsa|waltz|tango|ballet|charleston|cheer|celebrat|wave|clap|baile|bow$|angry|confused|greeting|victory|emote|salute|yes$|no$/i],
  ['Locomoción', /walk|run|jog|sprint|crouch|strafe|swim|climb|roll|dodge|jump|leap|hop|land|fall|march|tiptoe|caminar|correr/i],
  ['Idle y poses', /idle|pose|tpose|t-pose|breath|stand|sleep|wait/i],
  ['Interacción', /sit|lie|pick|interact|use|fix|drive|push|pull|talk|table|kneel|sentar|farm|harvest|consume|chest|water|plant|zombie|crawl|glide|fly|wash|drink|eat|clean|cook|stretch|exercise|playground|swing|climb/i],
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
