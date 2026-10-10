import * as THREE from "three";
import {
  anchors,
  target,
  alternative,
  ranges,
  candidates,
  stages,
  beacons3D,
  target3D,
} from "./model.js";
import "./style.css";
import { LabSound } from "./sound.js";
const sound = new LabSound();
import { RoomScan } from "./scan/room.js";
import { createSceneRotation, SCAN_SCENES } from "./scan/scenes.js";
import { ScanExperience } from "./scan/experience.js";
import { scanThumbnail } from "./scan/gallery.js";
import { RainExperience } from "./rain/experience.js";
import { rainThumbnail } from "./rain/gallery.js";
import { ModelGrab } from "./manipulation.js";
import {
  LayerExperience,
  LAYER_KEYS,
  LAYER_NAMES,
  LAYER_HINTS,
} from "./layers/experience.js";
import { renderLayerMap } from "./layers/map.js";
import { ViewshedExperience } from "./viewshed/experience.js";
import { PixelExperience } from "./pixels/experience.js";
const nextScanScene = createSceneRotation();
const devPreview =
  import.meta.env.DEV && new URLSearchParams(location.search).has("preview");
const app = document.querySelector("#app");
app.innerHTML = `<header><div class="brand">◈ &nbsp; SPATIAL DISCOVERY LAB</div><div class="tag">GIS Day · Immersive explorations</div></header><section class="intro"><div class="eyebrow">A different way to see where you are</div><h1>Your world.<br>A new dimension.</h1><p>Six short, hands-on discoveries in virtual and mixed reality.<br>Choose a VR experience in your headset, or open the mixed reality room scan.</p><button id="vr" disabled>Checking VR…</button><button id="ar" class="secondary" disabled>Checking room scan…</button><p class="small">Quest controllers · About 4 minutes per experience · Seated or standing</p></section><section class="grid"><article class="card"><div class="art" aria-hidden="true"><i class="ring"></i><i class="ring"></i><i class="ring"></i><i class="dot"></i></div><div class="eyebrow">01 / Positioning</div><h2>Find Yourself Without GPS</h2><p>Use distances to find possible locations. Grab a floating model and discover why one measurement is never the whole story.</p></article><article class="card"><div class="rain-art" aria-hidden="true">☁<span>╲ ╲ ╲ ╲ ╲</span><div>⌁ &nbsp; ▲ &nbsp; ⌁</div></div><div class="eyebrow">02 / Watersheds</div><h2>Make It Rain</h2><p>Make rain fall on a miniature landscape. Follow the water, cross a ridge, and discover where different watersheds lead.</p></article><article class="card"><div class="rain-art" aria-hidden="true">✧ ⋮ ✧<div>⠿ ⠿ ⠿</div></div><div class="eyebrow">03 / Remote sensing</div><h2>Scan the Hidden World</h2><p>Sweep a scanner to reveal a point cloud. Explore blind spots, change viewpoints, and filter vegetation.</p></article><article class="card"><div class="layers-art" aria-hidden="true"><span>▤</span><span>≈</span><span>♧</span></div><div class="eyebrow">04 / Data layers</div><h2>Stand Inside the Layers</h2><p>Build a landscape around you, one geographic layer at a time. Explore terrain, trees, rivers, roads, floodplains, and political boundaries.</p></article><article class="card"><div class="layers-art" aria-hidden="true"><span>◉</span><span>▲</span><span>◌</span></div><div class="eyebrow">05 / Visibility</div><h2>Can You See It?</h2><p>Move an observer across the same landscape and compare what is visible from eye level or a tower. Reveal the terrain hidden behind ridges.</p></article><article class="card"><div class="layers-art" aria-hidden="true"><span>▦</span><span>▩</span><span>▣</span></div><div class="eyebrow">06 / Spatial resolution</div><h2>How Big Is a Pixel?</h2><p>See how much ground one image pixel covers. Change resolution, compare an aerial image with the landscape, and discover mixed pixels.</p></article></section><p id="status" role="status" aria-live="polite"></p><footer>Quest-first prototype · VR experiences + mixed reality room scan</footer>`;
const status = document.querySelector("#status");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.domElement.id = "scene";
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  65,
  innerWidth / innerHeight,
  0.03,
  700,
);
camera.position.set(0, 0, 0);
const root = new THREE.Group();
scene.add(root);
const content = new THREE.Group();
root.add(content);
let uiParent = content;
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.025;
const rotation = new THREE.Matrix4();
let buttons = [],
  step = -1,
  elapsed = 0,
  lastTime = 0,
  waterSoundUntil = 0,
  pendingPlacement = false,
  noisy = false,
  prediction = "";
let scan = null;
let layers = null;
let viewshed = null;
let pixels = null;
let xrMode = null;
let pendingRoomHandoff = false;
let rightTurnReady = true;
let rain = null,
  rainPointer = 0,
  previewRaining = false;
let floatingModel = null,
  grab = null,
  preservePose = null;
