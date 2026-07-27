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

    // 生成评价等级与推荐理由（动态挂载到 Seat）
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

  /**
   * AI 观影问答式顾问推荐（加分项）
   * 接收自然语言输入，自动解析为 UserPreference 并推荐座位，给出顾问式解释
   * @param {string} userInput 用户自然语言输入，如"我想带女朋友看浪漫电影"
   * @param {Cinema} cinema
   * @param {Object} userRatings 用户手动评分映射
   * @returns {Seat[]} 推荐座位列表，每个 Seat 附加 aiAdvice 字段
   */
  aiRecommend(userInput, cinema, userRatings = {}) {
    console.log("[Recommend AI] aiRecommend input:", userInput);
    const preference = this._parseUserInput(userInput);
    const seats = this.recommend(preference, cinema, userRatings);
    const advice = this._generateAIAdvice(userInput, preference, seats, cinema);
    seats.forEach((s) => {
      s.aiAdvice = advice;
    });
    console.log("[Recommend AI] advice:", advice);
    return seats;
  }

  /**
   * 自然语言解析为 UserPreference
   * 基于关键词规则匹配，覆盖常见观影场景
   */
  _parseUserInput(input) {
    const text = (input || "").toLowerCase();
    let type = "personal";
    let count = 1;
    let age = "adult";
    const memberInfo = [];

    // 类型识别：情侣 / 家庭 / 团体
    if (
      /情侣|对象|女朋友|男朋友|老婆|老公|双人|两人|两位|二人/.test(text)
    ) {
      type = "couple";
      count = 2;
    } else if (
      /家庭|家人|全家|亲子|带孩子|带小孩|一家三口|一家四口/.test(text)
    ) {
      type = "family";
      count = 3;
    } else if (
      /团体|公司|同学|朋友|组队|多人|聚会|包场/.test(text)
    ) {
      type = "group";
      const m = text.match(/(\d+)\s*[人个位]/);
      count = m ? parseInt(m[1], 10) : 5;
    }

    // 年龄识别
    if (/老人|老年|父母|爷爷|奶奶|外公|外婆|长辈/.test(text)) {
      age = "elderly";
    } else if (
      /孩子|小孩|儿童|少年|青少年|学生|未成年|小朋友/.test(text)
    ) {
      age = "teenager";
    }

    // 通用人数提取（若前面未确定）
    if (type === "personal") {
      const m = text.match(/(\d+)\s*[人个位]/);
      if (m) {
        count = parseInt(m[1], 10);
        if (count > 1) type = "group";
      }
    }

    // 解析 "姓名:年龄" 或 "年龄岁" 的成员信息（用于团体/家庭票的子规则）
    const memberPattern = /([\u4e00-\u9fa5a-zA-Z]+)\s*[:：]\s*(\d+)\s*岁?/g;
    let match;
    while ((match = memberPattern.exec(text)) !== null) {
      memberInfo.push({ name: match[1].trim(), age: parseInt(match[2], 10) });
    }

    return { age, count, type, memberInfo };
  }

  /**
   * 生成 AI 顾问式自然语言解释
   */
  _generateAIAdvice(userInput, preference, seats, cinema) {
    if (!seats || seats.length === 0) {
      return "抱歉，根据您的需求未找到合适的座位，建议调整人数或选择其他场次。";
    }
    const top = seats[0];
    const typeText =
      preference.type === "couple"
        ? "情侣双人"
        : preference.type === "family"
          ? "家庭"
          : preference.type === "group"
            ? `团体 ${preference.count} 人`
            : "个人";

    let ageText = "";
    if (preference.age === "teenager") ageText = "（已避开前排，保护视力）";
    else if (preference.age === "elderly")
      ageText = "（已避开后排，方便进出）";

    const seatDesc = seats
      .map((s) => `${s.row + 1}排${s.col + 1}座`)
      .join("、");

    return `根据您的需求"${userInput}"，我为您安排了${typeText}观影座位${ageText}：${seatDesc}。${seats[0].recommendReason || ""}综合评分${seats[0].recommendGrade || "一般"}，祝您观影愉快！`;
  }
}

// ============== 临时控制台测试（开发联调后删除） ==============
// 该段代码仅在浏览器控制台直接加载此模块时执行，方便快速验证推荐逻辑。
// 测试依赖 core/cinema.js 的 Cinema 类，不依赖 UI、EventBus 或 Storage。
import { Cinema } from "../core/cinema.js";

const testCinema = new Cinema(10, 10, "top", 0.1);
// 设置若干已售座位，模拟真实情况
[
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 4, col: 4 },
  { row: 4, col: 5 },
  { row: 8, col: 2 },
].forEach((s) => {
  const seat = testCinema.getSeat(s.row, s.col);
  if (seat) seat.setStatus("sold");
});
// 设置少量热度（0-1）
testCinema.getSeat(2, 2).setHeat(0.2);
testCinema.getSeat(5, 5).setHeat(0.1);
testCinema.getSeat(7, 7).setHeat(0.8);

const testEngine = new RecommendEngine();

const testCases = [
  { name: "个人-成人", pref: { age: "adult", count: 1, type: "personal" } },
  { name: "个人-青少年", pref: { age: "teenager", count: 1, type: "personal" } },
  { name: "个人-老人", pref: { age: "elderly", count: 1, type: "personal" } },
  { name: "情侣", pref: { age: "adult", count: 2, type: "couple" } },
  { name: "家庭3人", pref: { age: "adult", count: 3, type: "family" } },
  { name: "家庭（含老人）", pref: { age: "adult", count: 3, type: "family", memberInfo: [{ name: "爷爷", age: 65 }] } },
  { name: "团体5人", pref: { age: "adult", count: 5, type: "group" } },
];

console.group("[Recommend Test] 推荐算法控制台测试");
for (const tc of testCases) {
  const result = testEngine.recommend(tc.pref, testCinema);
  console.log(
    `%c${tc.name}:`,
    "font-weight:bold;color:#2196F3",
    result.map((s) => `${s.row + 1}排${s.col + 1}座(score=${s.score})`).join(", ") || "无推荐",
    `| 等级=${result[0]?.recommendGrade || "-"}`,
    `| 理由=${result[0]?.recommendReason || "-"}`,
  );
}
console.groupEnd();

// AI 顾问问答式推荐测试
console.group("[Recommend AI Test] AI 观影顾问推荐测试");
const aiTestCases = [
  "我想带女朋友看浪漫电影",
  "我们五个人公司团建",
  "一家三口看电影，带一个老人",
  "初中生班级活动，20个人",
];
for (const aiInput of aiTestCases) {
  const result = testEngine.aiRecommend(aiInput, testCinema);
  console.log(
    `%c${aiInput}:`,
    "font-weight:bold;color:#9C27B0",
    result.map((s) => `${s.row + 1}排${s.col + 1}座`).join(", ") || "无推荐",
    `| AI建议=${result[0]?.aiAdvice || "-"}`,
  );
}
console.groupEnd();
// ============== 临时测试结束 ==============

