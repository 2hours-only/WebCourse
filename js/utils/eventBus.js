export class EventBus {
  constructor() {
    this.events = {};
  }
  on(eventName, callback) {
    if (!this.events[eventName]) this.events[eventName] = [];
    this.events[eventName].push(callback);
  }
  emit(eventName, payload) {
    if (this.events[eventName]) {
      this.events[eventName].forEach((cb) => cb(payload));
    }
  }
}
