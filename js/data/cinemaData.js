function generate7DaysData(rows, cols) {
  const heatMaps = [];
  const soldSeats = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayHeat = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rowFactor =
          1 - Math.abs(r - (rows - 1) / 2) / ((rows - 1) / 2 || 1);
        const colFactor =
          1 - Math.abs(c - (cols - 1) / 2) / ((cols - 1) / 2 || 1);
        let baseHeat = (rowFactor + colFactor) / 2;
        // JS getDay() 中 0=周日, 6=周六
        let dayFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.15 : -0.1;
        let heat = baseHeat + dayFactor + (Math.random() * 0.1 - 0.05);
        heat = Math.max(0, Math.min(1, heat));
        dayHeat.push({ row: r, col: c, value: heat });
      }
    }
    heatMaps.push(dayHeat);
    // 模拟一些默认已售座位，例如周一(dayOfWeek=1)的第一排
    soldSeats.push(
      dayOfWeek === 1 && rows === 10 && cols === 10 ? [{ row: 0, col: 0 }] : [],
    );
  }
  return { heatMaps, soldSeats };
}

const smallData = generate7DaysData(10, 10);
const mediumData = generate7DaysData(10, 20);
const largeData = generate7DaysData(10, 30);

export default {
  small: {
    name: "小厅",
    rows: 10,
    cols: 10,
    curvature: 0.1,
    soldSeats: smallData.soldSeats,
    heatMaps: smallData.heatMaps,
  },
  medium: {
    name: "中厅",
    rows: 10,
    cols: 20,
    curvature: 0.15,
    soldSeats: mediumData.soldSeats,
    heatMaps: mediumData.heatMaps,
  },
  large: {
    name: "大厅",
    rows: 10,
    cols: 30,
    curvature: 0.2,
    soldSeats: largeData.soldSeats,
    heatMaps: largeData.heatMaps,
  },
};
