import test from "node:test";
import assert from "node:assert/strict";
import { StorageManager } from "../js/storage/storage.js";
import { Order } from "../js/core/order.js";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const memoryStorage = new MemoryStorage();
globalThis.localStorage = memoryStorage;
globalThis.sessionStorage = new MemoryStorage();

function createSeat(row, col, status = "available") {
  return { row, col, status };
}

test("restores sold seats for the same hall and date from saved orders", () => {
  localStorage.clear();
  const storage = new StorageManager();
  sessionStorage.setItem(
    "sc_current_user",
    JSON.stringify({ username: "alice", password: "pw", role: "user" }),
  );
  const order = new Order([createSeat(1, 2), createSeat(3, 4)], {
    dateStr: "8月1日",
    dayOfWeek: 1,
  });
  order.confirm();
  order.username = "alice";
  storage.saveOrder(order);

  const restored = storage.loadSeatStates("small", 1);
  const seatIds = Object.keys(restored);

  assert.ok(seatIds.includes("r1c2"));
  assert.ok(seatIds.includes("r3c4"));
  assert.equal(restored.r1c2, "sold");
  assert.equal(restored.r3c4, "sold");
});
