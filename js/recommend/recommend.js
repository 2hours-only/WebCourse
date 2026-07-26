import { RuleEngine } from "./rule.js";
import { ScoreCalculator } from "./score.js";

export class RecommendEngine {
  constructor() {
    this.ruleEngine = new RuleEngine();
    this.scoreCalculator = new ScoreCalculator();
    console.log("[Recommend] Engine created");
  }

  /**
   * 智能推荐入口
   * @param {Object} userPreference { age, count, type, memberInfo }
   * @param {Cinema} cinema
   * @param {Object} userRatings 用户手动评分映射 { "r{row}c{col}": rating }
   * @returns {Seat[]} 推荐座位列表
   */
  recommend(userPreference, cinema, userRatings = {}) {
    console.log("[Recommend] recommend called", userPreference);

    // 清除上一次的推荐标记，保持 Seat 全局唯一性
    cinema.getAllSeats().forEach((s) => s.setRecommended(false));

    let seats = cinema.getAvailableSeats();
    seats = this.ruleEngine.applyRules(userPreference, seats);

    // 评分
    seats.forEach((s) => {
      const seatId = `r${s.row}c${s.col}`;
      const userRating = userRatings[seatId];
      const score = this.scoreCalculator.calculate(s, userRating, { cinema });
      s.setScore(score);
    });

    // 根据类型挑选最终推荐座位
    const count = (userPreference && userPreference.count) || 1;
    const type = (userPreference && userPreference.type) || "personal";
    let recommended;

    if (type === "couple") {
      recommended = this._pickBestPair(seats);
    } else if (type === "group" || type === "family") {
      const need = type === "family" ? Math.max(count, 3) : count;
      recommended = this._pickBestContiguous(seats, need);
    } else {
      recommended = this._pickTopSeats(seats, Math.max(count, 1));
    }

    recommended.forEach((s) => s.setRecommended(true));
    console.log(`[Recommend] recommended ${recommended.length} seats`);
    return recommended;
  }

  /**
   * 个人票：取评分最高的 count 个座位
   */
  _pickTopSeats(seats, count) {
    return [...seats]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(count, 1));
  }

  /**
   * 情侣票：取评分总和最高的相邻座位对
   */
  _pickBestPair(seats) {
    const seatMap = new Map(seats.map((s) => [`${s.row},${s.col}`, s]));
    let best = null;
    let bestSum = -1;
    for (const s of seats) {
      const right = seatMap.get(`${s.row},${s.col + 1}`);
      if (right) {
        const sum = s.score + right.score;
        if (sum > bestSum) {
          bestSum = sum;
          best = [s, right];
        }
      }
    }
    return best || [];
  }

  /**
   * 团体票：在每一行中找连续 need 个座位的最高评分组合
   */
  _pickBestContiguous(seats, need) {
    if (need <= 0) return [];
    const byRow = new Map();
    for (const s of seats) {
      if (!byRow.has(s.row)) byRow.set(s.row, []);
      byRow.get(s.row).push(s);
    }

    let best = null;
    let bestSum = -1;
    for (const rowSeats of byRow.values()) {
      rowSeats.sort((a, b) => a.col - b.col);
      for (let i = 0; i + need <= rowSeats.length; i++) {
        // 检查这 need 个座位列号是否连续
        let contiguous = true;
        for (let j = 1; j < need; j++) {
          if (rowSeats[i + j].col !== rowSeats[i + j - 1].col + 1) {
            contiguous = false;
            break;
          }
        }
        if (!contiguous) continue;
        const group = rowSeats.slice(i, i + need);
        const sum = group.reduce((acc, s) => acc + s.score, 0);
        if (sum > bestSum) {
          bestSum = sum;
          best = group;
        }
      }
    }
    return best || [];
  }
}
