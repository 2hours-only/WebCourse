export class Order {
  constructor(seatList) {
    this.seatList = seatList;
    this.amount = 0;
    this.status = "pending"; // pending / paid / cancelled
    console.log("[Core] Order created.");
  }

  calculateAmount() {
    console.log("[Core] Order calculateAmount");
    // Mock logic
    this.amount = this.seatList.length * 50;
    return this.amount;
  }

  confirm() {
    console.log("[Core] Order confirm");
    this.status = "paid";
  }

  cancel() {
    console.log("[Core] Order cancel");
    this.status = "cancelled";
  }
}
