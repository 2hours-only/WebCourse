export class RuleEngine {
  constructor() {
    console.log("[Recommend] RuleEngine created");
  }

  applyRules(userPreference, seats) {
    console.log("[Recommend] applyRules called", userPreference);
    return seats;
  }
}
