export class ScoreCalculator {
  constructor() {
    console.log("[Recommend] ScoreCalculator created");
  }

  // 接口定义：calculate(seat)
  calculate(seat) {
    console.log(
      `[Recommend] calculate score for Seat(${seat.row},${seat.col})`,
    );
    return Math.floor(Math.random() * 100);
  }
}
