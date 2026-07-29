import { MathUtils } from "../utils/math.js";

export class InteractionHandler {
  constructor(canvasElement, renderer, eventBus) {
    this.canvas = canvasElement;
    this.renderer = renderer;
    this.eventBus = eventBus;
    this.pointerDown = false;
    this.dragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.hoveredSeat = null;
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    console.log("[Canvas] InteractionHandler created");
    this.enable();
  }

  enable() {
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.addEventListener("pointercancel", this.handlePointerLeave);
  }

  disable() {
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.removeEventListener("pointercancel", this.handlePointerLeave);
  }

  handlePointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    // 【修复】将 CSS 坐标按比例转换为 Canvas 内部像素坐标，消除尺寸不匹配导致的错位
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const seat = this.renderer.getSeatAtPoint(x, y);
    if (seat !== this.hoveredSeat) {
      this.hoveredSeat = seat;
      this.renderer.setHoveredSeat(seat);
    }
    if (this.pointerDown) {
      const distance = Math.hypot(x - this.dragStart.x, y - this.dragStart.y);
      if (!this.dragging && distance > 6) {
        this.dragging = true;
      }
      if (this.dragging) {
        this.dragCurrent = { x, y };
        this.renderer.setDragRect(this._calculateDragRect());
      }
    }
  }

  handlePointerDown(e) {
    if (e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    // 【修复】同步修改按下时的坐标转换逻辑
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    this.pointerDown = true;
    this.dragging = false;
    this.dragStart = { x, y };
    this.dragCurrent = { ...this.dragStart };
  }

  handlePointerUp(e) {
    if (!this.pointerDown) return;
    const rect = this.canvas.getBoundingClientRect();
    // 【修复】同步修改抬起时的坐标转换逻辑
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const isMultiSelect = e.ctrlKey || e.metaKey;
    const isShiftSelect = e.shiftKey;
    if (this.dragging) {
      const selectedSeats = this._getSeatsInDragArea();
      if (selectedSeats.length > 0) {
        this.eventBus.emit("seat:clicked", {
          seats: selectedSeats,
          isMultiSelect: true,
          isShiftSelect: isShiftSelect,
          isDragSelect: true,
        });
      }
    } else {
      const seat = this.renderer.getSeatAtPoint(x, y);
      if (seat && seat.status !== "sold") {
        this.eventBus.emit("seat:clicked", {
          seat,
          isMultiSelect,
          isShiftSelect,
          isDragSelect: false,
        });
      }
    }
    this.pointerDown = false;
    this.dragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.renderer.clearDragRect();
  }

  handlePointerLeave() {
    this.hoveredSeat = null;
    this.renderer.setHoveredSeat(null);
    if (this.pointerDown) {
      this.pointerDown = false;
      this.dragging = false;
      this.dragStart = null;
      this.dragCurrent = null;
      this.renderer.clearDragRect();
    }
  }

  _calculateDragRect() {
    if (!this.dragStart || !this.dragCurrent) return null;
    const x = Math.min(this.dragStart.x, this.dragCurrent.x);
    const y = Math.min(this.dragStart.y, this.dragCurrent.y);
    const width = Math.abs(this.dragCurrent.x - this.dragStart.x);
    const height = Math.abs(this.dragCurrent.y - this.dragStart.y);
    return { x, y, width, height };
  }

  _getSeatsInDragArea() {
    const rect = this._calculateDragRect();
    if (!rect) return [];
    const seats = this.renderer.cinema.getAllSeats();
    return seats.filter((seat) => {
      const center = this.renderer.getSeatCenter(seat);
      return (
        center.x >= rect.x &&
        center.x <= rect.x + rect.width &&
        center.y >= rect.y &&
        center.y <= rect.y + rect.height &&
        seat.status !== "sold"
      );
    });
  }
}
