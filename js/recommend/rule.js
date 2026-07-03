export class RuleEngine {
  constructor() {
    console.log("[Recommend] RuleEngine created");
  }

  // 接口定义：applyRules(userPreference, seats)
  applyRules(userPreference, seats) {
    console.log("[Recommend] applyRules called", userPreference);
    return seats;
  }
}
