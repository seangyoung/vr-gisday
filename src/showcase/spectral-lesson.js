export const SPECTRAL_LESSON_STEPS = [
  {
    id: "prism",
    title: "One beam, many wavelengths",
    copy: "Sunlight contains visible colors and near infrared (NIR).\nMagenta represents invisible NIR here; a sensor can record it.",
    next: "See a healthy leaf",
  },
  {
    id: "healthy",
    title: "A healthy leaf",
    copy: "A healthy leaf absorbs much blue and red light and reflects green.\nIt also reflects strongly in near infrared, which our eyes cannot see.",
    next: "Compare a stressed leaf",
  },
  {
    id: "stressed",
    title: "A stressed leaf",
    copy: "Stressed vegetation often reflects less NIR and more red.\nA sensor can detect that shift before it is obvious to our eyes.",
    next: "Build an NDVI value",
  },
  {
    id: "ndvi",
    title: "Compare two bands with NDVI",
    copy: "NDVI compares reflected near infrared with red light.\nHigher values often indicate denser, greener vegetation.",
    next: "View Landsat scenes",
  },
];

export function nextSpectralLessonStep(step) {
  return step + 1 < SPECTRAL_LESSON_STEPS.length ? step + 1 : null;
}

const COLORS = {
  blue: "#62a7ee",
  green: "#70d58c",
  red: "#f37d73",
  nir: "#ec9edb",
  white: "#f2f8ef",
  muted: "#a9c8cf",
};

