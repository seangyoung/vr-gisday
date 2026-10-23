import test from "node:test";
import assert from "node:assert/strict";
import { Group, Object3D, Matrix4, Vector3, Quaternion, PerspectiveCamera } from "three";
import { ModelGrab } from "../src/manipulation.js";
const pose = (x, y = 0, z = 0, q = new Quaternion()) =>
  new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(1, 1, 1));
const close = (a, b) =>
  assert.ok(a.distanceTo(b) < 1e-8, `${a.toArray()} != ${b.toArray()}`);
function assembly() {
  const o = new Group();
  o.scale.setScalar(0.46);
  for (const x of [-0.5, 0.2, 0.65]) {
    const c = new Object3D();
    c.position.set(x, 0.3, -0.2);
    o.add(c);
  }
  return o;
}
test("one grip transforms every child together and preserves pairwise distances", () => {
  const o = assembly(),
    g = new ModelGrab(o);
  const before = o.children.map((c) => c.getWorldPosition(new Vector3()));
  g.begin(0, pose(0));
  const turn = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    Math.PI / 2,
  );
  g.update(new Map([[0, pose(1, 0.2, 0.3, turn)]]));
  const after = o.children.map((c) => c.getWorldPosition(new Vector3()));
  for (let i = 0; i < 3; i++)
    close(
      after[i],
      before[i]
        .clone()
        .applyQuaternion(turn)
        .add(new Vector3(1, 0.2, 0.3)),
    );
  assert.ok(
    Math.abs(after[0].distanceTo(after[1]) - before[0].distanceTo(before[1])) <
      1e-8,
  );
});
test("two grips scale uniformly within bounds and rotate the assembly", () => {
  const o = assembly(),
    g = new ModelGrab(o);
  g.begin(0, pose(-0.2));
  g.begin(1, pose(0.2));
  g.update(
    new Map([
      [0, pose(0, -0.4)],
      [1, pose(0, 0.4)],
    ]),
  );
  assert.equal(o.scale.x, 0.85);
  assert.equal(o.scale.y, o.scale.x);
  close(
    new Vector3(1, 0, 0).applyQuaternion(o.quaternion),
    new Vector3(0, 1, 0),
  );
  g.update(
    new Map([
      [0, pose(-0.04)],
      [1, pose(0.04)],
    ]),
  );
  assert.equal(o.scale.x, 0.28);
});
test("adding and releasing a second grip does not jump the object", () => {
  const o = assembly(),
    g = new ModelGrab(o);
  g.begin(0, pose(-0.2));
  g.update(new Map([[0, pose(-0.1)]]));
  g.begin(1, pose(0.3));
  const before = o.position.clone();
  g.update(
    new Map([
      [0, pose(-0.1)],
      [1, pose(0.3)],
    ]),
  );
  close(o.position, before);
  g.release(1);
  g.update(new Map([[0, pose(-0.1)]]));
  close(o.position, before);
});
test("tracking loss and cancellation release all grips without changing the pose", () => {
  const o = assembly(),
    g = new ModelGrab(o);
  g.begin(0, pose(0));
  g.update(new Map([[0, pose(0.1)]]));
  const before = o.position.clone();
  g.update(new Map());
  assert.equal(g.hands.size, 0);
  close(o.position, before);
  g.begin(0, pose(0));
  g.cancel();
  g.update(new Map([[0, pose(100)]]));
  close(o.position, before);
});
test("coincident hands cannot generate invalid scales; separating rebases cleanly", () => {
  const o = assembly(),
    g = new ModelGrab(o);
  g.begin(0, pose(0));
  g.begin(1, pose(0));
  g.update(
    new Map([
      [0, pose(0)],
      [1, pose(0)],
    ]),
  );
  assert.equal(o.scale.x, 0.46);
  g.update(
    new Map([
      [0, pose(-0.2)],
      [1, pose(0.2)],
    ]),
  );
  assert.equal(o.scale.x, 0.46);
  g.update(
    new Map([
      [0, pose(-0.25)],
      [1, pose(0.25)],
    ]),
  );
  assert.ok(Number.isFinite(o.scale.x));
});