let rangeAnimations = [];
let animationAge = 0;
let lastAnimatedRangeStep = null;
let uiFadeMeshes = [];
let uiFadeAge = 1;
let lastUIKey = "";
const isSpatial = () => step === 4 || step === 5;
const palette = [0x6ef0d1, 0xffca83, 0xc6b7ff, 0xff9ba8];
function clear() {
  rangeAnimations = [];
  animationAge = 0;
  uiFadeMeshes = [];
  grab?.cancel();
  if (floatingModel) {
    floatingModel.traverse((n) => {
      n.geometry?.dispose();
      n.material?.dispose();
    });
    scene.remove(floatingModel);
    floatingModel = null;
    grab = null;
  }
  buttons = [];
  for (const group of [content, layers?.ui, viewshed?.ui, pixels?.ui].filter(Boolean))
    while (group.children.length) {
      const obj = group.children[0];
      obj.traverse((n) => {
        n.geometry?.dispose();
        if (n.material) {
          for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
      group.remove(obj);
    }
}
function label(
  text,
  x,
  y,
  w = 1.8,
  h = 0.18,
  size = 42,
  color = "#e6f4f5",
  bg = null,
) {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = Math.round((1200 * h) / w);
  const ctx = c.getContext("2d");
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  size = (size * (w >= 0.8 ? 2.3 : 1.6)) / w;
  ctx.font = `500 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = text.split("\n");
  lines.forEach((s, i) =>
    ctx.fillText(
      s,
      c.width / 2,
      c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.4,
      c.width - 35,
    ),
  );
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: !bg,
      side: THREE.DoubleSide,
    }),
  );
  if (uiFadeAge < 0.45) {
    mesh.material.transparent = true;
    mesh.material.opacity = uiFadeAge / 0.45;
    uiFadeMeshes.push(mesh);
  }
  mesh.position.set(x, y, 0.02);
  uiParent.add(mesh);
  return mesh;
}
function button(text, x, y, action, w = 0.75) {
  const m = label(text, x, y, w, 0.16, 48, "#08241e", "#a6f5d9");
  m.position.z = 0.08;
  m.userData.action = () => {
    sound.click();
    action();
  };
  m.userData.label = text;
  buttons.push(m);
  return m;
}
function line(points, color, opacity = 1) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const m = new THREE.Line(
    geom,
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  content.add(m);
  return m;
}
function circle(a, r, color) {
  const ring = line(
    Array.from(
      { length: 257 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 256) * Math.PI * 2) * r,
          Math.sin((i / 256) * Math.PI * 2) * r,
          0,
        ),
    ),
    color,
  );
  ring.position.set(a.x, a.y, 0);
  ring.material.transparent = true;
  ring.material.depthWrite = false;
  return ring;
}
function point(p, color, r = 0.026, z = 0.045) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 14, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  m.position.set(p.x, p.y, z);
  content.add(m);
  return m;
}
function navigation(y = -0.98) {
  button(
    sound.muted ? "Sound: off" : "Sound: on",
    0.46,
    y,
    () => {
      sound.toggle();
      draw();
    },
    0.44,
  );
  button(
    xrMode === "immersive-ar" ? "VR menu" : "Menu",
    -0.92,
    y,
    () => {
      if (xrMode === "immersive-ar") {
        renderer.xr.getSession()?.end();
        return;
      }
      scan?.dispose();
      scan = null;
      layers?.dispose();
      layers = null;
      viewshed?.dispose();
      viewshed = null;
      pixels?.dispose();
      pixels = null;
      rain?.dispose();
      rain = null;
      stopRainInput();
      step = -1;
      draw();
    },
    0.44,
  );
  button("Restart", -0.46, y, () => start(), 0.44);
  button(
    rain || scan || layers || viewshed || pixels || isSpatial() ? "Reset View" : "Recenter",
    0,
    y,
    () => {
      if (devPreview) place();
      else pendingPlacement = true;
    },
    0.44,
  );
  button("Exit XR", 0.92, y, () => renderer.xr.getSession()?.end(), 0.44);
}
function start() {
  if (pixels) {
    startPixels();
    return;
  }
  if (viewshed) {
    startViewshed();
    return;
  }
  if (layers) {
    startLayers();
    return;
  }
  if (scan) {
    if (scan.room) startRoomScan();
    else startScan();
    return;
  }
  if (rain) {
    startRain();
    return;
  }
  preservePose = null;
  step = -2;
  lastAnimatedRangeStep = null;
  elapsed = 0;
  noisy = false;
  prediction = "";
  draw();
}
function stopRainInput() {
  sound.setWater(false);
  waterSoundUntil = 0;
  scan?.grab.cancel();
  for (const { c } of controllers) c.userData.scanning = false;
  previewRaining = false;
  rain?.endStroke();
  rain?.grab.cancel();
  for (const { c } of controllers) c.userData.raining = false;
}
function startRain(kind = "drainage", explore = false) {
  if (kind !== "erosion") kind = "drainage";
  scan?.dispose();
  scan = null;
  layers?.dispose();
  layers = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = null;
  stopRainInput();
  rain?.dispose();
  rain = new RainExperience(scene, draw, kind, (event) => sound.cue(event));
  rain.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  if (explore) rain.explore();
  else {
    rain.group.visible = false;
    draw();
  }
}
function startScan(sceneInfo, explore = false) {
  if (!SCAN_SCENES.includes(sceneInfo)) sceneInfo = nextScanScene();
  stopRainInput();
  rain?.dispose();
  rain = null;
  layers?.dispose();
  layers = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = null;
  scan?.dispose();
  scan = new ScanExperience(scene, draw, sceneInfo);
  scan.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  if (explore) scan.explore();
  else {
    scan.group.visible = false;
    draw();
  }
}
function startLayers() {
  stopRainInput();
  rain?.dispose();
  rain = null;
  scan?.dispose();
  scan = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = null;
  layers?.dispose();
  layers = new LayerExperience(scene, draw, (event) => sound.cue(event));
  layers.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  draw();
}
function startViewshed() {
  stopRainInput();
  rain?.dispose();
  rain = null;
  scan?.dispose();
  scan = null;
  layers?.dispose();
  layers = null;
  pixels?.dispose();
  pixels = null;
  viewshed?.dispose();
  viewshed = new ViewshedExperience(scene, draw, (event) => sound.cue(event));
  viewshed.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  draw();
}
function startPixels() {
  stopRainInput();
  rain?.dispose();
  rain = null;
  scan?.dispose();
  scan = null;
  layers?.dispose();
  layers = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = new PixelExperience(scene, draw, (event) => sound.cue(event));
  pixels.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  draw();
}
function startRoomScan() {
  stopRainInput();
  rain?.dispose();
  rain = null;
  layers?.dispose();
  layers = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = null;
  scan?.dispose();
  scan = new RoomScan(scene, draw, renderer.xr.getSession(), xrMode);
  scan.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  draw();
}
async function switchToRoomScan() {
  if (xrMode === "immersive-ar") {
    startRoomScan();
    return;
  }
  pendingRoomHandoff = true;
  try {
    const session = renderer.xr.getSession();
    if (session) {
      const ended = new Promise((resolve) => session.addEventListener("end", resolve, { once: true }));
      await session.end();
      await ended;
    }
    await enter("immersive-ar", true);
  } catch (error) {
    status.textContent = `Open the room scan with the mixed reality button: ${error.message}`;
  }
}
function drawRoomUI() {
  const s = scan;
  const title =
    s.stage === 0
      ? "Scan your room · Quest 3S"
      : s.stage === 2
        ? "Your surroundings, sampled."
        : s.frozen
          ? "Frozen room cloud"
          : "Sweep across real surfaces";
  const body =
    s.stage === 0
      ? "Uses browser estimates of real surfaces, with permission.\nYou are in MIXED REALITY; start and look around.\nA sparse surface scan; no camera images are recorded."
      : s.stage === 2
        ? "These points came from your headset's surface estimates.\nGaps and simplified shapes reflect the data it supplied.\nThe scan stays in this session and clears on exit."
        : s.frozen
          ? "GRIP to move / turn; BOTH grips to resize this copy.\nResume returns every point to its real-world position.\nKeep passthrough visible as you explore."
          : "Aim at a real surface. A green dot means a return.\nHOLD TRIGGER and sweep slowly to accumulate points.\nFreeze to inspect a movable miniature of your scan.";
  label(title, 0, 1.02, 2.4, 0.18, 48, "#e6f4f5", "#0b2430");
  label(body, 0, 0.78, 2.4, 0.3, 33, "#e6f4f5", "#0b2430");
  label(s.message, 0, -0.5, 2.3, 0.18, 28, "#e6f4f5", "#0b2430");
  label(
    `${s.records.length} points · WebXR surface estimates · Color: ${s.colorMode}`,
    0,
    -0.64,
    2.3,
    0.09,
    24,
    "#b6d1d9",
    "#0b2430",
  );
  if (s.stage === 0) {
    if (s.status !== "unavailable")
      button("Start room scan", 0, -0.77, () => s.explore(), 1.65);
  } else {
    button(
      s.stage === 2 ? "Scan again" : s.frozen ? "Resume" : "Freeze",
      -0.84,
      -0.77,
      () => {
        stopRainInput();
        if (s.stage === 2) startRoomScan();
        else if (s.frozen) s.resume();
        else s.freeze();
      },
      0.52,
    );
    button("Color", -0.28, -0.77, () => s.toggleColor(), 0.52);
    button(
      s.status === "error" || s.status === "waiting" ? "Retry" : "Clear",
      0.28,
      -0.77,
      () => {
        stopRainInput();
        if (s.status === "error" || s.status === "waiting") s.retry();
        else s.clearScan();
      },
      0.52,
    );
    button("Back to VR", 0.84, -0.77, () => renderer.xr.getSession()?.end(), 0.52);
  }
  navigation();
}
function drawScanUI() {
  const s = scan;
  if (s.room) {
    drawRoomUI();
    return;
  }
  if (s.stage === 0) {
    drawScanChooserUI();
    return;
  }
  const copy = [
    null,
    [
      "Which surfaces are still hidden?",
      "HOLD TRIGGER to sweep. Each bright ray stops at a first return.\nGRIP to turn / move; BOTH grips to resize. Scan another side.\nA missing patch may be occluded. Compare with the solid scene.",
    ],
    [
      "Different viewpoints fill different gaps.",
      "Occlusion means one surface blocks another from view.\nClassification labels measured points; it cannot invent hidden ground.\nReal lidar also needs georeferencing and error checks.",
    ],
  ];
  const [title, body] = copy[s.stage];
  label(title, 0, 1.02, 2.4, 0.18, 48, "#e6f4f5", "#0b2430");
  label(body, 0, 0.78, 2.4, 0.3, 33, "#e6f4f5", "#0b2430");
  label(
    s.hideVegetation
      ? "Vegetation hidden · Missing ground stays missing"
      : "Cyan: ground · Gold: structure · Green: vegetation",
    0,
    -0.52,
    2.3,
    0.12,
    28,
    "#e6f4f5",
    "#0b2430",
  );
  button(
    s.reveal ? "Cloud only" : "Compare surfaces",
    -0.84,
    -0.77,
    () => s.toggleReveal(),
    0.52,
  );
  button(
    s.hideVegetation ? "All points" : "Hide plants",
    -0.28,
    -0.77,
    () => s.toggleVegetation(),
    0.52,
  );
  button(
    "Clear scan",
    0.28,
    -0.77,
    () => {
      stopRainInput();
      s.clearScan();
    },
    0.52,
  );
  button(
    s.stage === 2 ? "Next scene" : "Takeaways",
    0.84,
    -0.77,
    () => {
      stopRainInput();
      if (s.stage === 2) startScan(undefined, true);
      else s.finish();
    },
    0.52,
  );
  label(
    `${s.sceneInfo.name} · ${s.records.length.toLocaleString()} / 18,000 samples · First surface only`,
    0,
    -0.64,
    2.3,
    0.09,
    24,
    "#b6d1d9",
    "#0b2430",
  );
  navigation();
}
function drawScanChoiceCard(kind, x, title, subtitle, action) {
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.22),
    new THREE.MeshBasicMaterial({ color: kind === "room" ? 0x294046 : 0x193e47,
      side: THREE.DoubleSide }),
  );
  card.position.set(x, -0.08, 0.01);
  card.userData.action = () => {
    sound.click();
    action();
  };
  card.userData.label = title;
  buttons.push(card);
  uiParent.add(card);
  const thumbnail = scanThumbnail(kind);
  thumbnail.position.set(x, 0.1, 0.16);
  uiParent.add(thumbnail);
  label(title, x, -0.38, 1.04, 0.12, 37, "#ffffff").position.z = 0.37;
  label(subtitle, x, -0.51, 1.04, 0.11, 25, "#c7e6e5").position.z = 0.37;
}
function drawScanChooserUI() {
  label("Scan the Hidden World", 0, 0.96, 2.3, 0.2, 54, "#e6f4f5", "#0b2430");
  label("Choose a point-cloud experience. A range return becomes one 3D point.",
    0, 0.69, 2.3, 0.2, 30, "#b6d1d9", "#0b2430");
  drawScanChoiceCard("synthetic", -0.61, "Synthetic scan", "Explore hidden surfaces", () => {
    scan.group.visible = true;
    scan.explore();
  });
  drawScanChoiceCard("room", 0.61, "Room scan · MR", "Scan nearby real surfaces", switchToRoomScan);
  navigation();
}
function drawLayersUI() {
  const l = layers;
  label(
    l.finished ? "A place, many datasets" : "Stand Inside the Layers",
    0,
    0.91,
    2.35,
    0.19,
    48,
    "#e6f4f5",
    "#0b2430",
  );
  if (l.finished) {
    label(
      "Each layer answers a different question.\nA floodplain is low land, not a flood prediction.\nPolitical boundaries are drawn by people; they are not physical walls.",
      0,
      0.48,
      2.35,
      0.39,
      35,
      "#e6f4f5",
      "#0b2430",
    );
    button("Build another view", 0, -0.62, () => l.reset(), 1.5);
    navigation(-1.02);
    return;
  }
  label("Toggle layers around you · right stick: 30° turns", 0, 0.68,
    2.3, 0.13, 28, "#b6d1d9", "#0b2430");
  {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    renderLayerMap(canvas.getContext("2d"), l.selected);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const map = new THREE.Mesh(
      new THREE.PlaneGeometry(1.17, 1.17),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    map.position.set(-0.52, 0.01, 0.04);
    uiParent.add(map);
    LAYER_KEYS.forEach((key, i) => {
      const marked = l.selected.has(key) ? "[x]" : "[ ]";
      button(`${marked} ${LAYER_NAMES[key]}`, 0.65, 0.47 - i * 0.17, () => l.toggle(key), 1.02);
    });
    label(l.lastLayer ? LAYER_HINTS[l.lastLayer] : "Select a map layer; watch it appear around you.",
      0, -0.69, 2.3, 0.12, 27, "#b6d1d9", "#0b2430");
    label(
      l.selected.has("floodplain")
        ? "Blue: low river land · Not a modeled flood extent"
        : "Synthetic place · Map north is an arbitrary model direction",
      0, -0.83, 2.3, 0.1, 24, "#b6d1d9", "#0b2430",
    );
    navigation(-1.02);
    return;
  }
}
function drawViewshedUI() {
  const v = viewshed;
  label(
    v.finished ? "What blocks the view?" : "Can You See It?",
    0, 0.91, 2.35, 0.19, 48, "#e6f4f5", "#0b2430",
  );
  if (v.finished) {
    label(
      "A viewshed tests line of sight across a DEM.\nThe ridge blocks the blue target at eye level; a tower can see it.\nThis model tests terrain only, not trees or buildings.",
      0, 0.39, 2.35, 0.48, 33, "#e6f4f5", "#0b2430",
    );
    button("Try another viewpoint", 0, -0.62, () => v.reset(), 1.5);
    navigation(-1.02);
    return;
  }
  label("Tap the map to move the observer · watch the landscape change",
    0, 0.68, 2.3, 0.13, 28, "#b6d1d9", "#0b2430");
  {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    v.renderMap(canvas.getContext("2d"));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const map = new THREE.Mesh(
      new THREE.PlaneGeometry(1.17, 1.17),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    map.position.set(-0.52, 0.01, 0.06);
    map.userData.action = (hit) => v.placeFromMap(hit);
    map.userData.debugHidden = true;
    uiParent.add(map);
    buttons.push(map);
    label("Move the gold observer.\nCan it see the blue target?", 0.64, 0.48, 1.06, 0.19, 31, "#e6f4f5", "#0b2430");
    button("Eye level · 2 m", 0.64, 0.18, () => v.setHeight(2), 1.04)
      .material.color.set(v.observer.height === 2 ? 0xffffff : 0x91a6a4);
    button("Tower · 12 m", 0.64, -0.05, () => v.setHeight(12), 1.04)
      .material.color.set(v.observer.height === 12 ? 0xffffff : 0x91a6a4);
    button("Reset point", 0.64, -0.31, () => v.reset(), 1.04);
    label("Map and landscape agree · right stick: 30° turns", 0, -0.68, 2.3, 0.12, 27, "#b6d1d9", "#0b2430");
  }
  label(
    `${v.visiblePercent}% nearby ground visible · Blue target ${v.trace.visible ? "VISIBLE" : "BLOCKED"} · Terrain only`,
    0, -0.84, 2.3, 0.1, 25, "#d8f3e6", "#0b2430",
  );
  navigation(-1.02);
}
function drawPixelsUI() {
  const p = pixels;
  label(
    p.finished ? "What did the pixel miss?" : "How Big Is a Pixel?",
    0, 0.91, 2.35, 0.19, 48, "#e6f4f5", "#0b2430",
  );
  if (p.finished) {
    label(
      "Ground sample distance (GSD) is the pixel's ground width.\nLarge pixels mix narrow roads, rivers, and other cover.\nThese are averaged model colors, not satellite reflectance.",
      0, 0.39, 2.35, 0.48, 33, "#e6f4f5", "#0b2430",
    );
    button("Compare again", 0, -0.62, () => p.reset(), 1.5);
    navigation(-1.02);
    return;
  }
  label(
    "GSD = ground width of one pixel · right stick: 30° turns",
    0, 0.68, 2.3, 0.12, 30, "#b6d1d9", "#0b2430",
  );
  for (const [size, x] of [[2, -0.84], [8, -0.28], [24, 0.28], [48, 0.84]])
    button(`${size} m`, x, 0.5, () => p.setSize(size), 0.48)
      .material.color.set(p.size === size ? 0xffffff : 0x91a6a4);
  for (const [size, x] of [[2, -0.56], [p.size, 0.56]]) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    p.renderMap(canvas.getContext("2d"), size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const map = new THREE.Mesh(
      new THREE.PlaneGeometry(1.03, 1.03),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    map.position.set(x, -0.07, 0.06);
    map.userData.action = (hit) => p.placeFromMap(hit);
    map.userData.debugHidden = true;
    uiParent.add(map);
    buttons.push(map);
  }
  const cell = p.cell;
  const percent = (index) => Math.round((cell.counts[index] / (p.size ** 2)) * 100);
  label(
    `Selected ${p.size} m GSD · ${p.size ** 2} m²\nForest ${percent(1)}% · Water ${percent(2)}% · Road ${percent(3)}% · Other ${percent(0)}%`,
    0, -0.675, 2.3, 0.14, 27, "#e6f4f5", "#0b2430",
  );
  if (p.answer === null) {
    label("Prediction: any all-water pixel at 48 m?", -0.35, -0.82, 1.5, 0.12, 27, "#d8f3e6", "#0b2430");
    button("Yes", 0.57, -0.82, () => p.predictPureWater(true), 0.42);
    button("No", 1.03, -0.82, () => p.predictPureWater(false), 0.34);
  } else
    label(
      `${p.answer === p.pureWaterAt48 ? "Correct" : "Look again"}: no pure-water 48 m pixel; narrow river mixes with land.`,
      0, -0.82, 2.3, 0.12, 27, "#d8f3e6", "#0b2430",
    );
  navigation(-1.03);
}
function drawRainChoiceCard(kind, x, title, subtitle) {
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.22),
    new THREE.MeshBasicMaterial({ color: kind === "erosion" ? 0x47362f : 0x193e47,
      side: THREE.DoubleSide }),
  );
  card.position.set(x, -0.08, 0.01);
  card.userData.action = () => {
    sound.click();
    startRain(kind, true);
  };
  card.userData.label = title;
  buttons.push(card);
  uiParent.add(card);
  const thumbnail = rainThumbnail(kind);
  thumbnail.position.set(x, 0.1, 0.16);
  uiParent.add(thumbnail);
  label(title, x, -0.38, 1.04, 0.12, 37, "#ffffff").position.z = 0.37;
  label(subtitle, x, -0.51, 1.04, 0.11, 25, "#c7e6e5").position.z = 0.37;
}
function drawRainChooserUI() {
  label("Make It Rain", 0, 0.96, 2.3, 0.2, 54, "#e6f4f5", "#0b2430");
  label("Point at a terrain and press trigger. Sculpt while water flows.",
    0, 0.69, 2.3, 0.2, 31, "#b6d1d9", "#0b2430");
  drawRainChoiceCard("drainage", -0.61, "Drainage sandbox", "Follow runoff and ponds");
  drawRainChoiceCard("erosion", 0.61, "Erosion tray", "Watch channels form");
  navigation();
}
function drawRainUI() {
  const r = rain;
  if (r.stage === 0) {
    drawRainChooserUI();
    return;
  }
  const copy = [
    null,
    [
      r.kind === "erosion"
        ? "Shape the land. Watch water reshape it."
        : "Shape the land. Follow the water.",
      r.kind === "erosion"
        ? "Runoff cuts loose soil; slower water deposits sediment.\nLEFT TRIGGER: pour. RIGHT TRIGGER: sculpt while it flows.\nGRIP: move / turn. BOTH grips: resize the tray."
        : "Runoff follows slope toward an outlet; ridges form divides.\nLEFT TRIGGER: rain. RIGHT TRIGGER: sculpt the land.\nGRIP: move / turn. BOTH grips: resize the model.",
    ],
    [
      "Predict the path",
      "Rain will fall at the gold ring near the ridge.\nWhich outlet will this water reach?\nChoose A or B, then watch the path.",
    ],
    [
      r.answer === r.destination
        ? "Your prediction follows the slope."
        : "The slope sends this rain the other way.",
      `This rain reaches outlet ${r.destination}. Follow its glowing path.\nEach colored area drains to one outlet: a watershed.\nThe white ridge line is the divide between them.`,
    ],
    [
      "One landscape. Two watersheds.",
      "A watershed is land that drains to a common outlet.\nNearby drops can end up in different places.\nRidges divide the land into different drainage areas.",
    ],
  ];
  if (r.stage === 4 && r.edited)
    copy[4] = [
      "Change the land. Change the flow.",
      "A watershed is land that drains to a common outlet.\nRidges redirect runoff; hollows fill before spilling.\nThis model traces paths, not water depth or flood risk.",
    ];
  if (r.kind === "erosion") {
    copy[4] = [
      "Water shapes its own path.",
      "Flow removes loose material and carries it downhill.\nChannels can join; slower water can leave sediment behind.\nThis accelerated experiment is not a real erosion forecast.",
    ];
  }
  const [title, body] = copy[r.stage];
  label(title, 0, 1.02, 2.4, 0.18, 48, "#e6f4f5", "#0b2430");
  label(body, 0, 0.78, 2.4, 0.3, 33, "#e6f4f5", "#0b2430");
  if (r.stage === 1) {
    if (r.kind === "erosion") {
      button("Reset", -0.78, -0.77, () => { stopRainInput(); r.restore(); }, 0.48);
      button(r.originalBed.visible ? "Hide bed" : "Compare", -0.26, -0.77,
        () => { r.originalBed.visible = !r.originalBed.visible; draw(); }, 0.48);
      button(r.replayTime >= 0 ? "Live" : "Replay", 0.26, -0.77,
        () => { stopRainInput(); if (r.replayTime >= 0) r.endReplay(); else r.startReplay(); }, 0.48);
      button("Takeaways", 0.78, -0.77, () => { stopRainInput(); r.finish(); }, 0.48);
    } else {
      button("Reset terrain", -0.59, -0.77,
        () => { stopRainInput(); r.restore(); }, 0.66);
      button(r.overlay ? "Hide basins" : "Show basins", 0.08, -0.77,
        () => r.toggleOverlay(), 0.59);
      button(r.edited ? "Takeaways" : "Prediction", 0.68, -0.77,
        () => { stopRainInput(); if (r.edited) r.finish(); else r.challenge(); }, 0.55);
    }
  }
  if (r.stage === 2) {
    button("Outlet A · left", -0.54, -0.77, () => r.choose("A"), 1.02);
    button("Outlet B · right", 0.58, -0.77, () => r.choose("B"), 1.02);
  }
  if (r.stage === 3) {
    button(
      "Rain here again",
      -0.54,
      -0.77,
      () => {
        r.playback = 4;
      },
      1.02,
    );
    button("Takeaways", 0.58, -0.77, () => r.finish(), 1.02);
  }
  if (r.stage === 4) {
    label(
      r.kind === "erosion"
        ? "Simplified water + loose sediment. No soil types, roots,\nreal-world erosion rates, or changing tray tilt."
        : "This model shows runoff and pond storage. Rain can\nalso soak into soil, evaporate, or collect in low spots.",
      0,
      -0.62,
      2.3,
      0.16,
      28,
      "#e6f4f5",
      "#0b2430",
    );
    button("Make rain again", 0, -0.77, () => startRain(r.kind, true), 1.65);
  } else
    label(
      r.kind === "erosion"
        ? r.replayTime >= 0
          ? "Time-lapse: saved bed shapes · Water paused · Live returns to experiment"
          : `Dark: cut · Pale: deposits · ${r.terrainChange.changed} cells changed · Replay after pouring`
        : r.overlay && r.edited
          ? "Blue: A · Gold: B · Purple: pond catchments · Cyan: stored water"
          : r.overlay
            ? "A: blue / round outlet    ·    B: gold / square outlet"
            : "Surface-flow model · Synthetic terrain · No flood prediction",
      0,
      -0.55,
      2.3,
      0.12,
      28,
      "#e6f4f5",
      "#0b2430",
    );
  navigation();
}
function next() {
  preservePose =
    step === 4 && floatingModel
      ? {
          position: floatingModel.position.clone(),
          quaternion: floatingModel.quaternion.clone(),
          scale: floatingModel.scale.clone(),
        }
      : null;
  step++;
  draw();
  sound.cue(step === 5 ? "reveal" : "measure");
}
function planar() {
  const first = content.children.length;
  const count = step === 0 ? 1 : step === 1 ? 2 : 3;
  const fresh = lastAnimatedRangeStep === step ? -1 : step < 3 ? count - 1 : -1;
  for (let x = -0.9; x <= 0.91; x += 0.15)
    line(
      [new THREE.Vector3(x, -0.75, -0.03), new THREE.Vector3(x, 0.65, -0.03)],
      0x254651,
    );
  for (let y = -0.75; y <= 0.66; y += 0.15)
    line(
      [new THREE.Vector3(-0.9, y, -0.03), new THREE.Vector3(0.9, y, -0.03)],
      0x254651,
    );
  anchors.slice(0, count).forEach((a, i) => {
    const ring = circle(a, ranges[i], palette[i]);
    if (i === fresh) rangeAnimations.push({ object: ring, delay: 0 });
    point(a, palette[i], 0.035);
    label(String.fromCharCode(65 + i), a.x, a.y + 0.07, 0.14, 0.09, 55);
    if (step === 3) {
      const tolerance = noisy ? 0.1 : 0.025;
      const band = new THREE.Mesh(
        new THREE.RingGeometry(
          ranges[i] - tolerance,
          ranges[i] + tolerance,
          96,
        ),
        new THREE.MeshBasicMaterial({
          color: palette[i],
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      band.position.set(a.x, a.y, -0.005);
      content.add(band);
    }
  });
  if (step === 1) {
    [target, alternative].forEach((p, i) => {
      const m = point(p, 0xffffff, 0.065);
      m.userData.action = () => {
        sound.click();
        sound.cue(i === 0 ? "correct" : "blocked");
        prediction =
          i === 0
            ? "Your choice matches the third distance."
            : "Your choice matched two distances. The third selects the other point.";
        next();
      };
      m.userData.label = `Candidate ${i + 1}`;
      buttons.push(m);
      label(i === 0 ? "1" : "2", p.x, p.y, 0.1, 0.1, 65, "#08241e").position.z =
        0.115;
    });
  }
  if (step === 2) {
    point(target, 0xffffff, 0.045);
    point(alternative, 0x607781, 0.025);
    label("YOU", target.x + 0.12, target.y, 0.22, 0.09, 45);
  }
  const diagram = new THREE.Group();
  const items = content.children.slice(first);
  for (const item of items) diagram.add(item);
  content.add(diagram);
  diagram.scale.setScalar(0.58);
  diagram.position.y = -0.07;
  if (step === 3) {
    const pts = candidates(3, noisy ? 0.1 : 0.025);
    const geom = new THREE.BufferGeometry().setFromPoints(
      pts.map((p) => new THREE.Vector3(p.x, p.y, 0.05)),
    );
    diagram.add(
      new THREE.Points(
        geom,
        new THREE.PointsMaterial({ size: 0.011, color: 0xffffff }),
      ),
    );
    button(
      noisy ? "Tolerance: ±0.10 → smaller" : "Tolerance: ±0.025 → larger",
      0,
      -0.61,
      () => {
        noisy = !noisy;
        draw();
      },
      1.2,
    );
  }
  lastAnimatedRangeStep = step;
}
function resetModelView() {
  if (!floatingModel) return;
  grab?.cancel();
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  const forward = new THREE.Vector3();
  cam.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
  forward.normalize();
  cam.getWorldPosition(floatingModel.position);
  floatingModel.position.addScaledVector(forward, 1.3);
  floatingModel.position.y -= 0.1;
  floatingModel.quaternion.setFromEuler(
    new THREE.Euler(0.12, Math.atan2(-forward.x, -forward.z) + 0.35, 0, "YXZ"),
  );
  floatingModel.scale.setScalar(0.35);
}
function spatial() {
  const group = new THREE.Group();
  floatingModel = group;
  scene.add(group);
  const beacons = beacons3D.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const t = new THREE.Vector3(target3D.x, target3D.y, target3D.z);
  // Use the bounds of all FOUR shells for a stable shared center across stages.
  const bounds = new THREE.Box3();
  beacons.forEach((a) => {
    const r = a.distanceTo(t);
    bounds.expandByPoint(a.clone().addScalar(r));
    bounds.expandByPoint(a.clone().addScalar(-r));
  });
  const center = bounds.getCenter(new THREE.Vector3());
  beacons.slice(0, step === 4 ? 3 : 4).forEach((a, i) => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(a.distanceTo(t), 48, 32),
      new THREE.MeshBasicMaterial({
        color: palette[i],
        wireframe: true,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    sphere.position.copy(a).sub(center);
    group.add(sphere);
    if (lastAnimatedRangeStep !== step && (step === 4 || i === 3))
      rangeAnimations.push({ object: sphere, delay: step === 4 ? i * 0.2 : 0 });
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 16, 12),
      new THREE.MeshBasicMaterial({ color: palette[i] }),
    );
    beacon.position.copy(a).sub(center);
    group.add(beacon);
    // A short radius spoke makes the assembly's rotation visible even for symmetric shells.
    const spoke = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        a.clone().sub(center),
        a
          .clone()
          .add(new THREE.Vector3(a.distanceTo(t), 0, 0))
          .sub(center),
      ]),
      new THREE.LineBasicMaterial({
        color: palette[i],
        transparent: true,
        opacity: 0.55,
      }),
    );
    group.add(spoke);
  });
  lastAnimatedRangeStep = step;
  [t, ...(step === 4 ? [new THREE.Vector3(t.x, t.y, -t.z)] : [])].forEach(
    (p) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      dot.position.copy(p).sub(center);
      group.add(dot);
    },
  );
  group.userData.radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  grab = new ModelGrab(group);
  resetModelView();
  if (preservePose) {
    group.position.copy(preservePose.position);
    group.quaternion.copy(preservePose.quaternion);
    group.scale.copy(preservePose.scale);
    preservePose = null;
  }
}
function draw() {
  drawScene();
  if (devPreview) {
    let panel = document.querySelector("#dev-controls");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "dev-controls";
      panel.style.cssText =
        "position:fixed;top:0;right:0;z-index:9;max-width:180px;background:#081a24d9;padding:8px;font-size:10px";
      document.body.append(panel);
    }
    panel.replaceChildren();
    if (scan?.stage === 1 && !scan.room) {
      for (const [name, z] of [
        ["Scan front", 3],
        ["Scan back", -3],
      ]) {
        const b = document.createElement("button");
        b.textContent = name;
        b.onclick = () => {
          scan.group.updateWorldMatrix(true, true);
          const origin = scan.group.localToWorld(new THREE.Vector3(0, 1.4, z));
          for (let x = -1; x <= 1; x += 0.025)
            for (let y = 0; y <= 1; y += 0.025) {
              const aim = scan.group.localToWorld(new THREE.Vector3(x, y, 0));
              scan.record(origin, aim.sub(origin).normalize());
            }
          scan.refreshPoints();
          draw();
        };
        panel.append(b);
      }
    }
    if (rain?.stage === 1 && rain.kind === "erosion" && rain.mode === "rain") {
      const b = document.createElement("button");
      b.textContent = "Preview 30 seconds of pour";
      b.onclick = async () => {
        const experiment = rain;
        experiment.pouring = true;
        for (let chunk = 0; chunk < 30 && rain === experiment; chunk++) {
          for (let i = 0; i < 20; i++) experiment.update(0.05);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        experiment.pouring = false;
        if (rain === experiment) draw();
      };
      panel.append(b);
    }
    if (rain?.stage === 1) {
      for (const [name, x, delta] of [
        ["Dig hollow", -0.3, -0.3],
        ["Raise ridge", 0.3, 0.3],
      ]) {
        const b = document.createElement("button");
        b.textContent = name;
        b.onclick = () => {
          rain.applyBrush(x, -0.4, delta);
          rain.endStroke();
        };
        panel.append(b);
      }
      for (const [name, x] of [
        ["Rain on left slope", -0.3],
        ["Rain on right slope", 0.3],
      ]) {
        const b = document.createElement("button");
        b.textContent = name;
        b.style.cssText = "font-size:11px;padding:5px;margin:3px";
        b.onclick = () => rain.burst(rain.cellAt(x, -0.4));
        panel.append(b);
      }
    }
    for (const mesh of buttons) {
      if (mesh.userData.debugHidden) continue;
      const b = document.createElement("button");
      b.textContent = mesh.userData.label || "Candidate";
      b.style.cssText = "font-size:11px;padding:5px;margin:3px";
      b.onclick = mesh.userData.action;
      panel.append(b);
    }
  }
}
function updateRangeAnimations(dt) {
  if (!rangeAnimations.length) return;
  animationAge += dt;
  for (const { object, delay } of rangeAnimations) {
    const t = THREE.MathUtils.clamp((animationAge - delay) / 0.75, 0, 1);
    const ease = 1 - (1 - t) ** 3;
    object.scale.setScalar(Math.max(0.001, ease));
    object.material.opacity = object.isMesh ? 0.25 * ease : ease;
  }
  if (animationAge > rangeAnimations.at(-1).delay + 0.8) rangeAnimations = [];
}
function updateUIFade(dt) {
  if (uiFadeAge >= 0.45) return;
  uiFadeAge = Math.min(0.45, uiFadeAge + dt);
  const opacity = 1 - (1 - uiFadeAge / 0.45) ** 2;
  for (const mesh of uiFadeMeshes) mesh.material.opacity = opacity;
  if (uiFadeAge >= 0.45) uiFadeMeshes = [];
}
function drawScene() {
  clear();
  const key = pixels ? `pixels:${pixels.finished}` :
    viewshed ? `viewshed:${viewshed.view}:${viewshed.finished}` :
    layers ? `layers:${layers.view}:${layers.finished}` :
    scan ? `scan:${scan.room ? "room" : "model"}:${scan.stage}` :
    rain ? `rain:${rain.kind}:${rain.stage}` : `position:${step}`;
  if (key !== lastUIKey) uiFadeAge = 0;
  lastUIKey = key;
  uiParent = pixels?.ui ?? viewshed?.ui ?? layers?.ui ?? content;
  if (pixels) {
    drawPixelsUI();
    return;
  }
  if (viewshed) {
    drawViewshedUI();
    return;
  }
  if (layers) {
    drawLayersUI();
    return;
  }
  if (scan) {
    drawScanUI();
    return;
  }
  if (rain) {
    drawRainUI();
    return;
  }
  // Only the planar lesson uses a backdrop; the 3D assembly lives in world space.
  if (!isSpatial()) {
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 3.9),
      new THREE.MeshBasicMaterial({ color: 0x0b2430, side: THREE.DoubleSide }),
    );
    back.position.set(0, -0.03, -1.15);
    content.add(back);
  }
  if (step === -2) {
    label("START WITH WHAT WE KNOW", 0, 0.78, 2, 0.14, 38, "#a6f5d9");
    label("Distance is not direction.", 0, 0.52, 2.15, 0.2, 52);
    label(
      "A beacon is a fixed point whose location we know.\nImagine a signal tells us how far away we are.\nIt does not tell us which direction to look.",
      0,
      0.13,
      2.15,
      0.4,
      39,
    );
    label(
      "Knowing the distance still leaves many possible places.\nLet’s find them in a small model of space.",
      0,
      -0.3,
      2.15,
      0.24,
      36,
    );
    button(
      "Show the possible locations",
      0,
      -0.64,
      () => {
        step = 0;
        draw();
        sound.cue("measure");
      },
      1.8,
    );
    navigation();
    return;
  }
  if (step === -1) {
    label("SPATIAL DISCOVERY LAB", 0, 0.78, 2, 0.16, 48, "#a6f5d9");
    label("Choose an experience", 0, 0.54, 2, 0.2, 58);
    button("Find Yourself Without GPS", 0, 0.27, start, 1.75);
    button("Make It Rain", 0, 0.09, startRain, 1.75);
    label(
      "About 4 minutes each · Point and press the trigger",
      0,
      -0.82,
      2,
      0.12,
      32,
    );
    button("Scan the Hidden World", 0, -0.09, startScan, 1.75);
    button("Stand Inside the Layers", 0, -0.27, startLayers, 1.75);
    button("Can You See It?", 0, -0.45, startViewshed, 1.75);
    button("How Big Is a Pixel?", 0, -0.63, startPixels, 1.75);
    navigation(-0.98);
    return;
  }
  if (step >= stages.length) {
    label("You found your place.", 0, 0.68, 2, 0.2, 65, "#a6f5d9");
    label(
      "Distance narrows the possibilities.\nMore well-placed beacons reduce ambiguity.\nMeasurement uncertainty leaves a region.",
      0,
      0.18,
      2,
      0.5,
      43,
    );
    label(
      "A positioning model, not a GPS receiver.\nGPS uses satellites and also estimates receiver clock error.",
      0,
      -0.3,
      2,
      0.24,
      33,
    );
    button("Explore again", 0, -0.64, start, 1.2);
    navigation();
    return;
  }
  const s = stages[step];
  if (isSpatial()) {
    spatial();
    label(s.title, 0, 1.02, 2.4, 0.18, 48, "#e6f4f5", "#0b2430");
    label(s.body, 0, 0.79, 2.4, 0.29, 33, "#e6f4f5", "#0b2430");
    label(
      "Hold a SIDE GRIP to move / turn the whole model.\nHold BOTH grips and spread / squeeze to resize.",
      0,
      -0.59,
      2.3,
      0.22,
      33,
      "#e6f4f5",
      "#0b2430",
    );
    button(s.action, 0, -0.79, next, 1.65);
    navigation();
    return;
  }
  label(
    `${String(step + 1).padStart(2, "0")} / 06    ·    FIND YOURSELF WITHOUT GPS`,
    0,
    1.04,
    2.1,
    0.1,
    31,
    "#a6f5d9",
  );
  label(s.title, 0, 0.88, 2.15, 0.17, 48);
  label(s.body, 0, 0.66, 2.15, 0.28, 32);
  planar();
  if (step === 2 && prediction)
    label(prediction, 0, -0.62, 2, 0.1, 29, "#a6f5d9");
  if (s.action) button(s.action, 0, -0.79, next, 1.65);
  navigation();
}
function place() {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  cam.getWorldPosition(pos);
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
  dir.normalize();
  root.position.copy(pos).addScaledVector(dir, 2.25);
  root.position.y = pos.y - 0.23;
  root.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  pendingPlacement = false;
  if (floatingModel) resetModelView();
  if (rain) rain.place(cam);
  scan?.place(cam);
  layers?.place(cam);
  viewshed?.place(cam);
  pixels?.place(cam);
}
const controllers = [];
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  scene.add(c);
  const grip = renderer.xr.getControllerGrip(i);
  scene.add(grip);
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xa6f5d9 }),
  );
  grip.add(handle);
  const beam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -1),
    ]),
    new THREE.LineBasicMaterial({ color: 0xa6f5d9 }),
  );
  beam.scale.z = 4;
  c.add(beam);
  c.addEventListener("connected", (event) => {
    c.userData.xrInput = event.data;
  });
  c.addEventListener("selectstart", () => {
    if (grab?.hands.size || rain?.grab.hands.size || scan?.grab.hands.size)
      return;
    const hit = intersect(c);
    if (hit) {
      hit.object.userData.action?.(hit);
      return;
    }
    if (viewshed) {
      viewshed.placeFromRay(raycaster);
      return;
    }
    if (pixels) {
      pixels.placeFromRay(raycaster);
      return;
    }
    if (scan?.stage === 1) {
      c.userData.scanning = true;
      return;
    }
    if (rain?.stage === 1) {
      const land = rainHit(c);
      if (land) {
        const action = rain.beginTrigger(
          c.userData.xrInput?.handedness,
          i,
          land.point,
          grip.visible ? grip.getWorldPosition(new THREE.Vector3()) : null,
        );
        c.userData.raining = action === "rain";
        if (c.userData.raining) rainPointer = i;
      }
    }
  });
  c.addEventListener("selectend", () => {
    rain?.endStroke(i);
    c.userData.raining = false;
    c.userData.scanning = false;
  });
  c.addEventListener("squeezestart", () => {
    if (scan && (scan.room || scan.stage === 1) && grip.visible) {
      if (scan.room && !scan.frozen) return;
      grip.updateWorldMatrix(true, false);
      if (scan.grab.hands.size || (!intersect(c) && scanHit(c))) {
        for (const { c: controller } of controllers)
          controller.userData.scanning = false;
        scan.grab.begin(i, grip.matrixWorld);
      }
      return;
    }
    if (rain && rain.stage !== 0 && grip.visible) {
      grip.updateWorldMatrix(true, false);
      rain.group.updateWorldMatrix(true, true);
      const local = rain.group.worldToLocal(
        grip.getWorldPosition(new THREE.Vector3()),
      );
      const near =
        Math.abs(local.x) < 1.1 &&
        Math.abs(local.z) < 1.1 &&
        local.y > -0.15 &&
        local.y < 1.1;
      if (rain.grab.hands.size || (!intersect(c) && (near || rainHit(c)))) {
        rain.endStroke();
        for (const { c: controller } of controllers)
          controller.userData.raining = false;
        rain.grab.begin(i, grip.matrixWorld);
      }
      return;
    }
    if (!floatingModel || !grip.visible) return;
    grip.updateWorldMatrix(true, false);
    const near =
      grip
        .getWorldPosition(new THREE.Vector3())
        .distanceTo(floatingModel.position) <
      floatingModel.userData.radius * floatingModel.scale.x + 0.08;
    // Once one hand holds the assembly, the other can join from anywhere.
    if (grab.hands.size || near || modelHit(c)) grab.begin(i, grip.matrixWorld);
  });
  c.addEventListener("squeezeend", () => {
    grab?.release(i);
    scan?.grab.release(i);
    rain?.grab.release(i);
    rain?.endStroke(i);
  });
  c.addEventListener("disconnected", () => {
    if (scan?.room) scan.releaseInput(c.userData.xrInput);
    c.userData.xrInput = null;
    grab?.release(i);
    scan?.grab.release(i);
    rain?.grab.release(i);
    rain?.endStroke(i);
    c.userData.raining = false;
    c.userData.scanning = false;
  });
  controllers.push({ c, grip, beam, handle, id: i });
}
function scanHit(c) {
  if (!scan || (!scan.room && scan.stage === 0)) return null;
  intersect(c);
  return scan.hit(raycaster);
}
function rainHit(c) {
  if (!rain || rain.stage === 0) return null;
  intersect(c);
  rain.group.updateWorldMatrix(true, true);
  return raycaster.intersectObject(rain.terrain, false)[0];
}
function modelHit(c) {
  if (!floatingModel) return null;
  intersect(c); // Set the ray from the controller pose.
  floatingModel.updateWorldMatrix(true, true);
  return raycaster.intersectObjects(floatingModel.children, false)[0];
}
function intersect(c) {
  c.updateWorldMatrix(true, false);
  rotation.extractRotation(c.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
  if ((layers && !layers.clipboard.visible) ||
      (viewshed && !viewshed.clipboard.visible) ||
      (pixels && !pixels.clipboard.visible)) return null;
  return raycaster.intersectObjects(buttons, false)[0];
}
async function enter(mode, roomScan = mode === "immersive-ar") {
  if (mode === "immersive-vr") pendingRoomHandoff = false;
  sound.setActive(true);
  sound.unlock();
  let session;
  try {
    session = await navigator.xr.requestSession(
      mode,
      mode === "immersive-ar" ? { optionalFeatures: ["hit-test"] } : {},
    );
    xrMode = mode;
    scene.background =
      mode === "immersive-ar" ? null : new THREE.Color(0x071820);
    await renderer.xr.setSession(session);
    renderer.xr.getReferenceSpace()?.addEventListener("reset", () => {
      if (scan?.room) {
        stopRainInput();
        scan.clearScan();
        scan.message = "Tracking origin changed. Scan cleared; begin again.";
        draw();
      }
    });
    document.body.classList.add("xr-active");
    scan?.dispose();
    scan = null;
    layers?.dispose();
    layers = null;
    viewshed?.dispose();
    viewshed = null;
    pixels?.dispose();
    pixels = null;
    rain?.dispose();
    rain = null;
    stopRainInput();
    step = -1;
    elapsed = 0;
    session.addEventListener("visibilitychange", () => {
      sound.setActive(session.visibilityState === "visible");
      if (session.visibilityState !== "visible") {
        grab?.cancel();
        stopRainInput();
      }
    });
    if (roomScan) startRoomScan();
    else draw();
    pendingPlacement = true;
    pendingRoomHandoff = false;
    status.textContent = "";
  } catch (e) {
    if (session) await session.end().catch(() => {});
    status.textContent = pendingRoomHandoff
      ? "VR ended. Select Open room scan in MR to continue; the browser requires a fresh tap to enter mixed reality."
      : `Could not enter ${mode === "immersive-ar" ? "mixed reality" : "VR"}: ${e.message}. You can try again.`;
  }
}
renderer.xr.addEventListener("sessionend", () => {
  sound.setActive(false);
  rightTurnReady = true;
  layers?.dispose();
  layers = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = null;
  if (scan?.room) {
    scan.dispose();
    scan = null;
  }
  xrMode = null;
  grab?.cancel();
  stopRainInput();
  document.body.classList.remove("xr-active");
  const arButton = document.getElementById("ar");
  if (pendingRoomHandoff) {
    if (!arButton.disabled) arButton.textContent = "Open room scan in MR";
    status.textContent = "VR ended. Select Open room scan in MR to continue.";
  } else {
    if (!arButton.disabled) arButton.textContent = "Open room scan in MR";
    status.textContent = "Session ended. Choose VR or room scan in mixed reality.";
  }
});
for (const [id, mode, name] of [
  ["vr", "immersive-vr", "Enter VR"],
  ["ar", "immersive-ar", "Open room scan in MR"],
]) {
  const b = document.getElementById(id);
  b.onclick = () => enter(mode);
  if (!isSecureContext || !navigator.xr) {
    b.textContent = name;
    b.disabled = true;
    status.textContent =
      "Open this HTTPS site in Meta Quest Browser to enter an immersive experience.";
  } else
    navigator.xr
      .isSessionSupported(mode)
      .then((ok) => {
        b.disabled = !ok;
        b.textContent = ok ? name : `${name} unavailable`;
      })
      .catch(() => {
        b.textContent = `${name} unavailable`;
        status.textContent =
          "XR availability could not be checked. Reload in Quest Browser.";
      });
}
renderer.setAnimationLoop((time, frame) => {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
  lastTime = time;
  updateRangeAnimations(dt);
  updateUIFade(dt);
  const previousSamples = scan?.records.length ?? 0;
  const previousWater = rain?.water.added ?? 0;
  if (renderer.xr.isPresenting && frame) {
    if (pendingPlacement) place();
    if (
      !rain &&
      !scan &&
      !layers &&
      !viewshed &&
      !pixels &&
      (step >= 0 || step === -2) &&
      step < stages.length &&
      renderer.xr.getSession().visibilityState === "visible"
    ) {
      elapsed += dt;
      if (elapsed >= 240) {
        step = stages.length;
        draw();
      }
    }
    const landscapeDemo = pixels ?? viewshed ?? layers;
    if (landscapeDemo) {
      const visible = renderer.xr.getSession().visibilityState === "visible";
      if (visible) landscapeDemo.update(dt);
      const right = visible
        ? controllers.find(({ c }) => c.userData.xrInput?.handedness === "right")
        : null;
      const gamepad = right?.c.userData.xrInput?.gamepad;
      const axis = gamepad?.mapping === "xr-standard" ? gamepad.axes[2] ?? 0 : 0;
      if (Math.abs(axis) < 0.3) rightTurnReady = true;
      else if (rightTurnReady && Math.abs(axis) > 0.7) {
        landscapeDemo.turn(Math.sign(axis) * Math.PI / 6, renderer.xr.getCamera());
        rightTurnReady = false;
      }
      const left = visible
        ? controllers.find(
            ({ c, grip }) =>
              c.userData.xrInput?.handedness === "left" && grip.visible,
          )
        : null;
      landscapeDemo.updateClipboard(left?.grip, renderer.xr.getCamera());
    }
    if (rain && renderer.xr.getSession().visibilityState === "visible") {
      const active = controllers[rainPointer];
      let falling = false;
      if (
        active?.c.visible &&
        active.c.userData.xrInput?.handedness === "left" &&
        rain.stage === 1 &&
        !rain.grab.hands.size &&
        !intersect(active.c)
      ) {
        const land = rainHit(active.c);
        if (land) {
          rain.aim(land.point);
          falling = !!active.c.userData.raining;
        }
      }
      if (rain.stroke) {
        const held = controllers[rain.stroke.id];
        if (held?.grip.visible) {
          const aimedAtTerrain = !intersect(held.c) && !!rainHit(held.c);
          rain.moveStroke(
            held.id,
            held.grip.getWorldPosition(new THREE.Vector3()),
            aimedAtTerrain,
          );
        } else rain.endStroke();
      }
      if (rain.stage !== 0) rain.update(dt, falling);
    }
    if (scan && renderer.xr.getSession().visibilityState === "visible") {
      if (scan.room)
        scan.updateFrame(
          frame,
          renderer.xr.getReferenceSpace(),
          controllers,
          dt,
          renderer.xr.getCamera(),
          intersect,
        );
      else
        for (const { c } of controllers) {
          if (!c.visible) c.userData.scanning = false;
          if (c.visible && c.userData.scanning && !intersect(c))
            scan.sweep(raycaster.ray.origin, raycaster.ray.direction, dt);
        }
      scan.update(dt);
    }
    const poses = new Map();
    for (const { grip, id } of controllers)
      if (grip.visible) {
        grip.updateWorldMatrix(true, false);
        poses.set(id, grip.matrixWorld);
      }
    if (renderer.xr.getSession().visibilityState === "visible") {
      grab?.update(poses);
      rain?.grab.update(poses);
      scan?.grab.update(poses);
    } else {
      grab?.cancel();
      rain?.grab.cancel();
      scan?.grab.cancel();
    }
    for (const b of buttons) {
      b.userData.baseColor ??= b.material.color.clone();
      b.material.color.copy(b.userData.baseColor);
    }
    for (const { c, beam, handle, id } of controllers) {
      const hit = intersect(c);
      const model = modelHit(c) || rainHit(c) || scanHit(c);
      const ground = hit ? null : (viewshed ?? pixels)?.hitTerrain(raycaster);
      beam.visible =
        !grab?.hands.has(id) &&
        !rain?.grab.hands.has(id) &&
        !scan?.grab.hands.has(id);
      beam.scale.z = hit ? hit.distance : model ? model.distance : ground ? ground.distance : 4;
      handle.material.color.set(
        grab?.hands.has(id) ||
          scan?.grab.hands.has(id) ||
          rain?.grab.hands.has(id) ||
          rain?.stroke?.id === id
          ? 0xffca83
          : model
            || ground
            ? 0xffffff
            : 0xa6f5d9,
      );
      if (hit) hit.object.material.color.set(0xffda8b);
    }
  }
  if (devPreview && (pixels || viewshed || layers) && !renderer.xr.isPresenting) {
    const landscapeDemo = pixels ?? viewshed ?? layers;
    landscapeDemo.update(dt);
    landscapeDemo.updateClipboard(null, camera, true);
  }
  if (devPreview && rain && !renderer.xr.isPresenting)
    rain.update(dt, previewRaining);
  if (devPreview && scan && !renderer.xr.isPresenting) scan.update(dt);
  const audible =
    !document.hidden &&
    (devPreview ||
      (renderer.xr.isPresenting &&
        renderer.xr.getSession()?.visibilityState === "visible"));
  sound.setActive(audible);
  if (audible && (scan?.records.length ?? 0) > previousSamples) sound.scan(scan.lastRange);
  if (audible && rain && rain.water.added > previousWater)
    waterSoundUntil = time + 1500;
  sound.setWater(!!(audible && rain?.stage === 1 && time < waterSoundUntil));
  renderer.render(scene, camera);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) sound.setActive(false);
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
// A development-only scene preview reuses the XR buttons; no desktop product flow.
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("preview")
) {
  const requestedStep = Number(
    new URLSearchParams(location.search).get("stage") ?? -1,
  );
  if (
    Number.isInteger(requestedStep) &&
    requestedStep >= -2 &&
    requestedStep <= stages.length
  )
    step = requestedStep;
  document.body.classList.add("xr-active");
  scene.background = new THREE.Color(0x071820);
  if (new URLSearchParams(location.search).get("demo") === "layers") {
    camera.position.y = 1.6;
    startLayers();
  } else if (new URLSearchParams(location.search).get("demo") === "viewshed") {
    camera.position.y = 1.6;
    startViewshed();
  } else if (new URLSearchParams(location.search).get("demo") === "pixels") {
    camera.position.y = 1.6;
    startPixels();
  } else if (new URLSearchParams(location.search).get("demo") === "rain")
    startRain();
  else if (new URLSearchParams(location.search).get("demo") === "scan")
    startScan(
      SCAN_SCENES.find(
        (s) => s.id === new URLSearchParams(location.search).get("scene"),
      ),
    );
  else draw();
  place();
  renderer.domElement.addEventListener("pointerdown", (e) => {
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        (-e.clientY / innerHeight) * 2 + 1,
      ),
      camera,
    );
    const ui = raycaster.intersectObjects(buttons, false)[0];
    if (ui) ui.object.userData.action?.(ui);
    else if (viewshed) viewshed.placeFromRay(raycaster);
    else if (pixels) pixels.placeFromRay(raycaster);
    else if (rain?.stage === 1) {
      rain.group.updateWorldMatrix(true, true);
      const land = raycaster.intersectObject(rain.terrain, false)[0];
      if (land) {
        rain.aim(land.point);
        previewRaining = true;
      }
    }
  });
}

if (devPreview) {
  window.addEventListener("pointerup", () => {
    previewRaining = false;
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (rain?.stage !== 1) return;
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        (-e.clientY / innerHeight) * 2 + 1,
      ),
      camera,
    );
    rain.group.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObject(rain.terrain, false)[0];
    if (hit) rain.aim(hit.point);
    else previewRaining = false;
  });
}
