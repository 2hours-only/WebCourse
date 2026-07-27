import { Cinema } from "../core/cinema.js";
import { User } from "../core/user.js";
import { Order } from "../core/order.js";
import { CanvasRenderer } from "../canvas/renderer.js";
import { InteractionHandler } from "../canvas/interaction.js";
import { HeatmapRenderer } from "../canvas/heatmap.js";
import { RecommendEngine } from "../recommend/recommend.js";
import { UIPanel } from "../ui/panel.js";
import { DialogManager } from "../ui/dialog.js";
import { AccessibilityManager } from "../ui/accessibility.js";
import { StorageManager } from "../storage/storage.js";
import { EventBus } from "../utils/eventBus.js";
import cinemaData from "../data/cinemaData.js";

class MainController {
  constructor() {
    this.eventBus = new EventBus();
    this.selectedSeats = [];
    this.dialogManager = new DialogManager();
    this.currentDateInfo = { dayOfWeek: new Date().getDay(), dateStr: "未知" };
    this.init();
  }

  init() {
    console.log("[Main] App Starting...");
    this.storage = new StorageManager();
    this.uiPanel = new UIPanel(
      document.querySelector(".main-container"),
      this.eventBus,
    );

    const currentUser = this.storage.getCurrentUser();
    if (currentUser) {
      console.log(
        "[Main] User already logged in:",
        currentUser.username,
        currentUser.role,
      );
      // 设置当前用户名显示
      this.uiPanel.setCurrentUser(currentUser.username);
      if (currentUser.role === "admin") {
        this.initCinemaData("small"); // 需要初始化影院数据以便退票时更新座位状态
        this.eventBus.emit("admin:view-orders");
      } else {
        this.initMainApplication(currentUser);
      }
    } else {
      console.log("[Main] No user found, showing login screen.");
      this.uiPanel.switchView("login");
    }

    this.registerEvents();
  }
  initCinemaData(hallType) {
    const data = cinemaData[hallType] || cinemaData.small;
    this.cinema = new Cinema(data.rows, data.cols, "top", data.curvature);
    const dayOfWeek = this.currentDateInfo
      ? this.currentDateInfo.dayOfWeek
      : new Date().getDay();
    // 获取当天的初始热力数据和已售座位
    let soldSeats = data.soldSeats[dayOfWeek] || [];
    let heatMap = data.heatMaps[dayOfWeek] || [];
    // 加载持久化的热力数据
    const savedHeatMap = this.storage.loadHeatMap(hallType, dayOfWeek);
    if (savedHeatMap) {
      heatMap = savedHeatMap;
    }
    this.cinema.reloadHallData(
      data.rows,
      data.cols,
      "top",
      soldSeats,
      heatMap,
      data.curvature,
    );
    // === 加载持久化的座位状态 ===
    const savedStates = this.storage.loadSeatStates(hallType, dayOfWeek);
    console.log(
      `[Main] Loading saved seat states for ${hallType} on dayOfWeek ${dayOfWeek}:`,
      savedStates,
    );
    if (Object.keys(savedStates).length > 0) {
      this.cinema.getAllSeats().forEach((seat) => {
        const seatId = `r${seat.row}c${seat.col}`;
        if (savedStates[seatId] === "sold") {
          seat.setStatus("sold");
        }
      });
    }
    return this.cinema;
  }

