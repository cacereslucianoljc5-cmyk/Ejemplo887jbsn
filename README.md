# ◆ AnimaGLB — Animaciones automáticas para cualquier modelo GLB

**Demo en vivo:** https://animaglb.vercel.app

Visualizador interactivo que aplica automáticamente **~290 animaciones incluidas** (ampliables a
**más de 2800** con la biblioteca CMU Mocap bajo demanda) a **cualquier modelo 3D humanoide**
(.glb / .gltf / .fbx / .bvh) directamente en el navegador, al estilo del auto-rigging + animación
de **Meshy AI**. Sin servidores: el retargeting de esqueleto ocurre 100 % en el cliente. Además
puedes **descargar** el modelo con la animación aplicada en un solo `.glb`.

![AnimaGLB](https://raw.githubusercontent.com/cacereslucianoljc5-cmyk/Ejemplo887jbsn/refs/heads/claude/lucid-babbage-crvo95/docs/screenshot.png)

## Qué hace

1. **Analiza el esqueleto** del GLB que subes: detecta cadera, columna, cuello, cabeza, brazos,
   piernas, pies y dedos aunque el rig use convenciones distintas (Mixamo, Ready Player Me,
   Rigify/Blender, KayKit, Unreal Mannequin, VRoid o nombres genéricos). Si los nombres no
   ayudan, infiere la estructura geométricamente (ramificaciones de la jerarquía, alturas y lados).
2. **Construye el mapa hueso→hueso** hacia el esqueleto de cada animación del paquete.
3. **Retargetea el clip** con `SkeletonUtils.retargetClip` de three.js:
   - compensación automática de la pose de reposo (offsets `inv(R_origen) · R_destino` por hueso),
   - escalado del desplazamiento de cadera a la altura real del personaje,
   - modo «en el sitio» (elimina el root motion),
   - corrige el caso de armaduras escaladas tipo FBX (Armature a 0.01).
4. **Reproduce con crossfade**, control de velocidad, bucle, esqueleto visible y cámara orbital.

También puedes **arrastrar animaciones tuyas** (GLB/FBX de Mixamo «without skin», o **`.bvh`**
de cualquier captura de movimiento) y se retargetean igual sobre el modelo cargado.

## Descargar el modelo animado

El botón **«⬇ Descargar modelo + animación»** exporta el modelo cargado —con su esqueleto
(incluido el **auto-rig** generado en el navegador para modelos sin huesos)— y la animación que
estás viendo, en un único **`.glb`** listo para Blender, Unity o Unreal (`GLTFExporter`).

## Biblioteca de animaciones

### Incluidas (CC0, cargadas de inicio)

| Paquete | Clips | Autor | Licencia |
|---|---|---|---|
| [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) base + addon | 163 | Mesh2Motion | CC0 1.0 |
| [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | 46 | Quaternius | CC0 1.0 |
| [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) | 76 | Kay Lousberg | CC0 1.0 |
| Meshy auto-rigging (walk/run) | 2 | generadas con la API de Meshy | del usuario |

### Biblioteca colosal: CMU Mocap (bajo demanda) 🎭

El botón **«➕ Biblioteca CMU (2548)»** añade la **mayor colección de captura de movimiento
gratuita que existe**: los **2548 movimientos** del *Carnegie-Mellon Graphics Lab Motion Capture
Database* (`mocap.cs.cmu.edu`), que CMU publica **libre para cualquier uso** (investigación y
comercial). Se usa la conversión BVH de Bruce Hahne (cgspeed), reflejada en GitHub por
[una-dinosauria/cmu-mocap](https://github.com/una-dinosauria/cmu-mocap).

Para no inflar el repositorio, **cada clip se transmite bajo demanda** (un `.bvh` por animación,
vía `raw.githubusercontent.com`/jsDelivr con CORS abierto) y se retargetea en el navegador con
`BVHLoader`. Andar, correr, saltar, bailar (salsa, breakdance), artes marciales, deportes
(baloncesto, fútbol), acrobacias (volteretas), interacciones… miles de movimientos reales.

Se investigaron también **Mixamo (Adobe)** y **Ready Player Me**, y se **descartaron a propósito**:
sus licencias no permiten redistribución. Detalle completo de proyectos investigados (UniRig,
Make-It-Animatable, RigNet, ossos, retargeting-threejs…) en el botón **«Librerías y proyectos»**.

## El modelo de ejemplo

El «Aventurero» se generó con la **API de Meshy** en 3 pasos (≈20 créditos):
`text-to-3d preview` (T-pose) → `refine` (texturas) → `rigging` (esqueleto + pesos + walk/run).
El GLB rigueado resultante es el que carga el botón *«Cargar ejemplo (Meshy)»*.

¿Tu modelo no tiene esqueleto? Riggéalo con la API de Meshy y vuelve a subirlo:

```bash
curl -X POST https://api.meshy.ai/openapi/v1/rigging \
  -H "Authorization: Bearer TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model_url": "https://tu-servidor/tu-modelo.glb", "height_meters": 1.7}'
```

## Desarrollo local

```bash
npm install
npm run dev        # abre http://localhost:5173
npm run build      # genera dist/
node scripts/e2e.mjs      # prueba end-to-end con Playwright (requiere Chromium)
node scripts/maptest.mjs public/models/example.glb public/anims/kaykit_knight.glb  # prueba del mapeador
```

Los binarios (modelo + packs) viven en `public/`. En despliegues donde no se suben binarios,
`scripts/fetch-assets.mjs` los descarga desde este repositorio antes del build
(así funciona el deploy de Vercel).

## Estructura

```
index.html            UI (paneles, estilos)
src/main.js           escena three.js, carga de modelos/packs, reproducción, descarga GLB
src/retarget.js       ★ mapeo automático de huesos + retargeting
src/autorig.js        auto-rigging en el navegador (modelos sin esqueleto)
src/cmu.js            ★ biblioteca CMU Mocap (índice + streaming BVH bajo demanda)
src/packs.js          definición del paquete de animaciones y categorías
src/projects.js       investigación de librerías/proyectos (modal)
scripts/fetch-assets.mjs  descarga de assets en el build de Vercel
scripts/e2e.mjs       prueba end-to-end (Playwright)
scripts/maptest.mjs   arnés del mapeador de huesos
public/anims/         paquetes de animaciones (CC0)
public/models/        modelo de ejemplo (Meshy)
```

## Licencias

- Código: MIT.
- Animaciones incluidas: CC0 1.0 (Mesh2Motion, Quaternius, KayKit) — ver tabla arriba.
- Biblioteca CMU Mocap: libre para cualquier uso (CMU Graphics Lab); conversión BVH de B. Hahne
  sin restricciones añadidas. Se transmite desde el mirror, no se redistribuye en este repo.
- Modelo de ejemplo y clips walk/run: generados con la cuenta de Meshy del autor del repo.
