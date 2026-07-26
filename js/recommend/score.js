import { AppConfig } from "../utils/config.js";
import { MathUtils } from "../utils/math.js";

export class ScoreCalculator {
  constructor() {
    console.log("[Recommend] ScoreCalculator created");
  }

  /**
   * 给单个 Seat 打综合评分 (0-100)
   * 评分维度：视角、距离银幕、舒适度（含周围空位）
   * 方法签名 calculate(seat, userRating)，第三参数 context 为可选扩展，兼容两参调用
   * @param {Seat} seat 目标座位
   * @param {number|undefined} userRating 观众手动评分 (可选，0-100)
   * @param {{cinema?:Cinema}} [context] 评分上下文（可选）
   * @returns {number} 综合评分 (0-100)
   */
  calculate(seat, userRating = undefined, context = {}) {
    const { cinema } = context;

    const viewAngleScore = this._viewAngleScore(seat, cinema);
    const distanceScore = this._distanceScore(seat, cinema);
    const comfortScore = this._comfortScore(seat, cinema);

    const weights = AppConfig.recommend;
    let score =
      viewAngleScore * weights.viewAngleWeight +
      distanceScore * weights.distanceWeight +
      comfortScore * weights.comfortWeight;

    score = Math.round(Math.min(100, Math.max(0, score)));

    // 观众手动评分与系统评分的综合计算
    if (
      userRating !== undefined &&
      userRating !== null &&
      !isNaN(userRating)
    ) {
      score = Math.round((score + Number(userRating)) / 2);
    }

    console.log(
      `[Recommend] Seat(${seat.row},${seat.col}) score=${score} ` +
        `(view=${viewAngleScore}, dist=${distanceScore}, comfort=${comfortScore})`,
    );
    return score;
  }

  /**
   * 根据影院尺寸推断影厅弧形参数
   */
  _getHallParams(cinema) {
    if (!cinema) return null;
    for (const params of Object.values(AppConfig.arcParams)) {
      if (params.rows === cinema.rows && params.cols === cinema.cols) {
        return params;
      }
    }
    return AppConfig.arcParams.small;
  }

  /**
   * 视角权重计算（调用 math.js 视角计算函数）
   * 视角偏离越小，分数越高
   */
  _viewAngleScore(seat, cinema) {
    if (!cinema) return 50;
    const hallParams = this._getHallParams(cinema);
    if (!hallParams) return 50;

    const { radius, angleSpan, cols } = hallParams;
    const angleSpanRad = (angleSpan * Math.PI) / 180;
    const theta = (seat.col / (cols - 1) - 0.5) * angleSpanRad;
    const physicalX = radius * Math.sin(theta);
    const physicalY = AppConfig.getRowPhysicalY(seat.row, hallParams);

    // 银幕中心位于 X=0, Y=0（银幕在顶部居中）
    const viewAngle = MathUtils.calculateViewAngle(
      physicalX,
      physicalY,
      0,
      0,
    );
    // viewAngle 范围 0~90，越小越好
    return Math.round(100 * (1 - viewAngle / 90));
  }

  /**
   * 距离银幕权重计算（调用 math.js 距离计算函数）
   * 越接近黄金排距分数越高
   */
  _distanceScore(seat, cinema) {
    if (!cinema) return 50;
    const hallParams = this._getHallParams(cinema);
    if (!hallParams) return 50;

    const physicalY = AppConfig.getRowPhysicalY(seat.row, hallParams);
    const screenDistance = MathUtils.calculateScreenDistance(physicalY, 0);

    // 黄金排距：约影厅 60% 位置的物理距离
    const goldenRowIndex = Math.floor(hallParams.rows * 0.6);
    const goldenDistance = AppConfig.getRowPhysicalY(goldenRowIndex, hallParams);

    const offset = Math.abs(screenDistance - goldenDistance);
    const maxOffset = Math.max(goldenDistance, screenDistance) || 1;
    return Math.round(100 * (1 - offset / maxOffset));
  }

  /**
   * 周围空位情况舒适度计算（调用 math.js countAdjacentEmpty）
   * 周围空位越多 + 热度越低，舒适度越高
   */
  _comfortScore(seat, cinema) {
    if (!cinema) return 50;
    const adjacentEmpty = MathUtils.countAdjacentEmpty(seat, cinema); // 0-8
    const emptyScore = (adjacentEmpty / 8) * 60;
    const heat = typeof seat.heat === "number" ? seat.heat : 0;
    const heatScore = (1 - Math.min(heat, 1)) * 40;
    return Math.round(emptyScore + heatScore);
  }
}
