// Small, bold canvas drawings stay legible after the menu cards are reduced in VR.
// Coordinates are centered on the 135 px icon rail of a 720 × 360 card.
export function drawMenuIcon(ctx, icon, color) {
  ctx.save();
  ctx.translate(90, 176);
  ctx.scale(1.12, 1.12);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = (points, close = false) => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    if (close) ctx.closePath();
    ctx.stroke();
  };
  const circle = (x, y, radius, fill = false) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) ctx.fill();
    else ctx.stroke();
  };
  const fillPath = (points, alpha = 0.2) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  switch (icon) {
    case "ranges": { // Three distance circles share one possible position.
      ctx.save();
      ctx.globalAlpha = 0.73;
      circle(-20, -14, 33);
      circle(20, -14, 33);
      circle(0, 19, 33);
      ctx.restore();
      ctx.fillStyle = "#f1fbf6";
      circle(0, 0, 7, true);
      break;
    }
    case "watershed": {
      ctx.beginPath();
      ctx.moveTo(-37, -17);
      ctx.bezierCurveTo(-45, -31, -31, -43, -17, -39);
      ctx.bezierCurveTo(-8, -55, 14, -52, 20, -37);
      ctx.bezierCurveTo(39, -39, 47, -22, 37, -12);
      ctx.closePath();
      ctx.stroke();
      for (const x of [-22, 0, 22]) path([[x, -5], [x - 6, 8]]);
      path([[-44, 39], [-17, 17], [0, 35], [18, 18], [44, 40]]);
      path([[-35, 46], [0, 37], [35, 46]]);
      break;
    }
    case "point-cloud": {
      const rows = [
        [-29, [-30, -18, -6, 6, 18]],
        [-17, [-30, -18, -6, 6, 18, 30]],
        [-5, [-30, -18, 6, 18, 30]],
        [7, [-30, -18, 6, 18, 30]],
        [19, [-30, -18, -6, 6, 18, 30]],
        [31, [-30, -18, -6, 6, 18, 30]],
      ];
      for (const [y, xs] of rows)
        for (const x of xs) circle(x, y, 3.1, true);
      for (const [x, y] of [[-44, -4], [43, -20], [40, 34], [-41, 27]])
        circle(x, y, 2.4, true);
      break;
    }
    case "layers": {
      for (const [y, opacity] of [[-27, 0.14], [-3, 0.21], [21, 0.28]]) {
        const sheet = [[0, y - 17], [43, y - 2], [0, y + 13], [-43, y - 2]];
        fillPath(sheet, opacity);
        path(sheet, true);
      }
      break;
    }
    case "viewshed": {
      fillPath([[-29, -25], [45, -8], [45, 20]], 0.22);
      path([[-29, -25], [45, -8]]);
      path([[-29, -25], [45, 20]]);
      path([[-46, 43], [-24, 18], [-4, 35], [16, 6], [44, 30]]);
      path([[-39, 34], [-29, -25], [-19, 29]]);
      path([[-38, 6], [-20, 6]]);
      circle(-29, -25, 4, true);
      break;
    }
    case "spectral-leaf": {
      const leaf = () => {
        ctx.beginPath();
        ctx.moveTo(-37, 38);
        ctx.bezierCurveTo(-34, -8, 2, -43, 40, -39);
        ctx.bezierCurveTo(45, 3, 15, 31, -37, 38);
        ctx.closePath();
      };
      ctx.save();
      leaf();
      ctx.clip();
      ctx.fillStyle = "#83d79c";
      ctx.fillRect(-50, -50, 50, 100);
      ctx.fillStyle = "#e798c1";
      ctx.fillRect(0, -50, 50, 100);
      ctx.restore();
      leaf();
      ctx.stroke();
      path([[-37, 38], [-10, 6], [15, -19], [39, -39]]);
      break;
    }
    case "pixels": {
      ctx.lineWidth = 4;
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 2; col++)
          ctx.strokeRect(-46 + col * 25, -26 + row * 25, 25, 25);
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++)
          ctx.strokeRect(13 + col * 12, -25 + row * 12, 12, 12);
      ctx.globalAlpha = 0.32;
      ctx.fillRect(-45, -25, 24, 24);
      ctx.fillRect(37, -1, 11, 11);
      break;
    }
    case "cluster": {
      ctx.save();
      ctx.globalAlpha = 0.76;
      path([[-32, -43], [-21, -8], [-33, 43]]);
      path([[18, -43], [5, -9], [28, 43]]);
      ctx.restore();
      for (const [x, y] of [[-25, -4], [-17, 16], [-8, 2], [-7, 24],
        [4, -19], [12, -4], [22, 10], [31, -23], [15, 25]])
        circle(x, y, 3.8, true);
      break;
    }
    case "flatten": {
      circle(-24, 0, 23);
      ctx.beginPath();
      ctx.ellipse(-24, 0, 9, 23, 0, 0, Math.PI * 2);
      ctx.stroke();
      path([[-46, 0], [-2, 0]]);
      path([[1, 0], [13, 0], [8, -6]]);
      path([[13, 0], [8, 6]]);
      ctx.strokeRect(19, -24, 29, 48);
      path([[33.5, -24], [33.5, 24]]);
      path([[19, 0], [48, 0]]);
      break;
    }
    case "change": {
      ctx.strokeRect(-46, -36, 92, 72);
      path([[0, -36], [0, 36]]);
      path([[-44, 17], [-23, -7], [-4, 13]]);
      path([[3, 13], [22, 1], [44, 17]]);
      path([[-44, 27], [-19, 27]]);
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = "#79c7e5";
      ctx.fillRect(3, 17, 41, 17);
      ctx.restore();
      path([[3, 17], [44, 17]]);
      circle(-31, -22, 4, true);
      circle(31, -22, 4, true);
      break;
    }
    case "contours": {
      for (const [x, top] of [[-32, -21], [0, -40], [31, -14]]) {
        path([[x, top + 5], [x, 34]]);
        circle(x, top, 6, true);
      }
      for (const y of [2, 18, 34]) {
        ctx.beginPath();
        ctx.moveTo(-46, y);
        ctx.bezierCurveTo(-21, y + 16, 10, y - 17, 46, y);
        ctx.stroke();
      }
      break;
    }
    case "slice": {
      fillPath([[-35, -30], [28, -30], [0, 2], [-35, 25]], 0.28);
      fillPath([[34, -23], [34, 27], [-15, 27], [9, 5]], 0.28);
      path([[-35, -30], [28, -30], [0, 2], [-35, 25], [-35, -30]]);
      path([[34, -23], [34, 27], [-15, 27], [9, 5]]);
      ctx.strokeStyle = "#f1fbf6";
      ctx.lineWidth = 6;
      path([[-43, 43], [38, -43]]);
      break;
    }
    default:
      circle(0, 0, 30);
  }
  ctx.restore();
}
