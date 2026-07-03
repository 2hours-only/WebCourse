export class AccessibilityManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.config = {
      fontSize: "normal",
      highContrast: false,
      colorBlindMode: "normal",
    };
  }
  _updateClasses() {
    document.body.className = "";
    if (this.config.fontSize !== "normal") {
      document.body.classList.add(`accessibility-${this.config.fontSize}-font`);
    }
    if (this.config.highContrast) {
      document.body.classList.add("accessibility-high-contrast");
    }
    if (this.config.colorBlindMode !== "normal") {
      document.body.classList.add(
        `accessibility-${this.config.colorBlindMode}`,
      );
    }
    this.eventBus.emit("accessibility:change", this.config);
  }
  setFontSize(size) {
    console.log(`[UI] Accessibility setFontSize: ${size}`);
    this.config.fontSize = size;
    this._updateClasses();
  }
  setHighContrast(enabled) {
    console.log(`[UI] Accessibility setHighContrast: ${enabled}`);
    this.config.highContrast = enabled;
    this._updateClasses();
  }
  setColorBlindMode(type) {
    console.log(`[UI] Accessibility setColorBlindMode: ${type}`);
    this.config.colorBlindMode = type;
    this._updateClasses();
  }
  enableVoicePrompt(enabled) {
    console.log(`[UI] Accessibility enableVoicePrompt: ${enabled}`);
    if (enabled) {
    }
  }
  getConfig() {
    console.log(`[UI] Accessibility getConfig`);
    return this.config;
  }
}
