import { User } from "../core/user.js";
import { Order } from "../core/order.js";

const KEY_USERS = "sc_users";
const KEY_ORDERS = "sc_orders";
const KEY_CURRENT_USER = "sc_current_user";
const KEY_RATINGS = "sc_ratings";

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
    const orders = this.getOrders();
    const orderData = {
      id: order.id,
      seatList: order.seatList.map((s) => ({
        row: s.row,
        col: s.col,
        status: s.status,
      })),
      amount: order.amount,
      status: order.status,
      timestamp: order.timestamp,
    };
    orders.push(orderData);
    localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));
  }

  getOrders() {
    return JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]");
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

  saveSeatState(seat) {}

  loadSeatStates() {
    return [];
  }
}
