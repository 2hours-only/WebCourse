import { RuleEngine } from "./rule.js";
import { ScoreCalculator } from "./score.js";

export class RecommendEngine {
  constructor() {
    this.ruleEngine = new RuleEngine();
    this.scoreCalculator = new ScoreCalculator();
    console.log("[Recommend] Engine created");
  }

  recommend(userPreference, cinema, userRatings = {}) {
    console.log("[Recommend] recommend called", userPreference);
    let seats = cinema.getAvailableSeats();
    seats = this.ruleEngine.applyRules(userPreference, seats);

    seats.forEach((s) => {
      const seatId = `r${s.row}c${s.col}`;
      const userRating = userRatings[seatId];
      const score = this.scoreCalculator.calculate(s, userRating);
      s.setScore(score);
      s.setRecommended(true); 
    });

    return seats;
  }
}
