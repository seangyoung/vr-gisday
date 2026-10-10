import * as THREE from "three";

// A small point-cloud illustration for each route; neither is a live scan.
export function scanThumbnail(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = kind === "room" ? "#102d38" : "#102b34";
  ctx.fillRect(0, 0, 640, 400);
  let seed = kind === "room" ? 29 : 73;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dot = (x, y, color, radius = 2) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  if (kind === "room") {
    // A furnished corner, shown as sampled surfaces rather than an empty box.
    for (let i = 0; i < 1250; i++) {
      const u = random(), v = random();
      const x = 75 + u * 495;
      const y = 248 + v * (83 + 0.14 * (x - 320));
      dot(x, y, "#6bcdd2", 1.2 + random());
    }
    for (let i = 0; i < 720; i++) {
      const x = 78 + random() * 438;
      const y = 48 + random() * 198;
      if (x > 300 && y > 145 && y < 220) continue;
      dot(x, y, "#6fabb3", 1.1 + random() * 0.7);
    }
    for (let i = 0; i < 410; i++) {
      const x = 276 + random() * 210;
      const y = 192 + random() * 53;
      dot(x, y, "#ffd29b", 1.4);
    }
    for (let i = 0; i < 150; i++) {
      const x = 302 + random() * 16;
      const y = 212 + random() * 97;
      dot(x, y, "#ffd29b", 1.3);
    }
    ctx.strokeStyle = "#a5f4d7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(82, 337);
    ctx.lineTo(268, 217);
    ctx.stroke();
    dot(268, 217, "#a5f4d7", 8);
  } else {
    for (let i = 0; i < 1800; i++) {
      const x = 48 + random() * 544;
      const depth = random();
      const y = 245 + depth * 110 + 18 * Math.sin(x / 55);
      dot(x, y, "#68cfd2", 1 + random() * 0.9);
    }
    for (let i = 0; i < 560; i++) {
      const x = 260 + random() * 155;
      const y = 125 + random() * 133;
      if (x > 345 && y < 170) continue;
      dot(x, y, "#ffd29b", 1.3 + random() * 0.6);
    }
    for (const [cx, cy, scale] of [[128, 215, 1], [480, 205, 1.18], [532, 227, 0.7]])
      for (let i = 0; i < 310; i++) {
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random());
        dot(cx + Math.cos(angle) * radius * 38 * scale,
          cy - 55 * scale + Math.sin(angle) * radius * 68 * scale,
          "#94df9e", 1.1 + random() * 0.8);
      }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.01, 0.65),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
}
