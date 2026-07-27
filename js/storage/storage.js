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

  refundOrder(orderId) {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.status = "refunded";
      localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));
      return order;
    }
    return null;
  }

  deleteOrder(orderId) {
    let orders = this.getOrders();
    orders = orders.filter((o) => o.id !== orderId);
    localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));
  }

  saveUserRating(seatId, rating) {
    const ratings = this.getUserRatings();
    ratings[seatId] = rating;
    localStorage.setItem(KEY_RATINGS, JSON.stringify(ratings));
  }

  getUserRatings() {
    return JSON.parse(localStorage.getItem(KEY_RATINGS) || "{}");
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
