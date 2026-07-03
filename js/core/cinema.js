import { Seat } from "./seat.js";

export class Cinema {
  constructor(rows, cols, screenPosition) {
    console.log("[Core] Cinema Initializing...");
    this.rows = rows;
    this.cols = cols;
    this.screenPosition = screenPosition;
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

  getSeat(row, col) {
    console.log(`[Core] Cinema getSeat(${row}, ${col})`);
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.seats[row][col];
    }
    return null;
  }

  getRow(row) {
    console.log(`[Core] Cinema getRow(${row})`);
    if (row >= 0 && row < this.rows) {
      return this.seats[row];
    }
    return [];
  }

  getAllSeats() {
    console.log("[Core] Cinema getAllSeats");
    return this.seats.flat();
  }

  getAvailableSeats() {
    console.log("[Core] Cinema getAvailableSeats");
    return this.getAllSeats().filter((s) => s.status === "available");
  }
}
