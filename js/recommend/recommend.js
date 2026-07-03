import { RuleEngine } from "./rule.js";
import { ScoreCalculator } from "./score.js";

export class RecommendEngine {
  constructor() {
    this.ruleEngine = new RuleEngine();
    this.scoreCalculator = new ScoreCalculator();
    console.log("[Recommend] Engine created");
  }

  // 接口定义：recommend(userPreference, cinema)
  recommend(userPreference, cinema) {
    console.log("[Recommend] recommend called", userPreference);
    let seats = cinema.getAvailableSeats();

    // 接口定义：applyRules(userPreference, seats)
    seats = this.ruleEngine.applyRules(userPreference, seats);

    seats.forEach((s) => {
      // 接口定义：calculate(seat)
      const score = this.scoreCalculator.calculate(s);
      s.setScore(score);
    });

    return seats;
  }
}
