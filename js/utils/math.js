import { AppConfig } from "./config.js";

/**
 * 缩放比例：物理距离（厘米）转像素
 * 这个值由 renderer 设置，math.js 读取使用
 */
let _pixelsPerCm = 0.35;

/**
 * 设置缩放比例（由 renderer 调用）
 */
export function setPixelsPerCm(value) {
  _pixelsPerCm = value;
}

/**
 * 获取当前缩放比例
 */
export function getPixelsPerCm() {
  return _pixelsPerCm;
}

export const MathUtils = {
  /**
   * 弧形座位坐标转换
   *
   * 计算流程：
   * 1. 根据影厅参数计算座位的物理坐标（厘米）
   * 2. 乘以缩放比例转换为像素坐标
   *
   * @param {number} row - 排号（0-indexed）
   * @param {number} col - 座位号（0-indexed）
   * @param {Object} hallParams - 影厅弧形参数
   * @returns {{x: number, y: number, rotation: number}} 像素坐标和旋转角度（弧度）
   */
  arcToCartesian(row, col, hallParams) {
    const { radius, angleSpan, cols } = hallParams;

    // === 计算物理坐标 ===

    // 角度范围（弧度）
    const angleSpanRad = (angleSpan * Math.PI) / 180;

    // 座位角度：均匀分布在圆弧上
    // col=0 对应 θ = -angleSpan/2（最左侧）
    // col=cols-1 对应 θ = +angleSpan/2（最右侧）
    // 中心座位 col=(cols-1)/2 对应 θ=0
    const theta = (col / (cols - 1) - 0.5) * angleSpanRad;

    // 【修改】获取该排的物理Y坐标（考虑过道），传入 hallParams
    const physicalY = AppConfig.getRowPhysicalY(row, hallParams);

    // 计算圆心位置
    // 座位在圆心下方，物理Y = 圆心Y + R × cos(θ)
    // 所以：圆心Y = physicalY - R × cos(θ)
    // 中心座位 θ=0，cos(0)=1，所以：圆心Y = physicalY - R
    const centerY = physicalY - radius;

    // 计算座位的物理坐标
    // x = R × sin(θ)：水平偏移
    // y = 圆心Y + R × cos(θ)：垂直位置
    const physicalX = radius * Math.sin(theta);
    const physicalSeatY = centerY + radius * Math.cos(theta);

    // === 转换为像素坐标 ===
    const x = physicalX * _pixelsPerCm;
    const y = physicalSeatY * _pixelsPerCm;

    // 【修复】旋转角度：座位面向圆心（银幕方向）
    // theta > 0 表示右侧座位，应该向左旋转（负角度）以面向中心
    // theta < 0 表示左侧座位，应该向右旋转（正角度）以面向中心
    const rotation = -theta;

    return { x, y, rotation };
  },

  /**
   * 计算视角（座位偏离银幕中心的角度）
   */
  calculateViewAngle(seatX, seatY, screenCenterX, screenY) {
    const offsetX = Math.abs(seatX - screenCenterX);
    const distY = seatY - screenY;

    if (distY <= 0) return 90;

    const angleRad = Math.atan(offsetX / distY);
    return angleRad * (180 / Math.PI);
  },

  /**
   * 计算座位到银幕的距离
   */
  calculateScreenDistance(seatY, screenY) {
    return Math.abs(seatY - screenY);
  },

  /**
   * 统计座位周围的空闲座位数量
   */
  countAdjacentEmpty(seat, cinema) {
    let count = 0;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const neighborRow = seat.row + dr;
        const neighborCol = seat.col + dc;

        const neighbor = cinema.getSeat(neighborRow, neighborCol);
        if (neighbor && neighbor.status === "available") {
          count++;
        }
      }
    }

    return count;
  },

  /**
   * 计算两点之间的距离
   */
  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * 从画布坐标反向计算座位行列（用于点击检测）
   */
  cartesianToSeat(canvasX, canvasY, canvasCenterX, hallParams, cinema, yOffset = 0) {
    const seatSizePixels = AppConfig.physical.seatWidth * _pixelsPerCm;
    const halfSize = seatSizePixels / 2;

    for (let r = 0; r < hallParams.rows; r++) {
      for (let c = 0; c < hallParams.cols; c++) {
        const pos = this.arcToCartesian(r, c, hallParams);

        const seatX = pos.x + canvasCenterX;
        const seatY = pos.y + yOffset;

        if (
          canvasX >= seatX - halfSize &&
          canvasX <= seatX + halfSize &&
          canvasY >= seatY - halfSize &&
          canvasY <= seatY + halfSize
        ) {
          return { row: r, col: c };
        }
      }
    }

    return null;
  },
};
