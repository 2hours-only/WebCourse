import { AppConfig } from "../utils/config.js";
import { MathUtils, setPixelsPerCm } from "../utils/math.js";

export class CanvasRenderer {
  constructor(canvasElement, cinema) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.cinema = cinema;
    this.hallType = "small";
    this.pixelsPerCm = 0.35;
    this.seatSizePixels = AppConfig.physical.seatWidth * this.pixelsPerCm;
    this.canvasPadding = 40;
    this.hoveredSeat = null;
    this.dragRect = null;
    this.yOffset = 55;

    setPixelsPerCm(this.pixelsPerCm);

    console.log("[Canvas] Renderer created");
  }

  setHallType(hallType) {
    this.hallType = hallType;
  }

  setPixelsPerCm(value) {
    this.pixelsPerCm = value;
    this.seatSizePixels = AppConfig.physical.seatWidth * value;
    setPixelsPerCm(value);
  }

  getHallParams() {
    return AppConfig.getHallParams(this.hallType);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const centerX = this.canvas.width / 2;

    this._renderScreen(centerX);
    if (this.heatmapRenderer) {
      this.heatmapRenderer.render();
    }
    this._renderAllSeats(centerX);
    this._renderRowLabels(centerX);
    this._renderColumnLabels(centerX);
    this._renderAisleMark(centerX);
    if (this.dragRect) {
      this._renderDragSelection(this.dragRect);
    }
  }

  _renderScreen(centerX) {
    const ctx = this.ctx;
    const screenWidthCm = AppConfig.getScreenWidth(this.hallType);
    const screenWidthPixels = screenWidthCm * this.pixelsPerCm * 0.8;
    const screenHeight = 30;
    const screenY = 15;

    const gradient = ctx.createLinearGradient(
      centerX - screenWidthPixels / 2,
      screenY,
      centerX + screenWidthPixels / 2,
      screenY,
    );
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#1a1a2e");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    this._drawRoundedRect(
      ctx,
      centerX - screenWidthPixels / 2,
      screenY,
      screenWidthPixels,
      screenHeight,
      4,
    );
    ctx.fill();

    ctx.fillStyle = "#e0e0e0";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("银 幕", centerX, screenY + screenHeight / 2 + 5);
  }

  _renderAllSeats(centerX) {
    const seats = this.cinema.getAllSeats();
    for (const seat of seats) {
      this._renderSeat(seat, centerX);
    }
  }

  _renderSeat(seat, centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();
    const pos = MathUtils.arcToCartesian(seat.row, seat.col, hallParams);
    const x = pos.x + centerX;
    const y = pos.y + this.yOffset;
    const rotation = pos.rotation;

    let fillColor = AppConfig.colors.free;
    if (seat.status === "sold") {
      fillColor = AppConfig.colors.sold;
    } else if (seat.status === "selected") {
      fillColor = AppConfig.colors.selected;
    } else if (seat.isRecommended) {
      fillColor = AppConfig.colors.recommended;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    this._drawRoundedRect(
      ctx,
      -this.seatSizePixels / 2,
      -this.seatSizePixels / 2,
      this.seatSizePixels,
      this.seatSizePixels,
      4,
    );
    ctx.fill();

    if (seat.isRecommended) {
      ctx.strokeStyle = "rgba(255, 215, 0, 0.85)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (this.hoveredSeat === seat) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderRowLabels(centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();
    const leftMostPos = MathUtils.arcToCartesian(hallParams.rows - 1, 0, hallParams);

    ctx.fillStyle = "#666666";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let r = 0; r < hallParams.rows; r++) {
      const pos = MathUtils.arcToCartesian(r, 0, hallParams);
      const labelX = centerX + leftMostPos.x - this.seatSizePixels;
      const labelY = pos.y + this.yOffset;

      ctx.fillText(`${r + 1}排`, labelX, labelY);

      if (r === AppConfig.physical.aisleRowIndex - 1) {
        ctx.fillStyle = "#999999";
        ctx.fillText("(过道)", labelX, labelY + 16);
        ctx.fillStyle = "#666666";
      }
    }
  }

  _renderColumnLabels(centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();

    ctx.fillStyle = "#666666";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    for (let c = 0; c < hallParams.cols; c++) {
      const pos = MathUtils.arcToCartesian(0, c, hallParams);
      const x = pos.x + centerX;
      const y = pos.y + this.yOffset - this.seatSizePixels;
      ctx.fillText(`${c + 1}`, x, y);
    }
  }

  _renderAisleMark(centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();
    const aisleRow = AppConfig.physical.aisleRowIndex;

    if (aisleRow <= 0 || aisleRow >= hallParams.rows) return;

    const posAbove = MathUtils.arcToCartesian(aisleRow - 1, Math.floor(hallParams.cols / 2), hallParams);
    const posBelow = MathUtils.arcToCartesian(aisleRow, Math.floor(hallParams.cols / 2), hallParams);

    ctx.save();
    ctx.fillStyle = "rgba(200, 200, 200, 0.12)";
    ctx.strokeStyle = "rgba(150, 150, 150, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.fillRect(
      centerX - (hallParams.cols * this.seatSizePixels) / 4,
      posAbove.y + this.yOffset + this.seatSizePixels / 2,
      (hallParams.cols * this.seatSizePixels) / 2,
      posBelow.y - posAbove.y - this.seatSizePixels,
    );
    ctx.strokeRect(
      centerX - (hallParams.cols * this.seatSizePixels) / 4,
      posAbove.y + this.yOffset + this.seatSizePixels / 2,
      (hallParams.cols * this.seatSizePixels) / 2,
      posBelow.y - posAbove.y - this.seatSizePixels,
    );
    ctx.restore();
  }

  _renderDragSelection(rect) {
    if (!rect) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(33, 150, 243, 0.14)";
    ctx.strokeStyle = "rgba(33, 150, 243, 0.9)";
    ctx.lineWidth = 2;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  updateSeat(seat) {
    const centerX = this.canvas.width / 2;
    this._renderSeat(seat, centerX);
  }

  renderSeats(seats) {
    const centerX = this.canvas.width / 2;
    for (const seat of seats) {
      this._renderSeat(seat, centerX);
    }
  }

  setHoveredSeat(seat) {
    if (this.hoveredSeat === seat) return;
    this.hoveredSeat = seat;
    this.render();
  }

  clearDragRect() {
    if (!this.dragRect) return;
    this.dragRect = null;
    this.render();
  }

  setDragRect(rect) {
    this.dragRect = rect;
    this.render();
  }

  getSeatAtPoint(canvasX, canvasY) {
    const centerX = this.canvas.width / 2;
    const hallParams = this.getHallParams();
    const seatCoord = MathUtils.cartesianToSeat(canvasX, canvasY, centerX, hallParams, this.cinema, this.yOffset);
    if (seatCoord) {
      return this.cinema.getSeat(seatCoord.row, seatCoord.col);
    }
    return this.getClosestSeatAtPoint(canvasX, canvasY);
  }

  getClosestSeatAtPoint(canvasX, canvasY) {
    const hallParams = this.getHallParams();
    const seats = this.cinema.getAllSeats();
    let closest = null;
    let minDistance = Infinity;
    const tolerance = this.seatSizePixels * 0.75;

    for (const seat of seats) {
      const center = this.getSeatCenter(seat);
      const dx = canvasX - center.x;
      const dy = canvasY - center.y;
      const distance = Math.hypot(dx, dy);
      if (distance < minDistance) {
        minDistance = distance;
        closest = seat;
      }
    }

    return minDistance <= tolerance ? closest : null;
  }

  _drawRoundedRect(ctx, x, y, width, height, radius) {
    if (typeof radius === "undefined") radius = 5;
    if (typeof radius === "number") {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
      for (const side in defaultRadius) {
        radius[side] = radius[side] || defaultRadius[side];
      }
    }

    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius.br,
      y + height,
    );
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
  }

  getSeatCenter(seat) {
    const hallParams = this.getHallParams();
    const pos = MathUtils.arcToCartesian(seat.row, seat.col, hallParams);
    return {
      x: pos.x + this.canvas.width / 2,
      y: pos.y + this.yOffset,
    };
  }

  renderHeatmap(heatData) {
    if (!heatData || !Array.isArray(heatData)) return;
    if (this.heatmapRenderer) {
      this.heatmapRenderer.update(heatData);
    }
  }
}
