/**
 * Hình dạng trả về của `GET /api/summary` — chốt ở §5 của
 * 2026-08-06-health-tracker-design.md. Đổi ở đây là đổi hợp đồng với web.
 */

export interface SummaryDay {
  /** "YYYY-MM-DD". */
  date: string;
  /** Số đo thô của đúng ngày đó; `null` nếu ngày đó không ghi. */
  weightKg: number | null;
  /** Trung bình trượt 7 ngày; `null` khi cửa sổ có dưới 2 giá trị. */
  weightMa7: number | null;
  waistCm: number | null;
  waistMa7: number | null;
  /** Luôn là số — ngày không ghi bữa nào là 0, không phải `null`. */
  totalCalories: number;
  mealCount: number;
}

export interface SummaryWeek {
  /** Thứ Hai của tuần, "YYYY-MM-DD". */
  weekStart: string;
  avgCalories: number | null;
  avgWeightKg: number | null;
}

/**
 * Tiến độ mục tiêu. Mọi trường "current*" neo vào HÔM NAY chứ không neo vào
 * `to` của khoảng truy vấn — người dùng xem biểu đồ tháng trước vẫn cần biết
 * mình đang đứng ở đâu hôm nay.
 */
export interface SummaryGoal {
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  currentMa7WeightKg: number | null;
  remainingKg: number | null;
  /** Âm = đang giảm. `null` khi chưa đủ dữ liệu. */
  currentRateKgPerWeek: number | null;
  requiredRateKgPerWeek: number | null;
  /** `null` khi thiếu một trong hai tốc độ để so. */
  onTrack: boolean | null;
}

export interface SummaryResponse {
  days: SummaryDay[];
  weeks: SummaryWeek[];
  goal: SummaryGoal;
}
