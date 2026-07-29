import { User } from "../core/user.js";
import { Order } from "../core/order.js";

const KEY_USERS = "sc_users";
const KEY_ORDERS = "sc_orders";
const KEY_CURRENT_USER = "sc_current_user";
const KEY_RATINGS = "sc_ratings";
const KEY_HALL_TYPE = "sc_last_hall_type";
const KEY_SEAT_STATES = "sc_seat_states"; // 用于持久化座位状态

export class StorageManager {
  constructor() {
    console.log("[Storage] Manager created");
    this._initStorage();
  }
  _initStorage() {
    if (!localStorage.getItem(KEY_USERS)) {
      // 初始化时可以默认插入一个管理员账号方便测试
      const defaultUsers = [
        { username: "admin", password: "admin", role: "admin" },
      ];
      localStorage.setItem(KEY_USERS, JSON.stringify(defaultUsers));
    }
    if (!localStorage.getItem(KEY_ORDERS))
      localStorage.setItem(KEY_ORDERS, JSON.stringify([]));
    if (!localStorage.getItem(KEY_RATINGS))
      localStorage.setItem(KEY_RATINGS, JSON.stringify({}));
    if (!localStorage.getItem(KEY_SEAT_STATES))
      localStorage.setItem(KEY_SEAT_STATES, JSON.stringify({}));
  }

  isAdmin() {
    console.log("[Storage] Checking if current user is admin");
    const user = this.getCurrentUser();
    return user ? user.role === "admin" : false;
  }

  findUser(username) {
    const users = this._getUsers();
    return users.find((u) => u.username === username);
  }

  register(user) {
    console.log(`[Storage] Registering user: ${user.username}`);
    const users = this._getUsers();
    users.push(user);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }

  login(username, password) {
    console.log(`[Storage] Login attempt: ${username}`);
    const users = this._getUsers();
    const user = users.find(
      (u) => u.username === username && u.password === password,
    );
    if (user) {
      localStorage.setItem(KEY_CURRENT_USER, JSON.stringify(user));
      return new User(user.username, user.password, user.role);
    }
    return null;
  }

  getCurrentUser() {
    const userJson = localStorage.getItem(KEY_CURRENT_USER);
    return userJson ? JSON.parse(userJson) : null;
  }

  logout() {
    console.log("[Storage] Logging out");
    localStorage.removeItem(KEY_CURRENT_USER);
  }

  getAllUsers() {
    return this._getUsers().map(({ password, ...u }) => u);
  }

  _getUsers() {
    return JSON.parse(localStorage.getItem(KEY_USERS) || "[]");
  }

  saveOrder(order) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return; // 未登录不保存

