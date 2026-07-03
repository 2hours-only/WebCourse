import { Seat } from "./seat.js";

export class Cinema {
  constructor(rows, cols, screenPosition, curvature = 0.1) {
    console.log("[Core] Cinema Initializing...");
    this.rows = rows;
    this.cols = cols;
    this.screenPosition = screenPosition;
    this.curvature = curvature; 
    this.seats = [];
    this._initSeats();
  }

  _initSeats() {
    for (let r = 0; r < this.rows; r++) {
      this.seats[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.seats[r][c] = new Seat(r, c);
      }
    }
  }

  reloadHallData(
    rows,
    cols,
    screenPosition,
    soldSeats = [],
    heatMap = [],
    curvature = 0.1,
  ) {
    console.log("[Core] Reloading Hall Data...");
    this.rows = rows;
    this.cols = cols;
    this.screenPosition = screenPosition;
    this.curvature = curvature; // 更新弧度
    this.seats = [];
    this._initSeats();

    soldSeats.forEach((s) => {
      const seat = this.getSeat(s.row, s.col);
      if (seat) seat.setStatus("sold");
    });

    if (heatMap && heatMap.length > 0) {
      heatMap.forEach((h) => {
        const seat = this.getSeat(h.row, h.col);
        if (seat) seat.setHeat(h.value);
      });
    }
  }

  getSeat(row, col) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.seats[row][col];
    }
    return null;
  }

  getRow(row) {
    if (row >= 0 && row < this.rows) {
      return this.seats[row];
    }
    return [];
  }

  getAllSeats() {
    return this.seats.flat();
  }

  getAvailableSeats() {
    return this.getAllSeats().filter((s) => s.status === "available");
  }
}
