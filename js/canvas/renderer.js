export class CanvasRenderer {
  // 接口定义：constructor(canvasElement, cinema)
  constructor(canvasElement, cinema) {
    this.canvas = canvasElement;
    this.cinema = cinema;
    this.ctx = this.canvas.getContext("2d");
    console.log("[Canvas] Renderer created");
  }

  render() {
    console.log("[Canvas] render full cinema");
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  renderSeats(seats) {
    console.log(`[Canvas] renderSeats count: ${seats.length}`);
  }

  renderHeatmap(heatData) {
    console.log("[Canvas] renderHeatmap");
  }

  updateSeat(seat) {
    console.log(`[Canvas] updateSeat(${seat.row},${seat.col})`);
  }
}