    // 获取所有订单，不能只获取当前用户的，否则会覆盖其他用户的订单
    const allOrders = JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]");
    const orderData = {
      id: order.id,
      username: currentUser.username, 
      seatList: order.seatList.map((s) => ({
        row: s.row,
        col: s.col,
        status: s.status,
      })),
      amount: order.amount,
      status: order.status,
      timestamp: order.timestamp,
      date: order.date,
      dayOfWeek: order.dayOfWeek,
    };

    allOrders.push(orderData);
    localStorage.setItem(KEY_ORDERS, JSON.stringify(allOrders));
  }
  getOrders() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];
    const allOrders = JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]");

    // 管理员可以看到所有订单，普通用户只能看到自己的
    if (currentUser.role === "admin") {
      return allOrders;
    }
    return allOrders.filter((o) => o.username === currentUser.username);
  }

  getAllOrders() {
    return this.getOrders();
  }

  // ==================== 订单写操作 ====================
  //
  // ⚠️ 这一组方法必须走 _getAllOrdersRaw(),不能用 getOrders()。
  //
  // getOrders() 对普通用户只返回【他自己的】订单。原实现是
  //   const orders = this.getOrders();   // 只有自己的
  //   ...改一改...
  //   localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));  // 整份写回
  // 于是 A 用户一退票,B、C 用户的订单就被这份只含 A 的数组覆盖掉了,
  // 全部消失。saveOrder() 当初已经踩过同一个坑并修好了(见上面的注释),
  // 退票/删除这两个方法漏掉了。

  /** 读全量订单,不做用户过滤 */
  _getAllOrdersRaw() {
    return JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]");
  }

  _writeAllOrders(orders) {
    localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));
  }

  /**
   * 当前用户有没有权限动这张订单:管理员随便动,普通用户只能动自己的。
   */
  _canModifyOrder(orderData) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    return orderData.username === currentUser.username;
  }

  /** 把 localStorage 里的纯数据还原成 Order 实例,便于复用 core/order.js 的状态方法 */
  _toOrderInstance(orderData) {
    const order = new Order(orderData.seatList || [], {
      dateStr: orderData.date,
      dayOfWeek: orderData.dayOfWeek,
    });
    // Order 构造函数会自己生成 id / timestamp,这里要用存下来的那份覆盖回去
    order.id = orderData.id;
    order.amount = orderData.amount;
    order.status = orderData.status;
    order.timestamp = orderData.timestamp;
    order.username = orderData.username;
    return order;
  }

  /**
   * 退票。
   * @returns {Order|null} 更新后的 Order 实例(接口表要求返回对象而非纯数据),失败返回 null
   */
  refundOrder(orderId) {
    const allOrders = this._getAllOrdersRaw();
    const target = allOrders.find((o) => o.id === orderId);
    if (!target) return null;
    if (!this._canModifyOrder(target)) {
      console.warn(`[Storage] 无权退订单 ${orderId}`);
      return null;
    }
    if (target.status === "refunded" || target.status === "cancelled") {
      console.warn(`[Storage] 订单 ${orderId} 状态为 ${target.status},不可退票`);
      return null;
    }

    const order = this._toOrderInstance(target);
    order.refund(); // 复用 core/order.js 的状态机,不在这里硬写字符串
    target.status = order.status;

    this._writeAllOrders(allOrders);
    return order;
  }

  /**
   * 取消预订(还没付款的订单)。作业模块6 要求「预订 / 取消预订 / 购票 / 退票」四态齐全。
   * @returns {Order|null}
   */
  cancelOrder(orderId) {
    const allOrders = this._getAllOrdersRaw();
    const target = allOrders.find((o) => o.id === orderId);
    if (!target) return null;
    if (!this._canModifyOrder(target)) {
      console.warn(`[Storage] 无权取消订单 ${orderId}`);
      return null;
    }

    const order = this._toOrderInstance(target);
    order.cancel();
    target.status = order.status;

    this._writeAllOrders(allOrders);
    return order;
  }

  /**
   * 删除订单记录。
   * @returns {boolean} 是否真的删掉了
   */
  deleteOrder(orderId) {
    const allOrders = this._getAllOrdersRaw();
    const target = allOrders.find((o) => o.id === orderId);
    if (!target) return false;
    if (!this._canModifyOrder(target)) {
      console.warn(`[Storage] 无权删除订单 ${orderId}`);
      return false;
    }

    this._writeAllOrders(allOrders.filter((o) => o.id !== orderId));
    return true;
  }

  // ==================== 观众手动评分 ====================

  /**
   * 保存观众对某个座位的手动评分。
   * @param {string} seatId 形如 "r1c2"
   * @param {number} rating 0-100 的整数
   */
  saveUserRating(seatId, rating) {
    if (!seatId) return;
    // 评分会直接参与 recommend/score.js 的加权计算,
    // 传进来的脏数据(NaN、字符串、超范围)会污染推荐结果,这里挡住
    const value = Number(rating);
    if (!Number.isFinite(value)) {
      console.warn(`[Storage] 忽略非法评分: ${rating}`);
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(value)));

    const ratings = this.getUserRatings();
    ratings[seatId] = clamped;
    localStorage.setItem(KEY_RATINGS, JSON.stringify(ratings));
  }

  /**
   * @returns {Object<string, number>} 形如 { "r1c2": 85 }
   */
  getUserRatings() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(KEY_RATINGS) || "{}");
    } catch (e) {
      console.warn("[Storage] 评分数据解析失败,已重置", e);
      return {};
    }
    if (!raw || typeof raw !== "object") return {};

    // 历史数据里可能混有非法值,读的时候再筛一遍
    const clean = {};
    for (const [seatId, value] of Object.entries(raw)) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        clean[seatId] = Math.max(0, Math.min(100, Math.round(num)));
      }
    }
    return clean;
  }

  saveHallType(hallType) {
    if (!hallType) return;
    const normalized = String(hallType).trim().toLowerCase();
    if (["small", "medium", "large"].includes(normalized)) {
      localStorage.setItem(KEY_HALL_TYPE, normalized);
    }
  }

  getHallType(defaultType = "small") {
    const stored = localStorage.getItem(KEY_HALL_TYPE);
    const normalized = stored ? String(stored).trim().toLowerCase() : "";
    if (["small", "medium", "large"].includes(normalized)) {
      return normalized;
    }
    return defaultType;
  }
  saveSeatState(hallType, date, seat) {
    if (!hallType || seat == null || date == null) return;
    const allStates = JSON.parse(localStorage.getItem(KEY_SEAT_STATES) || "{}");
    const key = `${hallType}_${date}`;
    if (!allStates[key]) {
      allStates[key] = {};
    }
    const seatId = `r${seat.row}c${seat.col}`;
    allStates[key][seatId] = seat.status;
    localStorage.setItem(KEY_SEAT_STATES, JSON.stringify(allStates));
  }

  saveSeatStates(hallType, date, seats) {
    if (!hallType || !seats || seats.length === 0 || date == null) return;
    const allStates = JSON.parse(localStorage.getItem(KEY_SEAT_STATES) || "{}");
    const key = `${hallType}_${date}`;
    if (!allStates[key]) {
      allStates[key] = {};
    }
    seats.forEach((s) => {
      const seatId = `r${s.row}c${s.col}`;
      allStates[key][seatId] = s.status;
    });
    localStorage.setItem(KEY_SEAT_STATES, JSON.stringify(allStates));
  }

  loadSeatStates(hallType, date) {
    const allStates = JSON.parse(localStorage.getItem(KEY_SEAT_STATES) || "{}");
    const key = `${hallType}_${date}`;
    return allStates[key] || {};
  }

  saveHeatMap(hallType, date, heatMap) {
    if (!hallType || date == null || !heatMap) return;
    const key = `sc_heatmaps`;
    const allHeatMaps = JSON.parse(localStorage.getItem(key) || "{}");
    const mapKey = `${hallType}_${date}`;
    allHeatMaps[mapKey] = heatMap;
    localStorage.setItem(key, JSON.stringify(allHeatMaps));
  }

  loadHeatMap(hallType, date) {
    if (!hallType || date == null) return null;
    const key = `sc_heatmaps`;
    const allHeatMaps = JSON.parse(localStorage.getItem(key) || "{}");
    const mapKey = `${hallType}_${date}`;
    return allHeatMaps[mapKey] || null;
  }
}
