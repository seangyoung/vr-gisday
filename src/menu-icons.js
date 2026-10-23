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
      // A lookout platform and its single dashed line of sight.
      path([[-45, 38], [-14, 34], [9, 39], [29, 22], [46, 28]]);
      path([[-42, -28], [-6, -28]]);
      path([[-39, -41], [-39, -29]]);
      path([[-9, -41], [-9, -29]]);
      path([[-38, -41], [-10, -41]]);
      path([[-38, -26], [-42, 32]]);
      path([[-10, -26], [-14, 32]]);
      path([[-37, -9], [-12, -9]]);
      path([[-39, 10], [-13, 10]]);
      circle(-16, -34, 4, true);
      ctx.save();
      ctx.setLineDash([2, 8]);
      ctx.lineWidth = 4;
      path([[-12, -33], [37, -7]]);
      ctx.restore();
      circle(38, -6, 5);
      break;
    }
    case "spectral-leaf": {
      const leaf = () => {
        ctx.beginPath();
        ctx.moveTo(-35, 39);
        ctx.bezierCurveTo(-34, -9, 1, -35, 38, -22);
        ctx.bezierCurveTo(39, 13, 13, 39, -35, 39);
        ctx.closePath();
      };
      ctx.save();
      ctx.globalAlpha = 0.25;
      leaf();
      ctx.fill();
      ctx.restore();
      leaf();
      ctx.stroke();
      path([[-35, 39], [-13, 12], [10, -7], [37, -21]]);
      ctx.save();
      ctx.strokeStyle = "#e9f4c1";
      ctx.lineWidth = 4.5;
      path([[-46, -44], [-10, -16]]);
      path([[-10, -16], [20, -47]]);
      path([[-18, -17], [-10, -16], [-11, -24]]);
      path([[11, -44], [20, -47], [17, -38]]);
      ctx.restore();
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
      // Bold street hand-pump silhouette stays readable on a small VR card.
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.moveTo(-20, 34);
      ctx.lineTo(-17, -16);
      ctx.quadraticCurveTo(-17, -29, -5, -31);
      ctx.quadraticCurveTo(7, -29, 8, -16);
      ctx.lineTo(11, 34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      path([[-20, 34], [-17, -16]]);
      path([[8, -16], [11, 34]]);
      path([[-27, 41], [18, 41], [12, 33], [-21, 33]], true);
      ctx.save();
      ctx.lineWidth = 7;
      path([[-5, -29], [-38, -42]]);
      ctx.restore();
      circle(-41, -43, 5, true);
      circle(-5, -30, 4, true);
      ctx.save();
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.bezierCurveTo(21, -9, 34, -9, 34, 7);
      ctx.lineTo(34, 12);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#a6e3f1";
      path([[34, 19], [29, 29], [34, 34], [39, 29], [34, 19]], true);
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
      path([[-44, 41], [44, 41]]);
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 4;
      for (const [x, top] of [[-32, -13], [0, -32], [32, -38]])
        path([[x, top + 6], [x, 39]]);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(-46, -8);
      ctx.bezierCurveTo(-29, -15, -13, -31, 0, -32);
      ctx.bezierCurveTo(16, -34, 25, -39, 46, -35);
      ctx.stroke();
      for (const [x, y] of [[-32, -13], [0, -32], [32, -38]])
        circle(x, y, 5.5, true);
      break;
    }
    case "slice": {
      fillPath([[-30, -23], [23, -23], [23, 35], [-30, 35]], 0.24);
      fillPath([[23, -23], [40, -39], [40, 19], [23, 35]], 0.38);
      path([[-30, -23], [23, -23], [23, 35], [-30, 35]], true);
      path([[-30, -23], [-13, -39], [40, -39], [23, -23]]);
      path([[23, -23], [40, -39], [40, 19], [23, 35]]);
      ctx.fillStyle = "#f1fbf6";
      ctx.font = "bold 43px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", -3, 7);
      break;
    }
    default:
      circle(0, 0, 30);
  }
  ctx.restore();
}
