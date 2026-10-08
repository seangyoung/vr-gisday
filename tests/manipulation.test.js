import test from "node:test";
import assert from "node:assert/strict";
import { Group, Object3D, Matrix4, Vector3, Quaternion } from "three";
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
