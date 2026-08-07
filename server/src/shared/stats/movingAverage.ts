import { addDays, enumerateDates } from '../../lib/time.js';

/** Một số đo gắn với ngày lịch "YYYY-MM-DD". */
export interface DatedValue {
  date: string;
  value: number;
}

export interface MovingAveragePoint {
  date: string;
  /** `null` khi cửa sổ có dưới 2 giá trị — xem MIN_VALUES_IN_WINDOW. */
  ma7: number | null;
}

/** Cửa sổ tính theo NGÀY LỊCH [d-6, d], không phải "7 điểm gần nhất". */
const WINDOW_DAYS = 7;

/**
 * Dưới ngưỡng này trả `null`. Một số đo đơn lẻ không phải là trung bình —
 * hiển thị nó như thể là xu hướng sẽ khiến người dùng đọc sai.
 */
const MIN_VALUES_IN_WINDOW = 2;

/**
 * Trung bình trượt 7 ngày cho mỗi ngày trong [fromIso, toIso].
 *
 * Hàm thuần: không đọc DB, không biết gì về HTTP, không sửa mảng đầu vào.
 * Định nghĩa đầy đủ ở §6 của 2026-08-06-health-tracker-design.md.
 *
 * Ngày không có số đo bị bỏ qua, KHÔNG nội suy và KHÔNG tính là 0.
 * Điểm nằm trước `fromIso` vẫn được dùng nếu lọt vào cửa sổ của ngày đầu.
 */
export function movingAverage7(
  points: readonly DatedValue[],
  fromIso: string,
  toIso: string,
): MovingAveragePoint[] {
  const valuesByDate = new Map<string, number[]>();
  for (const point of points) {
    const existing = valuesByDate.get(point.date);
    if (existing) existing.push(point.value);
    else valuesByDate.set(point.date, [point.value]);
  }

  return enumerateDates(fromIso, toIso).map((date) => {
    const window: number[] = [];
    for (let daysBack = 0; daysBack < WINDOW_DAYS; daysBack++) {
      const dayValues = valuesByDate.get(addDays(date, -daysBack));
      if (dayValues) window.push(...dayValues);
    }

    if (window.length < MIN_VALUES_IN_WINDOW) return { date, ma7: null };

    const sum = window.reduce((total, value) => total + value, 0);
    return { date, ma7: sum / window.length };
  });
}
