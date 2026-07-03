export class InteractionHandler {
  constructor(canvasElement, renderer, eventBus) {
    this.canvas = canvasElement;
    this.renderer = renderer;
    this.eventBus = eventBus;
    this.isDragging = false;
    console.log("[Canvas] InteractionHandler created");
    this.canvas.addEventListener("click", (e) => this.handleClick(e));
  }
  handleClick(e) {
    console.log("[Canvas] Handle click event");
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 模拟获取 Seat 对象
    const mockSeat = this.renderer.cinema.getSeat(0, 0);
    const isMultiSelect = e.ctrlKey;
    const isDragSelect = this.isDragging;

    this.eventBus.emit("seat:clicked", {
      seat: mockSeat,
      isMultiSelect: isMultiSelect,
      isDragSelect: isDragSelect,
    });
  }
  enableDragSelect(enabled) {
    console.log(`[Canvas] enableDragSelect -> ${enabled}`);
    this.isDragging = enabled;
  }
}
