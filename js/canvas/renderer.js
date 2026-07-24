import { AppConfig } from "../utils/config.js";
import { MathUtils, setPixelsPerCm, getPixelsPerCm } from "../utils/math.js";

export class CanvasRenderer {
  constructor(canvasElement, cinema) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.cinema = cinema;
    this.hallType = "small"; // 当前影厅类型

    // 渲染参数：像素相关
    this.pixelsPerCm = 0.35; // 缩放比例
    this.seatSizePixels = AppConfig.physical.seatWidth * this.pixelsPerCm;
    this.canvasPadding = 40;

    // 悬停状态
    this.hoveredSeat = null;

    // 设置 math.js 的缩放比例
    setPixelsPerCm(this.pixelsPerCm);

    console.log("[Canvas] Renderer created");
  }

  /**
   * 设置影厅类型
   */
  setHallType(hallType) {
    this.hallType = hallType;
  }

  /**
   * 设置缩放比例
   */
  setPixelsPerCm(value) {
    this.pixelsPerCm = value;
    this.seatSizePixels = AppConfig.physical.seatWidth * value;
    setPixelsPerCm(value);
  }

  /**
   * 获取当前影厅参数
   */
  getHallParams() {
    return AppConfig.getHallParams(this.hallType);
  }

  /**
   * 完整渲染影院
   */
  render() {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 计算画布中心
    const centerX = this.canvas.width / 2;

    // 1. 绘制银幕
    this._renderScreen(centerX);

    // 2. 绘制所有座位
    this._renderAllSeats(centerX);

    // 3. 绘制排号标识
    this._renderRowLabels(centerX);

    // 4. 绘制过道标识（可选）
    this._renderAisleMark(centerX);
  }

  /**
   * 绘制银幕
   */
  _renderScreen(centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();

    // 银幕宽度 = 影厅弧形弦长（近似）
    const screenWidthCm = AppConfig.getScreenWidth(this.hallType);
    const screenWidthPixels = screenWidthCm * this.pixelsPerCm * 0.8;
    const screenHeight = 30;
    const screenY = 15;

    // 银幕背景
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
    ctx.roundRect(
      centerX - screenWidthPixels / 2,
      screenY,
      screenWidthPixels,
      screenHeight,
      4,
    );
    ctx.fill();

    // 银幕文字
    ctx.fillStyle = "#e0e0e0";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("银 幕", centerX, screenY + screenHeight / 2 + 5);
  }

  /**
   * 绘制所有座位
   */
  _renderAllSeats(centerX) {
    const seats = this.cinema.getAllSeats();
    for (const seat of seats) {
      this._renderSeat(seat, centerX);
    }
  }

  /**
   * 绘制单个座位
   */
  _renderSeat(seat, centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();

    // 计算座位坐标和旋转角度
    const pos = MathUtils.arcToCartesian(seat.row, seat.col, hallParams);

    // 转换为画布坐标
    const x = pos.x + centerX;
    const y = pos.y + 55; // 银幕下移一点
    const rotation = pos.rotation;

    // 确定座位颜色
    let fillColor = AppConfig.colors.free;
    if (seat.status === "sold") {
      fillColor = AppConfig.colors.sold;
    } else if (seat.status === "selected") {
      fillColor = AppConfig.colors.selected;
    } else if (seat.isRecommended) {
      fillColor = AppConfig.colors.recommended;
    }

    // 悬停效果
    if (this.hoveredSeat === seat && seat.status === "available") {
      fillColor = AppConfig.colors.hover;
    }

    // === 绘制旋转的座位 ===
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(
      -this.seatSizePixels / 2,
      -this.seatSizePixels / 2,
      this.seatSizePixels,
      this.seatSizePixels,
      4,
    );
    ctx.fill();

    // 绘制座位号（仅首排显示）
    if (seat.row === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `${this.seatSizePixels * 0.35}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${seat.col + 1}`, 0, 0);
    }

    ctx.restore();
  }

  /**
   * 绘制排号标识
   */
  _renderRowLabels(centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();

    // 计算最左侧座位的 X 坐标
    const leftMostPos = MathUtils.arcToCartesian(
      hallParams.rows - 1,
      0,
      hallParams,
    );

    ctx.fillStyle = "#666666";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";

    for (let r = 0; r < hallParams.rows; r++) {
      const pos = MathUtils.arcToCartesian(r, 0, hallParams);

      const labelX = centerX + leftMostPos.x - this.seatSizePixels;
      const labelY = pos.y + 55 + this.seatSizePixels / 2;

      ctx.fillText(`${r + 1}排`, labelX, labelY);

      // 标注过道
      if (r === AppConfig.physical.aisleRowIndex - 1) {
        ctx.fillStyle = "#999999";
        ctx.fillText("(过道)", labelX, labelY + 15);
        ctx.fillStyle = "#666666";
      }
    }
  }

  /**
   * 绘制过道标识
   */
  _renderAisleMark(centerX) {
    const ctx = this.ctx;
    const hallParams = this.getHallParams();
    const aisleRow = AppConfig.physical.aisleRowIndex;

    if (aisleRow <= 0 || aisleRow >= hallParams.rows) return;

    // 获取过道上下的排的Y坐标
    const posAbove = MathUtils.arcToCartesian(
      aisleRow - 1,
      Math.floor(hallParams.cols / 2),
      hallParams,
    );
    const posBelow = MathUtils.arcToCartesian(
      aisleRow,
      Math.floor(hallParams.cols / 2),
      hallParams,
    );

    // 绘制过道区域
    ctx.save();
    ctx.fillStyle = "rgba(200, 200, 200, 0.3)";
    ctx.fillRect(
      centerX - (hallParams.cols * this.seatSizePixels) / 4,
      posAbove.y + 55 + this.seatSizePixels / 2,
      (hallParams.cols * this.seatSizePixels) / 2,
      posBelow.y - posAbove.y - this.seatSizePixels,
    );
    ctx.restore();
  }

  /**
   * 更新单个座位显示
   */
  updateSeat(seat) {
    const centerX = this.canvas.width / 2;
    this._renderSeat(seat, centerX);
  }

  /**
   * 渲染指定座位列表
   */
  renderSeats(seats) {
    const centerX = this.canvas.width / 2;
    for (const seat of seats) {
      this._renderSeat(seat, centerX);
    }
  }

  /**
   * 设置悬停座位
   */
  setHoveredSeat(seat) {
    this.hoveredSeat = seat;
  }

  /**
   * 渲染热力图图层
   */
  renderHeatmap(heatData) {
    console.log("[Canvas] renderHeatmap", heatData);
  }
}
