export class HeatmapRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.heatData = [];
    console.log("[Canvas] HeatmapRenderer created");
  }
  generate(seats) {
    console.log("[Canvas] Heatmap generating data...");
    this.heatData = seats.map((seat) => ({
      row: seat.row,
      col: seat.col,
      value: Math.random(),
    }));
  }
  render() {
    console.log("[Canvas] Heatmap rendering layer");
    const ctx = this.renderer.ctx;
  }
  setTimeDimension(day) {
    console.log(`[Canvas] Heatmap setTimeDimension: day=${day}`);
  }
  getWeeklyData() {
    console.log("[Canvas] Heatmap getWeeklyData");
    return [];
  }
}
