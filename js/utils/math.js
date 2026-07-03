export const MathUtils = {
  distance: (x1, y1, x2, y2) => {
    console.log("[Utils] Calculating distance");
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  },
  arcToCartesian: (row, col, totalRows, totalCols, curvature) => {
    console.log(`[Utils] arcToCartesian: row=${row}, col=${col}`);
    return { x: 0, y: 0 }; // 占位
  },
  calculateViewAngle: (seatX, seatY, screenCenterX, screenCenterY, screenY) => {
    console.log("[Utils] calculateViewAngle");
    return 0; // 占位
  },
  calculateScreenDistance: (seatY, screenY) => {
    console.log("[Utils] calculateScreenDistance");
    return 0; // 占位
  },
  countAdjacentEmpty: (seat, cinema) => {
    console.log("[Utils] countAdjacentEmpty");
    return 0; // 占位
  },
};