  initMainApplication(user) {
    this.currentUser = user;
    // 当前用户名显示
    this.uiPanel.setCurrentUser(user.username);
    this.uiPanel.switchView("main");

    // === 清理上一轮残留的监听器，防止堆积 ===
    if (this.interaction) {
      this.interaction.disable();
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }

    const lastHallType = this.storage.getHallType("small");
    if (this.uiPanel.dateOptions && this.uiPanel.dateOptions[0]) {
      this.currentDateInfo = this.uiPanel.dateOptions[0];
    }
    this.initCinemaData(lastHallType);

    const hallSelect = document.getElementById("hall-select");
    if (hallSelect) {
      hallSelect.value = lastHallType;
    }

    const canvasEl = document.getElementById("cinema-canvas");
    if (canvasEl) {
      this.resizeCanvas(canvasEl);

      // 保存resize处理器的引用，以便登出时移除
      this.resizeHandler = () => this.handleResize(canvasEl);
      window.addEventListener("resize", this.resizeHandler);

      this.renderer = new CanvasRenderer(canvasEl, this.cinema);
      this.renderer.setHallType(lastHallType);
      this.heatmapRenderer = new HeatmapRenderer(this.renderer);
      this.renderer.heatmapRenderer = this.heatmapRenderer;
      this.heatmapRenderer.update();
      this.interaction = new InteractionHandler(
        canvasEl,
        this.renderer,
        this.eventBus,
      );
      this.renderer.render();
    }
    this.recommendEngine = new RecommendEngine();
    this.accessibilityManager = new AccessibilityManager(this.eventBus);

    // === 加载并显示用户的历史订单 ===
    const orders = this.storage.getOrders();
    if (orders.length > 0) {
      const lastOrder = orders[orders.length - 1]; // 显示最近的一笔订单
      const orderDiv = document.getElementById("order-info");
      if (orderDiv) {
        const seatsInfo = lastOrder.seatList
          .map((s) => `${s.row + 1}排${s.col + 1}座`)
          .join("、");
        orderDiv.innerHTML = `
          <div class="card" style="background: #fff; border: 1px solid #e0e0e0;">
            <h3 style="color: #2196F3; margin-bottom: 10px;">最近订单</h3>
            <p><strong>用户名:</strong> ${lastOrder.username || "未知"}</p>
            <p><strong>观影日期:</strong> ${lastOrder.date || "未知"}</p>
            <p><strong>订单号:</strong> ${lastOrder.id.substring(lastOrder.id.length - 6)}</p>
            <p><strong>座位信息:</strong> ${seatsInfo}</p>
            <p><strong>总金额:</strong> ¥${lastOrder.amount}</p>
            <p><strong>状态:</strong> ${lastOrder.status === "paid" ? "已支付" : lastOrder.status}</p>
            <p><strong>时间:</strong> ${new Date(lastOrder.timestamp).toLocaleString()}</p>
          </div>
        `;
      }
    }
  }

  handleResize(canvasEl) {
    this.resizeCanvas(canvasEl);
    if (this.renderer) this.renderer.render();
    if (this.heatmapRenderer) this.heatmapRenderer.render();
  }

  resizeCanvas(canvasEl) {
    const container = document.querySelector(".cinema-container");
    if (container) {
      canvasEl.width = container.clientWidth;
      canvasEl.height = Math.min(container.clientWidth * 0.6, 600);
    }
  }

