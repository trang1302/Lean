// Nguồn sự thật DUY NHẤT cho danh sách số đo cơ thể ở phía web: điều khiển
// các ô của form Hôm nay, nhãn hiển thị, và (đợt `charts-mui`) danh sách biểu
// đồ. Thêm số đo thứ sáu = thêm MỘT dòng ở đây.
//
// Đặt ở `constants/` cạnh `meals.ts` theo đúng quán lệ đã có, không nhét vào
// `features/today/` — `features/charts/` cũng sẽ dùng.

export const MEASURES = [
  { field: 'weightKg', label: 'Cân nặng', unit: 'kg', step: '0.1' },
  { field: 'waistCm', label: 'Vòng bụng', unit: 'cm', step: '0.1' },
  { field: 'chestCm', label: 'Vòng ngực', unit: 'cm', step: '0.1' },
  { field: 'shoulderCm', label: 'Vòng vai', unit: 'cm', step: '0.1' },
  { field: 'armCm', label: 'Vòng bắp tay', unit: 'cm', step: '0.1' },
] as const;

export type MeasureField = (typeof MEASURES)[number]['field'];

/** Chỉ danh sách tên trường — dùng cho vòng lặp và `useFieldErrors`. */
export const MEASURE_FIELDS: readonly MeasureField[] = MEASURES.map((m) => m.field);

/** Nhãn kèm đơn vị, đúng như hiển thị trên `<label>`: "Cân nặng (kg)". */
export function measureLabel(measure: (typeof MEASURES)[number]): string {
  return `${measure.label} (${measure.unit})`;
}
