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
  shellIntersection,
} from "./model.js";
import "./style.css";
import { landingMarkup } from "./landing.js";
import { LabSound } from "./sound.js";
const sound = new LabSound();
import { RoomScan } from "./scan/room.js";
import { createSceneRotation, SCAN_SCENES } from "./scan/scenes.js";
import { ScanExperience } from "./scan/experience.js";
import { scanThumbnail } from "./scan/gallery.js";
import { RainExperience } from "./rain/experience.js";
import { rainThumbnail } from "./rain/gallery.js";
import { ModelGrab } from "./manipulation.js";
import { modelBeforeUi } from "./model-target.js";
import {
  LayerExperience,
  LAYER_KEYS,
  LAYER_NAMES,
  LAYER_HINTS,
  LANDSCAPE_EXTENT,
  riverX,
} from "./layers/experience.js";
import { renderLayerMap } from "./layers/map.js";
import { ViewshedExperience } from "./viewshed/experience.js";
import { PixelExperience } from "./pixels/experience.js";
import { PIXEL_EXTENT } from "./pixels/model.js";
import { SpectralExperience } from "./showcase/spectral-experience.js";
import { ClusterExperience } from "./showcase/cluster-experience.js";
import { ChangeExperience } from "./change/experience.js";
import { CHANGE_SCENES } from "./change/scenes.js";
import { ProjectionExperience } from "./showcase/projection-experience.js";
import { InterpolationExperience } from "./interpolation/experience.js";
import { SuitabilityExperience } from "./suitability/experience.js";
import { exhibitPanelHit } from "./showcase/pointer-targets.js";
import { ControllerShortcuts } from "./controller-shortcuts.js";
import { hasQuestShortcuts } from "./input-layout.js";
import { ControllerGuide } from "./controller-guide.js";
import { addControllerIllustrations } from "./controller-splash.js";
import { initRecommendedVideos } from "./videos.js";
const nextScanScene = createSceneRotation();
const devPreview =
  import.meta.env.DEV && new URLSearchParams(location.search).has("preview");
const previewGuide = devPreview && new URLSearchParams(location.search).has("guide");
const app = document.querySelector("#app");
app.innerHTML = landingMarkup;
initRecommendedVideos(app);
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
  devPreview ? 90 : 65,
  innerWidth / innerHeight,
  0.03,
  700,
);
camera.position.set(0, 0, 0);
const root = new THREE.Group();
scene.add(root);
const content = new THREE.Group();
root.add(content);
const soundPanel = new THREE.Group();
scene.add(soundPanel);
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
let showcase = null;
let xrMode = null;
let pendingRoomHandoff = false;
let rightTurnReady = true;
const controllerShortcuts = new ControllerShortcuts();
const fallbackPreview = devPreview && new URLSearchParams(location.search).has("fallback");
let showFallbackControls = fallbackPreview;
let rain = null,
  rainPointer = 0,
  previewRaining = false;
let previewSpinPointer = null;
let previewSpinTime = 0;
let floatingModel = null,
  grab = null,
  preservePose = null;
