export class Seat {
  constructor(row, col) {
    this.row = row;
    this.col = col;
    this.status = "available"; // available / sold / selected
    this.isRecommended = false;
    this.heat = 0; 
    this.score = 0; 
    this.price = 0; 
    console.log(`[Core] Seat(${row}, ${col}) created.`);
  }

  setStatus(status) {
    console.log(`[Core] Seat(${this.row}, ${this.col}) setStatus -> ${status}`);
    this.status = status;
  }

  setRecommended(isRecommended) {
    console.log(
      `[Core] Seat(${this.row}, ${this.col}) setRecommended -> ${isRecommended}`,
    );
    this.isRecommended = isRecommended;
  }

  setHeat(heatLevel) {
    console.log(
      `[Core] Seat(${this.row}, ${this.col}) setHeat -> ${heatLevel}`,
    );
    this.heat = heatLevel;
  }

  setScore(score) {
    console.log(`[Core] Seat(${this.row}, ${this.col}) setScore -> ${score}`);
    this.score = score;
  }
}
