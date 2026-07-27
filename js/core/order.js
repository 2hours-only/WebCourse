export class Order {
  constructor(seatList, dateInfo = {}) {
    this.id = Date.now().toString(); // 简单生成ID
    this.seatList = seatList;
    this.amount = 0;
    this.status = "pending"; // pending, paid, cancelled, refunded
    this.timestamp = new Date().toISOString();
    this.username = "未知"; // 默认用户名字段
    this.date = dateInfo.dateStr || "未知"; // 格式如 "8月1日"
    this.dayOfWeek = dateInfo.dayOfWeek != null ? dateInfo.dayOfWeek : 0; // 0-6 (0是周日)
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
