export class DialogManager {
  showConfirm(msg) {
    console.log(`[UI] Dialog: ${msg}`);
    return confirm(msg);
  }
  showSuccess(message) {
    console.log(`[UI] Dialog Success: ${message}`);
    alert(`成功: ${message}`);
  }
  showError(message) {
    console.log(`[UI] Dialog Error: ${message}`);
    alert(`错误: ${message}`);
  }
  showRatingDialog(seat, onSubmit) {
    console.log(
      `[UI] Dialog showRatingDialog for seat(${seat.row},${seat.col})`,
    );
  }
}
