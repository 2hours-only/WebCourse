export class AccessibilityManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.config = {
      fontSize: "normal", // normal, large, xlarge
      highContrast: false,
      colorBlindMode: "normal", // normal, protanopia, deuteranopia
    };
  }

 
  _updateClasses() {
    document.body.className = ""; // 清空
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
    // size: 'normal' | 'large' | 'xlarge'
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
    // type: 'normal' | 'protanopia' | 'deuteranopia'
    console.log(`[UI] Accessibility setColorBlindMode: ${type}`);
    this.config.colorBlindMode = type;
    this._updateClasses();
  }

  //语音提示可选
  enableVoicePrompt(enabled) {
    console.log(`[UI] Accessibility enableVoicePrompt: ${enabled}`);
    if (enabled) {

    }
  }
}