  registerEvents() {
    this.eventBus.on("accessibility:toggle-font", () => {
      if (this.accessibilityManager) {
        const currentSize = this.accessibilityManager.config.fontSize;
        this.accessibilityManager.setFontSize(
          currentSize === "normal" ? "large" : "normal",
        );
      }
    });

    this.eventBus.on("user:login", (loginData) => {
      console.log("[Main] Received user:login", loginData);
      const user = this.storage.login(loginData.username, loginData.password);
      if (user) {
        // 设置当前用户名显示
        this.uiPanel.setCurrentUser(user.username);
        if (user.role === "admin") {
          if (!this.cinema) this.initCinemaData("small");
          this.eventBus.emit("admin:view-orders");
        } else {
          this.initMainApplication(user);
        }
      } else {
        this.dialogManager.showError("登录失败：用户名或密码错误");
      }
    });

    // 修复越权登录逻辑
    this.eventBus.on("user:register", (registerData) => {
      console.log("[Main] Received user:register", registerData);
      const existingUser = this.storage.findUser(registerData.username);
      if (existingUser) {
        this.dialogManager.showError("注册失败：用户名已存在");
        return;
      }
      const newUser = new User(
        registerData.username,
        registerData.password,
        "user",
      );
      this.storage.register(newUser);
      this.dialogManager.showSuccess("注册成功，请登录");
    });

    this.eventBus.on("user:recommend", (userPref) => {
      console.log("[Main] Received user:recommend event", userPref);
      if (!this.cinema) return;
      if (userPref && userPref.action === "cancel") {
        // 取消推荐，清除推荐高亮并恢复默认状态
        this.cinema.getAllSeats().forEach((seat) => {
          seat.setRecommended(false);
          seat.recommendGrade = "";
          seat.recommendReason = "";
        });
        if (this.renderer) {
          this.renderer.render();
        }
        this.uiPanel.setRecommendation([]);
        return;
      }
      const userRatings = this.storage.getUserRatings();
      const seats = this.recommendEngine.recommend(
        userPref,
        this.cinema,
        userRatings,
      );
      if (this.renderer) {
        this.renderer.render();
      }

      // 从推荐结果中提取推荐理由
      // RecommendEngine 已经将理由挂载到了每个推荐座位的 recommendReason 属性上
      const reason = seats.length > 0 ? seats[0].recommendReason || "" : "";

      // 将推荐理由传递给 UI 层
      this.uiPanel.setRecommendation(seats, reason);
    });

    this.eventBus.on("seat:clicked", (payload) => {
      console.log("[Main] Received seat:clicked event", payload);
      if (!payload) return;

      const seats = payload.seats || (payload.seat ? [payload.seat] : []);
      const isMultiSelect = payload.isMultiSelect;

      if (!seats.length) return;

      if (!isMultiSelect) {
        seats.forEach((seat) => {
          if (!seat || seat.status === "sold") return;

          if (seat.status === "available") {
            seat.setStatus("selected");
            // === 去重判断，防止重复添加 ===
            if (!this.selectedSeats.includes(seat)) {
              this.selectedSeats.push(seat);
            }
          } else if (seat.status === "selected") {
            seat.setStatus("available");
            this.selectedSeats = this.selectedSeats.filter((s) => s !== seat);
          }
        });
      } else {
        seats.forEach((seat) => {
          if (!seat || seat.status === "sold") return;

          if (seat.status === "available") {
            seat.setStatus("selected");
            if (!this.selectedSeats.includes(seat)) {
              this.selectedSeats.push(seat);
            }
          }
        });
      }

      if (this.renderer) {
        this.renderer.render();
      }
      this.uiPanel.setSelectedSeats(this.selectedSeats);
    });

    this.eventBus.on("seat:rating", (ratingData) => {
      console.log("[Main] Received seat:rating event", ratingData);
      const { seatId, rating } = ratingData;
      this.storage.saveUserRating(seatId, rating);
      if (this.renderer) this.renderer.render();
    });
    this.eventBus.on("user:purchase", () => {
      console.log("[Main] Received user:purchase event");
      if (this.selectedSeats.length === 0) {
        this.dialogManager.showError("请先选择座位");
        return;
      }
      const order = new Order(this.selectedSeats, this.currentDateInfo);
      order.calculateAmount();
      order.confirm();
      // 确保订单包含用户名信息
      order.username = this.currentUser ? this.currentUser.username : "未知";
      this.storage.saveOrder(order);
      this.uiPanel.setOrderInfo(order);
      // 更新座位状态并持久化
      this.selectedSeats.forEach((s) => s.setStatus("sold"));
      const hallType = this.storage.getHallType("small");
      this.storage.saveSeatStates(
        hallType,
        this.currentDateInfo.dayOfWeek,
        this.selectedSeats,
      );

      // === 更新热力图数据 ===
      const heatMapData = this.cinema
        .getAllSeats()
        .map((s) => ({ row: s.row, col: s.col, value: s.heat || 0 }));
      const purchasedSeatsSet = new Set(
        this.selectedSeats.map((s) => `${s.row},${s.col}`),
      );
      const affectedSeats = new Set();

      this.selectedSeats.forEach((seat) => {
        affectedSeats.add(`${seat.row},${seat.col}`);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = seat.row + dr;
            const c = seat.col + dc;
            if (
              r >= 0 &&
              r < this.cinema.rows &&
              c >= 0 &&
              c < this.cinema.cols
            ) {
              affectedSeats.add(`${r},${c}`);
            }
          }
        }
      });

      const heatIncrease = 0.05;
      const totalIncrease = heatIncrease * affectedSeats.size;
      const totalDecrease =
        totalIncrease / (heatMapData.length - affectedSeats.size || 1);

      heatMapData.forEach((h) => {
        if (affectedSeats.has(`${h.row},${h.col}`)) {
          h.value = Math.min(1, h.value + heatIncrease);
        } else {
          h.value = Math.max(0, h.value - totalDecrease);
        }
      });

      this.cinema.updateHeatMap(heatMapData);
      this.storage.saveHeatMap(
        hallType,
        this.currentDateInfo.dayOfWeek,
        heatMapData,
      );

      if (this.heatmapRenderer) {
        this.heatmapRenderer.update(this.cinema.getAllSeats());
        this.heatmapRenderer.render();
      }
      if (this.renderer) this.renderer.render();
      this.selectedSeats = [];
      this.uiPanel.setSelectedSeats([]);
    });

    this.eventBus.on("hall:switch", (hallType) => {
      console.log("[Main] Switching hall to:", hallType);
      const data = cinemaData[hallType];
      if (this.cinema && data) {
        let soldSeats = data.soldSeats[this.currentDateInfo.dayOfWeek] || [];
        let heatMap = data.heatMaps[this.currentDateInfo.dayOfWeek] || [];
        const savedHeatMap = this.storage.loadHeatMap(
          hallType,
          this.currentDateInfo.dayOfWeek,
        );
        if (savedHeatMap) {
          heatMap = savedHeatMap;
        }
        this.cinema.reloadHallData(
          data.rows,
          data.cols,
          "top",
          soldSeats,
          heatMap,
          data.curvature,
        );
        // === 加载持久化的座位状态 ===
        const savedStates = this.storage.loadSeatStates(
          hallType,
          this.currentDateInfo.dayOfWeek,
        );
        console.log(
          `[Main] Loading saved seat states for ${hallType} on dayOfWeek ${this.currentDateInfo.dayOfWeek}:`,
          savedStates,
        );
        if (Object.keys(savedStates).length > 0) {
          this.cinema.getAllSeats().forEach((seat) => {
            const seatId = `r${seat.row}c${seat.col}`;
            if (savedStates[seatId] === "sold") {
              seat.setStatus("sold");
            }
          });
        }
        if (this.renderer) {
          this.renderer.setHallType(hallType);
        }
        if (this.heatmapRenderer) {
          this.heatmapRenderer.update(this.cinema.getAllSeats());
        }
        if (this.renderer) {
          this.renderer.render();
        }
        this.storage.saveHallType(hallType);
        this.selectedSeats = [];
        this.uiPanel.setSelectedSeats([]);
        this.uiPanel.setRecommendation([]);
      }
    });

    this.eventBus.on("date:switch", (selectedIndex) => {
      console.log("[Main] Switching date to index:", selectedIndex);
      const hallType = this.storage.getHallType("small");
      const data = cinemaData[hallType];

      if (this.uiPanel.dateOptions && this.uiPanel.dateOptions[selectedIndex]) {
        this.currentDateInfo = this.uiPanel.dateOptions[selectedIndex];
      }

      if (this.cinema && data) {
        let soldSeats = data.soldSeats[this.currentDateInfo.dayOfWeek] || [];
        let heatMap = data.heatMaps[this.currentDateInfo.dayOfWeek] || [];

        const savedHeatMap = this.storage.loadHeatMap(
          hallType,
          this.currentDateInfo.dayOfWeek,
        );
        if (savedHeatMap) {
          heatMap = savedHeatMap;
        }

        this.cinema.reloadHallData(
          data.rows,
          data.cols,
          "top",
          soldSeats,
          heatMap,
          data.curvature,
        );

        const savedStates = this.storage.loadSeatStates(
          hallType,
          this.currentDateInfo.dayOfWeek,
        );
        if (Object.keys(savedStates).length > 0) {
          this.cinema.getAllSeats().forEach((seat) => {
            const seatId = `r${seat.row}c${seat.col}`;
            if (savedStates[seatId] === "sold") {
              seat.setStatus("sold");
            }
          });
        }

        if (this.heatmapRenderer) {
          this.heatmapRenderer.update(this.cinema.getAllSeats());
        }
        if (this.renderer) {
          this.renderer.render();
        }
        this.selectedSeats = [];
        this.uiPanel.setSelectedSeats([]);
        this.uiPanel.setRecommendation([]);
      }
    });

    this.eventBus.on("admin:view-orders", () => {
      console.log("[Main] Admin viewing orders");
      const orders = this.storage.getAllOrders();
      const users = this.storage.getAllUsers();
      const username = this.currentUser ? this.currentUser.username : "管理员";
      this.uiPanel.renderAdminDashboard(orders, users, username);
    });
    this.eventBus.on("admin:refund-order", (orderId) => {
      console.log("[Main] Admin refunding order:", orderId);
      const updatedOrder = this.storage.refundOrder(orderId);
      if (updatedOrder) {
        // 仅在Cinema存在时更新座位状态
        if (this.cinema) {
          updatedOrder.seatList.forEach((seatData) => {
            const seat = this.cinema.getSeat(seatData.row, seatData.col);
            if (seat && seat.status === "sold") {
              seat.setStatus("available");
              const hallType = this.storage.getHallType("small");
              this.storage.saveSeatState(
                hallType,
                updatedOrder.dayOfWeek != null ? updatedOrder.dayOfWeek : 0,
                seat,
              );
            }
          });
        }
        // 判空保护，管理员后台由于没有渲染Canvas，this.renderer可能不存在
        if (this.renderer) this.renderer.render();
        this.eventBus.emit("admin:view-orders");
        this.dialogManager.showSuccess("退票成功");
      } else {
        this.dialogManager.showError("退票失败：订单不存在或状态异常");
      }
    });

    this.eventBus.on("accessibility:change", (config) => {
      console.log("[Main] Accessibility settings changed", config);
      if (this.renderer) this.renderer.render();
    });
    // === 监听登出事件 ===
    this.eventBus.on("user:logout", () => {
      console.log("[Main] Received user:logout event");
      // 1. 调用 Storage 清除登录状态
      this.storage.logout();
      // 2. 重置应用状态
      this.currentUser = null;
      this.selectedSeats = [];
      // 3. 清除用户名显示
      this.uiPanel.setCurrentUser("");
      // 4. 切换到登录视图
      this.uiPanel.switchView("login");
      // 5. 清空推荐、已选座位和订单信息显示
      this.uiPanel.setRecommendation([]);
      this.uiPanel.setSelectedSeats([]);
      // 清空订单信息显示
      const orderDiv = document.getElementById("order-info");
      if (orderDiv) {
        orderDiv.innerHTML = "<p>订单信息</p>";
      }

      if (this.interaction) {
        this.interaction.disable();
        this.interaction = null;
      }
      if (this.resizeHandler) {
        window.removeEventListener("resize", this.resizeHandler);
        this.resizeHandler = null;
      }

      console.log("[Main] User logged out successfully");
    });

    this.eventBus.on("ai:recommend", (payload) => {
      const apiKey = payload && payload.apiKey ? payload.apiKey : "";
      const userInput = payload && payload.userInput ? payload.userInput : {};
      this.aiRecommend(apiKey, userInput);
    });
  }

  /**
   * AI 智能推荐
   * 根据用户输入和当前影院状态构建提示词，请求AI推荐
   */
  /**
   * AI 智能推荐
   * 根据用户输入和当前影院状态构建提示词，请求AI推荐
   */
  async aiRecommend(apiKey, userInput) {
    console.log("[Main] AI Recommend started with input:", userInput);

    if (!apiKey) {
      alert("未提供有效的 API Key");
      return;
    }
    if (!this.cinema) {
      alert("影院数据未初始化");
      return;
    }

    // 1. 准备数据
    // 观众类型映射
    const ageMap = { adult: "成年人", teenager: "少年", elderly: "老年人" };
    const typeMap = {
      personal: "个人票",
      couple: "情侣票",
      family: "家庭票",
      group: "团体票",
    };

    const audienceType = ageMap[userInput.age] || "成年人";
    const ticketType = typeMap[userInput.type] || "个人票";
    const count = userInput.count || 1;

    // 成员信息格式化
    let memberInfoText = "无";
    if (
      userInput.type === "group" &&
      userInput.memberInfo &&
      userInput.memberInfo.length > 0
    ) {
      memberInfoText = userInput.memberInfo
        .map((m) => `${m.name}:${m.age}`)
        .join(", ");
    } else {
      // 如果不是团体票或没有详细成员信息，根据人数构造模拟信息
      const mockNames = ["张三", "李四", "王五", "赵六", "钱七"];
      memberInfoText = mockNames
        .slice(0, Math.min(count, 5))
        .map(
          (name) =>
            `${name}:${userInput.age === "teenager" ? 12 : userInput.age === "elderly" ? 65 : 25}`,
        )
        .join(", ");
    }

    // 已售座位格式化 (格式: a-b)
    const soldSeatsList = this.cinema
      .getAllSeats()
      .filter((s) => s.status === "sold")
      .map((s) => `${s.row + 1}-${s.col + 1}`); // 转为1-based索引
    const soldSeatsText =
      soldSeatsList.length > 0 ? soldSeatsList.join(", ") : "无";

    // 影院尺寸
    const rows = this.cinema.rows;
    const cols = this.cinema.cols;

    // 2. 构建提示词
    const prompt = `
# 影院智能选座助理任务书

## 1. 影厅布局信息
- **布局尺寸**: 10 排 x ${cols} 列
- **座位编号**: 使用“排号-列号”格式（例如 3-5 代表第3排第5列）
- **已售座位**: ${soldSeatsText || "无"}

## 2. 客户购票需求
- **观众类型**: ${audienceType}
- **选座类型**: ${ticketType}
- **购票数量**: **${count} 张** (请务必输出正好 ${count} 个座位，不能多也不能少)
- **成员信息**: ${memberInfoText}
  *(注: 仅当选座类型为“团体票”或“家庭票”时需参考成员年龄，其他情况请忽略姓名详情)*

## 3. 选座规则 (请严格遵守)

### 硬性规则 (必须满足，否则推荐无效)
1. **有效性限制**: 不能推荐已售座位。
2. **数量限制**: 推荐结果必须正好包含 **${count}** 个座位。
3. **少年限制**: 15岁以下(少年)观众不可坐前三排(第1-3排)。
4. **老年限制**: 60岁以上(老年)观众不可坐后三排。
5. **情侣票**: 必须推荐两个相邻座位。
6. **团体/家庭票**: 所有人必须坐在**同一排**且座位**连续**。

### 优化规则 (尽量满足)
- 优先选择影厅中间区域。
- 综合考虑视角与银幕距离。
- 避开周围拥挤区域。

## 4. 输出格式要求
请严格按照以下 Markdown 格式输出，不要包含多余的解释：

\`\`\`
座位列表
{
  <推荐座位1>,
  <推荐座位2>,
  ...
}

推荐理由: <简明扼要的理由>
\`\`\`

### 正确示例
输入: 团体票，3人
\`\`\`
座位列表
{
  5-5,
  5-6,
  5-7
}

推荐理由: 团体同排连续空位，居中视角佳。
\`\`\`

请根据以上信息开始推荐：
`;

    console.log("[Main] Sending prompt to AI:\n", prompt);

    const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "glm-4-flash",
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API请求失败: ${response.status} ${errorData.error?.message || ""}`,
        );
      }

      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        const reply = data.choices[0].message.content;
        console.log(
          `%c[Main] AI 推荐结果:\n${reply}`,
          "color: #2196F3; font-weight: bold;",
        );

        // === 解析AI返回的字符串，提取座位和理由 ===
        const parsed = this._parseAIResponse(reply);

        if (parsed.seats.length > 0) {
          // 清除所有座位的推荐标记
          this.cinema.getAllSeats().forEach((seat) => {
            seat.setRecommended(false);
          });

          // 设置推荐座位
          const recommendedSeats = [];
          parsed.seats.forEach(({ row, col }) => {
            const seat = this.cinema.getSeat(row, col);
            if (seat && seat.status !== "sold") {
              seat.setRecommended(true);
              recommendedSeats.push(seat);
              console.log(`[Main] AI推荐座位: ${row + 1}排${col + 1}座`);
            } else if (seat && seat.status === "sold") {
              console.warn(
                `[Main] AI推荐的座位 ${row + 1}-${col + 1} 已被占用，跳过`,
              );
            } else {
              console.warn(
                `[Main] AI推荐的座位 ${row + 1}-${col + 1} 不存在，跳过`,
              );
            }
          });

          // 更新UI显示
          this.uiPanel.setRecommendation(recommendedSeats, parsed.reason);

          // 更新Canvas渲染
          if (this.renderer) {
            this.renderer.render();
          }
        } else {
          this.uiPanel.setRecommendation([], "AI未能解析出有效座位");
        }
      } else {
        console.warn("[Main] AI 返回数据格式异常:", data);
      }
    } catch (error) {
      console.error("[Main] AI Recommend Failed:", error);
      alert(`AI推荐失败: ${error.message}`);
    }
  }

  /**
   * 解析AI返回的响应字符串
   * @param {string} response AI返回的原始字符串
   * @returns {{seats: Array<{row: number, col: number}>, reason: string}}
   */
  _parseAIResponse(response) {
    console.log("[Main] Parsing AI response:", response);

    const result = {
      seats: [],
      reason: "",
    };

    try {
      // 提取座位列表部分 - 匹配 "座位列表" 和 "推荐理由" 之间的内容
      // 支持格式: 座位列表{...}推荐理由:...
      // 或 Markdown 代码块格式

      // 尝试匹配多种格式
      let seatListStr = "";

      // 格式1: 座位列表{...}推荐理由:...
      const directMatch = response.match(/座位列表\s*\{([^}]*)\}/);
      if (directMatch) {
        seatListStr = directMatch[1];
      }

      // 格式2: Markdown代码块中的格式
      if (!seatListStr) {
        const codeBlockMatch = response.match(/座位列表\s*\n?\s*\{([^}]*)\}/s);
        if (codeBlockMatch) {
          seatListStr = codeBlockMatch[1];
        }
      }

      // 格式3: 直接匹配 {...} 内的内容（兼容不带"座位列表"前缀的情况）
      if (!seatListStr) {
        const braceMatch = response.match(/\{([^}]*)\}/);
        if (braceMatch) {
          seatListStr = braceMatch[1];
        }
      }

      if (seatListStr) {
        // 解析座位 - 格式为 "排号-列号"，如 "5-5, 5-6"
        // 清理字符串，移除多余空白和换行
        const cleanedStr = seatListStr.replace(/\s+/g, " ").trim();
        const seatStrs = cleanedStr
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);

        seatStrs.forEach((seatStr) => {
          // 匹配 "数字-数字" 格式
          const seatMatch = seatStr.match(/(\d+)\s*-\s*(\d+)/);
          if (seatMatch) {
            // 转为0-based索引
            const row = parseInt(seatMatch[1]) - 1;
            const col = parseInt(seatMatch[2]) - 1;
            result.seats.push({ row, col });
          }
        });
      }

      // 提取推荐理由
      // 格式1: 推荐理由: xxx
      const reasonMatch = response.match(/推荐理由\s*[:：]\s*([^\n{}]+)/);
      if (reasonMatch) {
        result.reason = reasonMatch[1].trim();
      }

      console.log("[Main] Parsed result:", result);
    } catch (error) {
      console.error("[Main] Failed to parse AI response:", error);
    }

    return result;
  }
}

new MainController();
