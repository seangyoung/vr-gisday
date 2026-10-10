import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/controller-profiles/", import.meta.url));
const profilesList = JSON.parse(readFileSync(`${root}/profilesList.json`, "utf8"));
const questProfiles = [
  "meta-quest-touch-plus-v2",
  "meta-quest-touch-plus",
  "oculus-touch-v3",
  "oculus-touch-v2",
];

function glbNodes(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString("utf8", 0, 4), "glTF");
  const jsonLength = buffer.readUInt32LE(12);
  const document = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
  return new Set(document.nodes.map((node) => node.name));
}

test("bundled Quest controller profiles place labels on actual button nodes", () => {
  for (const name of questProfiles) {
    assert.equal(profilesList[name].path, `${name}/profile.json`);
    const profile = JSON.parse(readFileSync(`${root}/${name}/profile.json`, "utf8"));
    for (const handedness of ["left", "right"]) {
      const asset = profile.layouts[handedness].assetPath;
      const nodes = glbNodes(`${root}/${name}/${asset}`);
      const required = [
        "xr_standard_trigger_pressed_value",
        "xr_standard_squeeze_pressed_value",
        ...(handedness === "left"
          ? ["xr_standard_thumbstick_pressed_value", "x_button_pressed_value", "y_button_pressed_value"]
          : ["a_button_pressed_value", "b_button_pressed_value"]),
      ];
      for (const node of required)
        assert.ok(nodes.has(node), `${name}/${handedness} missing ${node}`);
    }
  }
});

test("generic fallback and copied asset license are bundled", () => {
  const name = "generic-trigger";
  assert.equal(profilesList[name].path, `${name}/profile.json`);
  const profile = JSON.parse(readFileSync(`${root}/${name}/profile.json`, "utf8"));
  for (const handedness of ["left", "right", "none"])
    assert.ok(glbNodes(`${root}/${name}/${profile.layouts[handedness].assetPath}`).size);
  assert.match(readFileSync(`${root}/LICENSE.md`, "utf8"), /MIT License/);
});
