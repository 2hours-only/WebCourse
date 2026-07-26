export class RuleEngine {
  constructor() {
    console.log("[Recommend] RuleEngine created");
  }

  /**
   * 应用硬性过滤规则
   * @param {Object} userPreference { age, count, type, memberInfo? }
   *   type: 'personal' | 'couple' | 'family' | 'group'
   *   memberInfo: [{name, age}, ...] (团体/家庭票时使用)
   * @param {Seat[]} seats 当前可用座位
   * @returns {Seat[]} 过滤后的候选座位列表
   */
  applyRules(userPreference, seats) {
    console.log("[Recommend] applyRules called", userPreference);
    let filtered = [...seats];

    filtered = this._applyAgeRules(userPreference, filtered);
    filtered = this._applyTypeRules(userPreference, filtered);

    console.log(
      `[Recommend] rules filtered ${seats.length} -> ${filtered.length}`,
    );
    return filtered;
  }

  /**
   * 年龄规则
   * - 青少年(15岁以下)避开前三排
   * - 老年人(60岁以上)避开最后三排
   * - 团体/家庭票：检查 memberInfo 中成员年龄，遵循老人/少年子规则
   */
  _applyAgeRules(pref, seats) {
    const age = pref && pref.age;
    const memberInfo = pref && pref.memberInfo;

    let avoidFront = false;
    let avoidBack = false;

    // 个人/情侣票：依据 userPreference.age 判断
    if (age === "teenager") avoidFront = true;
    if (age === "elderly") avoidBack = true;

    // 团体/家庭票：依据 memberInfo 中成员实际年龄判断
    if (memberInfo && memberInfo.length > 0) {
      for (const m of memberInfo) {
        if (m.age < 15) avoidFront = true;
        if (m.age >= 60) avoidBack = true;
      }
    }

    const maxRow = seats.reduce((mx, s) => Math.max(mx, s.row), 0);

    if (avoidFront) {
      seats = seats.filter((s) => s.row >= 3);
    }
    if (avoidBack) {
      seats = seats.filter((s) => s.row < maxRow - 2);
    }

    return seats;
  }

  /**
   * 类型规则：个人/情侣/家庭/团体分类判定
   */
  _applyTypeRules(pref, seats) {
    const type = pref && pref.type;
    const count = (pref && pref.count) || 1;

    if (type === "couple") {
      return this._filterCouple(seats);
    }
    if (type === "family") {
      return this._filterFamily(seats, Math.max(count, 3));
    }
    if (type === "group") {
      return this._filterGroup(seats, count);
    }
    // personal：无额外类型限制
    return seats;
  }

  /**
   * 情侣票：优先中间区域连续双座
   * - 列位于影厅中间区域 (30%~70%)
   * - 左右至少一侧有相邻可用座位
   */
  _filterCouple(seats) {
    const maxCol = seats.reduce((mx, s) => Math.max(mx, s.col), 0);
    const centerStart = Math.floor(maxCol * 0.3);
    const centerEnd = Math.ceil(maxCol * 0.7);
    const seatSet = new Set(seats.map((s) => `${s.row},${s.col}`));

    return seats.filter((s) => {
      if (s.col < centerStart || s.col > centerEnd) return false;
      const hasLeft = seatSet.has(`${s.row},${s.col - 1}`);
      const hasRight = seatSet.has(`${s.row},${s.col + 1}`);
      return hasLeft || hasRight;
    });
  }

  /**
   * 家庭票：优先中后排连续座位
   * - 行位于中后排 (>= 50% 排位置)
   * - 所在行存在连续 need 个可用座位
   */
  _filterFamily(seats, need) {
    const maxRow = seats.reduce((mx, s) => Math.max(mx, s.row), 0);
    const middleRow = Math.floor(maxRow * 0.5);
    const middleBack = seats.filter((s) => s.row >= middleRow);
    return middleBack.filter((s) => this._hasContiguous(s, middleBack, need));
  }

  /**
   * 团体票(5-20人)：同排连续空位
   * - 所在行存在连续 count 个可用座位
   * - 老人/少年子规则已在 _applyAgeRules 中应用
   */
  _filterGroup(seats, need) {
    return seats.filter((s) => this._hasContiguous(s, seats, need));
  }

  /**
   * 检查向右连续 need 个可用座位（含自身）
   */
  _hasContiguous(seat, seats, need) {
    if (need <= 1) return true;
    const seatSet = new Set(seats.map((s) => `${s.row},${s.col}`));
    for (let i = 0; i < need; i++) {
      if (!seatSet.has(`${seat.row},${seat.col + i}`)) return false;
    }
    return true;
  }
}
