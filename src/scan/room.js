import * as THREE from "three";
import { ModelGrab } from "../manipulation.js";

// A modest horizontal fan widens each sweep without inventing surface points.
// Extra WebXR sources are optional: the center ray remains usable on its own.
const FAN_OFFSETS = [-0.075, 0.075];

// Only platform-provided surface positions enter this cloud; no synthetic fallback.
export class RoomScan {
  constructor(scene, onChange, session, mode) {
    this.room = true;
    this.onChange = onChange;
    this.session = session;
    this.stage = 0;
    this.elapsed = 0;
    this.records = [];
    this.keys = new Set();
    this.uploadedCount = 0;
    this.capacity = 18000;
    this.sources = new Map();
    this.dead = false;
    this.frozen = false;
    this.colorMode = "height";
    this.center = new THREE.Vector3();
    this.lastCamera = null;
    this.noticeTime = 0;
    this.status =
      mode === "immersive-ar" &&
      typeof session?.requestHitTestSource === "function"
        ? "ready"
        : "unavailable";
    this.message =
      this.status === "ready"
        ? "Ready to sample room surfaces."
        : mode !== "immersive-ar"
          ? "Exit XR, then choose Enter mixed reality.\nRoom scanning needs an AR session."
          : "This browser does not expose surface hit testing.\nUpdate Quest Browser or use the synthetic scene.";
    this.group = new THREE.Group();
    scene.add(this.group);
    this.grab = new ModelGrab(this.group, 0.03, 1);
    const geo = new THREE.BufferGeometry();
    for (const name of ["position", "color"])
      geo.setAttribute(
        name,
        new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3),
      );
    geo.setDrawRange(0, 0);
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ vertexColors: true, size: 0.012 }),
    );
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.pick = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.group.add(this.pick);
    this.reticles = [0, 1].map(() => [0, ...FAN_OFFSETS].map(() => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xa6f5d9 }),
      );
      m.visible = false;
      scene.add(m);
      return m;
    }));
  }
  explore() {
    if (this.status === "unavailable") return;
    this.stage = 1;
    this.onChange();
  }
  async ensureSource(input) {
    if (!input || this.sources.has(input) || this.dead) return;
    const entry = { sources: [null, ...FAN_OFFSETS.map(() => null)], error: false };
    this.sources.set(input, entry);
    try {
      // Default WebXR surface hit type; the runtime controls sensing/reconstruction.
      const source = await this.session.requestHitTestSource({
        space: input.targetRaySpace,
      });
      if (this.dead || this.sources.get(input) !== entry) {
        try {
          source.cancel();
        } catch {}
        return;
      }
      entry.sources[0] = source;
      this.status = "waiting";
      this.message =
        "Aim at nearby walls, floor, or furniture to collect points.";
      this.onChange();
      if (typeof globalThis.XRRay !== "function") return;
      await Promise.all(FAN_OFFSETS.map(async (offset, index) => {
        try {
          const offsetRay = new globalThis.XRRay(
            { x: 0, y: 0, z: 0 },
            { x: offset, y: 0, z: -1 },
          );
          const side = await this.session.requestHitTestSource({
            space: input.targetRaySpace,
            offsetRay,
          });
          if (this.dead || entry.error || this.sources.get(input) !== entry)
            side.cancel();
          else entry.sources[index + 1] = side;
        } catch {
          // A runtime may limit hit-test sources or offset rays. Keep the center.
        }
      }));
    } catch (error) {
      if (this.dead) return;
      entry.error = true;
      this.status = "error";
      this.message = `Surface access failed (${error.name || "error"}). Check Browser permissions, then retry.`;
      this.onChange();
    }
  }
  releaseInput(input) {
    const entry = this.sources.get(input);
    for (const source of entry?.sources ?? [])
      try {
        source?.cancel();
      } catch {}
    this.sources.delete(input);
  }
  cancelSources() {
    for (const input of [...this.sources.keys()]) this.releaseInput(input);
    for (const row of this.reticles)
      for (const m of row) m.visible = false;
  }
  retry() {
    this.cancelSources();
    this.status = "ready";
    this.message = "Retrying surface access. Point a controller at the room.";
    this.onChange();
  }
  record(position, origin) {
    if (this.stage !== 1 || this.frozen || this.records.length >= this.capacity)
      return false;
    const p = new THREE.Vector3(position.x, position.y, position.z);
    if (![p.x, p.y, p.z].every(Number.isFinite)) return false;
    const distance = p.distanceTo(origin);
    if (!Number.isFinite(distance) || distance < 0.2 || distance > 8)
      return false;
    const key = [p.x, p.y, p.z].map((v) => Math.round(v / 0.015)).join(":");
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.records.push({ p, distance });
    return true;
  }
  updateFrame(frame, referenceSpace, controllers, dt, camera, isOverUI) {
    this.lastCamera = camera;
    if (this.stage !== 1 || this.frozen || this.status === "unavailable")
      return;
    const current = new Set(
      controllers.map(({ c }) => c.userData.xrInput).filter(Boolean),
    );
    for (const input of this.sources.keys())
      if (!current.has(input)) this.releaseInput(input);
    let changed = false,
      hasHit = false;
    for (const { c, id } of controllers) {
      const reticles = this.reticles[id];
      for (const reticle of reticles) reticle.visible = false;
      if (!c.visible || isOverUI(c)) {
        if (!c.visible) c.userData.scanning = false;
        continue;
      }
      const input = c.userData.xrInput;
      if (!input) continue;
      void this.ensureSource(input);
      const entry = this.sources.get(input);
      if (!entry) continue;
      const origin = c.getWorldPosition(new THREE.Vector3());
      for (const [beam, source] of entry.sources.entries()) {
        if (!source) continue;
        try {
          const result = frame.getHitTestResults(source)[0];
          const pose = result?.getPose(referenceSpace);
          if (!pose) continue;
          const p = pose.transform.position;
          if (![p.x, p.y, p.z].every(Number.isFinite)) continue;
          const range = origin.distanceTo(new THREE.Vector3(p.x, p.y, p.z));
          if (range < 0.2 || range > 8) continue;
          reticles[beam].position.set(p.x, p.y, p.z);
          reticles[beam].visible = true;
          hasHit = true;
          if (c.userData.scanning) changed = this.record(p, origin) || changed;
        } catch {
          try {
            source.cancel();
          } catch {}
          entry.sources[beam] = null;
          if (beam !== 0) continue;
          entry.error = true;
          for (const side of entry.sources)
            try {
              side?.cancel();
            } catch {}
          entry.sources.fill(null);
          this.status = "error";
          this.message =
            "Surface tracking stopped. Release the trigger and choose Retry.";
          this.onChange();
          break;
        }
      }
    }
    if (changed) this.refreshPoints();
    this.noticeTime += dt;
    if (this.noticeTime >= 1) {
      this.noticeTime = 0;
      if (this.status === "error") return;
      if (hasHit) {
        this.status = "receiving";
        const wide = [...this.sources.values()].some((entry) =>
          entry.sources.slice(1).some(Boolean));
        this.message =
          this.records.length >= this.capacity
            ? "Point limit reached. Freeze or clear the scan."
            : wide
              ? "Real surface detected. Hold trigger and sweep the short ray fan."
              : "Real surface detected. Hold trigger and sweep slowly.";
      } else if (this.status !== "error") {
        this.status = "waiting";
        this.message =
          "Aim at a nearby wall or floor; check room permissions if points do not appear.";
      }
      this.onChange();
    }
  }
  refreshPoints(full = false) {
    const geo = this.points.geometry;
    if (full) this.uploadedCount = 0;
    const color = new THREE.Color();
    for (let i = this.uploadedCount; i < this.records.length; i++) {
      const { p, distance } = this.records[i];
      const local = this.frozen ? p.clone().sub(this.center) : p;
      geo.attributes.position.setXYZ(i, local.x, local.y, local.z);
      const value = this.colorMode === "height" ? (p.y + 1) / 3 : distance / 8;
      color.setHSL(
        0.65 - THREE.MathUtils.clamp(value, 0, 1) * 0.55,
        0.85,
        0.65,
      );
      geo.attributes.color.setXYZ(i, color.r, color.g, color.b);
    }
    this.uploadedCount = this.records.length;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, this.records.length);
  }
  toggleColor() {
    this.colorMode = this.colorMode === "height" ? "range" : "height";
    this.refreshPoints(true);
    this.onChange();
  }
  freeze(camera = this.lastCamera) {
    if (!this.records.length) return;
    this.frozen = true;
    this.grab.cancel();
    this.cancelSources();
    const box = new THREE.Box3().setFromPoints(this.records.map((r) => r.p));
    box.getCenter(this.center);
    const size = box.getSize(new THREE.Vector3());
    this.defaultScale = THREE.MathUtils.clamp(
      1 / Math.max(size.x, size.y, size.z, 0.1),
      0.03,
      0.75,
    );
    this.pick.scale.set(
      Math.max(size.x, 0.1),
      Math.max(size.y, 0.1),
      Math.max(size.z, 0.1),
    );
    this.refreshPoints(true);
    if (camera) this.place(camera);
    this.onChange();
  }
  resume() {
    this.frozen = false;
    this.grab.cancel();
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.refreshPoints(true);
    this.status = "ready";
    this.message = "Resuming live sampling.";
    this.onChange();
  }
  place(camera) {
    this.lastCamera = camera;
    this.grab.cancel();
    if (!this.frozen) return;
    const pos = new THREE.Vector3(),
      dir = new THREE.Vector3();
    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
    dir.normalize();
    this.group.position.copy(pos).addScaledVector(dir, 1.4);
    this.group.position.y -= 0.1;
    this.group.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    this.group.scale.setScalar(this.defaultScale);
  }
  hit(ray) {
    if (!this.frozen) return null;
    this.group.updateWorldMatrix(true, true);
    return ray.intersectObject(this.pick, false)[0];
  }
  clearScan() {
    this.cancelSources();
    this.records = [];
    this.keys.clear();
    this.resume();
  }
  finish() {
    this.stage = 2;
    this.cancelSources();
    if (this.records.length) this.freeze();
    this.grab.cancel();
    this.onChange();
  }
  update(dt) {
    if (this.stage < 2) {
      this.elapsed += dt;
      if (this.elapsed >= 240) this.finish();
    }
  }
  dispose() {
    this.dead = true;
    this.cancelSources();
    this.grab.cancel();
    this.group.removeFromParent();
    for (const row of this.reticles)
      for (const m of row) {
        m.removeFromParent();
        m.geometry.dispose();
        m.material.dispose();
      }
    this.group.traverse((n) => {
      n.geometry?.dispose();
      n.material?.dispose();
    });
  }
}
