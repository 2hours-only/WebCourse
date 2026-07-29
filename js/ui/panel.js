import { AppConfig } from "../utils/config.js";
import { dialog, ratingControlsHtml, bindRatingControls } from "./dialog.js";
import { getAccessibility } from "./accessibility.js";

/**
 * panel.js — 左右面板与所有界面结构
 *
 * ── 关于 _enhanceDOM ────────────────────────────────────
 * index.html 属于组长负责的文件,本轮约定不改动它。所以这里采取
 * 「渐进增强」的做法:构造时把 index.html 那副骨架在运行时升级一遍
 * (补 logo、座位图例、无障碍开关组、分区标题、把 API Key 收进折叠区)。
 *
 * 好处是组长之后再改 index.html 也不会和这边冲突;
 * 代价是所有注入代码都要对元素缺失做判空 —— 下面每处都做了。
 * ────────────────────────────────────────────────────────
 */

/** 拼进 innerHTML 之前一律转义,用户名和成员姓名都是用户可控内容 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 全项目统一的座位说法:「3排7座」 */
function seatLabel(seat) {
  return `${seat.row + 1}排${seat.col + 1}座`;
}

/** 座位在评分表里的键,格式见 接口表.md:325 */
function seatId(seat) {
  return `r${seat.row}c${seat.col}`;
}

function seatPrice(seat) {
  return seat.price || AppConfig.price.basePrice;
}

const ORDER_STATUS_TEXT = {
  paid: "已支付",
  pending: "待支付",
  cancelled: "已取消",
  refunded: "已退票",
};

export class UIPanel {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.loginLayer = document.getElementById("login-layer");
    this.mainContainer = container;
    this.recommendBtn = this.mainContainer
      ? this.mainContainer.querySelector("#recommend-btn")
      : null;
    this.recommendActive = false;
    this.ratingSeat = null;

