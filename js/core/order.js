export class Order {
  constructor(seatList) {
    this.id = Date.now().toString(); // 简单生成ID
    this.seatList = seatList;
    this.amount = 0;
    this.status = "pending"; // pending, paid, cancelled, refunded
    this.timestamp = new Date().toISOString();
    console.log("[Core] Order created.");
  }

  calculateAmount() {
    this.amount = this.seatList.length * 50;
    return this.amount;
  }

  confirm() {
    this.status = "paid";
  }

  cancel() {
    this.status = "cancelled";
  }

  refund() {
    console.log("[Core] Order refunding...");
    this.status = "refunded";
  }
}
