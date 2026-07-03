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
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const mockSeat = this.renderer.cinema.getSeat(0, 0);
    this.eventBus.emit("seat:clicked", mockSeat);
  }

  enableDragSelect(enabled) {
    console.log(`[Canvas] enableDragSelect -> ${enabled}`);
  }
}