let rangeAnimations = [];
let animationAge = 0;
let lastAnimatedRangeStep = null;
let uiFadeMeshes = [];
let uiFadeAge = 1;
let lastUIKey = "";
let clusterReadout = null;
let soundMenuOpen = false;
let soundButtons = [];
let soundHiddenVisuals = [];
let soundPreviousBackground = null;
let soundBackgroundSaved = false;
const isSpatial = () => step >= 4 && step < stages.length;
const isMenu = () => step === -1 && !scan && !rain && !layers && !viewshed && !pixels && !showcase;
const palette = [0x6ef0d1, 0xffca83, 0xc6b7ff, 0xff9ba8];
function clear() {
  clusterReadout = null;
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
  paintLabel(c, text, w, size, color, bg);
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
function paintLabel(c, text, w, size, color, bg) {
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
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
}
function updateClusterReadout() {
  if (!clusterReadout || !showcase || showcase.kind !== "cluster") return;
  const texture = clusterReadout.material.map;
  paintLabel(texture.image, showcase.selectedText, 2.35, 27, "#b6d1d9", "#0b2430");
  texture.needsUpdate = true;
}
// Keep guided content within a comfortable downward glance from eye level.
const GUIDED_CARD_Y = -0.57;
const GUIDED_INFO_Y = -0.95;
const GUIDED_ACTION_Y = -1.16;
function lessonCard(title, body, y = GUIDED_CARD_Y) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 250;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b2430";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e6f4f5";
  ctx.font = "600 59px system-ui, sans-serif";
  ctx.fillText(title, 600, 48, 1140);
  ctx.font = "500 43px system-ui, sans-serif";
  body.split("\n").forEach((line, index, lines) =>
    ctx.fillText(line, 600, 170 + (index - (lines.length - 1) / 2) * 50, 1140),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.5),
    new THREE.MeshBasicMaterial({ map: texture, transparent: uiFadeAge < 0.45,
      opacity: uiFadeAge < 0.45 ? uiFadeAge / 0.45 : 1, side: THREE.DoubleSide }),
  );
  if (uiFadeAge < 0.45) uiFadeMeshes.push(card);
  card.position.set(0, y, 0.02);
  uiParent.add(card);
  return card;
}
function button(text, x, y, action, w = 0.75, selected = false) {
  const m = label(text, x, y, w, 0.16, 48,
    selected ? "#251a08" : "#08241e", selected ? "#ffdc83" : "#a6f5d9");
  m.position.z = 0.08;
  m.userData.action = () => {
    sound.click();
    action();
  };
  m.userData.label = text;
  buttons.push(m);
  return m;
}
function takeawayActions(y, restart = start) {
  button("Restart", -0.57, y, restart, 1.02);
  button("Exit to Menu", 0.57, y, openMenu, 1.02);
}
function foregroundTakeaway() {
  for (const mesh of uiParent.children) {
    mesh.renderOrder = 10;
    mesh.material.depthTest = false;
    mesh.material.depthWrite = false;
  }
}
function menuCard({ title, lines, category, preview, glyph, color, action }, index, total) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#173440";
  ctx.fillRect(0, 0, 720, 360);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 9, 360);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 716, 356);
  ctx.fillStyle = "#294954";
  ctx.fillRect(22, 62, 135, 231);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = "600 91px system-ui, sans-serif";
  ctx.fillText(glyph, 90, 177, 115);
  ctx.font = "600 31px system-ui, sans-serif";
  ctx.fillText(String(index + 1).padStart(2, "0"), 90, 321);
  ctx.textAlign = "left";
  ctx.font = "600 27px system-ui, sans-serif";
  ctx.fillText(category.toUpperCase(), 181, 53, 510);
  ctx.fillStyle = "#f1fbf6";
  ctx.font = "650 48px system-ui, sans-serif";
  lines.forEach((line, lineIndex) =>
    ctx.fillText(line, 181, lines.length === 1 ? 133 : 105 + lineIndex * 55, 510));
  ctx.fillStyle = "#c3d9d9";
  ctx.font = "500 29px system-ui, sans-serif";
  const previewLines = [];
  let currentLine = "";
  for (const word of preview.split(" ")) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && ctx.measureText(candidate).width > 505) {
      previewLines.push(currentLine);
      currentLine = word;
    } else currentLine = candidate;
  }
  if (currentLine) previewLines.push(currentLine);
  previewLines.forEach((line, lineIndex) => ctx.fillText(line, 181, 230 + lineIndex * 35, 510));
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText("SELECT  ›", 181, 333);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.43),
    new THREE.MeshBasicMaterial({
      map: texture, side: THREE.DoubleSide,
      transparent: uiFadeAge < 0.45,
      opacity: uiFadeAge < 0.45 ? uiFadeAge / 0.45 : 1,
    }),
  );
  if (uiFadeAge < 0.45) uiFadeMeshes.push(mesh);
  const row = Math.floor(index / 4);
  const rowCount = Math.min(4, total - row * 4);
  const column = index % 4 - (rowCount - 1) / 2;
  mesh.position.set(column * 0.93, 0.53 - row * 0.52,
    0.08 + 0.08 * Math.abs(column));
  mesh.rotation.y = -column * 0.17;
  mesh.userData.action = () => { sound.click(); action(); };
  mesh.userData.label = title;
  content.add(mesh);
  buttons.push(mesh);
  return mesh;
}
function clearSoundPanel() {
  soundButtons = [];
  while (soundPanel.children.length) {
    const object = soundPanel.children[0];
    object.traverse((node) => {
      node.geometry?.dispose();
      if (node.material) {
        node.material.map?.dispose();
        node.material.dispose();
      }
    });
    soundPanel.remove(object);
  }
}
function closeSoundMenu() {
  soundMenuOpen = false;
  clearSoundPanel();
  soundPanel.visible = false;
  for (const { object, visible } of soundHiddenVisuals) object.visible = visible;
  soundHiddenVisuals = [];
  if (soundBackgroundSaved) scene.background = soundPreviousBackground;
  soundPreviousBackground = null;
  soundBackgroundSaved = false;
}
function hideVisualsForSoundMenu() {
  showcase?.grab?.cancel();
  const visualRoots = [
    root, floatingModel, rain?.group, scan?.group, showcase?.model,
    ...(scan?.reticles?.flat() ?? []),
    ...[layers, viewshed, pixels].flatMap((demo) =>
      demo ? [demo.group, demo.clipboard] : []),
  ];
  soundHiddenVisuals = visualRoots.filter(Boolean).map((object) => ({
    object, visible: object.visible,
  }));
  for (const { object } of soundHiddenVisuals) object.visible = false;
  soundPreviousBackground = scene.background;
  soundBackgroundSaved = true;
  if (scene.background !== null) scene.background = new THREE.Color(0x071820);
}
function drawSoundMenu() {
  clearSoundPanel();
  if (!soundMenuOpen) return;
  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.83),
    new THREE.MeshBasicMaterial({ color: 0x0b2430, side: THREE.DoubleSide }),
  );
  background.position.z = -0.02;
  soundPanel.add(background);
  const previousParent = uiParent;
  const previousFade = uiFadeAge;
  uiParent = soundPanel;
  uiFadeAge = 1;
  const control = (text, x, y, width, action) => {
    const mesh = label(text, x, y, width, 0.085, 34, "#e6f4f5", "#1b4550");
    mesh.userData.label = text;
    mesh.userData.action = () => {
      sound.click();
      action();
      if (soundMenuOpen) drawSoundMenu();
    };
    soundButtons.push(mesh);
  };
  label(showFallbackControls ? "SOUND · SELECT CLOSE" : "SOUND · A TO CLOSE",
    0, 0.33, 0.72, 0.09, 36, "#a6f5d9");
  control(`All sound: ${sound.muted ? "Off" : "On"}`, 0, 0.22, 0.69,
    () => sound.toggle());
  control("−", -0.29, 0.11, 0.11, () => sound.setVolume(sound.volume - 0.25));
  label(`Volume ${Math.round(sound.volume * 100)}%`, 0, 0.11, 0.40, 0.085, 34);
  control("+", 0.29, 0.11, 0.11, () => sound.setVolume(sound.volume + 0.25));
  control(`Menu music: ${sound.musicEnabled ? "On" : "Off"}`, 0, 0, 0.69,
    () => sound.setCategory("music", !sound.musicEnabled));
  control(`Nature: ${sound.ambienceEnabled ? "On" : "Off"}`, 0, -0.11, 0.69,
    () => sound.setCategory("ambience", !sound.ambienceEnabled));
  control(`Effects: ${sound.effectsEnabled ? "On" : "Off"}`, 0, -0.22, 0.69,
    () => sound.setCategory("effects", !sound.effectsEnabled));
  control("Close", 0, -0.34, 0.34, closeSoundMenu);
  soundPanel.traverse((object) => {
    if (!object.material) return;
    // Keep the panel opaque, while respecting nearer controllers and rays.
    object.material.transparent = true;
    object.material.opacity = 1;
    object.material.depthTest = true;
    object.material.depthWrite = object === background;
    // Controller button labels use render order 42 and should stay readable
    // when a hand is held between the visitor and this panel.
    object.renderOrder = object === background ? 20 : 21;
  });
  uiParent = previousParent;
  uiFadeAge = previousFade;
}
function toggleSoundMenu() {
  if (soundMenuOpen) {
    closeSoundMenu();
    return;
  }
  stopRainInput();
  grab?.cancel();
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  const eye = cam.getWorldPosition(new THREE.Vector3());
  const forward = cam.getWorldDirection(new THREE.Vector3());
  forward.y = 0;
  if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
  forward.normalize();
  soundPanel.position.copy(eye).addScaledVector(forward, 1.5);
  soundPanel.position.y += 0.08;
  soundPanel.lookAt(eye);
  soundPanel.visible = true;
  soundMenuOpen = true;
  hideVisualsForSoundMenu();
  drawSoundMenu();
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
function openMenu() {
  closeSoundMenu();
  stopRainInput();
  scan?.dispose();
  scan = null;
  layers?.dispose();
  layers = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = null;
  showcase?.dispose();
  showcase = null;
  root.scale.setScalar(1);
  rain?.dispose();
  rain = null;
  preservePose = null;
  step = -1;
  draw();
}
function resetView() {
  closeSoundMenu();
  if (devPreview) place();
  else pendingPlacement = true;
}
function runControllerShortcut(action) {
  if (action === "sound") {
    sound.click();
    toggleSoundMenu();
    return;
  }
  if (action === "exit") {
    sound.click();
    if (isMenu()) renderer.xr.getSession()?.end();
    else openMenu();
    return;
  }
  if (action === "restart" && (isMenu() || step === -3)) return;
  sound.click();
  if (action === "restart") start();
  else if (action === "reset") resetView();
}
function refreshInputLayout(session) {
  const fallback = !hasQuestShortcuts(navigator.userAgent, session?.inputSources);
  if (showFallbackControls === fallback) return;
  showFallbackControls = fallback;
  controllerShortcuts.reset();
  draw();
}
function start() {
  closeSoundMenu();
  if (pixels) {
    startPixels();
    return;
  }
  if (showcase) {
    startShowcase(showcase.kind);
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
function startShowcase(kind) {
  stopRainInput();
  rain?.dispose(); rain = null;
  scan?.dispose(); scan = null;
  layers?.dispose(); layers = null;
  viewshed?.dispose(); viewshed = null;
  pixels?.dispose(); pixels = null;
  showcase?.dispose();
  root.scale.setScalar(kind === "change" ? 1.25 : 1);
  const Constructor = {
    spectral: SpectralExperience,
    cluster: ClusterExperience,
    projection: ProjectionExperience,
    change: ChangeExperience,
    interpolation: InterpolationExperience,
    suitability: SuitabilityExperience,
  }[kind];
  if (!Constructor) throw new RangeError(`Unknown showcase: ${kind}`);
  showcase = new Constructor(root, (reason) => {
    if (reason === "selection" && showcase?.kind === "cluster") updateClusterReadout();
    else {
      if (["correct", "blocked", "reveal"].includes(reason)) sound.cue(reason);
      draw();
    }
  }, scene);
  showcase.place?.(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
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
  const intro = s.stage === 0;
  const colorGuide = s.colorMode === "height"
    ? "Height: green low → yellow high"
    : "Range: blue near → red far";
  const title =
    s.stage === 0
      ? "Scan your room · MR"
      : s.stage === 2
        ? "Your surroundings, sampled."
        : s.frozen
          ? "Frozen room cloud"
          : "Sweep across real surfaces";
  const body =
    s.stage === 0
      ? "Your browser estimates surfaces in your real room.\nMove your controller to collect points in mixed reality.\nThe points stay in this session and clear when you exit."
      : s.stage === 2
        ? "Your browser estimated these surfaces in your room.\nGaps show where another viewpoint could add samples.\nLidar builds point clouds from timed laser returns."
        : s.frozen
          ? "Move the frozen point cloud to inspect gaps.\nResume returns points to their real-world positions.\nKeep passthrough visible as you explore."
          : "Aim at real surfaces and sweep.\nUp to three green dots mark actual surface returns.\nFreeze to inspect the point cloud you collected.";
  if (intro) {
    label(title, 0, 1.02, 2.4, 0.18, 48, "#e6f4f5", "#0b2430");
    label(body, 0, 0.78, 2.4, 0.3, 33, "#e6f4f5", "#0b2430");
  } else if (s.stage === 2) {
    lessonCard(title, body);
    label(`${s.records.length} points · ${colorGuide}`,
      0, GUIDED_INFO_Y, 2.3, 0.12, 27, "#d8eae8", "#0b2430");
    takeawayActions(GUIDED_ACTION_Y);
    foregroundTakeaway();
    return;
  } else lessonCard(title, body);
  if (intro) {
    label(s.message, 0, -0.5, 2.3, 0.14, 27, "#e6f4f5", "#0b2430");
    label(`${s.records.length} points · ${colorGuide}`,
      0, -0.64, 2.3, 0.09, 24, "#b6d1d9", "#0b2430");
  } else label(`${s.message}\n${s.records.length} WebXR points · ${colorGuide}`,
    0, GUIDED_INFO_Y, 2.3, 0.17, 25, "#d8eae8", "#0b2430");
  if (s.stage === 0) {
    if (s.status !== "unavailable")
      button("Start room scan", 0, -0.77, () => s.explore(), 1.65);
    if (!showFallbackControls) label("Raise either controller into view for button shortcuts",
      0, -0.98, 2.3, 0.11, 27, "#b6d1d9", "#0b2430");
  } else {
    button(
      s.frozen ? "Resume" : "Freeze",
      -0.84,
      GUIDED_ACTION_Y,
      () => {
        stopRainInput();
        if (s.frozen) s.resume();
        else s.freeze();
      },
      0.52,
    );
    button("Color", -0.28, GUIDED_ACTION_Y, () => s.toggleColor(), 0.52);
    button(
      s.status === "error" || s.status === "waiting" ? "Retry" : "Clear",
      0.28,
      GUIDED_ACTION_Y,
      () => {
        stopRainInput();
        if (s.status === "error" || s.status === "waiting") s.retry();
        else s.clearScan();
      },
      0.52,
    );
    button("Takeaways", 0.84, GUIDED_ACTION_Y, () => s.finish(), 0.52);
  }
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
  if (s.stage === 2) {
    lessonCard(s.sceneInfo.takeaway.title, s.sceneInfo.takeaway.body);
    label(
      `${s.sceneInfo.name} · ${s.records.length.toLocaleString()} sampled points · First-hit model`,
      0, GUIDED_INFO_Y, 2.3, 0.12, 27, "#d8eae8", "#0b2430",
    );
    takeawayActions(GUIDED_ACTION_Y);
    foregroundTakeaway();
    return;
  }
  label(
    `${s.sceneInfo.prompt}\nGrip to move · stick while gripping: 45° turns\n${s.records.length.toLocaleString()} points · ${s.hideVegetation ? "Plants hidden" : "Cyan ground · Gold structures · Green plants"}`,
    0, -0.84, 2.3, 0.3, 27, "#d8eae8", "#0b2430",
  );
  button(
    s.reveal ? "Cloud only" : "Show scene",
    -0.84,
    GUIDED_ACTION_Y,
    () => s.toggleReveal(),
    0.52,
  );
  button(
    s.hideVegetation ? "All points" : "Hide plants",
    -0.28,
    GUIDED_ACTION_Y,
    () => s.toggleVegetation(),
    0.52,
  );
  button(
    "Clear scan",
    0.28,
    GUIDED_ACTION_Y,
    () => {
      stopRainInput();
      s.clearScan();
    },
    0.52,
  );
  button(
    "Takeaways",
    0.84,
    GUIDED_ACTION_Y,
    () => {
      stopRainInput();
      s.finish();
    },
    0.52,
  );
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
  card.userData.hoverColor = 0x477b91;
  buttons.push(card);
  uiParent.add(card);
  const thumbnail = scanThumbnail(kind);
  thumbnail.position.set(x, 0.1, 0.16);
  uiParent.add(thumbnail);
  label(title, x, -0.38, 1.04, 0.12, 37, "#ffffff").position.z = 0.37;
  label(subtitle, x, -0.51, 1.04, 0.11, 25, "#c7e6e5").position.z = 0.37;
}
function drawScanChooserUI() {
  label("Scan the Hidden World", 0, 1.02, 2.3, 0.2, 54, "#e6f4f5", "#0b2430");
  label("Lidar (light detection and ranging) times reflected laser pulses.\nEach pulse measures distance; many returns form a 3D point cloud.\nChoose a lidar model or sample your room in mixed reality.",
    0, 0.705, 2.3, 0.31, 38, "#e6f4f5", "#0b2430");
  drawScanChoiceCard("synthetic", -0.61, "Synthetic scan", "First surface hit", () => {
    scan.group.visible = true;
    scan.explore();
  });
  drawScanChoiceCard("room", 0.61, "Room scan · MR", "Sample real surfaces", switchToRoomScan);
  if (!showFallbackControls) label("Raise either controller into view for button shortcuts",
    0, -0.91, 2.3, 0.11, 27, "#b6d1d9", "#0b2430");
}
function drawLayersUI() {
  const l = layers;
  if (!l.started) {
    lessonCard(
      "Stand Inside the Layers",
      "A geographic information system (GIS) combines place data in layers.\nAdd terrain, trees, water, roads, and boundaries to this landscape.\nWatch the overhead map and the world around you change together.",
      0.13,
    );
    button("Start building", 0, -0.43, () => l.begin(), 1.5);
    label(showFallbackControls
      ? "The map and layer list appear on the left-hand clipboard."
      : "After starting, raise your left hand to see the map and layer list.",
      0, -0.72, 2.3, 0.12, 29, "#b6d1d9", "#0b2430");
    return;
  }
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
      "GIS overlays datasets at shared locations to reveal relationships.\nThe river follows low terrain; roads cross it; flood studies add water levels.\nDistrict boundaries organize places and services.",
      0,
      0.48,
      2.35,
      0.39,
      35,
      "#e6f4f5",
      "#0b2430",
    );
    takeawayActions(-0.62);

    return;
  }
  label("Left stick: move · right stick: turn 30°", 0, 0.68,
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
    l.registerVisitorMarker(map, LANDSCAPE_EXTENT);
    LAYER_KEYS.forEach((key, i) => {
      const marked = l.selected.has(key) ? "[x]" : "[ ]";
      button(`${marked} ${LAYER_NAMES[key]}`, 0.65, 0.47 - i * 0.17, () => l.toggle(key), 1.02);
    });
    label(l.lastLayer ? LAYER_HINTS[l.lastLayer] : "Select a map layer; watch it appear around you.",
      0, -0.69, 2.3, 0.12, 27, "#b6d1d9", "#0b2430");
    label(
      l.selected.has("floodplain")
        ? "Blue: low river land · flood studies also need water levels"
        : "Synthetic place · Map north is an arbitrary model direction",
      0, -0.83, 2.3, 0.1, 24, "#b6d1d9", "#0b2430",
    );
    button("Takeaway", 0, -1.01, () => l.finish(), 1.4);

    return;
  }
}
function drawViewshedUI() {
  const v = viewshed;
  if (!v.started) {
    lessonCard(
      "Can You See It?",
      "A viewshed maps the ground visible from one observation point.\nHere a bare-earth digital elevation model (DEM) supplies ground heights.\nRidges can block sight. Can a taller viewpoint see the blue target?",
      0.13,
    );
    button("Test the view", 0, -0.43, () => v.begin(), 1.5);
    label(showFallbackControls
      ? "The map and controls appear on the left-hand clipboard."
      : "After starting, raise your left hand to see the map and controls.",
      0, -0.72, 2.3, 0.12, 29, "#b6d1d9", "#0b2430");
    return;
  }
  label(
    v.finished ? "What blocks the view?" : "Can You See It?",
    0, 0.91, 2.35, 0.19, 48, "#e6f4f5", "#0b2430",
  );
  if (v.finished) {
    label(
      "This viewshed traces sight lines across a bare-earth DEM: a grid of ground heights.\nRaising the observer can reveal ground beyond a ridge.\nFor a site with trees or buildings, a surface model can add their heights to the analysis.",
      0, 0.39, 2.35, 0.48, 33, "#e6f4f5", "#0b2430",
    );
    takeawayActions(-0.62);

    return;
  }
  label("Left stick: move · right stick: turn 30°",
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
    map.userData.action = (hit) => { sound.click(); v.placeFromMap(hit); };
    map.userData.debugHidden = true;
    uiParent.add(map);
    buttons.push(map);
    v.registerVisitorMarker(map, LANDSCAPE_EXTENT, true);
    label("Move the gold observer.\nCan it see the blue target?", 0.64, 0.48, 1.06, 0.19, 31, "#e6f4f5", "#0b2430");
    button("Eye level · 2 m", 0.64, 0.18, () => v.setHeight(2), 1.04)
      .material.color.set(v.observer.height === 2 ? 0xffffff : 0x91a6a4);
    button("Tower · 12 m", 0.64, -0.05, () => v.setHeight(12), 1.04)
      .material.color.set(v.observer.height === 12 ? 0xffffff : 0x91a6a4);
    button("Reset point", 0.64, -0.31, () => v.reset(), 1.04);
    label("Gold: observer · white ring: you · tap map to move observer", 0, -0.68, 2.3, 0.12, 27, "#b6d1d9", "#0b2430");
  }
  label(
    `${v.visiblePercent}% nearby ground visible · Blue target ${v.trace.visible ? "VISIBLE" : "BLOCKED"} · Bare-earth DEM`,
    0, -0.84, 2.3, 0.1, 25, "#d8f3e6", "#0b2430",
  );
  button("Takeaway", 0, -1.01, () => v.finish(), 1.4);
}
function drawPixelsUI() {
  const p = pixels;
  if (!p.started) {
    lessonCard(
      "How Big Is a Pixel?",
      "Ground sample distance (GSD) is one image pixel's width on the ground.\nA larger pixel can mix a narrow river or road with nearby land.\nCompare the landscape with two maps of the same place at different pixel sizes.",
      0.13,
    );
    button("Compare pixels", 0, -0.43, () => p.begin(), 1.5);
    label(showFallbackControls
      ? "The images and controls appear on the left-hand clipboard."
      : "After starting, raise your left hand to see the images and controls.",
      0, -0.72, 2.3, 0.12, 29, "#b6d1d9", "#0b2430");
    return;
  }
  label(
    p.finished ? "What did the pixel miss?" : "How Big Is a Pixel?",
    0, 0.91, 2.35, 0.19, 48, "#e6f4f5", "#0b2430",
  );
  if (p.finished) {
    label(
      "Ground sample distance (GSD) is a pixel's width on the ground.\nLarge pixels blend narrow roads and rivers with nearby land.\nThis model averages colors; real sensors record light in bands.",
      0, 0.39, 2.35, 0.48, 33, "#e6f4f5", "#0b2430",
    );
    takeawayActions(-0.62);

    return;
  }
  label(
    "GSD = pixel ground width · left stick: move · right: turn",
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
    map.userData.action = (hit) => { sound.click(); p.placeFromMap(hit); };
    map.userData.debugHidden = true;
    uiParent.add(map);
    buttons.push(map);
    p.registerVisitorMarker(map, PIXEL_EXTENT);
  }
  const cell = p.cell;
  const percent = (index) => Math.round((cell.counts[index] / (p.size ** 2)) * 100);
  label(
    `Selected ${p.size} m GSD · ${p.size ** 2} m² · White dot: you\nForest ${percent(1)}% · Water ${percent(2)}% · Road ${percent(3)}% · Other ${percent(0)}%`,
    0, -0.675, 2.3, 0.14, 27, "#e6f4f5", "#0b2430",
  );
  if (p.answer === null) {
    label("Prediction: any all-water pixel at 48 m?", -0.35, -0.82, 1.5, 0.12, 27, "#d8f3e6", "#0b2430");
    button("Yes", 0.57, -0.82, () => p.predictPureWater(true), 0.42);
    button("No", 1.03, -0.82, () => p.predictPureWater(false), 0.34);
  } else
    label(
      `${p.answer === p.pureWaterAt48 ? "Exactly" : "Compare the 48 m view"}: each river pixel also includes land. That blend is a mixed pixel.`,
      0, -0.82, 2.3, 0.12, 27, "#d8f3e6", "#0b2430",
    );
  button("Takeaway", 0, -1.01, () => p.finish(), 1.4);
}
function drawShowcaseUI() {
  const exhibit = showcase;
  if (!exhibit.started) {
    const introductions = {
      spectral: ["See the Invisible",
        "Satellites measure visible colors and near infrared (NIR).\nHealthy leaves reflect much NIR light, which our eyes cannot see.\nCompare real places in natural color, false color, and NIR gray.",
        "Reveal the bands"],
      cluster: ["Where Did the Cluster Go?",
        "John Snow mapped cholera deaths near a London water pump in 1854.\nCompare the same 489 deaths in four hypothetical ward plans.\nWatch the darkest area shift or fade as boundaries and ward sizes change.",
        "Explore the pattern"],
      projection: ["Make the World Flat",
        "A map projection places Earth's curved surface on a flat map.\nChoose a projection and watch the globe unfold.\nTissot's circles show where shape and area stretch.",
        "Flatten the globe"],
      change: ["What Changed?",
        "Landsat revisits places, measuring visible and infrared light.\nSome pairs use false color to reveal patterns; Joplin uses natural color.\nDrag between dates and choose what changed most.",
        "Compare images"],
      interpolation: ["Between the Rain Gauges",
        "Spatial interpolation estimates values between measured places.\nEach post shows rainfall at one gauge in millimeters.\nCompare surfaces, then estimate rain at a new spot.",
        "Fit the surfaces"],
      suitability: ["Where Should It Go?",
        "A town needs a new clinic. GIS suitability analysis combines several spatial criteria.\nInspect three sites using a 450 m distance buffer, road proximity, and flood exposure.\nChange the priorities to see how the preferred site changes.",
        "Compare the sites"],
    };
    const [title, body, action] = introductions[exhibit.kind];
    lessonCard(title, body, 0.13);
    button(action, 0, -0.43, () => exhibit.begin(), 1.6);
    label(showFallbackControls
      ? "About four minutes · Use the action buttons below."
      : "About four minutes · Raise a controller to see its button labels.",
      0, -0.72, 2.3, 0.12, 29, "#b6d1d9", "#0b2430");
    return;
  }
  if (exhibit.kind === "spectral" && (exhibit.finished || exhibit.takeawayOpen)) {
    lessonCard(`${exhibit.sceneInfo.name} · takeaways`,
      `A spectral signature describes a surface's response across bands.\nFalse color assigns NIR to red; leafy areas often appear red.\n${exhibit.sceneInfo.observation}`, -0.02);
    label("Scientists map vegetation and water with calibrated bands.\nHere the sample bars show rendered-image brightness.",
      0, -0.45, 2.4, 0.18, 25, "#b6d1d9", "#0b2430");
    if (!exhibit.finished) {
      button("Keep exploring", -0.58, -0.72, () => exhibit.keepExploring(), 1.0);
      button("Next scene", 0.58, -0.72, () => exhibit.nextScene(), 1.0);
    }
    takeawayActions(exhibit.finished ? -0.72 : -0.96);
    return;
  }
  if (exhibit.kind === "change" && exhibit.finished) {
    lessonCard("Images turn change into evidence",
      "Change detection compares images of the same ground over time.\nMatch the view and consider season, sensor, and color bands.\nGround records help explain the changes you can see.", -0.05);
    label("USGS Landsat views · flood, fire, growth, eruption, and tornado",
      0, -0.43, 2.4, 0.13, 25, "#b6d1d9", "#0b2430");
    takeawayActions(-0.64);
    return;
  }
  if (exhibit.finished) {
    const takeaways = {
      cluster: ["Same deaths, new boundaries",
        "The same 489 deaths can look concentrated or nearly uniform.\nPlans A–C change six ward boundaries; Plan D uses four broad wards.\nThis is MAUP: the modifiable areal unit problem."],
      projection: ["Every flat map makes a choice",
        "Flattening Earth changes shape, area, or both.\nTissot circles show distortion through their size and shape.\nMercator keeps local shape; equal-area keeps relative area."],
      interpolation: ["Spatial interpolation fills the gaps",
        "Spatial interpolation estimates values between gauges.\nIDW favors nearby readings; a smooth trend may miss points.\nNearest-gauge zones make steps. Check held-out gauges."],
      suitability: ["The chosen site depends on priorities",
        "A buffer shows places within a set straight-line distance.\nSuitability analysis puts each criterion on a common scale and combines weighted scores.\nChanging the weights can change which site ranks first."],
    };
    const [title, body] = takeaways[exhibit.kind];
    lessonCard(title, body, -0.05);
    if (exhibit.kind === "cluster")
      label("Colors show raw death counts. Broad wards cover more blocks;\npopulation data would support mortality-rate comparisons.",
        0, -0.43, 2.4, 0.18, 26, "#b6d1d9", "#0b2430");
    if (exhibit.kind === "projection")
      label("Choose a projection that supports what your map needs to compare.",
        0, -0.43, 2.4, 0.13, 26, "#b6d1d9", "#0b2430");
    if (exhibit.kind === "interpolation")
      label("These rainfall readings are synthetic. Fewer gauges mean more uncertainty between them.",
        0, -0.43, 2.4, 0.13, 26, "#b6d1d9", "#0b2430");
    if (exhibit.kind === "suitability")
      label("This town is schematic. A real clinic decision also weighs travel time,\nland and operating costs, local knowledge, and community priorities.",
        0, -0.43, 2.4, 0.18, 25, "#b6d1d9", "#0b2430");
    takeawayActions(-0.62);
    return;
  }
  if (exhibit.kind === "suitability") {
    const selected = exhibit.scoreSet.scores.find((entry) =>
      entry.site.id === exhibit.selectedSite?.id);
    if (exhibit.scoresVisible) {
      label(`${exhibit.priority === "reach" ? "Reach first" : "Flood safety first"} · Scores: ${exhibit.scoreSet.scores.map((entry) =>
        `${entry.site.id} ${entry.score}`).join("  ·  ")} · ${exhibit.scoreSet.winner.site.id} leads`,
      0, -0.53, 2.45, 0.14, 27, "#e6f4f5", "#0b2430");
      label(exhibit.priority === "reach"
        ? "Weights: nearby residents 72% · road proximity 20% · flood safety 8%"
        : "Weights: nearby residents 30% · road proximity 10% · flood safety 60%",
      0, -0.69, 2.45, 0.12, 25, "#b6d1d9", "#0b2430");
    } else {
      label(selected
        ? `Site ${selected.site.id} · ${selected.residents} residents in buffer · ${selected.roadMeters} m to road · ${selected.floodplain ? "floodplain" : "higher ground"}`
        : "Select site A, B, or C on the town model to reveal its distance buffer.",
      0, -0.53, 2.45, 0.14, 25, "#e6f4f5", "#0b2430");
      label("White ring = 450 m straight-line buffer · Bright homes are inside it",
        0, -0.69, 2.45, 0.12, 25, "#b6d1d9", "#0b2430");
    }
    button("Reach first", -0.60, -0.88, () => exhibit.setPriority("reach"),
      1.05, exhibit.priority === "reach");
    button("Flood safety first", 0.60, -0.88, () => exhibit.setPriority("safety"),
      1.05, exhibit.priority === "safety");
    button(exhibit.scoresVisible ? "Hide scores" : "Compare scores", -0.60, -1.09,
      () => exhibit.toggleScores(), 1.05);
    button("Takeaway", 0.60, -1.09, () => exhibit.finish(), 1.05);
  } else if (exhibit.kind === "interpolation") {
    const explanations = {
      samples: "Spatial interpolation: estimate between the gauge readings.",
      zones: "Spatial interpolation · nearest-gauge zones make steps.",
      smooth: "Smooth trend · amber: gauge above surface · cyan: below.",
      idw: "Inverse distance weighting (IDW) favors nearby gauges.",
    };
    label(explanations[exhibit.mode], 0, -0.48, 2.47, 0.13, 26,
      "#e6f4f5", "#0b2430");
    if (exhibit.showWeights) {
      const terms = exhibit.estimate.neighbors.map(({ station, weight }) =>
        `${station.value}×${Math.round(weight * 100)}%`).join(" + ");
      label(`IDW weights = 1/d² for ${exhibit.estimate.neighbors.length} nearest gauge${exhibit.estimate.neighbors.length === 1 ? "" : "s"}\n${terms} ≈ ${exhibit.estimate.value.toFixed(1)} mm`,
        0, -0.66, 2.48, 0.18, 26, "#ffdd91", "#0b2430");
    } else label(`Point at the model to move ? · ${exhibit.mode === "smooth" ? "smooth" :
      exhibit.mode === "zones" ? "nearest" : "IDW"} estimate ${exhibit.displayValue.toFixed(1)} mm`,
      0, -0.64, 2.48, 0.13, 25, "#b6d1d9", "#0b2430");
    button("Readings", -0.91, -0.84, () => exhibit.setMode("samples"),
      0.55, exhibit.mode === "samples");
    button("Zones", -0.32, -0.84, () => exhibit.setMode("zones"),
      0.52, exhibit.mode === "zones");
    button("Smooth", 0.30, -0.84, () => exhibit.setMode("smooth"),
      0.58, exhibit.mode === "smooth");
    button("IDW", 0.92, -0.84, () => exhibit.setMode("idw"),
      0.54, exhibit.mode === "idw");
    button(exhibit.showWeights ? "Hide IDW math" : "Explain IDW", -0.60, -1.07,
      () => exhibit.toggleWeights(), 1.05,
      !!exhibit.showWeights);
    button("Takeaway", 0.60, -1.07, () => exhibit.finish(), 1.05);
  } else if (exhibit.kind === "change") {
    const caseInfo = exhibit.sceneInfo;
    label(`Case ${exhibit.sceneIndex + 1}/${CHANGE_SCENES.length} · ${caseInfo.place}`,
      0, 0.98, 2.45, 0.17, 43, "#e6f4f5", "#0b2430");
    label(`${caseInfo.sensor} · USGS imagery`,
      0, 0.79, 2.35, 0.12, 27, "#b6d1d9", "#0b2430");
    label("Drag the white line to compare dates",
      -0.47, -0.84, 1.7, 0.13, 23, "#e6f4f5", "#0b2430");
    label(caseInfo.question, 0.91, 0.67, 1.06, 0.16, 33,
      "#e6f4f5", "#0b2430");
    if (exhibit.error) {
      label("Image could not load", 0.91, 0.16, 1.05, 0.16, 28);
      button("Retry", 0.91, -0.18, () => exhibit.loadScene(), 0.95);
    } else if (!exhibit.ready) {
      label("Loading images…", 0.91, 0.16, 1.05, 0.16, 28);
    } else if (!exhibit.revealed) {
      caseInfo.options.forEach((option, index) =>
        button(option, 0.91, 0.40 - index * 0.24,
          () => exhibit.chooseAnswer(index), 1.05));
    } else {
      label(exhibit.selectedOption === caseInfo.answer
        ? "Good observation" : `Look for: ${caseInfo.options[caseInfo.answer]}`,
      0.91, 0.37, 1.06, 0.16, 28, "#ffdf85", "#0b2430");
      label(caseInfo.observation, 0.91, 0.12, 1.06, 0.24, 26,
        "#e6f4f5", "#0b2430");
      label(caseInfo.explanation, 0.91, -0.28, 1.06, 0.38, 22,
        "#b6d1d9", "#0b2430");
      button(exhibit.sceneIndex === CHANGE_SCENES.length - 1 ? "Show Takeaway" : "Next place",
        0.91, -0.66, () => exhibit.nextScene(), 1.05);
    }
  } else if (exhibit.kind === "spectral") {
    const modeText = {
      natural: "Natural color: visible red, green, and blue bands",
      false: "False color: NIR → red, red → green, green → blue",
      nir: "Approximate near-infrared view in gray",
    };
    label(`${exhibit.sceneInfo.name} · ${exhibit.sceneInfo.sensor}`,
      0, 0.96, 2.35, 0.18, 40, "#e6f4f5", "#0b2430");
    label(exhibit.sceneInfo.prompt, 0, -0.42, 2.4, 0.12, 28,
      "#d8f3e6", "#0b2430");
    label(modeText[exhibit.mode], 0, -0.58, 2.4, 0.12, 27,
      "#e6f4f5", "#0b2430");
    button("Natural color", -0.78, -0.75, () => exhibit.setMode("natural"),
      0.72, exhibit.mode === "natural");
    button("False color", 0, -0.75, () => exhibit.setMode("false"),
      0.72, exhibit.mode === "false");
    button("Near infrared", 0.78, -0.75, () => exhibit.setMode("nir"),
      0.72, exhibit.mode === "nir");
    button("Next scene", -0.58, -1.0, () => exhibit.nextScene(), 1.0);
    button("Takeaways", 0.58, -1.0, () => exhibit.showTakeaways(), 1.0);
  } else if (exhibit.kind === "cluster") {
    label("Where Did the Cluster Go?", 0, 0.98, 2.45, 0.17, 46, "#e6f4f5", "#0b2430");
    clusterReadout = label(exhibit.selectedText, 0, -0.64, 2.35, 0.12,
      27, "#b6d1d9", "#0b2430");
    button("Buildings", -0.96, -0.84, () => exhibit.setMode("points"),
      0.45, exhibit.mode === "points");
    button("Plan A", -0.48, -0.84, () => exhibit.setMode("wardA"),
      0.43, exhibit.mode === "wardA");
    button("Plan B", 0, -0.84, () => exhibit.setMode("wardB"),
      0.43, exhibit.mode === "wardB");
    button("Plan C", 0.48, -0.84, () => exhibit.setMode("wardC"),
      0.43, exhibit.mode === "wardC");
    button("Plan D", 0.96, -0.84, () => exhibit.setMode("wardD"),
      0.43, exhibit.mode === "wardD");
    button("Takeaway", 0, -1.08, () => exhibit.finish(), 1.1);
  } else {
    label("Make the World Flat", 0, 0.98, 2.35, 0.17, 46, "#e6f4f5", "#0b2430");
    label(exhibit.selectedCircle
      ? "The selected circle starts round on Earth. Its map shape and size show distortion."
      : exhibit.tissot
      ? "Tissot's circles start equally sized on Earth. Select one to see its distortion."
      : `${exhibit.projection === "equalArea" ? "Equal-area" :
      exhibit.projection === "mercator" ? "Mercator" : "Plate Carrée"}: equal land area at 60° N looks ${exhibit.areaAt60}× equator`,
    0, -0.36, 2.45, 0.13, 28, "#e6f4f5", "#0b2430");
    button("Plate Carrée", -0.8, -0.57,
      () => exhibit.setProjection("equirectangular"), 0.7,
      exhibit.projection === "equirectangular");
    button("Mercator", 0, -0.57, () => exhibit.setProjection("mercator"), 0.7,
      exhibit.projection === "mercator");
    button("Equal-area", 0.8, -0.57, () => exhibit.setProjection("equalArea"), 0.7,
      exhibit.projection === "equalArea");
    const equalArea = exhibit.projection === "equalArea";
    button(exhibit.flat ? "Wrap" : "Flatten", equalArea ? -0.78 : -0.52, -0.79,
      () => exhibit.transitionTo(!exhibit.flat), equalArea ? 0.7 : 0.85);
    button(exhibit.tissot ? "Tissot ✓" : "Tissot circles", equalArea ? 0 : 0.52, -0.79,
      () => exhibit.setTissot(!exhibit.tissot), equalArea ? 0.78 : 0.95, exhibit.tissot);
    if (equalArea)
      button(exhibit.standardParallel === 0 ? "Use 30°" : "Use 0°", 0.78, -0.79,
        () => exhibit.setStandardParallel(exhibit.standardParallel === 0 ? 30 : 0), 0.7);
    label(`Center ${Math.round(exhibit.centralMeridian)}° · drag map to recenter${exhibit.projection === "equalArea" ? ` · true-scale latitude ${exhibit.standardParallel}°` : ""}`,
      0, -1.0, 2.35, 0.12, 25, "#b6d1d9", "#0b2430");
    button("Takeaway", 0, -1.22, () => exhibit.finish(), 1.1);
  }
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
  if (!showFallbackControls) label("Raise either controller into view for button shortcuts",
    0, -0.91, 2.3, 0.11, 27, "#b6d1d9", "#0b2430");
}
function drawRainUI() {
  const r = rain;
  if (r.stage === 0) {
    drawRainChooserUI();
    return;
  }
  if (r.kind === "erosion" && r.stage === 4 && r.replayTime >= 0) {
    label("Replay · watch the bed change from its starting shape",
      0, GUIDED_INFO_Y, 2.3, 0.13, 28, "#e6f4f5", "#0b2430");
    button("Back to Takeaway", 0, GUIDED_ACTION_Y, () => r.endReplay(), 1.3);
    return;
  }
  const copy = [
    null,
    [
      r.kind === "erosion"
        ? "Shape the land. Watch water reshape it."
        : "Shape the land. Follow the water.",
      r.kind === "erosion"
        ? "Rain cuts channels in loose soil. Paint green cover to protect a patch,\nthen compare its erosion with bare ground beside it."
        : "Runoff follows slope toward an outlet; ridges form divides.\nRain the slopes, sculpt the land, and watch paths change.",
    ],
    [
      "Predict the path",
      "Rain will fall at the gold ring near the ridge.\nWhich outlet will this water reach?\nPoint at an outlet choice below and press trigger.",
    ],
    [
      r.answer === r.destination
        ? "Your prediction follows the slope."
        : "The slope sends this rain the other way.",
      `This rain reaches outlet ${r.destination}. Follow its glowing path.\nEach colored area drains to one outlet: a watershed.\nThe white ridge line is the divide between them.`,
    ],
    [
      "One landscape. Two watersheds.",
      "A watershed is land that drains to one outlet.\nDrops on opposite sides of a ridge reach different outlets.\nThe ridge is a drainage divide between the watersheds.",
    ],
  ];
  if (r.stage === 4 && r.edited)
    copy[4] = [
      "Change the land. Change the flow.",
      "A watershed is land that drains to one outlet.\nReshaping a ridge redirects runoff; hollows fill and spill.\nFlood studies also measure rainfall, soil, and water depth.",
    ];
  if (r.kind === "erosion") {
    copy[4] = [
      "Plants help hold soil in place.",
      "Fast runoff cuts bare soil and carries sediment downhill.\nVegetation slows soil detachment and stabilizes wet banks; water still flows across it.\nCompare green and bare patches. This short simulation speeds up erosion.",
    ];
  }
  const [title, body] = copy[r.stage];
  if (r.stage === 1)
    label(
      `Left trigger: rain · Right trigger: ${r.kind === "erosion" && r.brushTool === "vegetation" ? "paint plants" : "sculpt"} · Grips: move/size\n${r.kind === "erosion"
        ? r.replayTime >= 0 ? "Replay shows saved bed shapes; Live resumes water." : "Green cover protects soil; bare patches erode faster."
        : r.overlay ? "Blue and gold mark the two drainage basins." : "Runoff follows slope; ridges divide basins."}`,
      0, GUIDED_INFO_Y, 2.3, 0.2, 32, "#e6f4f5", "#0b2430",
    );
  else lessonCard(title, body);
  if (r.stage === 1) {
    if (r.kind === "erosion") {
      button("Reset", -0.88, GUIDED_ACTION_Y, () => { stopRainInput(); r.restore(); }, 0.42);
      button(r.originalBed.visible ? "Hide bed" : "Compare", -0.44, GUIDED_ACTION_Y,
        () => { r.originalBed.visible = !r.originalBed.visible; draw(); }, 0.42);
      button(r.replayTime >= 0 ? "Live" : "Replay", 0, GUIDED_ACTION_Y,
        () => { stopRainInput(); if (r.replayTime >= 0) r.endReplay(); else r.startReplay(); }, 0.42);
      button("Plants", 0.44, GUIDED_ACTION_Y,
        () => r.setBrushTool(r.brushTool === "vegetation" ? "earth" : "vegetation"),
        0.42, r.brushTool === "vegetation");
      button("Takeaway", 0.88, GUIDED_ACTION_Y, () => { stopRainInput(); r.finish(); }, 0.42);
    } else {
      button("Reset terrain", -0.59, GUIDED_ACTION_Y,
        () => { stopRainInput(); r.restore(); }, 0.66);
      button(r.overlay ? "Hide basins" : "Show basins", 0.08, GUIDED_ACTION_Y,
        () => r.toggleOverlay(), 0.59);
      button(r.edited ? "Takeaways" : "Prediction", 0.68, GUIDED_ACTION_Y,
        () => { stopRainInput(); if (r.edited) r.finish(); else r.challenge(); }, 0.55);
    }
  }
  if (r.stage === 2) {
    button("Left outlet", -0.54, GUIDED_ACTION_Y, () => r.choose("A"), 1.02);
    button("Right outlet", 0.58, GUIDED_ACTION_Y, () => r.choose("B"), 1.02);
  }
  if (r.stage === 3) {
    button(
      "Rain here again",
      -0.54,
      GUIDED_ACTION_Y,
      () => {
        r.playback = 4;
      },
      1.02,
    );
    button("Takeaways", 0.58, GUIDED_ACTION_Y, () => r.finish(), 1.02);
  }
  if (r.stage === 4) {
    label(
      r.kind === "erosion"
        ? "Real slopes also vary in soil, roots, and rainfall.\nField measurements help estimate how fast erosion happens."
        : "This model shows runoff and pond storage. Rain can\nalso soak into soil, evaporate, or collect in low spots.",
      0,
      GUIDED_INFO_Y,
      2.3,
      0.16,
      28,
      "#e6f4f5",
      "#0b2430",
    );
    if (r.kind === "erosion" && r.replayFrames.length > 1) {
      button("Replay", -0.78, GUIDED_ACTION_Y, () => r.startReplay(), 0.7);
      button("Restart", 0, GUIDED_ACTION_Y, start, 0.7);
      button("Exit to Menu", 0.78, GUIDED_ACTION_Y, openMenu, 0.7);
    } else takeawayActions(GUIDED_ACTION_Y);
    foregroundTakeaway();
  } else if (r.stage !== 1)
    label(
      r.kind === "erosion"
        ? r.replayTime >= 0
          ? "Time-lapse: saved bed shapes · Water paused · Live returns to experiment"
          : `Dark: cut · Pale: deposits · ${r.terrainChange.changed} cells changed · Replay after pouring`
        : r.overlay && r.edited
          ? "Blue: A · Gold: B · Purple: pond catchments · Cyan: stored water"
          : r.overlay
            ? "A: blue / round outlet    ·    B: gold / square outlet"
            : "Surface-flow model · Follow paths and pond overflow",
      0,
      GUIDED_INFO_Y,
      2.3,
      0.12,
      28,
      "#e6f4f5",
      "#0b2430",
    );
}
function next() {
  preservePose =
    isSpatial() && floatingModel && step < stages.length - 1
      ? {
          position: floatingModel.position.clone(),
          quaternion: floatingModel.quaternion.clone(),
          scale: floatingModel.scale.clone(),
        }
      : null;
  step++;
  draw();
  sound.cue(isSpatial() ? "reveal" : "measure");
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
  diagram.scale.setScalar(0.72);
  diagram.position.y = 0.38;
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
      -0.64,
      GUIDED_ACTION_Y,
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
  floatingModel.position.y += 0.2;
  floatingModel.quaternion.setFromEuler(
    new THREE.Euler(0.12, Math.atan2(-forward.x, -forward.z) + 0.72, 0, "YXZ"),
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
  const count = step - 3;
  const fresh = lastAnimatedRangeStep === step ? -1 : count - 1;
  beacons.slice(0, count).forEach((a, i) => {
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
    if (i === fresh) {
      sphere.scale.setScalar(0.001);
      sphere.material.opacity = 0;
      rangeAnimations.push({ object: sphere, delay: 0, opacity: 0.25 });
    }
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
  if (count === 2) {
    const intersection = shellIntersection(
      beacons[0], beacons[1], beacons[0].distanceTo(t), beacons[1].distanceTo(t),
    );
    if (intersection) {
      for (const [tube, color, opacity] of [
        [0.022, 0xffdc7b, 0.18],
        [0.007, 0xfff2bc, 0.95],
      ]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(intersection.radius, tube, 8, 128),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
            depthTest: false, depthWrite: false }),
        );
        ring.position.set(
          intersection.center.x, intersection.center.y, intersection.center.z,
        ).sub(center);
        ring.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(
            intersection.normal.x, intersection.normal.y, intersection.normal.z,
          ),
        );
        ring.renderOrder = 5;
        group.add(ring);
        if (fresh === 1) {
          ring.material.opacity = 0;
          rangeAnimations.push({ object: ring, delay: 0.6, opacity, fadeOnly: true });
        }
      }
    }
  }
  lastAnimatedRangeStep = step;
  (count === 3 ? [t, new THREE.Vector3(t.x, t.y, -t.z)] : count === 4 ? [t] : []).forEach(
    (p) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
      );
      dot.position.copy(p).sub(center);
      dot.renderOrder = 10;
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
function drawFallbackToolbar() {
  if (!showFallbackControls || soundMenuOpen) return;
  const onClipboard = uiParent !== content;
  const actions = [
    ...(!isMenu() && step !== -3 ? [["Restart", "restart"]] : []),
    ["Reset", "reset"], ["Sound", "sound"],
    [isMenu() ? xrMode === "immersive-ar" ? "Exit MR" : "Exit VR" :
      step === -3 ? "Skip" : "Exit", "exit"],
  ];
  let y;
  if (onClipboard) {
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(2.50, 0.36),
      new THREE.MeshBasicMaterial({ color: 0x143441, side: THREE.DoubleSide }),
    );
    backing.position.set(0, -1.28, -0.04);
    uiParent.add(backing);
    y = -1.30;
  } else {
    const lowest = buttons.length ? Math.min(...buttons.map((mesh) => mesh.position.y)) : -0.5;
    y = isMenu() ? -1.02 : Math.min(-0.99, lowest - 0.25);
    content.position.y = y < -1.24 ? 0.18 : 0;
  }
  const pitch = actions.length === 4 ? 0.60 : 0.74;
  const width = actions.length === 4 ? 0.55 : 0.67;
  actions.forEach(([name, action], index) => {
    const x = (index - (actions.length - 1) / 2) * pitch;
    const control = label(name, x, y, width, 0.16, 48, "#08241e", "#a6f5d9");
    control.position.z = 0.10;
    control.userData.action = () => runControllerShortcut(action);
    control.userData.label = name;
    control.userData.fallbackAction = true;
    control.material.depthTest = false;
    control.material.depthWrite = false;
    control.renderOrder = 30;
    buttons.push(control);
  });
}
function draw() {
  content.position.y = 0;
  drawScene();
  drawFallbackToolbar();
  sound.setMenuMusic((isMenu() || step === -3) && renderer.xr.isPresenting);
  for (const { guide } of controllers)
    guide.setContext(...controllerGuideContext(guide.handedness));
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
    if (!showFallbackControls) {
      for (const [name, action] of [
        ...(!isMenu() && step !== -3 ? [["X · Restart", "restart"]] : []),
        ["Y · Reset view", "reset"], ["A · Sound menu", "sound"],
        [isMenu() ? "B · Exit XR" : step === -3 ? "B · Skip guide" : "B · Exit demo", "exit"],
      ]) {
        const b = document.createElement("button");
        b.textContent = name;
        b.onclick = () => runControllerShortcut(action);
        panel.append(b);
      }
    }
  }
}
function controllerGuideContext(hand) {
  const onMenu = isMenu() || step === -3;
  const exitLabel = step === -3 ? "Skip guide" : onMenu
    ? xrMode === "immersive-ar" ? "Exit MR" : "Exit VR" : "Exit";
  if (rain?.stage === 1) {
    return [hand === "left" ? "Rain" : rain.brushTool === "vegetation" ? "Plant" : "Sculpt",
      "Move/size", onMenu, exitLabel];
  }
  if (scan?.stage === 1)
    return ["Scan", scan.room && !scan.frozen ? null : "Move/size", onMenu, exitLabel];
  if (showcase) return [showcase.kind === "projection" ? "Drag globe" :
    showcase.kind === "interpolation" ? "Place estimate" : "Select",
    ["interpolation", "suitability"].includes(showcase.kind) ? "Move/size" : null,
    onMenu, exitLabel];
  if (step === -3) return ["Select", null, onMenu, exitLabel];
  if (isSpatial()) return ["Select", "Move/size", onMenu, exitLabel];
  return [null, null, onMenu, exitLabel];
}
function updateControllerGuides(cam, tracked, dt) {
  if (showFallbackControls) {
    for (const { guide } of controllers) guide.setVisible(false);
    return;
  }
  let closest = null;
  let best = -Infinity;
  for (const { guide, grip } of controllers) {
    const score = guide.update(cam, tracked && grip.visible, dt);
    if (score > best) {
      best = score;
      closest = guide;
    }
  }
  for (const { guide } of controllers)
    guide.setVisible(guide === closest);
}
function updateRangeAnimations(dt) {
  if (!rangeAnimations.length) return;
  animationAge += dt;
  for (const { object, delay, opacity, fadeOnly } of rangeAnimations) {
    const t = THREE.MathUtils.clamp((animationAge - delay) / 0.75, 0, 1);
    const ease = 1 - (1 - t) ** 3;
    if (!fadeOnly) object.scale.setScalar(Math.max(0.001, ease));
    object.material.opacity = (opacity ?? (object.isMesh ? 0.25 : 1)) * ease;
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
  (pixels ?? viewshed ?? layers)?.clearVisitorMarkers();
  clear();
  const key = showcase ? `showcase:${showcase.kind}:${showcase.started}:${showcase.finished}:${showcase.mode ?? showcase.projection}` :
    pixels ? `pixels:${pixels.started}:${pixels.finished}` :
    viewshed ? `viewshed:${viewshed.view}:${viewshed.started}:${viewshed.finished}` :
    layers ? `layers:${layers.view}:${layers.started}:${layers.finished}` :
    scan ? `scan:${scan.room ? "room" : "model"}:${scan.stage}` :
    rain ? `rain:${rain.kind}:${rain.stage}` : `position:${step}`;
  if (key !== lastUIKey) uiFadeAge = 0;
  lastUIKey = key;
  uiParent = (pixels?.started ? pixels.ui : null) ??
    (viewshed?.started ? viewshed.ui : null) ??
    (layers?.started ? layers.ui : null) ?? content;
  if (showcase) {
    drawShowcaseUI();
    return;
  }
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
  if (!isSpatial() && (step !== -1 || xrMode === "immersive-ar")) {
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 3.9),
      new THREE.MeshBasicMaterial({ color: 0x0b2430, side: THREE.DoubleSide }),
    );
    back.position.set(0, -0.03, -1.15);
    content.add(back);
  }
  if (step === -3) {
    if (showFallbackControls) {
      label("YOUR VR CONTROLS", 0, 0.74, 2.5, 0.18, 52, "#a6f5d9");
      label("Point and press a trigger to select", 0, 0.37, 2.6, 0.18, 42);
      label("Use Reset, Sound, or Skip below.\nGrip to move models; sticks move and turn in landscapes.",
        0, 0.03, 2.55, 0.26, 33, "#e6f4f5", "#0b2430");
      button("Continue to experiences", 0, -0.50, () => {
        step = -1;
        draw();
      }, 2.0);
      return;
    }
    label("YOUR QUEST CONTROLS", 0, 0.97, 2.5, 0.17, 50, "#a6f5d9");
    label("Point at Continue and press either trigger to begin", 0, 0.76,
      2.75, 0.17, 34);
    addControllerIllustrations(content, import.meta.env.BASE_URL);
    label("LEFT CONTROLLER", -0.72, 0.55, 1.2, 0.14, 34, "#80cfe6");
    label("RIGHT CONTROLLER", 0.72, 0.55, 1.2, 0.14, 34, "#ffdc83");
    label("X · Restart", -0.72, -0.23, 1.35, 0.15, 42);
    label("Y · Reset view", -0.72, -0.40, 1.35, 0.15, 42);
    label("A · Sound menu", 0.72, -0.23, 1.35, 0.15, 42);
    label("B · Back / exit", 0.72, -0.40, 1.35, 0.15, 42);
    label("Trigger · Point / select", -0.75, -0.59, 1.45, 0.14, 36);
    label("Grip · Grab / resize", 0.75, -0.59, 1.45, 0.14, 36);
    label("Sticks · Walk and turn in landscape demos", 0, -0.74,
      2.6, 0.13, 30, "#b6d1d9");
    button("Continue to experiences", 0, -0.96, () => {
      step = -1;
      draw();
    }, 2.0);
    return;
  }
  if (step === -2) {
    label("HOW SATELLITES FIND YOU", 0, 0.78, 2, 0.14, 38, "#a6f5d9");
    label("One distance. Many directions.", 0, 0.52, 2.15, 0.2, 52);
    label(
      "GNSS means Global Navigation Satellite System.\nGPS is one such satellite system. A receiver uses\nsignal travel times to estimate distances to satellites.",
      0,
      0.13,
      2.15,
      0.4,
      39,
    );
    label(
      "Known beacons stand in for satellites.\nWe know each beacon's distance; direction remains unknown.\nCombine distances to narrow down your location.",
      0,
      -0.3,
      2.15,
      0.3,
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
    if (!showFallbackControls) label("Raise either controller into view for button shortcuts",
      0, -1.04, 2.3, 0.13, 27, "#b6d1d9", "#0b2430");

    return;
  }
  if (step === -1) {
    if (xrMode === "immersive-ar") {
      label("SPATIAL DISCOVERY LAB", 0, 0.78, 2, 0.16, 48, "#a6f5d9");
      label("Mixed reality", 0, 0.5, 2, 0.2, 58);
      label(showFallbackControls
        ? "Explore a point cloud of your surroundings.\nUse Exit below to leave mixed reality."
        : "Explore a point cloud of your surroundings.\nB exits mixed reality from this menu.",
        0, 0.12, 2.1, 0.28, 36);
      button("Scan your room", 0, -0.25, startRoomScan, 1.75);
      label(showFallbackControls ? "Point and press the trigger to select" :
        "A opens sound menu · Point and press the trigger",
        0, -0.62, 2.1, 0.13, 29, "#b6d1d9", "#0b2430");
      return;
    }
    label("SPATIAL DISCOVERY LAB", 0, 1.03, 2.4, 0.13, 36,
      "#a6f5d9", "#0b2430");
    label("Choose an experience", 0, 0.83, 2.5, 0.17, 52);
    [
      { title: "Find Yourself", lines: ["Find Yourself"],
        category: "Positioning", preview: "Narrow your location with satellite distances.",
        glyph: "◎", color: "#71e3c9", action: start },
      { title: "Make It Rain", lines: ["Make It Rain"],
        category: "Watersheds", preview: "Shape terrain and watch water carve new paths.",
        glyph: "≈", color: "#80cfe6", action: startRain },
      { title: "Scan the Hidden World", lines: ["Scan the", "Hidden World"],
        category: "Point clouds", preview: "Sweep a scene to reveal a 3D point cloud.",
        glyph: "✦", color: "#b2ddf1", action: startScan },
      { title: "Stand Inside the Layers", lines: ["Stand Inside", "the Layers"],
        category: "GIS layers", preview: "Build a landscape by switching GIS layers on.",
        glyph: "▤", color: "#a8d995", action: startLayers },
      { title: "Can You See It?", lines: ["Can You See It?"],
        category: "Viewsheds", preview: "Test what a tower can see across the terrain.",
        glyph: "◉", color: "#f7ce87", action: startViewshed },
      { title: "How Big Is a Pixel?", lines: ["How Big Is", "a Pixel?"],
        category: "Resolution", preview: "Compare what coarse and fine pixels reveal.",
        glyph: "▦", color: "#c1b6f5", action: startPixels },
      { title: "See the Invisible", lines: ["See the", "Invisible"],
        category: "Spectral data", preview: "Reveal vegetation with near-infrared imagery.",
        glyph: "◒", color: "#f4aece",
        action: () => startShowcase("spectral") },
      { title: "Where Did the Cluster Go?", lines: ["Where Did the", "Cluster Go?"],
        category: "Aggregation", preview: "Switch zoning plans and watch patterns shift.",
        glyph: "⁙", color: "#f2b694",
        action: () => startShowcase("cluster") },
      { title: "Make the World Flat", lines: ["Make the", "World Flat"],
        category: "Projections", preview: "Flatten a globe and explore map distortion.",
        glyph: "◐", color: "#9adad1",
        action: () => startShowcase("projection") },
      { title: "What Changed?", lines: ["What Changed?"],
        category: "Change detection", preview: "Compare real satellite images across time.",
        glyph: "⇄", color: "#f5dc91",
        action: () => startShowcase("change") },
      { title: "Between the Rain Gauges", lines: ["Between the", "Rain Gauges"],
        category: "Interpolation", preview: "Estimate rainfall between measured locations.",
        glyph: "⌁", color: "#81d6c8",
        action: () => startShowcase("interpolation") },
    ].forEach((item, index, all) => menuCard(item, index, all.length));
    if (!showFallbackControls) label("Point and press trigger · A sound · B exit VR",
      0, -0.97, 2.8, 0.11, 26, "#b6d1d9", "#0b2430");

    return;
  }
  if (step >= stages.length) {
    label("You found your place.", 0, 0.68, 2, 0.2, 65, "#a6f5d9");
    label(
      "Each distance narrows the possible locations.\nMore well-placed beacons resolve ambiguity.\nMeasurement error leaves an area of possible positions.",
      0,
      0.18,
      2,
      0.5,
      43,
    );
    label(
      "Satellites broadcast their positions and times.\nA GNSS receiver uses those signals to calculate\nits 3D position and estimate its clock error.",
      0,
      -0.3,
      2,
      0.3,
      33,
    );
    takeawayActions(-0.64);

    return;
  }
  const s = stages[step];
  if (isSpatial()) {
    spatial();
    lessonCard(s.title, s.body);
    button(s.action, 0, GUIDED_ACTION_Y, next, 1.65);

    return;
  }
  lessonCard(s.title, s.body);
  planar();
  if (step === 2 && prediction)
    label(prediction, 0, GUIDED_INFO_Y, 2.3, 0.1, 28, "#a6f5d9", "#0b2430");
  if (s.action)
    button(s.action, step === 3 ? 0.64 : 0, GUIDED_ACTION_Y, next, step === 3 ? 1.18 : 1.65);
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
  root.position.y = pos.y - 0.08;
  root.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  pendingPlacement = false;
  if (floatingModel) resetModelView();
  if (rain) rain.place(cam);
  scan?.place(cam);
  layers?.place(cam);
  viewshed?.place(cam);
  pixels?.place(cam);
  showcase?.place?.(cam);
}
const controllers = [];
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  scene.add(c);
  const grip = renderer.xr.getControllerGrip(i);
  scene.add(grip);
  const guide = new ControllerGuide(scene, grip);
  const beam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -1),
    ]),
    new THREE.LineBasicMaterial({ color: 0xa6f5d9 }),
  );
  beam.scale.z = 4;
  c.add(beam);
  const targetBeam = new THREE.Line(beam.geometry,
    new THREE.LineBasicMaterial({ color: 0xffd070, transparent: true,
      depthTest: false, depthWrite: false }));
  targetBeam.visible = false;
  targetBeam.renderOrder = 9;
  c.add(targetBeam);
  c.addEventListener("connected", (event) => {
    c.userData.xrInput = event.data;
    guide.setHandedness(event.data.handedness);
    guide.setContext(...controllerGuideContext(guide.handedness));
    if (renderer.xr.isPresenting) refreshInputLayout(renderer.xr.getSession());
  });
  c.addEventListener("selectstart", () => {
    if (grab?.hands.size || rain?.grab.hands.size || scan?.grab.hands.size ||
        showcase?.grab?.hands.size)
      return;
    const hit = intersect(c);
    if (hit?.object.userData.fallbackAction) {
      hit.object.userData.action(hit);
      return;
    }
    if (rain?.stage === 1 && !soundMenuOpen) {
      const land = rainHit(c);
      if (modelBeforeUi(land, hit)) {
        const action = rain.beginTrigger(
          c.userData.xrInput?.handedness,
          i,
          land.point,
          grip.visible ? grip.getWorldPosition(new THREE.Vector3()) : null,
        );
        if (action) sound.click();
        c.userData.raining = action === "rain";
        if (c.userData.raining) {
          rainPointer = i;
          sound.setWater(true);
        }
        return;
      }
    }
    if (scan?.stage === 1 && !scan.room) {
      const model = scan.grabHit(raycaster);
      if (modelBeforeUi(model, hit)) {
        sound.click();
        c.userData.scanning = true;
        return;
      }
    }
    if (["interpolation", "suitability"].includes(showcase?.kind) && !soundMenuOpen) {
      const model = showcase.grabHit(raycaster);
      if (modelBeforeUi(model, hit) && showcase.selectFromRay(raycaster)) {
        sound.click();
        return;
      }
    }
    if (hit) {
      hit.object.userData.action?.(hit);
      return;
    }
    if (soundMenuOpen) return;
    if (viewshed) {
      if (viewshed.placeFromRay(raycaster)) sound.click();
      return;
    }
    if (pixels) {
      if (pixels.placeFromRay(raycaster)) sound.click();
      return;
    }
    if (showcase) {
      if (["projection", "change"].includes(showcase.kind) &&
          showcase.beginInteraction(raycaster, i)) {
        sound.click();
        return;
      }
      if (showcase.selectFromRay?.(raycaster)) sound.click();
      return;
    }
    if (scan?.stage === 1) {
      sound.click();
      c.userData.scanning = true;
      return;
    }
  });
  c.addEventListener("selectend", () => {
    showcase?.endInteraction?.(i);
    rain?.endStroke(i);
    c.userData.raining = false;
    c.userData.scanning = false;
  });
  c.addEventListener("squeezestart", () => {
    if (soundMenuOpen) return;
    if (scan && (scan.room || scan.stage === 1) && grip.visible) {
      if (scan.room && !scan.frozen) return;
      grip.updateWorldMatrix(true, false);
      const ui = intersect(c);
      const target = scan.room ? scanHit(c) : scan.grabHit(raycaster);
      const near = !scan.room && scan.handNear(grip.getWorldPosition(new THREE.Vector3()));
      if (scan.grab.hands.size || near || modelBeforeUi(target, ui)) {
        sound.click();
        for (const { c: controller } of controllers)
          controller.userData.scanning = false;
        scan.grab.begin(i, grip.matrixWorld);
      }
      return;
    }
    if (rain && rain.stage !== 0 && grip.visible) {
      grip.updateWorldMatrix(true, false);
      const ui = intersect(c);
      const target = rain.grabHit(raycaster);
      const near = rain.handNear(grip.getWorldPosition(new THREE.Vector3()));
      if (rain.grab.hands.size || near || modelBeforeUi(target, ui)) {
        sound.click();
        rain.endStroke();
        for (const { c: controller } of controllers)
          controller.userData.raining = false;
        rain.grab.begin(i, grip.matrixWorld);
      }
      return;
    }
    if (["interpolation", "suitability"].includes(showcase?.kind) && showcase.started &&
        !showcase.finished && grip.visible) {
      grip.updateWorldMatrix(true, false);
      const ui = intersect(c);
      const target = showcase.grabHit(raycaster);
      const near = showcase.handNear(grip.getWorldPosition(new THREE.Vector3()));
      if (showcase.grab.hands.size || near || modelBeforeUi(target, ui)) {
        sound.click();
        showcase.grab.begin(i, grip.matrixWorld);
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
    if (grab.hands.size || near || modelHit(c)) {
      sound.click();
      grab.begin(i, grip.matrixWorld);
    }
  });
  c.addEventListener("squeezeend", () => {
    grab?.release(i);
    scan?.grab.release(i);
    rain?.grab.release(i);
    showcase?.grab?.release(i);
    rain?.endStroke(i);
  });
  c.addEventListener("disconnected", () => {
    if (scan?.room) scan.releaseInput(c.userData.xrInput);
    c.userData.xrInput = null;
    guide.setHandedness("none");
    grab?.release(i);
    scan?.grab.release(i);
    rain?.grab.release(i);
    showcase?.grab?.release(i);
    rain?.endStroke(i);
    c.userData.raining = false;
    c.userData.scanning = false;
  });
  controllers.push({ c, grip, beam, targetBeam, guide, id: i });
}
function scanHit(c) {
  if (!scan || (!scan.room && scan.stage !== 1)) return null;
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
  if (soundMenuOpen) return raycaster.intersectObjects(soundButtons, false)[0];
  if ((layers?.started && !layers.clipboard.visible) ||
      (viewshed?.started && !viewshed.clipboard.visible) ||
      (pixels?.started && !pixels.clipboard.visible)) return null;
  return raycaster.intersectObjects(buttons, false)[0];
}
async function enter(mode, roomScan = mode === "immersive-ar") {
  if (mode === "immersive-vr") pendingRoomHandoff = false;
  controllerShortcuts.reset();
  if (previewGuide)
    for (const { grip } of controllers) grip.matrixAutoUpdate = false;
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
    showFallbackControls = !hasQuestShortcuts(navigator.userAgent, session.inputSources);
    session.addEventListener("inputsourceschange", () => refreshInputLayout(session));
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
    showcase?.dispose();
    showcase = null;
    rain?.dispose();
    rain = null;
    stopRainInput();
    step = mode === "immersive-vr" ? -3 : -1;
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
  closeSoundMenu();
  sound.setMenuMusic(false);
  sound.setActive(false);
  controllerShortcuts.reset();
  showFallbackControls = fallbackPreview;
  rightTurnReady = true;
  layers?.dispose();
  layers = null;
  viewshed?.dispose();
  viewshed = null;
  pixels?.dispose();
  pixels = null;
  showcase?.dispose();
  showcase = null;
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
      "Open this HTTPS site in a browser with immersive WebXR support.";
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
          "XR availability could not be checked. Reload in a WebXR browser.";
      });
}
renderer.setAnimationLoop((time, frame) => {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
  lastTime = time;
  updateRangeAnimations(dt);
  updateUIFade(dt);
  const previousSamples = scan?.records.length ?? 0;
  if (renderer.xr.isPresenting && frame) {
    if (pendingPlacement) place();
    const session = renderer.xr.getSession();
    refreshInputLayout(session);
    const visibleSession = session.visibilityState === "visible";
    if (visibleSession && !showFallbackControls) {
      const actions = controllerShortcuts.update(
        controllers.map(({ c }) => c.userData.xrInput).filter(Boolean),
      );
      if (actions.length) runControllerShortcut(actions[0]);
    } else controllerShortcuts.reset();
    updateControllerGuides(renderer.xr.getCamera(), visibleSession, dt);
    if (
      !rain &&
      !scan &&
      !layers &&
      !viewshed &&
      !pixels &&
      (step >= 0 || step === -2) &&
      step < stages.length &&
      renderer.xr.getSession().visibilityState === "visible" &&
      !soundMenuOpen
    ) {
      elapsed += dt;
      if (elapsed >= 240) {
        step = stages.length;
        draw();
      }
    }
    const landscapeDemo = pixels ?? viewshed ?? layers;
    if (["projection", "change"].includes(showcase?.kind) &&
        showcase.draggingBy !== null) {
      const active = controllers.find(({ id }) => id === showcase.draggingBy);
      if (!visibleSession || !active?.c.visible || soundMenuOpen)
        showcase.endInteraction(showcase.draggingBy);
      else {
        intersect(active.c);
        showcase.dragInteraction(raycaster, active.id, dt);
      }
    }
    if (showcase && visibleSession && !soundMenuOpen) showcase.update(dt);
    if (landscapeDemo) {
      const visible = renderer.xr.getSession().visibilityState === "visible";
      if (visible && !soundMenuOpen) landscapeDemo.update(dt);
      const right = visible && !soundMenuOpen
        ? controllers.find(({ c }) => c.userData.xrInput?.handedness === "right")
        : null;
      const gamepad = right?.c.userData.xrInput?.gamepad;
      const axis = gamepad?.mapping === "xr-standard" ? gamepad.axes[2] ?? 0 : 0;
      if (Math.abs(axis) < 0.3) rightTurnReady = true;
      else if (rightTurnReady && Math.abs(axis) > 0.7) {
        landscapeDemo.turn(Math.sign(axis) * Math.PI / 6, renderer.xr.getCamera());
        rightTurnReady = false;
      }
      const left = visible && !soundMenuOpen
        ? controllers.find(
            ({ c, grip }) =>
              c.userData.xrInput?.handedness === "left" && grip.visible,
          )
        : null;
      const leftPad = left?.c.userData.xrInput?.gamepad;
      const leftX = leftPad?.mapping === "xr-standard" ? leftPad.axes[2] ?? 0 : 0;
      const leftY = leftPad?.mapping === "xr-standard" ? leftPad.axes[3] ?? 0 : 0;
      if (visible && !soundMenuOpen)
        landscapeDemo.walk(leftX, leftY, dt, renderer.xr.getCamera());
      if (!soundMenuOpen)
        landscapeDemo.updateClipboard(left?.grip, renderer.xr.getCamera(), false,
          showFallbackControls);
    }
    if (rain && !soundMenuOpen && renderer.xr.getSession().visibilityState === "visible") {
      const active = controllers[rainPointer];
      let falling = false;
      if (
        active?.c.visible &&
        active.c.userData.xrInput?.handedness === "left" &&
        rain.stage === 1 &&
        !rain.grab.hands.size
      ) {
        falling = !!active.c.userData.raining;
        const ui = intersect(active.c);
        const land = rainHit(active.c);
        if (modelBeforeUi(land, ui)) rain.aim(land.point);
      }
      if (rain.stroke) {
        const held = controllers[rain.stroke.id];
        if (held?.grip.visible) {
          rain.moveStroke(
            held.id,
            held.grip.getWorldPosition(new THREE.Vector3()),
            rain.stroke.tool === "vegetation" ? rainHit(held.c)?.point : null,
          );
        } else rain.endStroke();
      }
      if (falling || rain.pouring) waterSoundUntil = time + 350;
      if (rain.stage !== 0) rain.update(dt, falling);
    }
    if (scan && !soundMenuOpen && renderer.xr.getSession().visibilityState === "visible") {
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
          if (c.visible && c.userData.scanning) {
            const ui = intersect(c);
            const model = scan.grabHit(raycaster);
            if (!ui || modelBeforeUi(model, ui))
              scan.sweep(raycaster.ray.origin, raycaster.ray.direction, dt);
          }
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
      showcase?.grab?.update(poses);
      if (scan && !scan.room && scan.stage === 1 && !soundMenuOpen)
        for (const { c, id } of controllers) {
          const pad = c.userData.xrInput?.gamepad;
          scan.rotateWithStick(id,
            pad?.mapping === "xr-standard" ? pad.axes[2] ?? 0 : 0,
            pad?.mapping === "xr-standard" ? pad.axes[3] ?? 0 : 0,
            renderer.xr.getCamera());
        }
    } else {
      grab?.cancel();
      rain?.grab.cancel();
      scan?.grab.cancel();
      showcase?.grab?.cancel();
      scan?.stickReady?.clear();
    }
    for (const b of soundMenuOpen ? soundButtons : buttons) {
      b.userData.baseColor ??= b.material.color.clone();
      b.material.color.copy(b.userData.baseColor);
    }
    for (const { c, beam, targetBeam, id } of controllers) {
      const hit = intersect(c);
      const model = soundMenuOpen ? null : modelHit(c) || rainHit(c) ||
        scanHit(c) || (showcase?.kind === "interpolation" ? null :
          showcase?.grabHit?.(raycaster));
      const interpolationTarget = hit || soundMenuOpen ||
        showcase?.kind !== "interpolation" ? null : showcase.targetHit(raycaster);
      const ground = hit || soundMenuOpen ? null : (viewshed ?? pixels)?.hitTerrain(raycaster);
      const exhibitPanel = hit || soundMenuOpen ? null :
        exhibitPanelHit(raycaster, showcase);
      const pointerAvailable =
        !grab?.hands.has(id) &&
        !rain?.grab.hands.has(id) &&
        !scan?.grab.hands.has(id) &&
        !showcase?.grab?.hands.has(id) &&
        showcase?.draggingBy !== id;
      const activeTarget = pointerAvailable && !!interpolationTarget;
      beam.visible = pointerAvailable && !activeTarget;
      targetBeam.visible = activeTarget;
      if (activeTarget) targetBeam.scale.z = interpolationTarget.distance;
      if (showcase?.kind === "interpolation")
        showcase.showTarget(id, activeTarget ? interpolationTarget : null);
      beam.scale.z = hit ? hit.distance : interpolationTarget ? interpolationTarget.distance :
        model ? model.distance :
        ground ? ground.distance : exhibitPanel ? exhibitPanel.distance : 4;
      beam.material.color.set(
        grab?.hands.has(id) ||
          scan?.grab.hands.has(id) ||
          rain?.grab.hands.has(id) ||
          showcase?.grab?.hands.has(id) ||
          rain?.stroke?.id === id
          ? 0xffca83
          : model
            || ground || exhibitPanel
            ? 0xffffff
            : 0xa6f5d9,
      );
      if (hit) hit.object.material.color.set(hit.object.userData.hoverColor ?? 0xffda8b);
    }
  }
  if (devPreview && (pixels || viewshed || layers) && !renderer.xr.isPresenting &&
      !soundMenuOpen) {
    const landscapeDemo = pixels ?? viewshed ?? layers;
    landscapeDemo.update(dt);
    landscapeDemo.updateClipboard(null, camera, true, fallbackPreview);
  }
  if (devPreview && showcase && !renderer.xr.isPresenting && !soundMenuOpen)
    showcase.update(dt);
  if (devPreview && rain && !renderer.xr.isPresenting && !soundMenuOpen) {
    rain.update(dt, previewRaining);
    if (previewRaining || rain.pouring) waterSoundUntil = time + 350;
  }
  if (devPreview && scan && !renderer.xr.isPresenting && !soundMenuOpen)
    scan.update(dt);
  if (previewGuide && !renderer.xr.isPresenting)
    for (const { grip, id } of controllers) {
      grip.visible = true;
      const previewHand = new URLSearchParams(location.search).get("hand");
      const focused = previewHand === "right" ? 1 : 0;
      grip.position.set(id === focused ? 0 : id === 0 ? -0.32 : 0.32,
        id === focused ? -0.12 : -0.38, id === focused ? -0.36 : -0.55);
      grip.rotation.set(id === focused ? -0.65 : 0, 0, 0);
      grip.updateWorldMatrix(true, false);
    }
  if (previewGuide && !renderer.xr.isPresenting)
    updateControllerGuides(camera, true, dt);
  const audible =
    !document.hidden &&
    (devPreview ||
      (renderer.xr.isPresenting &&
        renderer.xr.getSession()?.visibilityState === "visible"));
  sound.setActive(audible);
  const landscapeAudioDemo = pixels ?? viewshed ?? layers;
  if (audible && (scan?.records.length ?? 0) > previousSamples) sound.scan(scan.lastRange);
  sound.setWater(!!(audible && rain?.stage === 1 && time < waterSoundUntil));
  const riverLevel = landscapeAudioDemo?.selected.has("hydrology")
    ? THREE.MathUtils.clamp(
        1 - Math.abs(landscapeAudioDemo.visitor.x -
          riverX(landscapeAudioDemo.visitor.y)) / 24,
        0, 1,
      )
    : 0;
  sound.setLandscape(!!(audible && landscapeAudioDemo), riverLevel,
    landscapeAudioDemo?.selected.has("vegetation") ? 1 : 0);
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
    requestedStep >= -3 &&
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
  } else if (["spectral", "cluster", "projection", "change", "interpolation", "suitability"].includes(
    new URLSearchParams(location.search).get("demo"))) {
    startShowcase(new URLSearchParams(location.search).get("demo"));
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
  if (previewGuide)
    for (const { grip, guide, id } of controllers) {
      grip.matrixAutoUpdate = true;
      grip.visible = true;
      grip.position.set(id === 0 ? -0.25 : 0.25, -0.18, -0.45);
      guide.setHandedness(id === 0 ? "left" : "right");
      guide.setContext(...controllerGuideContext(guide.handedness));
      grip.dispatchEvent({
        type: "connected",
        data: {
          handedness: id === 0 ? "left" : "right",
          targetRayMode: "tracked-pointer",
          profiles: ["meta-quest-touch-plus-v2", "meta-quest-touch-plus"],
          gamepad: {
            mapping: "xr-standard",
            buttons: Array.from({ length: 7 },
              () => ({ pressed: false, touched: false, value: 0 })),
            axes: [0, 0, 0, 0],
          },
        },
      });
    }
  renderer.domElement.addEventListener("pointerdown", (e) => {
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        (-e.clientY / innerHeight) * 2 + 1,
      ),
      camera,
    );
    const ui = raycaster.intersectObjects(soundMenuOpen ? soundButtons : buttons, false)[0];
    if (ui) ui.object.userData.action?.(ui);
    else if (soundMenuOpen) return;
    else if (viewshed) viewshed.placeFromRay(raycaster);
    else if (pixels) pixels.placeFromRay(raycaster);
    else if (showcase) {
      if (["projection", "change"].includes(showcase.kind) &&
          showcase.beginInteraction(raycaster, "preview")) {
        previewSpinPointer = e.pointerId;
        previewSpinTime = e.timeStamp;
        renderer.domElement.setPointerCapture(e.pointerId);
      } else showcase.selectFromRay?.(raycaster);
    }
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
  window.addEventListener("pointerup", (e) => {
    previewRaining = false;
    if (e.pointerId === previewSpinPointer) {
      showcase?.endInteraction?.("preview");
      previewSpinPointer = null;
    }
  });
  window.addEventListener("pointercancel", (e) => {
    if (e.pointerId === previewSpinPointer) {
      showcase?.endInteraction?.("preview");
      previewSpinPointer = null;
    }
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    const previewInterpolation = showcase?.kind === "interpolation" &&
      showcase.started && !showcase.finished;
    if (e.pointerId !== previewSpinPointer && rain?.stage !== 1 &&
        !previewInterpolation) return;
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        (-e.clientY / innerHeight) * 2 + 1,
      ),
      camera,
    );
    if (e.pointerId === previewSpinPointer) {
      showcase?.dragInteraction?.(raycaster, "preview",
        Math.min(0.1, (e.timeStamp - previewSpinTime) / 1000));
      previewSpinTime = e.timeStamp;
      return;
    }
    if (previewInterpolation) {
      const ui = raycaster.intersectObjects(soundMenuOpen ? soundButtons : buttons, false)[0];
      showcase.showTarget(2, ui || soundMenuOpen ? null : showcase.targetHit(raycaster));
      return;
    }
    rain.group.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObject(rain.terrain, false)[0];
    if (hit) rain.aim(hit.point);
    // A held press keeps watering its last valid source beyond the terrain edge.
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    if (showcase?.kind === "interpolation") showcase.showTarget(2, null);
  });
}
