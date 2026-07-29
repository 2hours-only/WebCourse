import { AppConfig } from "../utils/config.js";

/**
 * accessibility.js — 无障碍模式
 *
 * 大字体 / 高对比度 / 色盲友好 / 语音提示,对应作业模块5(10分)。
 *
 * ── 这个文件里最关键的一件事 ──────────────────────────────
 * 座位图是 Canvas 画的,CSS 选择器碰不到它。原来的实现只切 body 的类,
 * 于是「高对比度」「色盲友好」对占了半个屏幕的座位图完全没有效果。
 *
 * 解决办法:renderer.js 的 _renderSeat 读的是 AppConfig.colors,
 * heatmap.js 的 _getHeatColor 读的是 AppConfig.heatmap,而且两者都是在
 * 【每帧绘制时】才读、不在构造时缓存。所以这里只要原地改写 AppConfig
 * 的字段,下一次重绘座位就会换色 —— renderer.js / heatmap.js / config.js
 * 一行都不用动。
 *
 * 重绘由谁触发:_updateClasses() 会 emit("accessibility:change"),
 * main.js 已有的监听器收到后调 renderer.render()。链路本来就是通的。
 * ────────────────────────────────────────────────────────
 */

/**
 * 调色板表。
 *
 * 这里的取值必须和 css/theme.css 里的 --seat-* / --heat-* 令牌【逐个对应】,
 * 否则右侧图例的小色块会和座位图上的实际颜色对不上。改一边就要改另一边。
 */
const PALETTES = {
  /* 默认:深色影院风 */
  normal: {
    colors: {
      free: "#2E9E63",
      selected: "#E5B567",
      sold: "#C33A3A",
      recommended: "#4C8DFF",
      hover: "#3FBF7C",
    },
    heatmap: {
      hot: "#FF4D4F",
      warm: "#FFB020",
      cold: "#3B82F6",
    },
  },

  /* 高对比度:最大饱和度 + 最大明度差,给低视力用户 */
  highContrast: {
    colors: {
      free: "#00E676",
      selected: "#FFD400",
      sold: "#FF2D2D",
      recommended: "#00E5FF",
      hover: "#FFFFFF",
    },
    heatmap: {
      hot: "#FF2D2D",
      warm: "#FFD400",
      cold: "#00E5FF",
    },
  },

  /* 色盲友好:Okabe-Ito 配色,彻底避开红/绿对(红绿色盲占绝大多数) */
  colorblind: {
    colors: {
      free: "#0072B2",
      selected: "#F0E442",
      sold: "#D55E00",
      recommended: "#CC79A7",
      hover: "#56B4E9",
    },
    heatmap: {
      hot: "#D55E00",
      warm: "#F0E442",
      cold: "#0072B2",
    },
  },
};

const STORAGE_KEY = "sc_a11y";

const DEFAULT_CONFIG = {
  fontSize: "normal",
  highContrast: false,
  colorBlindMode: "normal",
  voice: false,
  // 热力图图层是否可见。对应「说明与分工」里 accessibility.js 的「简化UI模式」职责。
  heatmap: true,
};

/** 关掉热力图时用的全透明色,见 applyPalette 的说明 */
const HEATMAP_OFF = {
  hot: "rgba(0,0,0,0)",
  warm: "rgba(0,0,0,0)",
  cold: "rgba(0,0,0,0)",
};

/** 从 localStorage 读回上次的无障碍设置,读不到就用默认值 */
function readStoredConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      return { ...DEFAULT_CONFIG, ...saved };
    }
  } catch (e) {
    console.warn("[UI] 无障碍设置读取失败,使用默认值", e);
  }
  return { ...DEFAULT_CONFIG };
}

/** 按配置挑一套调色板写进 AppConfig。高对比度优先级高于色盲模式。 */
function applyPalette(config) {
  let name = "normal";
  if (config.highContrast) name = "highContrast";
  else if (config.colorBlindMode !== "normal") name = "colorblind";

  const palette = PALETTES[name];
  // 原地改字段而不是整体换对象:万一别处缓存了 AppConfig.colors 的引用也不会失联
  Object.assign(AppConfig.colors, palette.colors);

  // 热力图是画在座位【下面】的一层光晕,座位方块不透明会把中心盖住,
  // 只剩一圈彩色边漏在外面,和座位本身的颜色混在一起很难读。
  // 关掉它的办法:把三档热度色都换成全透明 —— heatmap.js 的 _getHeatColor
  // 返回值直接拿去当 createRadialGradient 的色标,全透明就等于整层不可见,
  // 同样不需要改 heatmap.js。
  Object.assign(
    AppConfig.heatmap,
    config.heatmap === false ? HEATMAP_OFF : palette.heatmap,
  );
}

/**
 * ⚠️ 模块加载时立即执行一次。
 *
 * 不能只在构造函数里做:main.js 的 initMainApplication 是先
 * renderer.render() 画完第一帧、再 new AccessibilityManager 的,
 * 那时候才改调色板,首屏会先闪一下旧配色。
 * ES module 的 import 在 main.js 的代码体之前求值,所以放在这里
 * 能保证任何一次绘制之前调色板就已经就位。
 *
 * 顺带一提,这一步同时把热力图冷区从 config.js 默认的绿色 #4CAF50
 * 改成了蓝色 —— 作业说明明确要求「红色热门 / 黄色一般 / 蓝色冷门」,
 * 而绿色既违反要求、又和空座的绿撞色。这属于运行时修正组长的 config,
 * 需要同步告知他(彻底的解法是直接改 config.js 那一行)。
 */
