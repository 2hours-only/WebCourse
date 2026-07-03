export class ScoreCalculator {
  constructor() {
    console.log("[Recommend] ScoreCalculator created");
  }


  calculate(seat, userRating = undefined) {
    console.log(
      `[Recommend] calculate score for Seat(${seat.row},${seat.col}) with userRating: ${userRating}`,
    );

    // 系统基础评分
    let baseScore = Math.floor(Math.random() * 100);

    // 如果存在观众手动评分，则进行综合计算
    if (userRating !== undefined) {
      return Math.floor((baseScore + userRating) / 2);
    }

    return baseScore;
  }
}
