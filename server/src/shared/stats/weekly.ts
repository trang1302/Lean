import { addDays, daysBetween, startOfWeekMonday } from '../../lib/time.js';

const DAYS_PER_WEEK = 7;

export interface DatedCalories {
  date: string;
  calories: number;
}

export interface DatedWeight {
  date: string;
  weightKg: number;
}

export interface WeekSummary {
  /** Thứ Hai của tuần, dạng "YYYY-MM-DD". */
  weekStart: string;
  /** `null` nếu cả tuần không ghi bữa nào. */
  avgCalories: number | null;
  /** `null` nếu cả tuần không có số đo cân nặng nào. */
  avgWeightKg: number | null;
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Tổng hợp theo tuần cho mỗi tuần chạm vào [fromIso, toIso]. Tuần bắt đầu THỨ HAI.
 *
 * Hàm thuần: không đọc DB, không biết gì về HTTP, không sửa mảng đầu vào.
 * Định nghĩa đầy đủ ở §6 của 2026-08-06-health-tracker-design.md.
 *
 * `avgCalories` là trung bình TỔNG CALO MỖI NGÀY, chỉ tính trên những ngày
 * CÓ ÍT NHẤT MỘT BỮA. Tính ngày quên ghi là 0 calo sẽ kéo trung bình xuống
 * sai lệch — người dùng quên ghi chứ không phải nhịn ăn.
 *
 * `avgWeightKg` dùng số đo THÔ, không phải MA7: đây là "cân nặng trung bình
 * tuần đó", không phải một phép làm mượt xu hướng.
 */
export function weeklySummaries(
  meals: readonly DatedCalories[],
  weights: readonly DatedWeight[],
  fromIso: string,
  toIso: string,
): WeekSummary[] {
  if (daysBetween(fromIso, toIso) < 0) return [];

  const inRange = (date: string): boolean => date >= fromIso && date <= toIso;

  // Gộp calo theo ngày trước — một ngày nhiều bữa vẫn chỉ là MỘT ngày khi
  // lấy trung bình, nếu không ngày ăn nhiều bữa sẽ bị đếm trội.
  const caloriesByDate = new Map<string, number>();
  for (const meal of meals) {
    if (!inRange(meal.date)) continue;
    caloriesByDate.set(meal.date, (caloriesByDate.get(meal.date) ?? 0) + meal.calories);
  }

  const dailyTotalsByWeek = new Map<string, number[]>();
  for (const [date, total] of caloriesByDate) {
    const week = startOfWeekMonday(date);
    const bucket = dailyTotalsByWeek.get(week);
    if (bucket) bucket.push(total);
    else dailyTotalsByWeek.set(week, [total]);
  }

  const weightsByWeek = new Map<string, number[]>();
  for (const entry of weights) {
    if (!inRange(entry.date)) continue;
    const week = startOfWeekMonday(entry.date);
    const bucket = weightsByWeek.get(week);
    if (bucket) bucket.push(entry.weightKg);
    else weightsByWeek.set(week, [entry.weightKg]);
  }

  const out: WeekSummary[] = [];
  const lastWeekStart = startOfWeekMonday(toIso);
  for (
    let weekStart = startOfWeekMonday(fromIso);
    weekStart <= lastWeekStart;
    weekStart = addDays(weekStart, DAYS_PER_WEEK)
  ) {
    const dailyTotals = dailyTotalsByWeek.get(weekStart);
    const weekWeights = weightsByWeek.get(weekStart);
    out.push({
      weekStart,
      avgCalories: dailyTotals ? mean(dailyTotals) : null,
      avgWeightKg: weekWeights ? mean(weekWeights) : null,
    });
  }
  return out;
}
