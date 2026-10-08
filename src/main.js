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
import { ScanExperience } from "./scan/experience.js";
import { RainExperience } from "./rain/experience.js";
import { cellAt } from "./rain/terrain.js";
import { ModelGrab } from "./manipulation.js";
const devPreview =
  import.meta.env.DEV && new URLSearchParams(location.search).has("preview");
const app = document.querySelector("#app");
app.innerHTML = `<header><div class="brand">◈ &nbsp; SPATIAL DISCOVERY LAB</div><div class="tag">GIS Day · Immersive explorations</div></header><section class="intro"><div class="eyebrow">A different way to see where you are</div><h1>Your world.<br>A new dimension.</h1><p>Three short, hands-on discoveries in virtual and mixed reality.<br>Enter the lab, then choose an experience inside your headset.</p><button id="vr" disabled>Checking VR…</button><button id="ar" class="secondary" disabled>Checking mixed reality…</button><p class="small">Quest controllers · About 4 minutes per experience · Seated or standing</p></section><section class="grid"><article class="card"><div class="art" aria-hidden="true"><i class="ring"></i><i class="ring"></i><i class="ring"></i><i class="dot"></i></div><div class="eyebrow">01 / Positioning</div><h2>Find Yourself Without GPS</h2><p>Use distances to find possible locations. Grab a floating model and discover why one measurement is never the whole story.</p></article><article class="card"><div class="rain-art" aria-hidden="true">☁<span>╲ ╲ ╲ ╲ ╲</span><div>⌁ &nbsp; ▲ &nbsp; ⌁</div></div><div class="eyebrow">02 / Watersheds</div><h2>Make It Rain</h2><p>Make rain fall on a miniature landscape. Follow the water, cross a ridge, and discover where different watersheds lead.</p></article><article class="card"><div class="rain-art" aria-hidden="true">✧ ⋮ ✧<div>⠿ ⠿ ⠿</div></div><div class="eyebrow">03 / Remote sensing</div><h2>Scan the Hidden World</h2><p>Sweep a scanner to reveal a point cloud. Explore blind spots, change viewpoints, and filter vegetation.</p></article></section><p id="status" role="status" aria-live="polite"></p><footer>Quest-first prototype · VR / passthrough · Three hands-on experiences</footer>`;
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
  30,
);
camera.position.set(0, 0, 0);
const root = new THREE.Group();
scene.add(root);
const content = new THREE.Group();
root.add(content);
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.025;
const rotation = new THREE.Matrix4();
let buttons = [],
  step = -1,
  elapsed = 0,
  lastTime = 0,
  pendingPlacement = false,
  noisy = false,
  prediction = "";
let scan = null;
let rain = null,
  rainPointer = 0,
  previewRaining = false;
let floatingModel = null,
  grab = null,
  preservePose = null;
