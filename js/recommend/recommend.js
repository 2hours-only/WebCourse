import { RuleEngine } from "./rule.js";
import { ScoreCalculator } from "./score.js";
import { MathUtils } from "../utils/math.js";

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
   * @returns {Seat[]} 推荐座位列表（已排序）
   */
  recommend(userPreference, cinema, userRatings = {}) {
    console.log("[Recommend] recommend called", userPreference);

    // 清除上一次的推荐标记及附属文本，保持 Seat 全局唯一性
    cinema.getAllSeats().forEach((s) => {
      s.setRecommended(false);
      s.recommendGrade = "";
      s.recommendReason = "";
    });

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

    // 生成评价等级与推荐理由（方案A：动态挂载到 Seat）
    const grade = this._generateGrade(recommended);
    const reason = this._generateReason(recommended, userPreference, cinema);
    recommended.forEach((s) => {
      s.setRecommended(true);
      s.recommendGrade = grade;
      s.recommendReason = reason;
    });

    console.log(
      `[Recommend] recommended ${recommended.length} seats, grade=${grade}, reason=${reason}`,
    );
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

  /**
   * 根据推荐列表的最高分生成评价等级：极佳 / 优秀 / 一般
   */
  _generateGrade(seats) {
    if (!seats || seats.length === 0) return "一般";
    const topScore = seats.reduce((m, s) => Math.max(m, s.score || 0), 0);
    if (topScore >= 85) return "极佳";
    if (topScore >= 70) return "优秀";
    return "一般";
  }

  /**
   * 根据用户偏好与最佳座位位置生成推荐理由文本
   */
  _generateReason(seats, userPreference, cinema) {
    if (!seats || seats.length === 0 || !cinema) return "";
    const top = seats[0];
    const reasons = [];
    const type = (userPreference && userPreference.type) || "personal";
    const age = userPreference && userPreference.age;

    // 类型相关理由
    if (type === "couple") reasons.push("中间区域相邻双座");
    else if (type === "family") reasons.push("家庭连续座位");
    else if (type === "group") reasons.push("团体同排连续空位");

    // 年龄相关理由
    if (age === "teenager") reasons.push("避开前排保护视力");
    else if (age === "elderly") reasons.push("避开后排方便进出");

    // 位置相关理由
    const centerCol = (cinema.cols - 1) / 2;
    if (Math.abs(top.col - centerCol) <= cinema.cols * 0.15) {
      reasons.push("居中视角佳");
    }
    const optimalRow = Math.floor(cinema.rows * 0.6);
    if (Math.abs(top.row - optimalRow) <= 1) reasons.push("黄金排距");

    // 舒适度理由
    const adjacentEmpty = MathUtils.countAdjacentEmpty(top, cinema);
    if (adjacentEmpty >= 6) reasons.push("周围空位充足");

    // 热度理由
    const heat = typeof top.heat === "number" ? top.heat : 0;
    if (heat < 0.3) reasons.push("热度适中不拥挤");

    return reasons.join("，");
  }
}
