export class UIPanel {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus; 
    console.log("[UI] Panel created");

    this.bindDOMEvents();
  }

  bindDOMEvents() {
    const recommendBtn = this.container.querySelector("#recommend-btn");
    if (recommendBtn) {
      recommendBtn.addEventListener("click", () => {
        const userInput = this.getUserInput();
        // 修改点：通过 EventBus 发送事件，而不是直接调用回调
        this.eventBus.emit("user:recommend", userInput);
      });
    }

    const purchaseBtn = this.container.querySelector("#purchase-btn");
    if (purchaseBtn) {
      purchaseBtn.addEventListener("click", () => {
        this.eventBus.emit("user:purchase");
      });
    }
  }

  getUserInput() {
    console.log("[UI] getUserInput");
    const ageSelect = document.getElementById("age-select");
    const countInput = document.getElementById("people-count");

    return {
      age: ageSelect ? ageSelect.value : "adult",
      count: countInput ? parseInt(countInput.value) : 2,
      type: "action",
    };
  }

  

  setRecommendation(seats) {
    const resultDiv = document.getElementById("recommend-result");
    resultDiv.innerHTML = `<p>推荐座位: ${seats.map((s) => `${s.row}排${s.col}座`).join(", ")}</p>`;
  }

  setSelectedSeats(seats) {
    const selectedDiv = document.getElementById("selected-seats");
    selectedDiv.innerHTML = `<p>已选: ${seats.map((s) => `${s.row}排${s.col}座`).join(", ")}</p>`;

    const purchaseBtn = document.getElementById("purchase-btn");
    if (purchaseBtn) purchaseBtn.disabled = seats.length === 0;
  }

  setOrderInfo(order) {
    const orderDiv = document.getElementById("order-info");
    orderDiv.innerHTML = `<p>订单成功! 总额: ¥${order.amount}</p>`;
  }
}
