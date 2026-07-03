export class StorageManager {
  constructor() {
    console.log("[Storage] Manager created");
  }

  saveOrder(order) {
    console.log(`[Storage] saveOrder: ${order.id || "mock"}`);
  }

  getOrders() {
    console.log("[Storage] getOrders");
    return [];
  }

  deleteOrder(orderId) {
    console.log(`[Storage] deleteOrder: ${orderId}`);
  }

  saveSeatState(seat) {
    console.log(`[Storage] saveSeatState: ${seat.row},${seat.col}`);
  }

  loadSeatStates() {
    console.log("[Storage] loadSeatStates");
    return [];
  }
}
