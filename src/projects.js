// Contenido del modal "Librerías y proyectos": investigación verificada (julio 2026)
// de proyectos open-source de auto-rigging y retargeting, y créditos de los assets.

export const PROJECTS_HTML = `
<h4>Cómo funciona esta herramienta</h4>
<p>
  AnimaGLB replica en el navegador la parte de <b>aplicación automática de animaciones</b> del
  pipeline de Meshy AI: <b>1)</b> analiza el esqueleto del GLB que subes (detección de huesos por
  nombre en las convenciones Mixamo, Ready Player Me, Rigify, KayKit, Unreal Mannequin y VRoid, con
  inferencia geométrica de cadera/columna/extremidades como respaldo), <b>2)</b> construye un mapa
  hueso-a-hueso hacia el esqueleto de cada animación, <b>3)</b> retargetea el clip con
  <code>SkeletonUtils.retargetClip</code> de three.js, compensando la pose de reposo y escalando el
  desplazamiento de cadera a la altura de tu personaje, y <b>4)</b> lo reproduce con crossfade.
  Todo ocurre localmente: tu modelo no se sube a ningún servidor.
</p>

<h4>Paquete de animaciones incluido (~290 clips)</h4>
<table>
  <tr><th>Paquete</th><th>Clips</th><th>Autor</th><th>Licencia</th></tr>
  <tr><td><a href="https://github.com/Mesh2Motion/mesh2motion-app" target="_blank" rel="noopener">Mesh2Motion base + addon</a></td><td>163</td><td>Mesh2Motion</td><td>CC0 1.0</td></tr>
  <tr><td><a href="https://quaternius.itch.io/universal-animation-library" target="_blank" rel="noopener">Universal Animation Library</a></td><td>46</td><td>Quaternius</td><td>CC0 1.0</td></tr>
  <tr><td><a href="https://kaylousberg.itch.io/kaykit-adventurers" target="_blank" rel="noopener">KayKit Adventurers</a></td><td>76</td><td>Kay Lousberg</td><td>CC0 1.0</td></tr>
  <tr><td><a href="https://docs.meshy.ai/en/api/rigging-and-animation" target="_blank" rel="noopener">Meshy auto-rigging (walk/run)</a></td><td>2</td><td>Generadas con Meshy AI</td><td>Del usuario</td></tr>
</table>
<p style="font-size:12px;color:#8b93a7">
  Nota: las librerías de animaciones de Mixamo (Adobe) y Ready Player Me se investigaron y se
  <b>descartaron a propósito</b>: sus licencias no permiten redistribuirlas ni usarlas con avatares
  arbitrarios. Aún así, puedes descargar animaciones de Mixamo tú mismo (FBX «without skin») y
  arrastrarlas aquí: se retargetean igual.
</p>

<h4>Proyectos open-source de auto-rigging (estilo Meshy)</h4>
<table>
  <tr><th>Proyecto</th><th>★</th><th>Qué hace</th><th>Licencia</th></tr>
  <tr><td><a href="https://github.com/VAST-AI-Research/UniRig" target="_blank" rel="noopener">UniRig</a> (SIGGRAPH 2025)</td><td>1.6k</td><td>Transformer autoregresivo que genera esqueleto + pesos de skinning para cualquier modelo 3D (humanos, animales, objetos). El estado del arte open-source.</td><td>MIT</td></tr>
  <tr><td><a href="https://github.com/jasongzy/Make-It-Animatable" target="_blank" rel="noopener">Make-It-Animatable</a> (CVPR 2025)</td><td>424</td><td>Riggea cualquier humanoide en &lt;1 s: huesos, pesos y canonicalización de pose; demo Gradio.</td><td>MIT</td></tr>
  <tr><td><a href="https://github.com/VAST-AI-Research/SkinTokens" target="_blank" rel="noopener">SkinTokens</a> (2026)</td><td>214</td><td>Sucesor de UniRig: rigging autoregresivo unificado, exporta GLB rigueado.</td><td>MIT</td></tr>
  <tr><td><a href="https://github.com/Seed3D/MagicArticulate" target="_blank" rel="noopener">MagicArticulate</a> (CVPR 2025)</td><td>412</td><td>Generación de esqueletos como modelado de secuencias + predicción de skinning (ByteDance).</td><td>Apache-2.0</td></tr>
  <tr><td><a href="https://github.com/Seed3D/Puppeteer" target="_blank" rel="noopener">Puppeteer</a></td><td>407</td><td>Rigging + animación de modelos articulados a partir de vídeo/prompts.</td><td>Apache-2.0</td></tr>
  <tr><td><a href="https://github.com/zhan-xu/RigNet" target="_blank" rel="noopener">RigNet</a> (SIGGRAPH 2020)</td><td>1.5k</td><td>El paper clásico de rigging neuronal: predice articulaciones, conectividad y pesos.</td><td>GPL-3.0</td></tr>
  <tr><td><a href="https://github.com/PeizhuoLi/neural-blend-shapes" target="_blank" rel="noopener">Neural Blend Shapes</a></td><td>702</td><td>Rigging + skinning + blend shapes correctivos para humanoides en T-pose.</td><td>BSD-2</td></tr>
  <tr><td><a href="https://github.com/c8241998/HumanRig" target="_blank" rel="noopener">HumanRig</a></td><td>93</td><td>Dataset + baseline de rigging humanoide.</td><td>MIT</td></tr>
</table>

<h4>Retargeting y animación en el navegador</h4>
<table>
  <tr><th>Proyecto</th><th>★</th><th>Qué hace</th></tr>
  <tr><td><a href="https://github.com/mrdoob/three.js" target="_blank" rel="noopener">three.js SkeletonUtils</a></td><td>113k</td><td>La utilidad de retargeting que usa esta app (<code>retargetClip</code>).</td></tr>
  <tr><td><a href="https://github.com/Mesh2Motion/mesh2motion-app" target="_blank" rel="noopener">Mesh2Motion</a></td><td>—</td><td>Alternativa web open-source a Mixamo (three.js); origen de 163 clips CC0 incluidos aquí.</td></tr>
  <tr><td><a href="https://github.com/sketchpunklabs/ossos" target="_blank" rel="noopener">ossos</a></td><td>499</td><td>Sistema completo de esqueletos, IK y retargeting en TypeScript puro.</td></tr>
  <tr><td><a href="https://github.com/upf-gti/retargeting-threejs" target="_blank" rel="noopener">retargeting-threejs</a></td><td>43</td><td>Librería de retargeting humanoide para three.js (UPF-GTI).</td></tr>
  <tr><td><a href="https://github.com/pixiv/three-vrm" target="_blank" rel="noopener">three-vrm</a></td><td>2k</td><td>Avatares VRM en three.js, con huesos humanoides normalizados.</td></tr>
  <tr><td><a href="https://github.com/yeemachine/kalidokit" target="_blank" rel="noopener">Kalidokit</a></td><td>5.7k</td><td>Captura facial/corporal por webcam → huesos (mocap casero).</td></tr>
  <tr><td><a href="https://github.com/met4citizen/TalkingHead" target="_blank" rel="noopener">TalkingHead</a></td><td>1.4k</td><td>Avatares parlantes 3D con lip-sync en el navegador.</td></tr>
  <tr><td><a href="https://github.com/donmccurdy/three-gltf-viewer" target="_blank" rel="noopener">three-gltf-viewer</a></td><td>2.4k</td><td>El visor GLTF de referencia (inspiración del visor).</td></tr>
</table>

<h4>Servicios comerciales con API de auto-rigging</h4>
<table>
  <tr><th>Servicio</th><th>Notas</th></tr>
  <tr><td><a href="https://docs.meshy.ai/en/api/rigging-and-animation" target="_blank" rel="noopener">Meshy AI</a></td><td>Rigging + animaciones básicas por API (~5 créditos por rig). El modelo de ejemplo de esta app se generó y riggeó con esta API.</td></tr>
  <tr><td><a href="https://anything.world" target="_blank" rel="noopener">Anything World</a></td><td>«Animate Anything»: rigging automático de humanoides, animales y objetos.</td></tr>
  <tr><td><a href="https://github.com/VAST-AI-Research/tripo-python-sdk" target="_blank" rel="noopener">Tripo AI</a></td><td>API de rigging/animación con SDK Python open-source.</td></tr>
</table>

<h4>¿Tu modelo no tiene esqueleto?</h4>
<p>
  Esta app aplica animaciones a modelos <b>ya rigueados</b> (con esqueleto). Si tu GLB no tiene
  huesos, riggéalo primero en segundos con la API de Meshy y vuelve a subirlo:
</p>
<pre style="background:#171c27;border:1px solid #232a38;border-radius:8px;padding:10px;font-size:12px;overflow-x:auto">curl -X POST https://api.meshy.ai/openapi/v1/rigging \\
  -H "Authorization: Bearer TU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model_url": "https://tu-servidor/tu-modelo.glb", "height_meters": 1.7}'</pre>
<p style="font-size:12px;color:#8b93a7">
  También puedes usar UniRig o Make-It-Animatable (gratuitos, requieren GPU local).
</p>
`;