test("a held tabletop model snap-turns around its center once per stick deflection", () => {
  const object = assembly();
  object.position.set(0.3, 1.2, -1.5);
  object.rotation.set(0.35, 0.2, 0);
  const grab = new ModelGrab(object);
  grab.turnPivot.set(0, 0.3, 0);
  const camera = new PerspectiveCamera();
  const hand = pose(0.1, 1.1, -0.9);
  const center = object.localToWorld(grab.turnPivot.clone());
  assert.equal(grab.turnWithStick(0, 1, 0, camera), false);
  grab.begin(0, hand);
  assert.equal(grab.turnWithStick(0, 1, 0, camera), true);
  close(object.localToWorld(grab.turnPivot.clone()), center);
  const turned = object.quaternion.clone();
  assert.equal(grab.turnWithStick(0, 1, 0, camera), false);
  grab.update(new Map([[0, hand]]));
  assert.ok(object.quaternion.angleTo(turned) < 1e-7);
  grab.turnWithStick(0, 0, 0, camera);
  assert.equal(grab.turnWithStick(0, 0, -1, camera), true);
  close(object.localToWorld(grab.turnPivot.clone()), center);
  grab.release(0);
  assert.equal(grab.turnWithStick(0, 1, 0, camera), false);
});

function releaseAfterTurn(speed) {
  const object = assembly();
  object.position.set(0.2, 1.3, -1.4);
  const grab = new ModelGrab(object);
  grab.turnPivot.set(0, 0.3, 0);
  grab.begin(0, pose(0, 0, 0));
  for (let frame = 1; frame <= 6; frame++) {
    const turn = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0), speed * frame * 0.02);
    grab.update(new Map([[0, pose(0, 0, 0, turn)]]), 0.02);
  }
  const heldAngle = object.rotation.y;
  const center = object.localToWorld(grab.turnPivot.clone());
  grab.release(0);
  for (let frame = 0; frame < 40; frame++) grab.update(new Map(), 0.02);
  close(object.localToWorld(grab.turnPivot.clone()), center);
  return { coast: object.rotation.y - heldAngle, grab, object };
}

test("a faster hand turn coasts farther in the same direction, then stops", () => {
  const slow = releaseAfterTurn(1.1);
  const fast = releaseAfterTurn(3.3);
  const reverse = releaseAfterTurn(-3.3);
  assert.ok(slow.coast > 0.05);
  assert.ok(fast.coast > slow.coast * 2);
  assert.ok(reverse.coast < -0.1);
  assert.ok(fast.coast < 0.8, "a strong flick remains a short coast");
  const settled = fast.object.quaternion.clone();
  fast.grab.update(new Map(), 1);
  assert.ok(fast.object.quaternion.angleTo(settled) < 0.01);
});

test("a gentle release, lost tracking, or a snap-turn adds no momentum", () => {
  const gentle = releaseAfterTurn(0.2);
  assert.ok(Math.abs(gentle.coast) < 1e-8);

  const object = assembly();
  const grab = new ModelGrab(object);
  const camera = new PerspectiveCamera();
  grab.begin(0, pose(0));
  grab.update(new Map([[0, pose(0, 0, 0,
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.1))]]), 0.02);
  assert.equal(grab.turnWithStick(0, 1, 0, camera), true);
  const snapped = object.quaternion.clone();
  grab.release(0);
  grab.update(new Map(), 0.2);
  assert.ok(object.quaternion.angleTo(snapped) < 1e-8);

  grab.begin(0, pose(0));
  grab.update(new Map([[0, pose(0, 0, 0,
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.1))]]), 0.02);
  const beforeLoss = object.quaternion.clone();
  grab.update(new Map(), 0.02);
  grab.update(new Map(), 0.2);
  assert.ok(object.quaternion.angleTo(beforeLoss) < 1e-8);
});

test("a two-handed turn keeps its momentum when both grips release together", () => {
  const object = assembly();
  const grab = new ModelGrab(object);
  grab.begin(0, pose(-0.2));
  grab.begin(1, pose(0.2));
  for (let frame = 1; frame <= 6; frame++) {
    const angle = frame * 0.07;
    const x = 0.2 * Math.cos(angle);
    const z = 0.2 * Math.sin(angle);
    grab.update(new Map([
      [0, pose(-x, 0, z)], [1, pose(x, 0, -z)],
    ]), 0.02);
  }
  const held = object.quaternion.clone();
  grab.release(0);
  grab.release(1);
  grab.update(new Map(), 0.08);
  assert.ok(object.quaternion.angleTo(held) > 0.1);
});