const isSpatial = () => step === 4 || step === 5;
const palette = [0x6ef0d1, 0xffca83, 0xc6b7ff, 0xff9ba8];
function clear() {
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
  while (content.children.length) {
    const obj = content.children[0];
    obj.traverse((n) => {
      n.geometry?.dispose();
      if (n.material) {
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          m.map?.dispose();
          m.dispose();
        }
      }
    });
    content.remove(obj);
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
  size = (size * 1.6) / w;
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
  mesh.position.set(x, y, 0.02);
  content.add(mesh);
  return mesh;
}
function button(text, x, y, action, w = 0.75) {
  const m = label(text, x, y, w, 0.16, 48, "#08241e", "#a6f5d9");
  m.position.z = 0.08;
  m.userData.action = action;
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
  return line(
    Array.from(
      { length: 129 },
      (_, i) =>
        new THREE.Vector3(
          a.x + Math.cos((i / 128) * Math.PI * 2) * r,
          a.y + Math.sin((i / 128) * Math.PI * 2) * r,
          0,
        ),
    ),
    color,
  );
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
    "Menu",
    -0.72,
    y,
    () => {
      scan?.dispose();
      scan = null;
      rain?.dispose();
      rain = null;
      stopRainInput();
      step = -1;
      draw();
    },
    0.42,
  );
  button("Restart", -0.23, y, () => start(), 0.46);
  button(
    rain || scan || isSpatial() ? "Reset View" : "Recenter",
    0.3,
    y,
    () => {
      if (devPreview) place();
      else pendingPlacement = true;
    },
    0.5,
  );
  button("Exit XR", 0.84, y, () => renderer.xr.getSession()?.end(), 0.46);
}
function start() {
  if (scan) {
    startScan();
    return;
  }
  if (rain) {
    startRain(rain.kind);
    return;
  }
  preservePose = null;
  step = -2;
  elapsed = 0;
  noisy = false;
  prediction = "";
  draw();
}
function stopRainInput() {
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
  stopRainInput();
  rain?.dispose();
  rain = new RainExperience(scene, draw, kind);
  rain.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  if (explore) rain.stage = 1;
  draw();
}
function startScan() {
  stopRainInput();
  rain?.dispose();
  rain = null;
  scan?.dispose();
  scan = new ScanExperience(scene, draw);
  scan.place(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  draw();
}
function drawScanUI() {
  const s = scan;
  const copy = [
    [
      "Scan the Hidden World",
      "A scanner measures distance along a known direction.\nEach return becomes one 3D point, building a point cloud.\nThis is a synthetic scene, not a scan of your room.",
    ],
    [
      "Sweep. Change your viewpoint. Discover.",
      "Point into the box and HOLD TRIGGER to collect points.\nGRIP to turn / move; BOTH grips to resize. Scan another side.\nGaps can be blocked views. Filtering cannot fill them in.",
    ],
    [
      "A point cloud is a set of observations.",
      "New viewpoints reveal surfaces that were blocked.\nFiltering removes selected points; it cannot see through objects.\nReal lidar needs careful positioning and classification.",
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
  if (s.stage === 0)
    button("Start scanning", 0, -0.77, () => s.explore(), 1.65);
  else {
    button(
      s.reveal ? "Cloud only" : "Reveal scene",
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
      s.stage === 2 ? "Scan again" : "Takeaways",
      0.84,
      -0.77,
      () => {
        stopRainInput();
        if (s.stage === 2) startScan();
        else s.finish();
      },
      0.52,
    );
    label(
      `${s.records.length.toLocaleString()} / 18,000 samples · First surface only · Synthetic class labels`,
      0,
      -0.64,
      2.3,
      0.09,
      24,
      "#b6d1d9",
      "#0b2430",
    );
  }
  navigation();
}
function drawRainUI() {
  const r = rain;
  const copy = [
    [
      "Make It Rain",
      "Water on the surface flows downhill.\nA ridge can send nearby drops toward different outlets.\nGRIP: move / turn the model. BOTH grips: resize.",
    ],
    [
      "Where will your rain go?",
      "Point at the land and HOLD the TRIGGER to rain.\nThe cloud follows your aim. Try both sides of the ridge.\nSIDE GRIP: move / turn. BOTH grips: resize.",
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
  if (r.stage === 1 && r.mode === "sculpt")
    copy[1] = [
      "Sandbox · shape the land",
      "Point at the land and HOLD a SIDE GRIP.\nLift to raise earth; lower to dig. Move sideways to sculpt.\nRelease, then choose Rain mode to test your changes.",
    ];
  else if (r.stage === 1 && r.edited)
    copy[1] = [
      "Rain mode · test your terrain",
      "Point at the land and HOLD the TRIGGER to rain.\nDid your ridge redirect water? Did your hollow trap it?\nKeep raining to fill / spill. GRIP: move; BOTH grips: resize.",
    ];
  if (r.stage === 4 && r.edited)
    copy[4] = [
      "Change the land. Change the flow.",
      "A watershed is land that drains to a common outlet.\nRidges redirect runoff; hollows fill before spilling.\nThis model traces paths, not water depth or flood risk.",
    ];
  if (r.kind === "erosion") {
    copy[0] = [
      "Make It Rain · erosion tray",
      "Water can move the land as well as flow over it.\nPour onto this tilted bed and watch channels develop.\nGRIP: move / turn. BOTH grips: resize.",
    ];
    copy[1] = [
      "Pour. Cut channels. Carry sediment.",
      "Start the pour, or point and HOLD TRIGGER to add water.\nDarker grooves show erosion; pale patches show deposits.\nStop the pour to inspect. GRIP: move; BOTH grips: resize.",
    ];
    copy[4] = [
      "Water shapes its own path.",
      "Flow removes loose material and carries it downhill.\nChannels can join; slower water can leave sediment behind.\nThis accelerated experiment is not a real erosion forecast.",
    ];
  }
  const [title, body] = copy[r.stage];
  label(title, 0, 1.02, 2.4, 0.18, 48, "#e6f4f5", "#0b2430");
  label(body, 0, 0.78, 2.4, 0.3, 33, "#e6f4f5", "#0b2430");
  if (r.stage === 0) {
    button(
      r.kind === "erosion" ? "Explore tray" : "Drainage sandbox",
      -0.55,
      -0.77,
      () => r.explore(),
      1.02,
    );
    button(
      r.kind === "erosion" ? "Drainage sandbox" : "Erosion tray",
      0.55,
      -0.77,
      () => startRain(r.kind === "erosion" ? "drainage" : "erosion", true),
      1.02,
    );
  }
  if (r.stage === 1 && r.kind === "erosion") {
    button(
      r.pouring ? "Stop pour" : "Start pour",
      -0.84,
      -0.77,
      () => {
        stopRainInput();
        r.pouring = !r.pouring;
        draw();
      },
      0.52,
    );
    button(
      "Reset tray",
      -0.28,
      -0.77,
      () => {
        stopRainInput();
        r.pouring = false;
        r.restore();
      },
      0.52,
    );
    button("Drainage", 0.28, -0.77, () => startRain("drainage", true), 0.52);
    button(
      "Takeaways",
      0.84,
      -0.77,
      () => {
        stopRainInput();
        r.finish();
      },
      0.52,
    );
  }
  if (r.stage === 1 && r.kind !== "erosion") {
    button(
      r.mode === "sculpt" ? "Rain mode" : "Shape terrain",
      -0.84,
      -0.77,
      () => {
        stopRainInput();
        r.setMode(r.mode === "sculpt" ? "rain" : "sculpt");
      },
      0.52,
    );
    button(
      r.mode === "sculpt"
        ? "Restore terrain"
        : r.overlay
          ? "Hide basins"
          : "Show basins",
      -0.28,
      -0.77,
      () => {
        stopRainInput();
        if (r.mode === "sculpt") r.restore();
        else r.toggleOverlay();
      },
      0.52,
    );
    button(
      r.edited || r.mode === "sculpt" ? "Takeaways" : "Prediction",
      0.28,
      -0.77,
      () => {
        stopRainInput();
        if (r.edited || r.mode === "sculpt") r.finish();
        else r.challenge();
      },
      0.52,
    );
    button("Erosion tray", 0.84, -0.77, () => startRain("erosion", true), 0.52);
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
    button("Make rain again", 0, -0.77, () => startRain(r.kind), 1.65);
  } else
    label(
      r.kind === "erosion"
        ? "Illustrative loose sediment · Fixed tray slope · Accelerated time"
        : r.mode === "sculpt"
          ? "Editing drains water · Edges anchored · Height limited"
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
}
function planar() {
  const first = content.children.length;
  const count = step === 0 ? 1 : step === 1 ? 2 : 3;
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
    circle(a, ranges[i], palette[i]);
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
      new THREE.SphereGeometry(a.distanceTo(t), 28, 18),
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
    if (scan?.stage === 1) {
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
    if (rain?.stage === 1 && rain.kind === "erosion") {
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
      for (const [name, x] of [
        ["Rain on left slope", -0.3],
        ["Rain on right slope", 0.3],
      ]) {
        const b = document.createElement("button");
        b.textContent = name;
        b.style.cssText = "font-size:11px;padding:5px;margin:3px";
        b.textContent =
          rain.mode === "sculpt"
            ? x < 0
              ? "Dig hollow"
              : "Raise ridge"
            : name;
        b.onclick = () => {
          if (rain.mode === "sculpt") {
            rain.applyBrush(x, -0.4, x < 0 ? -0.3 : 0.3);
            rain.endStroke();
          } else rain.burst(cellAt(x, -0.4));
        };
        panel.append(b);
      }
    }
    for (const mesh of buttons) {
      const b = document.createElement("button");
      b.textContent = mesh.userData.label || "Candidate";
      b.style.cssText = "font-size:11px;padding:5px;margin:3px";
      b.onclick = mesh.userData.action;
      panel.append(b);
    }
  }
}
function drawScene() {
  clear();
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
      },
      1.8,
    );
    navigation();
    return;
  }
  if (step === -1) {
    label("SPATIAL DISCOVERY LAB", 0, 0.78, 2, 0.16, 48, "#a6f5d9");
    label("Choose an experience", 0, 0.54, 2, 0.2, 58);
    button("Find Yourself Without GPS", 0, 0.15, start, 1.75);
    button("Make It Rain", 0, -0.1, startRain, 1.75);
    label(
      "About 4 minutes each · Point and press the trigger",
      0,
      -0.62,
      2,
      0.12,
      32,
    );
    button("Scan the Hidden World", 0, -0.4, startScan, 1.75);
    navigation();
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
  c.addEventListener("selectstart", () => {
    if (grab?.hands.size || rain?.grab.hands.size || scan?.grab.hands.size)
      return;
    const hit = intersect(c);
    if (hit) {
      hit.object.userData.action?.();
      return;
    }
    if (scan?.stage === 1) {
      c.userData.scanning = true;
      return;
    }
    if (rain?.stage === 1) {
      const land = rainHit(c);
      if (land) {
        rainPointer = i;
        rain.aim(land.point);
        c.userData.raining = true;
      }
    }
  });
  c.addEventListener("selectend", () => {
    c.userData.raining = false;
    c.userData.scanning = false;
  });
  c.addEventListener("squeezestart", () => {
    if (scan && grip.visible) {
      grip.updateWorldMatrix(true, false);
      if (scan.grab.hands.size || (!intersect(c) && scanHit(c))) {
        for (const { c: controller } of controllers)
          controller.userData.scanning = false;
        scan.grab.begin(i, grip.matrixWorld);
      }
      return;
    }
    if (rain?.mode === "sculpt" && grip.visible && !intersect(c)) {
      const land = rainHit(c);
      if (land)
        rain.beginStroke(
          i,
          land.point,
          grip.getWorldPosition(new THREE.Vector3()),
        );
      return;
    }
    if (rain && rain.mode === "rain" && grip.visible) {
      grip.updateWorldMatrix(true, false);
      rain.group.updateWorldMatrix(true, false);
      const local = rain.group.worldToLocal(
        grip.getWorldPosition(new THREE.Vector3()),
      );
      const near =
        Math.abs(local.x) < 1.1 &&
        Math.abs(local.z) < 1.1 &&
        local.y > -0.15 &&
        local.y < 1.1;
      if (rain.grab.hands.size || (!intersect(c) && (near || rainHit(c)))) {
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
  if (!scan) return null;
  intersect(c);
  return scan.hit(raycaster);
}
function rainHit(c) {
  if (!rain) return null;
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
  return raycaster.intersectObjects(buttons, false)[0];
}
async function enter(mode) {
  let session;
  try {
    session = await navigator.xr.requestSession(mode);
    scene.background =
      mode === "immersive-ar" ? null : new THREE.Color(0x071820);
    await renderer.xr.setSession(session);
    document.body.classList.add("xr-active");
    scan?.dispose();
    scan = null;
    rain?.dispose();
    rain = null;
    stopRainInput();
    step = -1;
    elapsed = 0;
    session.addEventListener("visibilitychange", () => {
      if (session.visibilityState !== "visible") {
        grab?.cancel();
        stopRainInput();
      }
    });
    draw();
    pendingPlacement = true;
    status.textContent = "";
  } catch (e) {
    if (session) await session.end().catch(() => {});
    status.textContent = `Could not enter ${mode === "immersive-ar" ? "mixed reality" : "VR"}: ${e.message}. You can try again.`;
  }
}
renderer.xr.addEventListener("sessionend", () => {
  grab?.cancel();
  stopRainInput();
  document.body.classList.remove("xr-active");
  status.textContent =
    "Session ended. Choose VR or mixed reality to start again.";
});
for (const [id, mode, name] of [
  ["vr", "immersive-vr", "Enter VR"],
  ["ar", "immersive-ar", "Enter mixed reality"],
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
  if (renderer.xr.isPresenting && frame) {
    if (pendingPlacement) place();
    if (
      !rain &&
      !scan &&
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
    if (rain && renderer.xr.getSession().visibilityState === "visible") {
      const active = controllers[rainPointer];
      let falling = false;
      if (
        active?.c.visible &&
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
        if (held?.grip.visible)
          rain.moveStroke(
            held.id,
            held.grip.getWorldPosition(new THREE.Vector3()),
          );
        else rain.endStroke();
      }
      rain.update(dt, falling);
    }
    if (scan && renderer.xr.getSession().visibilityState === "visible") {
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
    for (const b of buttons) b.material.color.set(0xffffff);
    for (const { c, beam, handle, id } of controllers) {
      const hit = intersect(c);
      const model = modelHit(c) || rainHit(c) || scanHit(c);
      beam.visible =
        !grab?.hands.has(id) &&
        !rain?.grab.hands.has(id) &&
        !scan?.grab.hands.has(id);
      beam.scale.z = hit ? hit.distance : model ? model.distance : 4;
      handle.material.color.set(
        grab?.hands.has(id) ||
          scan?.grab.hands.has(id) ||
          rain?.grab.hands.has(id) ||
          rain?.stroke?.id === id
          ? 0xffca83
          : model
            ? 0xffffff
            : 0xa6f5d9,
      );
      if (hit) hit.object.material.color.set(0xffda8b);
    }
  }
  if (devPreview && rain && !renderer.xr.isPresenting)
    rain.update(dt, previewRaining);
  if (devPreview && scan && !renderer.xr.isPresenting) scan.update(dt);
  renderer.render(scene, camera);
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
  if (new URLSearchParams(location.search).get("demo") === "rain") startRain();
  else if (new URLSearchParams(location.search).get("demo") === "scan")
    startScan();
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
    if (ui) ui.object.userData.action?.();
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
