/**
 * dialog.js — 弹窗系统
 *
 * 原实现是裸的 alert() / confirm(),浏览器原生弹窗既做不了深色主题,
 * 也会阻塞主线程。这里换成自建模态,自己往 body 挂根节点,
 * 不需要改 index.html。
 *
 * 对齐 docs/接口表.md:
 *   showConfirm(message)             → Promise<boolean>
 *   showSuccess(message)             → 成功提示
 *   showError(message)               → 错误提示
 *   showRatingDialog(seat, onSubmit) → onSubmit 收 0-100 的评分值
 */

/** 用户名、座位数据都可能带特殊字符,拼进 innerHTML 前一律转义 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 座位编号统一成「3排7座」的说法,和右栏、订单卡保持一致 */
function seatLabel(seat) {
  if (!seat) return "该座位";
  return `${seat.row + 1}排${seat.col + 1}座`;
}

export class DialogManager {
  constructor() {
    this.modalRoot = null;
    this.toastRoot = null;
    this.activeModal = null;
    this.lastFocused = null;
  }

  // ==================== 内部:根节点 ====================

  _ensureModalRoot() {
    if (!this.modalRoot) {
      this.modalRoot = document.createElement("div");
      this.modalRoot.id = "sc-modal-root";
      document.body.appendChild(this.modalRoot);
    }
    return this.modalRoot;
  }

  _ensureToastRoot() {
    if (!this.toastRoot) {
      this.toastRoot = document.createElement("div");
      this.toastRoot.className = "sc-toast-stack";
      this.toastRoot.setAttribute("role", "status");
      // 屏幕阅读器需要在提示出现时播报,但不该打断用户当前操作
      this.toastRoot.setAttribute("aria-live", "polite");
      document.body.appendChild(this.toastRoot);
    }
    return this.toastRoot;
  }

  // ==================== 内部:模态骨架 ====================

  /**
   * 打开一个模态。close(result) 由调用方在按钮回调里执行。
   * @returns {{ backdrop: HTMLElement, modal: HTMLElement, close: Function }}
   */
  _openModal(innerHtml, onClose, { dismissible = true } = {}) {
    // 同时只允许一个模态,后开的顶掉前一个,免得遮罩叠成一片纯黑
    if (this.activeModal) this.activeModal.close(null);

    const root = this._ensureModalRoot();
    this.lastFocused = document.activeElement;

    const backdrop = document.createElement("div");
    backdrop.className = "sc-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "sc-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = innerHtml;

    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    let closed = false;
    const close = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
      if (this.activeModal && this.activeModal.close === close) {
        this.activeModal = null;
      }
      // 焦点还给打开弹窗的那个元素,键盘用户不会迷失位置
      if (this.lastFocused && this.lastFocused.isConnected) {
        this.lastFocused.focus();
      }
      if (onClose) onClose(result);
    };

    // 焦点陷阱:Tab 在弹窗内循环,不会跑到后面的页面上
    const focusables = () =>
      Array.from(
        modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.disabled && el.offsetParent !== null);

