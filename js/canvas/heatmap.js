import { AppConfig } from "../utils/config.js";
import { MathUtils } from "../utils/math.js";

export class HeatmapRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.heatSpots = [];
    this.isReady = false;
    console.log("[Canvas] HeatmapRenderer created");
  }

  generate(seats) {
    const filtered = seats.filter((seat) => typeof seat.heat === "number");
    if (filtered.length > 0) {
      this.heatSpots = filtered.map((seat) => ({
        seat,
        value: this._normalizeHeat(seat.heat),
      }));
      this.isReady = true;
      this.isFallback = false;
      return;
    }

    // 无真实热度数据时提供默认示意热力图
    this.isFallback = true;
    const rows = this.renderer.getHallParams().rows;
    const cols = this.renderer.getHallParams().cols;
    this.heatSpots = seats.map((seat) => {
      const rowFactor = 1 - Math.abs(seat.row - (rows - 1) / 2) / ((rows - 1) / 2 || 1);
      const colFactor = 1 - Math.abs(seat.col - (cols - 1) / 2) / ((cols - 1) / 2 || 1);
      const value = this._normalizeHeat((rowFactor + colFactor) / 2);
      return { seat, value };
    });
    this.isReady = true;
  }

  clear() {
    this.heatSpots = [];
    this.isReady = false;
    this.isFallback = false;
  }

  update(seats = null) {
    if (seats) {
      this.generate(seats);
    } else if (!this.isReady && this.renderer.cinema) {
      this.generate(this.renderer.cinema.getAllSeats());
    }
  }

  render() {
    if (!this.isReady) return;

    const ctx = this.renderer.ctx;
    const hallParams = this.renderer.getHallParams();
    const centerX = this.renderer.canvas.width / 2;

    ctx.save();
    ctx.globalAlpha = this.isFallback ? 0.55 : 0.7;

    for (const spot of this.heatSpots) {
      const pos = MathUtils.arcToCartesian(spot.seat.row, spot.seat.col, hallParams);
      const x = pos.x + centerX;
      const y = pos.y + this.renderer.yOffset;
      const radius = this.renderer.seatSizePixels * (this.isFallback ? 1.0 : 0.85);
      const baseColor = this._getHeatColor(spot.value);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(0.55, baseColor);
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

  }

  _normalizeHeat(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  _getHeatColor(value) {
    if (value >= 0.66) {
      return AppConfig.heatmap.hot;
    }
    if (value >= 0.33) {
      return AppConfig.heatmap.warm;
    }
    return AppConfig.heatmap.cold;
  }

  _renderZoneLabels() {
    // 已移除热力图区域文本显示
  }

  _renderFallbackHint() {
    // 已移除热力图示例提示文字
  }
}
