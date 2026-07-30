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
import { AppConfig } from "../utils/config.js";
import cinemaData from "../data/cinemaData.js";

class MainController {
  constructor() {
    this.eventBus = new EventBus();
    this.selectedSeats = [];
    this.dialogManager = new DialogManager();
    this.currentDateInfo = { dayOfWeek: new Date().getDay(), dateStr: "未知" };
    this.currentHallType = "small";
    this.syncClientId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    this.syncChannel = null;
    this.init();
  }

  init() {
    console.log("[Main] App Starting...");
    this.storage = new StorageManager();
    this.initSyncChannel();
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

  initSyncChannel() {
    const syncKey = "smartcinema-sync-event";
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.syncChannel = new BroadcastChannel("smartcinema-sync");
        this.syncChannel.onmessage = (event) => {
          this.handleSyncMessage(event.data);
        };
      } catch (e) {
        console.warn("[Sync] BroadcastChannel unavailable", e);
      }
    }

    if (!this.syncChannel) {
      window.addEventListener("storage", (event) => {
        if (event.key !== syncKey || !event.newValue) return;
        let message = null;
        try {
          message = JSON.parse(event.newValue);
        } catch (error) {
          console.warn("[Sync] Invalid storage sync payload", error);
          return;
        }
        this.handleSyncMessage(message);
      });
    }
  }

  broadcastSyncEvent(type, payload) {
    const message = {
      type,
      payload,
      source: this.syncClientId,
      timestamp: Date.now(),
    };
    if (this.syncChannel) {
      this.syncChannel.postMessage(message);
      return;
    }
    try {
      const syncKey = "smartcinema-sync-event";
      localStorage.setItem(syncKey, JSON.stringify(message));
      localStorage.removeItem(syncKey);
    } catch (error) {
      console.warn("[Sync] Failed to broadcast sync event", error);
    }
  }

  handleSyncMessage(message) {
    if (!message || message.source === this.syncClientId) return;
    if (message.type === "seat:sold") {
      this.applyRemoteSeatState(message.payload, "sold");
    } else if (message.type === "seat:available") {
      this.applyRemoteSeatState(message.payload, "available");
    } else if (message.type === "order:refunded") {
      this.applyRemoteOrderRefund(message.payload);
    }
  }

  applyRemoteSeatState(payload, targetStatus) {
    if (!this.cinema || !payload) return;
    const { hallType, dayOfWeek, seats } = payload;
    if (
      !hallType ||
      dayOfWeek == null ||
      !Array.isArray(seats) ||
      hallType !== this.currentHallType ||
      dayOfWeek !== this.currentDateInfo.dayOfWeek
    ) {
      return;
    }

    let seatChanged = false;
    seats.forEach((seatData) => {
      const seat = this.cinema.getSeat(seatData.row, seatData.col);
      if (!seat) return;
      if (seat.status === targetStatus) return;
      seat.setStatus(targetStatus);
      seatChanged = true;
    });

    if (!seatChanged) return;

    if (this.renderer) {
      this.renderer.render();
    }

    // 如果当前页面正在选中已被售出的座位，移除它们
    if (targetStatus === "sold" && this.selectedSeats.length > 0) {
      this.selectedSeats = this.selectedSeats.filter(
        (seat) => seat.status !== "sold",
      );
      this.uiPanel.setSelectedSeats(this.selectedSeats);
    }

    if (this.isAdminView()) {
      this.eventBus.emit("admin:view-orders");
    }

    if (this.currentUser && this.currentUser.role !== "admin") {
      this.uiPanel.setOrderList(this.storage.getOrders());
    }
  }

  applyRemoteOrderRefund(payload) {
    if (!payload) return;
    const { hallType, dayOfWeek } = payload;
    if (!hallType || dayOfWeek == null) return;
    this.applyRemoteSeatState(payload, "available");

    if (this.isAdminView()) {
      this.eventBus.emit("admin:view-orders");
    }

    if (this.currentUser && this.currentUser.role !== "admin") {
      this.uiPanel.setOrderList(this.storage.getOrders());
    }
  }

  isAdminView() {
    return Boolean(document.querySelector(".admin-wrapper"));
  }

  initCinemaData(hallType) {
    this.currentHallType = hallType;
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
      this.resizeCanvas(canvasEl);
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
    // === 加载并显示用户的历史订单列表 ===
    const orders = this.storage.getOrders();
    this.uiPanel.setOrderList(orders);
  }

  handleResize(canvasEl) {
    this.resizeCanvas(canvasEl);
    // 修复 bug：移除单独调用 heatmapRenderer.render()，因为 renderer.render() 内部已经按正确顺序（先热力图后座位）调用了它，单独再调会导致热力图覆盖在座位上方。
    if (this.renderer) this.renderer.render();
  }

  resizeCanvas(canvasEl) {
    const container = document.querySelector(".cinema-container");
    if (!container) return;

    const containerStyle = getComputedStyle(container);
    const paddingTop = parseFloat(containerStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0;
    const legend = container.querySelector(".seat-legend");
    const legendHeight = legend ? legend.offsetHeight : 0;
    const availableHeight =
      container.clientHeight - paddingTop - paddingBottom - legendHeight - 16;

    canvasEl.width = container.clientWidth;
    canvasEl.height = Math.min(
      container.clientWidth * 0.6,
      600,
      Math.max(280, availableHeight),
    );

    if (!this.renderer) return;

    const hallParams = AppConfig.getHallParams(this.currentHallType);
    const basePixelsPerCm = 0.35;
    const seatHalfHeight = (AppConfig.physical.seatWidth * basePixelsPerCm) / 2;
    const lastRow = hallParams.rows - 1;
    const lastRowY =
      AppConfig.getRowPhysicalY(lastRow, hallParams) * basePixelsPerCm;
    const contentHeight = 55 + lastRowY + seatHalfHeight + 20;
    const scale = Math.min(1, canvasEl.height / contentHeight);
    this.renderer.setPixelsPerCm(basePixelsPerCm * scale);
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
      // 刷新右栏订单列表,新订单出现在最上方
      this.uiPanel.setOrderList(this.storage.getOrders());
      // 更新座位状态并持久化
      this.selectedSeats.forEach((s) => s.setStatus("sold"));

      const hallType = this.storage.getHallType("small");
      this.storage.saveSeatStates(
        hallType,
        this.currentDateInfo.dayOfWeek,
        this.selectedSeats,
      );

      this.broadcastSyncEvent("seat:sold", {
        hallType,
        dayOfWeek: this.currentDateInfo.dayOfWeek,
        seats: this.selectedSeats.map((s) => ({ row: s.row, col: s.col })),
        orderId: order.id,
        username: order.username,
      });

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
      this.currentHallType = hallType;
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
        this.broadcastSyncEvent("order:refunded", {
          hallType: this.storage.getHallType("small"),
          dayOfWeek:
            updatedOrder.dayOfWeek != null ? updatedOrder.dayOfWeek : 0,
          seats: updatedOrder.seatList.map((seatData) => ({
            row: seatData.row,
            col: seatData.col,
          })),
          orderId: updatedOrder.id,
          username: updatedOrder.username,
        });
        this.dialogManager.showSuccess("退票成功");
      } else {
        this.dialogManager.showError("退票失败：订单不存在或状态异常");
      }
    });

    // === 普通用户退票 ===
    // 与 admin:refund-order 走同一份 StorageManager.refundOrder,
    // 区别仅在退款成功后的视图刷新:普通用户刷新右栏订单列表,管理员刷新后台表格。
    this.eventBus.on("user:refund-order", (orderId) => {
      console.log("[Main] User refunding order:", orderId);
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
        // 判空保护,退票时如果用户在管理员视图,this.renderer可能不存在
        if (this.renderer) this.renderer.render();
        // 刷新右栏订单列表,已退票订单会显示为「已退票」状态,按钮消失
        this.uiPanel.setOrderList(this.storage.getOrders());
        this.broadcastSyncEvent("order:refunded", {
          hallType: this.storage.getHallType("small"),
          dayOfWeek:
            updatedOrder.dayOfWeek != null ? updatedOrder.dayOfWeek : 0,
          seats: updatedOrder.seatList.map((seatData) => ({
            row: seatData.row,
            col: seatData.col,
          })),
          orderId: updatedOrder.id,
          username: updatedOrder.username,
        });
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
      // 5. 清空推荐、已选座位和订单信息显示
      this.uiPanel.setRecommendation([]);
      this.uiPanel.setSelectedSeats([]);
      // 清空订单信息显示
      this.uiPanel.setOrderList([]);

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

    try {
      // 调用 RecommendEngine 的 aiRecommend 方法
      const userRatings = this.storage.getUserRatings();
      const recommendedSeats = await this.recommendEngine.aiRecommend(
        userInput,
        this.cinema,
        userRatings,
        apiKey,
      );

      // 更新 UI 显示
      const reason =
        recommendedSeats.length > 0
          ? recommendedSeats[0].aiAdvice ||
            recommendedSeats[0].recommendReason ||
            ""
          : "";
      this.uiPanel.setRecommendation(recommendedSeats, reason);

      // 更新 Canvas 渲染
      if (this.renderer) {
        this.renderer.render();
      }
    } catch (error) {
      console.error("[Main] AI Recommend Failed:", error);
      alert(`AI推荐失败: ${error.message}`);
    }
  }
}

new MainController();