function line(ctx, x1, y1, x2, y2, color, width = 8, alpha = 1, dash = []) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function pulse(ctx, x1, y1, x2, y2, time, color, radius = 10, alpha = 1) {
  const t = ((time % 2.3) + 2.3) % 2.3 / 2.3;
  const x = x1 + (x2 - x1) * t;
  const y = y1 + (y2 - y1) * t;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function text(ctx, value, x, y, size = 28, color = COLORS.white, align = "center") {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function drawPrism(ctx, time) {
  text(ctx, "SUNLIGHT", 132, 200, 28, COLORS.white);
  line(ctx, 74, 257, 452, 257, COLORS.white, 11, 0.9);
  pulse(ctx, 74, 257, 452, 257, time, COLORS.white, 12);
  ctx.save();
  ctx.fillStyle = "rgba(154, 229, 223, 0.20)";
  ctx.strokeStyle = "#bcece5";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(455, 370);
  ctx.lineTo(533, 134);
  ctx.lineTo(651, 370);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  text(ctx, "PRISM", 544, 408, 27, COLORS.muted);
  const rays = [
    { name: "Blue", y: 116, color: COLORS.blue },
    { name: "Green", y: 202, color: COLORS.green },
    { name: "Red", y: 289, color: COLORS.red },
    { name: "NIR*", y: 376, color: COLORS.nir },
  ];
  rays.forEach((ray, index) => {
    line(ctx, 610, 258, 946, ray.y, ray.color, 8, 0.85,
      index === 3 ? [17, 11] : []);
    pulse(ctx, 610, 258, 946, ray.y, time - index * 0.19,
      ray.color, 10);
    text(ctx, ray.name, 967, ray.y + 10, 28, ray.color, "left");
  });
  text(ctx, "*Near infrared is invisible; magenta makes its path visible in this model.",
    550, 481, 24, COLORS.muted);
}

function leaf(ctx, stressed) {
  ctx.save();
  ctx.fillStyle = stressed ? "#82945a" : "#69b96b";
  ctx.strokeStyle = stressed ? "#b9b471" : "#c6ecb2";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(445, 286);
  ctx.bezierCurveTo(506, 150, 703, 112, 786, 259);
  ctx.bezierCurveTo(706, 394, 515, 388, 445, 286);
  ctx.fill();
  ctx.stroke();
  line(ctx, 458, 287, 778, 258, stressed ? "#d7c780" : "#d3edb6", 4, 0.8);
  for (const side of [-1, 1])
    for (const x of [555, 630, 699]) {
      const y = 278 - (x - 458) * 0.09;
      line(ctx, x, y, x + 39, y + side * 48,
        stressed ? "#d7c780" : "#d3edb6", 2, 0.55);
    }
  ctx.restore();
}

function drawLeaf(ctx, time, stressed) {
  text(ctx, "SUNLIGHT", 172, 197, 28, COLORS.white);
  line(ctx, 100, 260, 493, 260, COLORS.white, 11, 0.9);
  pulse(ctx, 100, 260, 493, 260, time, COLORS.white, 11);
  leaf(ctx, stressed);
  // Blue and red enter the leaf. Their fading pulses depict absorption.
  line(ctx, 484, 253, 593, 239, COLORS.blue, 7, 0.52);
  line(ctx, 484, 268, 606, 278, COLORS.red, 7, stressed ? 0.42 : 0.72);
  pulse(ctx, 484, 253, 593, 239, time - 0.45, COLORS.blue, 8, 0.52);
  pulse(ctx, 484, 268, 606, 278, time - 0.62, COLORS.red, 8,
    stressed ? 0.42 : 0.72);
  text(ctx, stressed ? "Blue partly absorbed" : "Red + blue absorbed",
    561, 428, 27, COLORS.muted);
  line(ctx, 661, 223, 938, 125, COLORS.green, stressed ? 6 : 9,
    stressed ? 0.60 : 0.96);
  pulse(ctx, 661, 223, 938, 125, time - 0.7, COLORS.green,
    stressed ? 8 : 11, stressed ? 0.65 : 1);
  text(ctx, "GREEN REFLECTED", 817, 92, 25, COLORS.green);
  if (stressed) {
    line(ctx, 666, 300, 772, 357, COLORS.nir, 6, 0.44, [14, 9]);
    pulse(ctx, 666, 300, 772, 357, time - 0.9, COLORS.nir, 7, 0.4);
    text(ctx, "LESS NIR RETURNS", 889, 383, 27, COLORS.nir);
    line(ctx, 659, 265, 934, 261, COLORS.red, 5, 0.65);
    text(ctx, "MORE RED", 908, 242, 24, COLORS.red);
  } else {
    line(ctx, 667, 300, 946, 379, COLORS.nir, 11, 0.9, [23, 12]);
    pulse(ctx, 667, 300, 946, 379, time - 0.9, COLORS.nir, 12);
    text(ctx, "STRONG NIR REFLECTION", 871, 418, 27, COLORS.nir);
  }
  text(ctx, "Magenta shows invisible near infrared.", 550, 486, 23, COLORS.muted);
}

function valueBars(ctx, x, title, red, nir, ndvi, time, stressed) {
  text(ctx, title, x + 185, 142, 34,
    stressed ? "#dbd7a1" : "#b7ecc0");
  ctx.fillStyle = stressed ? "#82945a" : "#69b96b";
  ctx.beginPath();
  ctx.ellipse(x + 185, 195, 51, 23, -0.25, 0, Math.PI * 2);
  ctx.fill();
  const grow = Math.min(1, Math.max(0, (time - 0.25) / 0.9));
  text(ctx, `Red ${red.toFixed(2)}`, x + 23, 269, 28, COLORS.red, "left");
  ctx.fillStyle = "#264650";
  ctx.fillRect(x + 164, 243, 183, 27);
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(x + 164, 243, 183 * red * grow, 27);
  text(ctx, `NIR ${nir.toFixed(2)}`, x + 23, 325, 28, COLORS.nir, "left");
  ctx.fillStyle = "#264650";
  ctx.fillRect(x + 164, 299, 183, 27);
  ctx.fillStyle = COLORS.nir;
  ctx.fillRect(x + 164, 299, 183 * nir * grow, 27);
  text(ctx, `(${nir.toFixed(2)} − ${red.toFixed(2)}) ÷ (${nir.toFixed(2)} + ${red.toFixed(2)})`,
    x + 185, 376, 24, COLORS.muted);
  text(ctx, `NDVI ${ndvi.toFixed(2)}`, x + 185, 421, 35,
    stressed ? "#d9d8ac" : "#a6f5d9");
}

function drawNdvi(ctx, time) {
  text(ctx, "Example reflected light from two leaf canopies", 550, 73,
    31, COLORS.muted);
  ctx.strokeStyle = "#42656b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(550, 118);
  ctx.lineTo(550, 431);
  ctx.stroke();
  valueBars(ctx, 74, "Healthy", 0.10, 0.70, 0.75, time, false);
  valueBars(ctx, 654, "Stressed", 0.20, 0.25, 0.11, time, true);
  text(ctx, "NDVI = (NIR − red) ÷ (NIR + red)", 550, 485,
    38, COLORS.white);
}

export function drawSpectralLesson(ctx, step, time) {
  ctx.fillStyle = "#0d2a35";
  ctx.fillRect(0, 0, 1100, 530);
  ctx.strokeStyle = "#50777b";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 1094, 524);
  if (step === 0) drawPrism(ctx, time);
  else if (step === 1) drawLeaf(ctx, time, false);
  else if (step === 2) drawLeaf(ctx, time, true);
  else drawNdvi(ctx, time);
}