    const onKeyDown = (e) => {
      if (e.key === "Escape" && dismissible) {
        e.preventDefault();
        close(null);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    if (dismissible) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close(null);
      });
    }

    // 打开后把焦点移进弹窗,否则键盘用户还停在页面上
    const items = focusables();
    if (items.length > 0) items[0].focus();

    this.activeModal = { backdrop, modal, close };
    return this.activeModal;
  }

  // ==================== 公开接口 ====================

  /**
   * 确认弹窗。
   * @param {string} message 提示内容(可含 <strong> 等简单标签,调用方自行保证内容安全)
   * @param {{title?:string, confirmText?:string, cancelText?:string, danger?:boolean}} [options]
   * @returns {Promise<boolean>} 确认为 true;取消 / Esc / 点遮罩均为 false
   */
  showConfirm(message, options = {}) {
    const {
      title = "确认操作",
      confirmText = "确认",
      cancelText = "取消",
      danger = false,
    } = options;

    return new Promise((resolve) => {
      const html = `
        <div class="sc-modal__title">${escapeHtml(title)}</div>
        <div class="sc-modal__body">${message}</div>
        <div class="sc-modal__actions">
          <button type="button" class="btn btn-secondary" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${escapeHtml(confirmText)}</button>
        </div>
      `;

      const { modal, close } = this._openModal(html, (result) =>
        resolve(result === true),
      );

      modal
        .querySelector('[data-act="ok"]')
        .addEventListener("click", () => close(true));
      modal
        .querySelector('[data-act="cancel"]')
        .addEventListener("click", () => close(false));

      // 确认按钮更常用,默认焦点给它
      modal.querySelector('[data-act="ok"]').focus();
    });
  }

  /** 成功提示 */
  showSuccess(message) {
    this._toast(message, "success", "✓");
  }

  /** 错误提示 */
  showError(message) {
    this._toast(message, "error", "!");
  }

  /** 中性提示(实时座位更新之类的旁路消息用) */
  showInfo(message) {
    this._toast(message, "info", "◆");
  }

  _toast(message, type, icon) {
    const root = this._ensureToastRoot();
    const el = document.createElement("div");
    el.className = `sc-toast sc-toast--${type}`;
    el.innerHTML = `<span class="sc-toast__icon">${icon}</span><span>${escapeHtml(message)}</span>`;
    root.appendChild(el);

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
      // 兜底:prefers-reduced-motion 下动画几乎为 0,animationend 未必可靠
      setTimeout(() => el.remove(), 400);
    };

    const timer = setTimeout(remove, type === "error" ? 4200 : 2800);
    el.addEventListener("click", () => {
      clearTimeout(timer);
      remove();
    });
  }

  /**
   * 评分对话框。观众观影后给座位打分,结果参与后续推荐排序。
   * @param {object} seat 座位对象
   * @param {(rating:number)=>void} onSubmit 回调,参数为 0-100 的整数
   */
  showRatingDialog(seat, onSubmit) {
    const label = seatLabel(seat);
    const html = `
      <div class="sc-modal__title">为 ${escapeHtml(label)} 打分</div>
      <div class="sc-modal__body">这场看得怎么样?你的评分会影响之后给其他观众的推荐。</div>
      ${ratingControlsHtml(80)}
      <div class="sc-modal__actions">
        <button type="button" class="btn btn-secondary" data-act="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-act="ok">提交评分</button>
      </div>
    `;

    const { modal, close } = this._openModal(html, () => {});
    const controls = bindRatingControls(modal, 80);

    modal.querySelector('[data-act="ok"]').addEventListener("click", () => {
      const rating = controls.get();
      close(rating);
      if (typeof onSubmit === "function") onSubmit(rating);
    });
    modal
      .querySelector('[data-act="cancel"]')
      .addEventListener("click", () => close(null));
  }
}

/**
 * 评分控件的 HTML。
 * 右栏内嵌评分面板(panel.js)和评分弹窗用同一套结构,
 * 所以模板和绑定逻辑都放这里导出复用,避免两边各写一遍、改一处漏一处。
 */
export function ratingControlsHtml(initial = 80) {
  return `
    <div class="rating-panel">
      <div class="rating-stars" role="group" aria-label="星级评分">
        ${[1, 2, 3, 4, 5]
          .map(
            (i) =>
              `<button type="button" class="star" data-star="${i}" aria-label="${i} 星">★</button>`,
          )
          .join("")}
      </div>
      <div class="rating-value">
        <span>综合评分</span>
        <strong data-role="value">${initial}</strong>
      </div>
      <input type="range" class="rating-slider" min="0" max="100" step="1"
             value="${initial}" data-role="slider" aria-label="评分 0 到 100" />
    </div>
  `;
}

/**
 * 把星级、滑杆、数字三者绑成联动的一组。
 * @param {HTMLElement} scope 包含 .star / [data-role=slider] / [data-role=value] 的容器
 * @param {number} initial 初始分值 0-100
 * @returns {{ get: () => number, set: (v:number) => void }}
 */
export function bindRatingControls(scope, initial = 80) {
  const slider = scope.querySelector('[data-role="slider"]');
  const valueEl = scope.querySelector('[data-role="value"]');
  const stars = Array.from(scope.querySelectorAll(".star"));

  const paint = (v) => {
    if (valueEl) valueEl.textContent = String(v);
    // 100 分 = 5 星,每 20 分一颗
    const lit = Math.ceil(v / 20);
    stars.forEach((s, i) => s.classList.toggle("is-on", i < lit));
  };

  const set = (v) => {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    if (slider) slider.value = String(clamped);
    paint(clamped);
  };

  if (slider) {
    slider.addEventListener("input", () => paint(parseInt(slider.value, 10)));
  }
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      set(parseInt(star.dataset.star, 10) * 20);
    });
  });

  set(initial);

  return {
    get: () => (slider ? parseInt(slider.value, 10) : initial),
    set,
  };
}

/**
 * 全局单例。
 * panel.js / accessibility.js 直接 import 它即可,不用各自 new 一个,
 * 否则每个实例都会往 body 再挂一套根节点。
 * main.js 里现有的 `new DialogManager()` 继续可用,不受影响。
 */
export const dialog = new DialogManager();
