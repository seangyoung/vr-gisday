import test from "node:test";
import assert from "node:assert/strict";
import { fitWrappedText, wrapTextLines } from "../src/ui-text.js";

const ctx = {
  font: "500 40px system-ui",
  measureText(text) {
    const size = Number(this.font.match(/([\d.]+)px/)?.[1] ?? 40);
    return { width: text.length * size * 0.52 };
  },
};

test("prose reflows existing manual breaks and keeps paragraph breaks", () => {
  const lines = wrapTextLines(ctx,
    "GIS combines place data\nin layers. Different layers reveal relationships.\n\nCompare them in one place.",
    460);
  assert.deepEqual(lines, [
    "GIS combines place", "data in layers.", "Different layers", "reveal relationships.",
    "", "Compare them in one", "place.",
  ]);
  assert.deepEqual(wrapTextLines(ctx, "Left: walk\nRight: turn", 460, true),
    ["Left: walk", "Right: turn"]);
});

test("fitted prose wraps to the available width and height without squeezing lines", () => {
  const layout = fitWrappedText(ctx,
    "GIS overlays datasets at shared locations to reveal relationships. " +
    "Each layer describes a feature or attribute of the real world. " +
    "Together the layers help us examine spatial patterns.",
    { maxWidth: 470, maxHeight: 155, fontSize: 43, minFontSize: 18 });
  assert.ok(layout.size < 43);
  assert.ok(layout.lines.length > 3);
  assert.ok(layout.lines.length * layout.spacing <= 155);
  assert.ok(layout.lines.every((line) => ctx.measureText(line).width <= 470));
});
