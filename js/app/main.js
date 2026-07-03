import { Cinema } from "../core/cinema.js";
import { Order } from "../core/order.js";
import { CanvasRenderer } from "../canvas/renderer.js";
import { InteractionHandler } from "../canvas/interaction.js";
import { HeatmapRenderer } from "../canvas/heatmap.js";
import { RecommendEngine } from "../recommend/recommend.js";
import { UIPanel } from "../ui/panel.js";
import { StorageManager } from "../storage/storage.js";
import { EventBus } from "../utils/eventBus.js";

class MainController {
  constructor() {
    // 1. 初始化全局事件总线
    this.eventBus = new EventBus();
    this.selectedSeats = [];
    this.init();
  }

  init() {
    console.log("[Main] App Starting...");

    // 初始化数据层
    this.cinema = new Cinema(8, 10, "top");
    this.storage = new StorageManager();

    // 初始化 UI 层 (注入 eventBus 供其发送消息)
    this.uiPanel = new UIPanel(
      document.querySelector(".main-container"),
      this.eventBus,
    );

    // 初始化 Canvas 层
    const canvasEl = this.getElementByIdOrCreate("cinema-canvas");

    // 响应式处理：初始化 Canvas 尺寸
    this.resizeCanvas(canvasEl);
    window.addEventListener("resize", () => this.handleResize(canvasEl));

    this.renderer = new CanvasRenderer(canvasEl, this.cinema);

    // 热力图层
    this.heatmapRenderer = new HeatmapRenderer(this.renderer);

    // 交互层 (注入 eventBus 供其发送消息)
    this.interaction = new InteractionHandler(
      canvasEl,
      this.renderer,
      this.eventBus,
    );

    // 推荐层
    this.recommendEngine = new RecommendEngine();

    // 2. 注册事件监听 (Main 层作为唯一的调度中心)
    this.registerEvents();

    // 3. 初始渲染
    this.renderer.render();
  }

  getElementByIdOrCreate(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("canvas");
      el.id = id;
      document.querySelector(".cinema-container").appendChild(el);
    }
    return el;
  }

  // --- 响应式架构支持 ---
  handleResize(canvasEl) {
    this.resizeCanvas(canvasEl);
    // 重新渲染以适应新尺寸
    this.renderer.render();
    this.heatmapRenderer.render(); // 如果热力图是基于绝对位置的，也需要重绘
  }

  resizeCanvas(canvasEl) {
    // 获取容器宽度，动态设置 Canvas 宽度，支持 PC/iPad/手机
    const container = document.querySelector(".cinema-container");
    if (container) {
      canvasEl.width = container.clientWidth;
      // 保持一定的宽高比，或者固定高度
      canvasEl.height = Math.min(container.clientWidth * 0.6, 600);
    }
  }
  // ---------------------

  registerEvents() {
    // 监听：用户点击推荐
    this.eventBus.on("user:recommend", (userPref) => {
      console.log("[Main] Received user:recommend event", userPref);
      const seats = this.recommendEngine.recommend(userPref, this.cinema);

      // 更新数据状态
      seats.forEach((s) => s.setRecommended(true));

      // 更新视图 (通过 Renderer 和 UI)
      this.renderer.renderSeats(seats);
      this.heatmapRenderer.generate(seats); // 计算热力
      this.heatmapRenderer.render(); // 绘制热力
      this.uiPanel.setRecommendation(seats);
    });

    // 监听：用户点击座位
    this.eventBus.on("seat:clicked", (seat) => {
      console.log("[Main] Received seat:clicked event", seat);

      // 业务逻辑判断
      if (seat.status === "available") {
        seat.setStatus("selected");
        this.selectedSeats.push(seat);
        // 触发 UI 更新
        this.renderer.updateSeat(seat);
        this.uiPanel.setSelectedSeats(this.selectedSeats);
      } else if (seat.status === "selected") {
        // 支持取消选择
        seat.setStatus("available");
        this.selectedSeats = this.selectedSeats.filter((s) => s !== seat);
        this.renderer.updateSeat(seat);
        this.uiPanel.setSelectedSeats(this.selectedSeats);
      }
    });

    // 监听：用户点击购票
    this.eventBus.on("user:purchase", () => {
      console.log("[Main] Received user:purchase event");
      if (this.selectedSeats.length === 0) return;

      // 生成订单
      const order = new Order(this.selectedSeats);
      order.calculateAmount();

      // 保存订单
      this.storage.saveOrder(order);

      // 更新 UI
      this.uiPanel.setOrderInfo(order);

      // 更新座位状态
      this.selectedSeats.forEach((s) => s.setStatus("sold"));
      this.renderer.renderSeats(this.selectedSeats);

      // 重置
      this.selectedSeats = [];
      this.uiPanel.setSelectedSeats([]);
    });

    // 监听：用户切换无障碍模式 (AccessibilityManager 发出的事件)
    this.eventBus.on("accessibility:change", (config) => {
      console.log("[Main] Accessibility settings changed", config);
      // 这里可以触发一些 Canvas 内部的重绘逻辑（例如放大图标、改变对比度）
      this.renderer.render();
    });
  }
}

new MainController();
