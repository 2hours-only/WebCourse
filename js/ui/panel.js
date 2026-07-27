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
    console.log("[UI] Panel created");
    this.bindDOMEvents();
  }

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

    // === 修改：AI推荐按钮监听 ===
    const aiRecommendBtn = document.getElementById("ai-recommend-btn");
    if (aiRecommendBtn) {
      aiRecommendBtn.addEventListener("click", () => {
        console.log("[UI] AI Recommend Button clicked");
        // 获取 API Key 输入框的值
        const apiKeyInput = document.getElementById("api-key-input");
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";

        if (!apiKey) {
          alert("请先在上方输入您的智谱AI API Key");
          return;
        }

        // 收集用户输入数据
        const userInput = this.getUserInput();

        this.eventBus.emit("ai:recommend", { apiKey, userInput });
      });
    }
    // === 结束修改 ===

    const purchaseBtn = this.container.querySelector("#purchase-btn");
    if (purchaseBtn) {
      purchaseBtn.addEventListener("click", () => {
        this.eventBus.emit("user:purchase");
      });
    }

    const hallSelect = document.getElementById("hall-select");
    if (hallSelect) {
      hallSelect.addEventListener("change", () => {
        const hallType = this.getHallSelection();
        console.log(`[UI] Hall selected: ${hallType}`);
        this.eventBus.emit("hall:switch", hallType);
      });
    }

    const dateSelect = document.getElementById("date-select");
    if (dateSelect) {
      dateSelect.innerHTML = "";
      this.dateOptions = [];
      const today = new Date();
      const weekdayMap = [
        "周日",
        "周一",
        "周二",
        "周三",
        "周四",
        "周五",
        "周六",
      ];
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
        const selectedIndex = parseInt(dateSelect.value);
        console.log(`[UI] Date selected index: ${selectedIndex}`);
        this.eventBus.emit("date:switch", selectedIndex);
      });
    }

    const fontToggle = document.getElementById("font-toggle");
    if (fontToggle) {
      fontToggle.addEventListener("click", () => {
        this.eventBus.emit("accessibility:toggle-font");
      });
    }

    // 新增：观影类型切换时，控制团体成员输入框的显示隐藏
    const typeSelect = document.getElementById("type-select");
    if (typeSelect) {
      typeSelect.addEventListener("change", () => {
        const memberArea = document.getElementById("member-info-area");
        if (memberArea) {
          if (typeSelect.value === "group") {
            memberArea.classList.remove("hidden");
          } else {
            memberArea.classList.add("hidden");
          }
        }
      });
    }

    //登出按钮监听
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        this.eventBus.emit("user:logout");
      });
    }

    this.container.addEventListener("click", (e) => {
      const target = e.target;
      if (target.classList.contains("btn-refund")) {
        const orderId = target.getAttribute("data-order-id");
        if (orderId) {
          this.eventBus.emit("admin:refund-order", orderId);
        }
      }
    });
  }

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
    const index = select ? parseInt(select.value) : 0;
    if (this.dateOptions && this.dateOptions[index]) {
      return this.dateOptions[index];
    }
    const today = new Date();
    return { dayOfWeek: today.getDay(), dateStr: "未知" };
  }

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
      // 登录界面隐藏用户名
      this.setCurrentUser("");
    } else if (viewName === "admin") {
      if (this.loginLayer) this.loginLayer.classList.add("hidden");
      if (this.mainContainer) this.mainContainer.classList.remove("hidden");
      // 管理员界面显示用户名（由main.js传入）
    } else {
      if (this.loginLayer) this.loginLayer.classList.add("hidden");
      if (this.mainContainer) this.mainContainer.classList.remove("hidden");

      const leftPanel = this.mainContainer.querySelector(".left-panel");
      const cinemaContainer =
        this.mainContainer.querySelector(".cinema-container");
      const rightPanel = this.mainContainer.querySelector(".right-panel");

      if (leftPanel) leftPanel.style.display = "flex";
      if (cinemaContainer) cinemaContainer.style.display = "flex";
      if (rightPanel) rightPanel.style.display = "flex";

      const orderDiv = document.getElementById("order-info");
      if (orderDiv) {
        orderDiv.innerHTML = "<p>订单信息</p>";
      }
      const recommendDiv = document.getElementById("recommend-result");
      if (recommendDiv) {
        recommendDiv.innerHTML = "<p>推荐结果</p>";
      }
      const selectedDiv = document.getElementById("selected-seats");
      if (selectedDiv) {
        selectedDiv.innerHTML = "<p>已选座位</p>";
      }
      const purchaseBtn = document.getElementById("purchase-btn");
      if (purchaseBtn) purchaseBtn.disabled = true;
    }
  }

  renderAdminDashboard(orders, users, username = "管理员") {
    this.switchView("admin");
    // 设置当前用户名显示
    this.setCurrentUser(username);

    const ordersHtml =
      orders.length > 0
        ? orders
            .map(
              (order) => `
            <tr>
              <td>${order.id.substring(order.id.length - 6)}</td>
              <td>${order.username || "未知"}</td>
              <td>${order.date || "未知"}</td>
              <td>¥${order.amount}</td>
              <td>${order.seatList.map((s) => `${s.row + 1}排${s.col + 1}座`).join(", ")}</td>
              <td>${order.status}</td>
              <td>
                ${
                  order.status === "paid"
                    ? `<button class="btn btn-danger btn-refund" data-order-id="${order.id}">退票</button>`
                    : '<span style="color:gray;">-</span>'
                }
              </td>
            </tr>
          `,
            )
            .join("")
        : '<tr><td colspan="6">暂无订单</td></tr>';

    const usersHtml = users
      .map(
        (u) => `
          <li>${u.username} <span style="font-size:0.8em; color:#666;">(${u.role})</span></li>
        `,
      )
      .join("");

    const dashboardHtml = `
      <div class="admin-wrapper" style="width: 100%; max-width: 1000px; margin: 0 auto; padding: 20px;">
        <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom:10px;">
          <h2>管理员控制台</h2>
          <button class="btn btn-secondary" onclick="location.reload()">退出登录</button>
        </header>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
          <section class="card">
            <h3>订单管理</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #f5f5f5; text-align: left;">
                  <th style="padding: 8px;">订单号(后6位)</th>
                  <th style="padding: 8px;">用户名</th>
                  <th style="padding: 8px;">日期</th>
                  <th style="padding: 8px;">金额</th>
                  <th style="padding: 8px;">座位信息</th>
                  <th style="padding: 8px;">状态</th>
                  <th style="padding: 8px;">操作</th>
                </tr>
              </thead>
              <tbody>
                ${ordersHtml}
              </tbody>
            </table>
          </section>
          <section class="card">
            <h3>注册用户 (${users.length})</h3>
            <ul style="padding-left: 20px; margin-top: 10px; line-height: 2;">
              ${usersHtml}
            </ul>
          </section>
        </div>
      </div>
    `;
    this.mainContainer.innerHTML = dashboardHtml;
  }

  // 修复并补全 getUserInput 逻辑
  getUserInput() {
    console.log("[UI] getUserInput");
    const ageSelect = document.getElementById("age-select");
    const countInput = document.getElementById("people-count");
    const typeSelect = document.getElementById("type-select");
    const memberInfoInput = document.getElementById("member-info");

    let memberInfo = [];
    const type = typeSelect ? typeSelect.value : "personal";

    // 解析团体成员信息
    if (type === "group" && memberInfoInput && memberInfoInput.value) {
      const items = memberInfoInput.value.split(",");
      memberInfo = items
        .map((item) => {
          const parts = item.trim().split(":");
          return {
            name: parts[0] ? parts[0].trim() : "未知",
            age: parts[1] ? parseInt(parts[1].trim()) || 20 : 20,
          };
        })
        .filter((m) => m.name);
    }

    return {
      age: ageSelect ? ageSelect.value : "adult",
      count: countInput ? parseInt(countInput.value) || 1 : 1,
      type: type,
      memberInfo: memberInfo,
      date: this.getDateSelection(),
    };
  }

  // 整合去重后的 setRecommendation
  setRecommendation(seats, reason = "") {
    console.log(`[UI] setRecommendation with reason: ${reason}`);
    const resultDiv = document.getElementById("recommend-result");
    if (resultDiv) {
      if (seats && seats.length > 0) {
        resultDiv.innerHTML = `
          <p><strong>推荐座位 (${seats.length}):</strong></p>
          <p style="color: var(--primary-color); font-weight: bold;">
            ${seats
              .slice(0, 5)
              .map((s) => `${s.row + 1}排${s.col + 1}座`)
              .join(", ")}
            ${seats.length > 5 ? "..." : ""}
          </p>
          <p style="font-size: 0.9em; color: #666;">评分: ${seats[0]?.score || 0}分 (极佳)</p>
          ${reason ? `<p style="font-size: 0.9em; color: #888;">理由:${reason}</p>` : ""}
        `;
      } else {
        resultDiv.innerHTML = `<p>暂无推荐座位</p>`;
      }
    }
    this.setRecommendButtonActive(seats && seats.length > 0);
  }

  // 整合去重后的 setSelectedSeats
  setSelectedSeats(seats, onRemove = null) {
    console.log(`[UI] setSelectedSeats with onRemove callback: ${!!onRemove}`);
    const selectedDiv = document.getElementById("selected-seats");
    if (selectedDiv) {
      if (seats.length > 0) {
        selectedDiv.innerHTML = `
          <p><strong>已选:</strong> ${seats.map((s) => `${s.row + 1}排${s.col + 1}座`).join(", ")}</p>
        `;
      } else {
        selectedDiv.innerHTML = `<p>已选: -</p>`;
      }
    }
    const purchaseBtn = document.getElementById("purchase-btn");
    if (purchaseBtn) purchaseBtn.disabled = seats.length === 0;
  }

  setOrderInfo(order) {
    const orderDiv = document.getElementById("order-info");
    if (orderDiv) {
      // 格式化座位信息
      const seatsInfo = order.seatList
        .map((s) => `${s.row + 1}排${s.col + 1}座`)
        .join("、");
      orderDiv.innerHTML = `
        <div class="card" style="background: #e8f5e9; border: 1px solid #c8e6c9;">
          <h3 style="color: #2e7d32; margin-bottom: 10px;">预订成功!</h3>
          <p><strong>用户名:</strong> ${order.username || "未知"}</p>
          <p><strong>观影日期:</strong> ${order.date || "未知"}</p>
          <p><strong>订单号:</strong> ${order.id.substring(order.id.length - 6)}</p>
          <p><strong>座位信息:</strong> ${seatsInfo}</p>
          <p><strong>总金额:</strong> ¥${order.amount}</p>
          <p><strong>时间:</strong> ${new Date(order.timestamp).toLocaleString()}</p>
        </div>
      `;
    }
  }

  /**
   * 设置当前用户名显示
   * @param {string} username 用户名
   */
  setCurrentUser(username) {
    console.log(`[UI] setCurrentUser: ${username}`);
    const usernameSpan = document.getElementById("current-username");
    if (usernameSpan) {
      usernameSpan.textContent = username ? `当前用户: ${username}` : "";
    }
  }

  showRatingPanel(seat, onRatingSubmit) {
    console.log(`[UI] showRatingPanel for seat(${seat.row},${seat.col})`);
  }
  hideRatingPanel() {
    console.log(`[UI] hideRatingPanel`);
  }
  removeSelectedSeat(seat) {
    console.log(`[UI] removeSelectedSeat seat(${seat.row},${seat.col})`);
  }
}
