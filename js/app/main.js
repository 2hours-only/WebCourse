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
    if (data.soldSeats || data.heatMap) {
      this.cinema.reloadHallData(
        data.rows,
        data.cols,
        "top",
        data.soldSeats,
        data.heatMap,
        data.curvature,
      );
    }
    return this.cinema;
  }

  initMainApplication(user) {
    this.currentUser = user;
    this.uiPanel.switchView("main");
    this.initCinemaData("small");

    const canvasEl = document.getElementById("cinema-canvas");
    if (canvasEl) {
      this.resizeCanvas(canvasEl);
      window.addEventListener("resize", () => this.handleResize(canvasEl));
      this.renderer = new CanvasRenderer(canvasEl, this.cinema);
      this.heatmapRenderer = new HeatmapRenderer(this.renderer);
      this.interaction = new InteractionHandler(
        canvasEl,
        this.renderer,
        this.eventBus,
      );
      this.renderer.render();
    }

    this.recommendEngine = new RecommendEngine();
    this.accessibilityManager = new AccessibilityManager(this.eventBus);
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
      const userRatings = this.storage.getUserRatings();
      const seats = this.recommendEngine.recommend(
        userPref,
        this.cinema,
        userRatings,
      );
      if (this.renderer) {
        this.renderer.renderSeats(seats);
        if (this.heatmapRenderer) {
          this.heatmapRenderer.generate(seats);
          this.heatmapRenderer.render();
        }
      }
      this.uiPanel.setRecommendation(seats);
    });

    this.eventBus.on("seat:clicked", (payload) => {
      console.log("[Main] Received seat:clicked event", payload);
      const { seat, isMultiSelect, isDragSelect } = payload;
      if (!seat) return;

      if (seat.status === "available") {
        seat.setStatus("selected");
        this.selectedSeats.push(seat);
        if (this.renderer) this.renderer.updateSeat(seat);
        this.uiPanel.setSelectedSeats(this.selectedSeats);
      } else if (seat.status === "selected") {
        seat.setStatus("available");
        this.selectedSeats = this.selectedSeats.filter((s) => s !== seat);
        if (this.renderer) this.renderer.updateSeat(seat);
        this.uiPanel.setSelectedSeats(this.selectedSeats);
      }
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
      const order = new Order(this.selectedSeats);
      order.calculateAmount();
      order.confirm();
      this.storage.saveOrder(order);
      this.uiPanel.setOrderInfo(order);
      this.selectedSeats.forEach((s) => s.setStatus("sold"));
      if (this.renderer) this.renderer.renderSeats(this.selectedSeats);
      this.selectedSeats = [];
      this.uiPanel.setSelectedSeats([]);
    });

    this.eventBus.on("hall:switch", (hallType) => {
      console.log("[Main] Switching hall to:", hallType);
      const data = cinemaData[hallType];
      if (this.cinema && data) {
        this.cinema.reloadHallData(
          data.rows,
          data.cols,
          "top",
          data.soldSeats,
          data.heatMap,
          data.curvature,
        );
        if (this.renderer) this.renderer.render();
        this.selectedSeats = [];
        this.uiPanel.setSelectedSeats([]);
        this.uiPanel.setRecommendation([]);
      }
    });

    this.eventBus.on("admin:view-orders", () => {
      console.log("[Main] Admin viewing orders");
      const orders = this.storage.getAllOrders();
      const users = this.storage.getAllUsers();
      this.uiPanel.renderAdminDashboard(orders, users);
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
  }
}

new MainController();