    console.log("[UI] Panel created");
    this._enhanceDOM();
    this.bindDOMEvents();
    this._bindAccessibilityUI();
  }

  // ============================================================
  // 渐进增强:把 index.html 的骨架在运行时升级成完整界面
  // ============================================================

  _enhanceDOM() {
    this._enhanceLogin();
    this._enhanceHeader();
    this._enhanceLeftPanel();
    this._enhanceCinema();
    this._enhanceRightPanel();
  }

  _enhanceLogin() {
    const box = this.loginLayer
      ? this.loginLayer.querySelector(".login-box")
      : null;
    if (!box || box.dataset.enhanced) return;

    const heading = box.querySelector("h2");
    if (heading) {
      const brand = document.createElement("div");
      brand.className = "login-box__brand";
      brand.innerHTML = `<span class="sc-brand__dot"></span><span>SmartCinema</span>`;
      box.insertBefore(brand, heading);

      const sub = document.createElement("p");
      sub.className = "login-box__sub";
      sub.textContent = "登录后即可选座购票,三步完成。";
      heading.insertAdjacentElement("afterend", sub);
    }

    // 把登录/注册两个按钮并成一行
    const loginBtn = box.querySelector("#login-btn");
    const registerBtn = box.querySelector("#register-btn");
    if (loginBtn && registerBtn) {
      const actions = document.createElement("div");
      actions.className = "login-box__actions";
      loginBtn.classList.add("btn", "btn-primary");
      registerBtn.classList.add("btn", "btn-secondary");
      loginBtn.parentNode.insertBefore(actions, loginBtn);
      actions.appendChild(loginBtn);
      actions.appendChild(registerBtn);

      const hint = document.createElement("p");
      hint.className = "login-box__hint";
      hint.innerHTML = `首次使用请先注册 · 管理员账号 <code>admin / admin</code>`;
      actions.insertAdjacentElement("afterend", hint);
    }

    box.dataset.enhanced = "1";
  }

  _enhanceHeader() {
    const header = document.getElementById("user-header");
    if (!header || header.dataset.enhanced) return;

    // logo 放最左
    const brand = document.createElement("div");
    brand.className = "sc-brand";
    brand.innerHTML = `
      <span class="sc-brand__dot"></span>
      <span class="sc-brand__name">Smart<em>Cinema</em></span>
    `;
    header.insertBefore(brand, header.firstChild);

    // 右侧动作区:无障碍开关组 + 用户名 + 登出
    const actions = document.createElement("div");
    actions.className = "sc-header-actions";

    const a11yGroup = document.createElement("div");
    a11yGroup.className = "a11y-group";
    a11yGroup.setAttribute("role", "group");
    a11yGroup.setAttribute("aria-label", "无障碍设置");

    // #font-toggle 已经在 index.html 里且 bindDOMEvents 会给它绑监听,
    // 所以是「搬过来」而不是新建,避免监听器丢失。
    const fontToggle = document.getElementById("font-toggle");
    if (fontToggle) {
      fontToggle.className = "a11y-btn";
      fontToggle.textContent = "大字体";
      fontToggle.dataset.a11y = "font";
      a11yGroup.appendChild(fontToggle);
    }

    [
      { key: "contrast", text: "高对比度" },
      { key: "colorblind", text: "色盲友好" },
      { key: "voice", text: "语音" },
    ].forEach(({ key, text }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "a11y-btn";
      btn.dataset.a11y = key;
      btn.textContent = text;
      btn.setAttribute("aria-pressed", "false");
      a11yGroup.appendChild(btn);
    });

    actions.appendChild(a11yGroup);

    const usernameSpan = document.getElementById("current-username");
    if (usernameSpan) actions.appendChild(usernameSpan);
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) actions.appendChild(logoutBtn);

    header.appendChild(actions);
    header.dataset.enhanced = "1";
  }

  _enhanceLeftPanel() {
    const left = this.container
      ? this.container.querySelector(".left-panel")
      : null;
    if (!left || left.dataset.enhanced) return;

    // 给三个区块加上分区标题
    this._prependTitle(left.querySelector("#hall-selection-area"), "场次");
    this._prependTitle(left.querySelector("#user-input-area"), "购票信息");

    // index.html 里 #user-input-area 开头有一句占位的「用户输入区」,
    // 有了分区标题就多余了
    const placeholder = left.querySelector("#user-input-area > p");
    if (placeholder && placeholder.textContent.trim() === "用户输入区") {
      placeholder.remove();
    }

    // API Key 是可选的高级功能,裸露在主流程上会干扰「别让用户思考」,
    // 收进折叠区,默认收起
    const apiArea = document.getElementById("api-key-area");
    const aiBtn = document.getElementById("ai-recommend-btn");
    if (apiArea && aiBtn) {
      const details = document.createElement("details");
      details.className = "sc-details";
      details.innerHTML = `<summary>AI 观影顾问</summary>`;
      const body = document.createElement("div");
      body.className = "sc-details__body";
      details.appendChild(body);

      apiArea.parentNode.insertBefore(details, apiArea);
      body.appendChild(apiArea);
      body.appendChild(aiBtn);
    }

    // 左栏原来的「无障碍 / 大字体」区块已由顶栏开关组接管
    const a11yArea = left.querySelector("#accessibility-area");
    if (a11yArea) a11yArea.remove();

    left.dataset.enhanced = "1";
  }

  _prependTitle(section, text) {
    if (!section || section.querySelector(".panel__title")) return;
    section.classList.add("panel");
    const title = document.createElement("div");
    title.className = "panel__title";
    title.textContent = text;
    section.insertBefore(title, section.firstChild);
  }

  _enhanceCinema() {
    const cinema = this.container
      ? this.container.querySelector(".cinema-container")
      : null;
    if (!cinema || cinema.dataset.enhanced) return;

    // 座位图例。原来完全没有,用户看到一片彩色方块并不知道哪个是什么意思。
    //
    // 分成两组是有原因的:画布上其实是【两个图层】叠着 ——
    // 热力图先画成一层光晕,不透明的座位方块再盖在上面,
    // 所以热度只以一圈彩边的形式漏在座位外围。
    // 排成一行会让人误以为是 7 种并列的座位状态,必须分组并标明层次。
    const legend = document.createElement("div");
    legend.className = "seat-legend";
    legend.innerHTML = `
      <span class="legend-group">
        <span class="legend-group__label">座位</span>
        <span class="legend-item"><i class="legend-dot legend-dot--free"></i>可选</span>
        <span class="legend-item"><i class="legend-dot legend-dot--selected"></i>已选</span>
        <span class="legend-item"><i class="legend-dot legend-dot--sold"></i>已售</span>
        <span class="legend-item"><i class="legend-dot legend-dot--recommended"></i>推荐</span>
      </span>
      <span class="legend-sep"></span>
      <span class="legend-group" data-role="heat-group">
        <span class="legend-group__label">热度<span class="legend-group__hint">(座位外圈光晕)</span></span>
        <span class="legend-item"><i class="legend-dot legend-dot--hot"></i>热门</span>
        <span class="legend-item"><i class="legend-dot legend-dot--warm"></i>一般</span>
        <span class="legend-item"><i class="legend-dot legend-dot--cold"></i>冷门</span>
        <button type="button" class="btn btn-ghost legend-toggle" data-role="heat-toggle"
                aria-pressed="true">隐藏</button>
      </span>
    `;
    cinema.appendChild(legend);

    const heatToggle = legend.querySelector('[data-role="heat-toggle"]');
    if (heatToggle) {
      heatToggle.addEventListener("click", () => {
        const a11y = getAccessibility();
        if (!a11y) return;
        a11y.setHeatmapVisible(!a11y.getConfig().heatmap);
      });
    }

    cinema.dataset.enhanced = "1";
  }

  _enhanceRightPanel() {
    const right = this.container
      ? this.container.querySelector(".right-panel")
      : null;
    if (!right || right.dataset.enhanced) return;

    const sections = [
      ["#recommend-result", "智能推荐"],
      ["#selected-seats", "已选座位"],
      ["#order-info", "订单"],
    ];

    sections.forEach(([selector, text]) => {
      const el = right.querySelector(selector);
      if (!el) return;
      const wrapper = document.createElement("div");
      wrapper.className = "panel";
      const title = document.createElement("div");
      title.className = "panel__title";
      title.textContent = text;
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(title);
      wrapper.appendChild(el);
    });

    right.dataset.enhanced = "1";
  }

  // ============================================================
  // 事件绑定
  // ============================================================

  bindDOMEvents() {
    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        const data = this.getLoginInput();
        data.action = "login";
        this.eventBus.emit("user:login", data);
      });
    }

    const registerBtn = document.getElementById("register-btn");
    if (registerBtn) {
      registerBtn.addEventListener("click", () => {
        const data = this.getLoginInput();
        data.action = "register";
        this.eventBus.emit("user:register", data);
      });
    }

    // 回车直接登录,少一次鼠标移动
    const passwordInput = document.getElementById("login-password");
    if (passwordInput) {
      passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && loginBtn) loginBtn.click();
      });
    }

    const recommendBtn = this.container.querySelector("#recommend-btn");
    if (recommendBtn) {
      recommendBtn.addEventListener("click", () => {
        if (this.recommendActive) {
          this.eventBus.emit("user:recommend", { action: "cancel" });
        } else {
          const userInput = this.getUserInput();
          userInput.action = "recommend";
          this.eventBus.emit("user:recommend", userInput);
        }
      });
    }

    const aiRecommendBtn = document.getElementById("ai-recommend-btn");
    if (aiRecommendBtn) {
      aiRecommendBtn.addEventListener("click", () => {
        const apiKeyInput = document.getElementById("api-key-input");
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";

        if (!apiKey) {
          dialog.showError("请先在上方填入你的 AI API Key");
          return;
        }

        this.eventBus.emit("ai:recommend", {
          apiKey,
          userInput: this.getUserInput(),
        });
      });
    }

    const purchaseBtn = this.container.querySelector("#purchase-btn");
    if (purchaseBtn) {
      purchaseBtn.addEventListener("click", () => {
        // 购票确认弹窗在这里拦一道再放行。
        // main.js 的 user:purchase 处理器是收到事件就直接建单扣款,
        // 在它前面加确认既不用改 main.js,也避免误点直接出票。
        const seats = this.selectedSeats || [];
        if (seats.length === 0) {
          dialog.showError("请先选择座位");
          return;
        }
        const total = seats.reduce((sum, s) => sum + seatPrice(s), 0);
        const list = seats.map(seatLabel).join("、");

        dialog
          .showConfirm(
            `即将购买 <strong>${escapeHtml(list)}</strong>,共 ${seats.length} 张,合计 <strong>¥${total}</strong>。`,
            { title: "确认购票", confirmText: "确认支付" },
          )
          .then((ok) => {
            if (ok) this.eventBus.emit("user:purchase");
          });
      });
    }

    const hallSelect = document.getElementById("hall-select");
    if (hallSelect) {
      hallSelect.addEventListener("change", () => {
        this.eventBus.emit("hall:switch", this.getHallSelection());
      });
    }

    const dateSelect = document.getElementById("date-select");
    if (dateSelect) {
      dateSelect.innerHTML = "";
      this.dateOptions = [];
      const today = new Date();
      const weekdayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayOfWeek = date.getDay();
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `${dateStr} ${weekdayMap[dayOfWeek]}`;
        dateSelect.appendChild(option);
        this.dateOptions.push({ dayOfWeek, dateStr });
      }
      dateSelect.addEventListener("change", () => {
        this.eventBus.emit("date:switch", parseInt(dateSelect.value, 10));
      });
    }

    const fontToggle = document.getElementById("font-toggle");
    if (fontToggle) {
      fontToggle.addEventListener("click", () => {
        this.eventBus.emit("accessibility:toggle-font");
      });
    }

    // 团体票才需要填成员信息
    const typeSelect = document.getElementById("type-select");
    if (typeSelect) {
      typeSelect.addEventListener("change", () => {
        const memberArea = document.getElementById("member-info-area");
        if (memberArea) {
          memberArea.classList.toggle("hidden", typeSelect.value !== "group");
        }
      });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        this.eventBus.emit("user:logout");
      });
    }

    // 后台的退票按钮是动态渲染的,用事件委托
    this.container.addEventListener("click", (e) => {
      const refundBtn = e.target.closest(".btn-refund");
      if (!refundBtn) return;
      const orderId = refundBtn.getAttribute("data-order-id");
      if (!orderId) return;

      dialog
        .showConfirm(
          `确定要为订单 <strong>${escapeHtml(orderId.slice(-6))}</strong> 办理退票吗?座位会重新放出。`,
          { title: "确认退票", confirmText: "确认退票", danger: true },
        )
        .then((ok) => {
          if (ok) this.eventBus.emit("admin:refund-order", orderId);
        });
    });
  }

  /**
   * 顶栏无障碍开关组。
   * AccessibilityManager 是 main.js 在登录之后才 new 的,这里拿不到,
   * 所以用 getAccessibility() 在点击时惰性取当前实例。
   */
  _bindAccessibilityUI() {
    const group = document.querySelector(".a11y-group");
    if (!group) return;

    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".a11y-btn");
      if (!btn) return;

      const a11y = getAccessibility();
      // 大字体走 eventBus(main.js 已有对应处理),其余三项直接调管理器
      if (btn.dataset.a11y === "font") return;

      if (!a11y) {
        dialog.showError("请先登录后再使用无障碍设置");
        return;
      }

      const cfg = a11y.getConfig();
      switch (btn.dataset.a11y) {
        case "contrast":
          a11y.setHighContrast(!cfg.highContrast);
          break;
        case "colorblind":
          a11y.setColorBlindMode(
            cfg.colorBlindMode === "normal" ? "deuteranopia" : "normal",
          );
          break;
        case "voice":
          a11y.enableVoicePrompt(!cfg.voice);
          break;
      }
    });

    // 开关的高亮状态跟着实际配置走
    this.eventBus.on("accessibility:change", (cfg) => {
      this._syncAccessibilityButtons(cfg);
    });
  }

  _syncAccessibilityButtons(cfg) {
    if (!cfg) return;
    const map = {
      font: cfg.fontSize === "large",
      contrast: !!cfg.highContrast,
      colorblind: cfg.colorBlindMode !== "normal",
      voice: !!cfg.voice,
    };
    Object.entries(map).forEach(([key, on]) => {
      const btn = document.querySelector(`.a11y-btn[data-a11y="${key}"]`);
      if (!btn) return;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });

    // 热力图关掉时,那三个热度色块也一起淡下去,否则图例在说谎
    const heatOn = cfg.heatmap !== false;
    const heatGroup = document.querySelector('[data-role="heat-group"]');
    if (heatGroup) heatGroup.classList.toggle("is-off", !heatOn);
    const heatToggle = document.querySelector('[data-role="heat-toggle"]');
    if (heatToggle) {
      heatToggle.textContent = heatOn ? "隐藏" : "显示";
      heatToggle.setAttribute("aria-pressed", String(heatOn));
    }
  }

  // ============================================================
  // 读取输入
  // ============================================================

  getLoginInput() {
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    return {
      username: usernameInput ? usernameInput.value : "",
      password: passwordInput ? passwordInput.value : "",
    };
  }

  getHallSelection() {
    const select = document.getElementById("hall-select");
    return select ? select.value : "small";
  }

  getDateSelection() {
    const select = document.getElementById("date-select");
    const index = select ? parseInt(select.value, 10) : 0;
    if (this.dateOptions && this.dateOptions[index]) {
      return this.dateOptions[index];
    }
    const today = new Date();
    return { dayOfWeek: today.getDay(), dateStr: "未知" };
  }

  getUserInput() {
    const ageSelect = document.getElementById("age-select");
    const countInput = document.getElementById("people-count");
    const typeSelect = document.getElementById("type-select");
    const memberInfoInput = document.getElementById("member-info");

    let memberInfo = [];
    const type = typeSelect ? typeSelect.value : "personal";

    if (type === "group" && memberInfoInput && memberInfoInput.value) {
      memberInfo = memberInfoInput.value
        .split(",")
        .map((item) => {
          const parts = item.trim().split(":");
          return {
            name: parts[0] ? parts[0].trim() : "未知",
            age: parts[1] ? parseInt(parts[1].trim(), 10) || 20 : 20,
          };
        })
        .filter((m) => m.name);
    }

    return {
      age: ageSelect ? ageSelect.value : "adult",
      count: countInput ? parseInt(countInput.value, 10) || 1 : 1,
      type,
      memberInfo,
      date: this.getDateSelection(),
    };
  }

  // ============================================================
  // 视图切换
  // ============================================================

  setRecommendButtonActive(active) {
    this.recommendActive = !!active;
    if (!this.recommendBtn) return;
    this.recommendBtn.textContent = this.recommendActive
      ? "取消智能推荐"
      : "智能推荐";
    this.recommendBtn.classList.toggle("btn-secondary", this.recommendActive);
    this.recommendBtn.classList.toggle("btn-primary", !this.recommendActive);
  }

  clearRecommendation() {
    this.setRecommendation([]);
  }

  switchView(viewName) {
    console.log(`[UI] Switching to view: ${viewName}`);
    if (viewName === "login") {
      if (this.loginLayer) this.loginLayer.classList.remove("hidden");
      if (this.mainContainer) this.mainContainer.classList.add("hidden");
      this.setCurrentUser("");
      return;
    }

    if (this.loginLayer) this.loginLayer.classList.add("hidden");
    if (this.mainContainer) this.mainContainer.classList.remove("hidden");

    if (viewName === "admin") return;

    // 原实现在这里设 element.style.display = "flex"。内联样式会压过
    // 样式表,响应式断点里的 flex-direction 之类就再也改不动了,
    // 所以改成切类。
    ["left-panel", "cinema-container", "right-panel"].forEach((cls) => {
      const el = this.mainContainer.querySelector(`.${cls}`);
      if (el) el.classList.remove("is-hidden");
    });

    this.setRecommendation([]);
    this.setSelectedSeats([]);
    const orderDiv = document.getElementById("order-info");
    if (orderDiv) {
      orderDiv.innerHTML = `<p class="empty-hint">还没有订单</p>`;
    }
  }

  // ============================================================
  // 右栏渲染
  // ============================================================

  setRecommendation(seats, reason = "") {
    const resultDiv = document.getElementById("recommend-result");
    if (resultDiv) {
      if (seats && seats.length > 0) {
        const score = Math.round(seats[0]?.score || 0);
        const grade = seats[0]?.recommendGrade || this._gradeOf(score);
        const shown = seats.slice(0, 5).map(seatLabel).join("、");

        resultDiv.innerHTML = `
          <div class="rec-card">
            <div class="rec-card__head">
              <div>
                <div class="rec-card__seats">${escapeHtml(shown)}${
                  seats.length > 5
                    ? `<span class="rec-card__more"> 等 ${seats.length} 座</span>`
                    : ""
                }</div>
                <span class="badge badge--${this._gradeClass(grade)}">${escapeHtml(grade)}</span>
              </div>
              <div class="rec-card__score" style="--score:${score}">
                <span>${score}</span>
              </div>
            </div>
            ${
              reason
                ? `<div class="rec-card__reason">${escapeHtml(reason)}</div>`
                : ""
            }
          </div>
        `;

        const a11y = getAccessibility();
        if (a11y) {
          a11y.speak(`已为你推荐 ${shown},评分 ${score} 分,${grade}`);
        }
      } else {
        resultDiv.innerHTML = `<p class="empty-hint">填好左侧信息后点「智能推荐」</p>`;
      }
    }
    this.setRecommendButtonActive(seats && seats.length > 0);
  }

  _gradeOf(score) {
    if (score >= 85) return "极佳";
    if (score >= 70) return "优秀";
    return "一般";
  }

  _gradeClass(grade) {
    if (grade === "极佳") return "excellent";
    if (grade === "优秀") return "good";
    return "normal";
  }

  /**
   * 已选座位列表。每一行带「✕ 移除」和「★ 评分」两个操作。
   *
   * @param {Array} seats 已选座位
   * @param {(seat)=>void} [onRemove] 移除回调。main.js 目前没有传,
   *        此时走 fallback:直接 emit seat:clicked。main.js 已有的
   *        seat:clicked 处理器在座位处于 selected 时会把它改回 available
   *        并移出 selectedSeats —— 正好就是「移除」语义,所以不用改 main.js。
   */
  setSelectedSeats(seats, onRemove = null) {
    const selectedDiv = document.getElementById("selected-seats");
    const list = seats || [];
    // 购票确认弹窗要用到当前选座,存一份
    this.selectedSeats = list;

    if (selectedDiv) {
      if (list.length > 0) {
        const total = list.reduce((sum, s) => sum + seatPrice(s), 0);
        selectedDiv.innerHTML = `
          <div class="seat-chip-list">
            ${list
              .map(
                (s) => `
              <div class="seat-chip" data-seat="${seatId(s)}">
                <span class="seat-chip__label">${seatLabel(s)}</span>
                <span class="seat-chip__price">¥${seatPrice(s)}</span>
                <span class="seat-chip__actions">
                  <button type="button" class="icon-btn icon-btn--rate"
                          data-act="rate" title="为这个座位评分" aria-label="为 ${seatLabel(s)} 评分">★</button>
                  <button type="button" class="icon-btn icon-btn--remove"
                          data-act="remove" title="取消选择" aria-label="取消 ${seatLabel(s)}">✕</button>
                </span>
              </div>`,
              )
              .join("")}
          </div>
          <div class="total-row">
            <span class="total-row__label">合计 ${list.length} 张</span>
            <span class="total-row__value">¥${total}</span>
          </div>
        `;

        // 每次重渲染都重新绑定,座位对象从闭包里取,不依赖 DOM 上的 id 反查
        selectedDiv.querySelectorAll(".seat-chip").forEach((chip, index) => {
          const seat = list[index];
          chip
            .querySelector('[data-act="remove"]')
            .addEventListener("click", () => {
              if (typeof onRemove === "function") {
                onRemove(seat);
              } else {
                this.removeSelectedSeat(seat);
              }
            });
          chip
            .querySelector('[data-act="rate"]')
            .addEventListener("click", () => {
              this.showRatingPanel(seat);
            });
        });
      } else {
        selectedDiv.innerHTML = `<p class="empty-hint">点击座位图选座,可 Ctrl+点击多选或框选</p>`;
      }
    }

    const purchaseBtn = document.getElementById("purchase-btn");
    if (purchaseBtn) purchaseBtn.disabled = list.length === 0;

    // 选中的座位变了,之前打开的评分面板就不再对应当前状态,收起来
    if (this.ratingSeat && !list.includes(this.ratingSeat)) {
      this.hideRatingPanel();
    }
  }

  setOrderInfo(order) {
    const orderDiv = document.getElementById("order-info");
    if (!orderDiv) return;

    const seatsInfo = order.seatList.map(seatLabel).join("、");
    orderDiv.innerHTML = `
      <div class="card card--success">
        <h3>购票成功</h3>
        <p><strong>订单号</strong> ${escapeHtml(order.id.slice(-6))}</p>
        <p><strong>用户</strong> ${escapeHtml(order.username || "未知")}</p>
        <p><strong>观影日期</strong> ${escapeHtml(order.date || "未知")}</p>
        <p><strong>座位</strong> ${escapeHtml(seatsInfo)}</p>
        <p><strong>总金额</strong> ¥${order.amount}</p>
        <p><strong>下单时间</strong> ${new Date(order.timestamp).toLocaleString()}</p>
      </div>
    `;
  }

  setCurrentUser(username) {
    const usernameSpan = document.getElementById("current-username");
    if (usernameSpan) {
      usernameSpan.textContent = username ? username : "";
    }
  }

  // ============================================================
  // 观众手动评分
  // ============================================================

  /**
   * 在右栏展开评分面板。
   *
   * 提交时除了调 onRatingSubmit,还会 emit("seat:rating", {seatId, rating})。
   * main.js 里已经有这个事件的监听器(会调 storage.saveUserRating 并重绘),
   * 缺的一直只是发射方 —— 补上这里,评分链路当场就通了,main.js 不用改。
   *
   * @param {object} seat
   * @param {({seatId:string, rating:number})=>void} [onRatingSubmit]
   */
  showRatingPanel(seat, onRatingSubmit) {
    if (!seat) return;
    const host = document.getElementById("selected-seats");
    if (!host) return;

    this.hideRatingPanel();
    this.ratingSeat = seat;

    const wrap = document.createElement("div");
    wrap.id = "seat-rating-panel";
    wrap.innerHTML = `
      <div class="rating-panel__title">为 ${seatLabel(seat)} 打分</div>
      ${ratingControlsHtml(80)}
      <div class="rating-actions">
        <button type="button" class="btn btn-secondary" data-act="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-act="submit">提交</button>
      </div>
    `;
    wrap.className = "rating-panel";
    host.appendChild(wrap);

    const controls = bindRatingControls(wrap, 80);

    wrap.querySelector('[data-act="submit"]').addEventListener("click", () => {
      const rating = controls.get();
      const payload = { seatId: seatId(seat), rating };

      this.eventBus.emit("seat:rating", payload);
      if (typeof onRatingSubmit === "function") onRatingSubmit(payload);

      dialog.showSuccess(`已记录 ${seatLabel(seat)} 的评分:${rating} 分`);
      const a11y = getAccessibility();
      if (a11y) a11y.speak(`已提交评分 ${rating} 分`);

      this.hideRatingPanel();
    });

    wrap
      .querySelector('[data-act="cancel"]')
      .addEventListener("click", () => this.hideRatingPanel());

    wrap.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  hideRatingPanel() {
    const existing = document.getElementById("seat-rating-panel");
    if (existing) existing.remove();
    this.ratingSeat = null;
  }

  /**
   * 取消选中某个座位。
   * 复用 main.js 已有的 seat:clicked 处理逻辑(selected → available),
   * 不需要为「移除」单独造一个事件。
   */
  removeSelectedSeat(seat) {
    if (!seat) return;
    this.eventBus.emit("seat:clicked", {
      seat,
      isMultiSelect: false,
      isShiftSelect: false,
      isDragSelect: false,
    });
  }

  // ============================================================
  // 管理员后台
  // ============================================================

  renderAdminDashboard(orders, users, username = "管理员") {
    this.switchView("admin");
    this.setCurrentUser(username);

    const ordersHtml =
      orders.length > 0
        ? orders
            .map((order) => {
              const status = order.status || "pending";
              return `
            <tr>
              <td>${escapeHtml(order.id.slice(-6))}</td>
              <td>${escapeHtml(order.username || "未知")}</td>
              <td>${escapeHtml(order.date || "未知")}</td>
              <td>¥${order.amount}</td>
              <td>${escapeHtml(order.seatList.map(seatLabel).join("、"))}</td>
              <td><span class="badge badge--${status}">${ORDER_STATUS_TEXT[status] || status}</span></td>
              <td>
                ${
                  status === "paid"
                    ? `<button type="button" class="btn btn-danger btn-refund" data-order-id="${escapeHtml(order.id)}">退票</button>`
                    : "—"
                }
              </td>
            </tr>`;
            })
            .join("")
        : `<tr><td colspan="7" class="empty-hint">暂无订单</td></tr>`;

    const usersHtml = users
      .map(
        (u) => `
          <li>
            <span>${escapeHtml(u.username)}</span>
            <span class="user-list__role">${escapeHtml(u.role)}</span>
          </li>`,
      )
      .join("");

    this.mainContainer.innerHTML = `
      <div class="admin-wrapper">
        <header class="admin-header">
          <div class="sc-brand">
            <span class="sc-brand__dot"></span>
            <h2>管理员控制台</h2>
          </div>
          <div class="sc-header-actions">
            <span id="current-username">${escapeHtml(username)}</span>
            <button type="button" class="btn btn-secondary" id="admin-logout">退出登录</button>
          </div>
        </header>
        <div class="admin-grid">
          <section class="card">
            <h3>订单管理</h3>
            <div class="admin-table-scroll">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>用户名</th>
                    <th>日期</th>
                    <th>金额</th>
                    <th>座位</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>${ordersHtml}</tbody>
              </table>
            </div>
          </section>
          <section class="card">
            <h3>注册用户 (${users.length})</h3>
            <ul class="user-list">${usersHtml}</ul>
          </section>
        </div>
      </div>
    `;

    // 原实现用的是内联 onclick="location.reload()",改成正常的监听器
    const adminLogout = document.getElementById("admin-logout");
    if (adminLogout) {
      adminLogout.addEventListener("click", () => {
        this.eventBus.emit("user:logout");
        location.reload();
      });
    }
  }
}