applyPalette(readStoredConfig());

/**
 * 模块级当前实例。
 * panel.js 需要在「推荐完成」这些时刻播报,但它拿不到 main.js 里
 * new 出来的那个 AccessibilityManager。构造时在这里登记一下,
 * panel.js 用 getAccessibility() 取即可,不用改 main.js 的构造流程。
 */
let currentInstance = null;

/** 取当前的无障碍管理器(可能为 null,登录前还没创建) */
export function getAccessibility() {
  return currentInstance;
}

export class AccessibilityManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.config = readStoredConfig();

    currentInstance = this;

    this._bindVoiceEvents();
    this._updateClasses();
  }

  // ==================== 持久化 ====================

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn("[UI] 无障碍设置保存失败", e);
    }
  }

  // ==================== CSS 类 ====================

  _updateClasses() {
    const body = document.body;

    // 原实现这里是 body.className = "",会把别的模块加在 body 上的类
    // 一并清空。改成只增删自己管的这几个类。
    body.classList.remove(
      "accessibility-large-font",
      "accessibility-normal-font",
      "accessibility-high-contrast",
      "accessibility-colorblind",
    );

    if (this.config.fontSize !== "normal") {
      body.classList.add(`accessibility-${this.config.fontSize}-font`);
    }
    if (this.config.highContrast) {
      body.classList.add("accessibility-high-contrast");
    }
    if (this.config.colorBlindMode !== "normal") {
      // 统一用这一个类名。原实现加的是 accessibility-protanopia,
      // 而 CSS 里写的是 .accessibility-colorblind,两边对不上,永远不生效。
      body.classList.add("accessibility-colorblind");
    }

    applyPalette(this.config);
    this._persist();

    // main.js 收到后会 renderer.render(),座位与热力图随之换色
    this.eventBus.emit("accessibility:change", this.config);
  }

  // ==================== 公开接口 ====================

  setFontSize(size) {
    this.config.fontSize = size === "large" ? "large" : "normal";
    this._updateClasses();
    this.speak(
      this.config.fontSize === "large" ? "已开启大字体" : "已恢复标准字体",
    );
  }

  setHighContrast(enabled) {
    this.config.highContrast = !!enabled;
    this._updateClasses();
    this.speak(enabled ? "已开启高对比度模式" : "已关闭高对比度模式");
  }

  /**
   * @param {'normal'|'protanopia'|'deuteranopia'} type
   * 红色盲和绿色盲用同一套 Okabe-Ito 配色即可,不必分开处理。
   */
  setColorBlindMode(type) {
    this.config.colorBlindMode = type || "normal";
    this._updateClasses();
    this.speak(
      this.config.colorBlindMode === "normal"
        ? "已关闭色盲友好模式"
        : "已开启色盲友好模式",
    );
  }

  /**
   * 热力图图层开关。关掉之后座位状态(可选/已选/已售/推荐)看得更清楚。
   * @param {boolean} visible
   */
  setHeatmapVisible(visible) {
    this.config.heatmap = !!visible;
    this._updateClasses();
    this.speak(visible ? "已显示观众热度" : "已隐藏观众热度");
  }

  enableVoicePrompt(enabled) {
    this.config.voice = !!enabled;
    this._persist();
    this.eventBus.emit("accessibility:change", this.config);
    if (this.config.voice) {
      // 先说一句,顺便验证浏览器确实能出声
      this.speak("语音提示已开启");
    } else if (this._synth()) {
      this._synth().cancel();
    }
  }

  getConfig() {
    return this.config;
  }

  // ==================== 语音 ====================

  _synth() {
    return typeof window !== "undefined" && window.speechSynthesis
      ? window.speechSynthesis
      : null;
  }

  /**
   * 播报一句话。未开启语音提示时是空操作,调用方不用自己判断。
   * 用浏览器内置的 SpeechSynthesis,不引第三方库。
   */
  speak(text) {
    // 登出再登录会重新 new 一个实例,而 EventBus 没有 off(),
    // 旧实例的监听器还挂在上面。不加这道判断会出现同一句话念好几遍。
    if (currentInstance !== this) return;
    if (!this.config.voice || !text) return;
    const synth = this._synth();
    if (!synth) return;

    // 连续点座位时会堆积一串待播报,先取消上一句,只念最新的
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = "zh-CN";
    utter.rate = 1.05;
    synth.speak(utter);
  }

  /**
   * 自己订阅事件来播报,而不是让 main.js 逐处调用。
   * 这样接线不需要改 main.js,也符合「UI 层监听用户操作」的分层约定。
   */
  _bindVoiceEvents() {
    if (!this.eventBus) return;

    this.eventBus.on("seat:clicked", (payload) => {
      if (!this.config.voice || !payload) return;
      const seats = payload.seats || (payload.seat ? [payload.seat] : []);
      if (seats.length === 0) return;

      if (seats.length === 1) {
        const s = seats[0];
        const action = s.status === "selected" ? "已取消" : "已选中";
        this.speak(`${action} ${s.row + 1}排${s.col + 1}座`);
      } else {
        this.speak(`已选中 ${seats.length} 个座位`);
      }
    });

    this.eventBus.on("user:purchase", () => {
      this.speak("正在为你出票");
    });

    this.eventBus.on("hall:switch", (hallType) => {
      const names = { small: "小厅", medium: "中厅", large: "大厅" };
      this.speak(`已切换到${names[hallType] || "放映厅"}`);
    });
  }
}
