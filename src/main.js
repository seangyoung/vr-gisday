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
import { ModelGrab } from "./manipulation.js";
const devPreview =
  import.meta.env.DEV && new URLSearchParams(location.search).has("preview");
const app = document.querySelector("#app");
app.innerHTML = `<header><div class="brand">◈ &nbsp; SPATIAL DISCOVERY LAB</div><div class="tag">GIS Day · Immersive explorations</div></header><section class="intro"><div class="eyebrow">A different way to see where you are</div><h1>Your world.<br>A new dimension.</h1><p>Short, hands-on discoveries in virtual and mixed reality.<br>Choose your view, put on your Quest, and follow your curiosity.</p></section><section class="grid"><article class="card"><div class="art" aria-hidden="true"><i class="ring"></i><i class="ring"></i><i class="ring"></i><i class="dot"></i></div><div class="eyebrow">01 / Positioning · About 4 minutes</div><h2>Find Yourself Without GPS</h2><p>How much can a distance tell you? Reveal your possible locations, make a prediction, and discover why measurements never tell the whole story.</p><button id="vr" disabled>Checking VR…</button><button id="ar" class="secondary" disabled>Checking mixed reality…</button><p class="small">Use Quest controllers. Point and press the trigger to select.<br>Stay seated or standing in one place; no walking required.</p></article><article class="card planned"><div class="eyebrow">On the drawing board</div><h3>Make It Rain</h3><p class="small">Follow water across a miniature landscape.</p><h3>Scan the Hidden World</h3><p class="small">Discover a world one point at a time.</p><p class="small">Future experiences · Not yet playable</p></article></section><p id="status" role="status" aria-live="polite"></p><footer>Quest-first prototype · VR / passthrough · No account required</footer>`;
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
      step = -1;
      draw();
    },
    0.42,
  );
  button("Restart", -0.23, y, () => start(), 0.46);
  button(
    isSpatial() ? "Reset View" : "Recenter",
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
  preservePose = null;
  step = -2;
  elapsed = 0;
  noisy = false;
  prediction = "";
  draw();
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
    label(
      "About 4 minutes · Point and press the trigger",
      0,
      -0.08,
      1.9,
      0.13,
      35,
    );
    label("COMING LATER", 0, -0.38, 1.6, 0.12, 32, "#99b8c2");
    label(
      "Make It Rain   /   Scan the Hidden World",
      0,
      -0.54,
      1.9,
      0.14,
      35,
      "#99b8c2",
    );
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
    if (grab?.hands.size) return;
    const hit = intersect(c);
    hit?.object.userData.action?.();
  });
  c.addEventListener("squeezestart", () => {
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
  c.addEventListener("squeezeend", () => grab?.release(i));
  c.addEventListener("disconnected", () => grab?.release(i));
  controllers.push({ c, grip, beam, handle, id: i });
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
    step = -1;
    elapsed = 0;
    session.addEventListener("visibilitychange", () => {
      if (session.visibilityState !== "visible") grab?.cancel();
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
    const poses = new Map();
    for (const { grip, id } of controllers)
      if (grip.visible) {
        grip.updateWorldMatrix(true, false);
        poses.set(id, grip.matrixWorld);
      }
    if (renderer.xr.getSession().visibilityState === "visible")
      grab?.update(poses);
    else grab?.cancel();
    for (const b of buttons) b.material.color.set(0xffffff);
    for (const { c, beam, handle, id } of controllers) {
      const hit = intersect(c);
      const model = modelHit(c);
      beam.visible = !grab?.hands.has(id);
      beam.scale.z = hit ? hit.distance : model ? model.distance : 4;
      handle.material.color.set(
        grab?.hands.has(id) ? 0xffca83 : model ? 0xffffff : 0xa6f5d9,
      );
      if (hit) hit.object.material.color.set(0xffda8b);
    }
  }
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
  draw();
  place();
  renderer.domElement.addEventListener("pointerdown", (e) => {
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        (-e.clientY / innerHeight) * 2 + 1,
      ),
      camera,
    );
    raycaster.intersectObjects(buttons, false)[0]?.object.userData.action?.();
  });
}
