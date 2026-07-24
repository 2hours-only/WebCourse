export const AppConfig = {
  // ==================== 物理尺寸参数（单位：厘米）====================
  // 所有距离都是真实物理距离，与屏幕缩放无关
  physical: {
    // 座位尺寸
    seatWidth: 60, // 座位宽度（厘米）
    seatDepth: 80, // 座位深度（厘米）

    // 座位间隙
    seatGap: 10, // 同排相邻座位之间的间隙（厘米）

    // 排间距
    rowSpacing: 95, // 标准排间距（厘米）
    aisleRowSpacing: 150, // 过道排间距（厘米）- 第3排和第4排之间
    aisleRowIndex: 3, // 过道位置：第3排后（0-indexed）

    // 银幕尺寸
    screenWidth: {
      small: 800, // 小厅银幕宽度（厘米）
      medium: 1400, // 中厅银幕宽度（厘米）
      large: 2300, // 大厅银幕宽度（厘米）
    },
  },

  // ==================== 弧形参数（按影厅类型分别设置）====================
  arcParams: {
    small: {
      name: "小厅",
      rows: 10, // 排数
      cols: 10, // 每排座位数
      radius: 1200, // 圆弧半径（厘米）
      angleSpan: 30, // 角度范围（度）
      screenToFirstRow: 200, // 【新增】银幕到第一排距离（厘米）
    },
    medium: {
      name: "中厅",
      rows: 10,
      cols: 20,
      radius: 2500, // 中厅半径
      angleSpan: 30,
      screenToFirstRow: 300, // 【新增】中厅距离更远
    },
    large: {
      name: "大厅",
      rows: 10,
      cols: 30,
      radius: 4000, // 大厅半径
      angleSpan: 30,
      screenToFirstRow: 400, // 【新增】大厅距离最远
    },
  },

  // ==================== 座位状态颜色 ====================
  colors: {
    free: "#4CAF50",
    selected: "#FFC107",
    sold: "#F44336",
    recommended: "#2196F3",
    hover: "#81C784",
  },

  // ==================== 热力图颜色 ====================
  heatmap: {
    hot: "#FF0000",
    warm: "#FFA500",
    cold: "#0000FF",
  },

  // ==================== 推荐算法权重 ====================
  recommend: {
    viewAngleWeight: 0.4,
    distanceWeight: 0.3,
    comfortWeight: 0.3,
  },

  // ==================== 价格设置 ====================
  price: {
    basePrice: 50,
  },

  // ==================== 辅助方法 ====================
  /**
   * 获取指定影厅的弧形参数
   */
  getHallParams(hallType) {
    return this.arcParams[hallType] || this.arcParams.small;
  },

  /**
   * 计算指定排的物理Y坐标（考虑过道）
   * 【修改】接收 hallParams 参数，从中读取 screenToFirstRow
   * @param {number} rowIndex - 排索引
   * @param {Object} hallParams - 影厅参数（包含 screenToFirstRow）
   * @returns {number} 该排中心座位的物理Y坐标（厘米）
   */
  getRowPhysicalY(rowIndex, hallParams) {
    const { rowSpacing, aisleRowSpacing, aisleRowIndex } = this.physical;
    const screenToFirstRow = hallParams.screenToFirstRow || 200;

    let y = screenToFirstRow;

    for (let r = 0; r < rowIndex; r++) {
      // 如果当前排后面有过道，则下一排距离更大
      if (r === aisleRowIndex - 1) {
        y += aisleRowSpacing;
      } else {
        y += rowSpacing;
      }
    }

    return y;
  },

  /**
   * 获取指定排到银幕的物理距离
   */
  getRowScreenDistance(rowIndex, hallParams) {
    return this.getRowPhysicalY(rowIndex, hallParams);
  },

  /**
   * 获取指定影厅的银幕物理宽度
   */
  getScreenWidth(hallType) {
    return (
      this.physical.screenWidth[hallType] || this.physical.screenWidth.small
    );
  },
};
