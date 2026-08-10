// Hàm thuần biến đổi HÌNH DẠNG dữ liệu cho trang Biểu đồ — đếm, ghép mảng,
// lọc. KHÔNG có phép tính thống kê nào ở đây (MA7, tốc độ, `onTrack`,
// `remainingKg` đều do backend tính, xem docs/overview/03-stats.md và
// docs/features/web-charts/PLAN.md §5.3: thấy `/ 7`, `reduce` cộng trung
// bình, hay `.filter()` rồi chia độ dài trong file này là dấu hiệu công
// thức đang bị nhân bản sai chỗ). Không import React, không import Recharts
// — test được mà không cần render (PLAN §5.2).
//
// Đây là nơi sống của bốn cạm bẫy B2 (điều phối viên):
//   1. MA7 nổi bật hơn điểm thô            → thực thi ở component, không ở đây
//   2. `weightMa7 === null` phải ngắt đoạn  → `mergeWeeklyAvg`/không `?? 0` ở đây
//   3. `avgCalories === null` khác `0`      → `mergeWeeklyAvg` giữ `null` nguyên vẹn
//   4. tuần cắt cụt                         → `dropTruncatedWeeks` (phương án A, xem SPEC §7.5)

import type { SummaryDay, SummaryWeek } from '../../../types/api';
import { addDaysIso } from './dateMath';

/** Bốn trường số của `SummaryDay` có thể là `null` — dùng cho `countRealPoints`.
 * `totalCalories`/`mealCount` CỐ Ý không nằm trong danh sách này: chúng không
 * bao giờ `null` (SPEC §2.2), "có dữ liệu calo" là một câu hỏi khác, xem
 * `hasCalorieData`. */
export type NullableDayKey = 'weightKg' | 'weightMa7' | 'waistCm' | 'waistMa7';

/**
 * Số ngày có giá trị thật (`!== null`) cho một trường của `days`. Dùng để
 * quyết định trạng thái rỗng (SPEC §6): "cần ít nhất 2 ngày dữ liệu để vẽ
 * xu hướng" nghĩa là đếm theo hàm này, KHÔNG phải `days.length` — `days`
 * không bao giờ rỗng (SPEC §2.2, §6), độ dài của nó chỉ phản ánh độ dài
 * khoảng `[from, to]`, không phản ánh có dữ liệu hay không.
 */
export function countRealPoints(days: readonly SummaryDay[], key: NullableDayKey): number {
  return days.filter((day) => day[key] !== null).length;
}

/**
 * Trạng thái rỗng riêng của biểu đồ calo (SPEC §6: "xét từng biểu đồ riêng").
 * Khác `countRealPoints` vì `totalCalories`/`mealCount` không bao giờ `null`
 * — "chưa có dữ liệu calo" nghĩa là mọi ngày đều `mealCount === 0`, không
 * phải một giá trị `null` nào cần đếm.
 */
export function hasCalorieData(days: readonly SummaryDay[]): boolean {
  return days.some((day) => day.mealCount > 0);
}

/** `SummaryDay` kèm trung bình tuần của tuần chứa ngày đó — đầu ra của
 * `mergeWeeklyAvg`, đầu vào của `CaloriesChart` (SPEC §5.2, phương án "ghép
 * vào days": đường trung bình tuần thành đường bậc thang trên trục ngày). */
export interface DayWithWeeklyAvg extends SummaryDay {
  weekAvgCalories: number | null;
}

/**
 * Ghép `weeks[].avgCalories` vào từng ngày của `days`, theo tuần chứa ngày
 * đó (`weekStart <= date <= weekStart + 6`). Giữ `null` NGUYÊN VẸN — tuyệt
 * đối không `?? 0` (SPEC §4.3): một tuần `avgCalories === null` (không ghi
 * bữa nào) phải làm CẢ BẢY ngày của tuần đó thành lỗ hổng trên đường trung
 * bình tuần, đúng ý "ngắt đoạn thay vì nói dối bằng số 0".
 *
 * Truyền `weeks` đã lọc qua `dropTruncatedWeeks` (nếu áp dụng phương án A,
 * SPEC §7.5) để tuần cắt cụt không có mặt ở đây — ngày nào không khớp tuần
 * nào (kể cả vì tuần chứa nó đã bị lọc bỏ) nhận `weekAvgCalories: null`,
 * đúng hành vi "không vẽ" mà phương án A đòi hỏi.
 */
export function mergeWeeklyAvg(
  days: readonly SummaryDay[],
  weeks: readonly SummaryWeek[],
): DayWithWeeklyAvg[] {
  return days.map((day) => {
    const week = weeks.find((w) => isDateInWeek(day.date, w.weekStart));
    // `week?.avgCalories` chứ không `week?.avgCalories ?? 0` — nếu `week` là
    // `undefined` (không có tuần khớp) HOẶC `week.avgCalories` đã là `null`,
    // kết quả phải là `null`, không phải `0`.
    return { ...day, weekAvgCalories: week ? week.avgCalories : null };
  });
}

function isDateInWeek(date: string, weekStart: string): boolean {
  const weekEnd = addDaysIso(weekStart, 6);
  // So sánh chuỗi "YYYY-MM-DD" — đúng thứ tự thời gian, không cần parse
  // (docs/overview/04-conventions.md).
  return date >= weekStart && date <= weekEnd;
}

/**
 * Lọc bỏ tuần "cắt cụt" — tuần mà `[weekStart, weekStart+6]` KHÔNG nằm trọn
 * trong `[from, to]`. Đây là phương án A đã chốt cho SPEC §7.5 (xem báo cáo
 * `.superpowers/sdd/web-shell/web-charts-report.md` để biết lý do chọn A
 * thay vì B/C): so `weekStart` và `weekStart + 6` với khoảng đang xem, tuần
 * nào không lọt trọn thì không đưa vào `mergeWeeklyAvg` — đường trung bình
 * tuần chỉ hiện những điểm so sánh ngang hàng được (đủ 7 ngày), không hiện
 * một điểm 3/7 ngày cạnh một điểm 7/7 ngày mà không có cách nào phân biệt
 * (SummaryWeek không có trường đánh dấu cắt cụt — SPEC §4.4).
 */
export function dropTruncatedWeeks(
  weeks: readonly SummaryWeek[],
  from: string,
  to: string,
): SummaryWeek[] {
  return weeks.filter((week) => {
    const weekEnd = addDaysIso(week.weekStart, 6);
    return week.weekStart >= from && weekEnd <= to;
  });
}

/** `SummaryDay` kèm HAI trường trung bình tuần khác nhau — dùng cho
 * `CaloriesChart`, nơi đường vẽ và câu chữ tooltip phải nói hai chuyện khác
 * nhau (xem docstring hai trường bên dưới). */
export interface CaloriesChartDatum extends SummaryDay {
  /** Dùng để VẼ đường trung bình tuần. `null` khi tuần không ghi bữa nào
   * (SPEC §4.3) HOẶC khi tuần bị loại vì cắt cụt (phương án A đã chốt cho
   * SPEC §7.5) — cả hai lý do đều hợp lệ để KHÔNG vẽ một điểm ở đó. */
  weekAvgCalories: number | null;
  /** Dùng cho TOOLTIP. Giá trị THẬT từ backend cho tuần chứa ngày này,
   * KHÔNG bị ảnh hưởng bởi việc lọc cắt cụt — `null` CHỈ khi tuần đó thật
   * sự không ghi bữa nào. Cần tách riêng khỏi `weekAvgCalories` vì lý do
   * "null" của hai trường có thể khác nhau: một ngày ở tuần cắt cụt có
   * `weekAvgCalories: null` (không vẽ) nhưng `weekAvgCaloriesRaw` có thể
   * vẫn là một số thật (người dùng có ghi bữa, tuần chỉ là chưa trọn) —
   * tooltip phải nói đúng cái này, không được lỡ tay báo "Không ghi bữa
   * nào" cho một tuần mà người dùng có ghi. */
  weekAvgCaloriesRaw: number | null;
}

/**
 * Dựng dữ liệu cho `CaloriesChart`: ghép `days` với CẢ HAI phiên bản trung
 * bình tuần — bản đã lọc cắt cụt (để vẽ) và bản thô (để tooltip nói đúng
 * sự thật bất kể có vẽ hay không).
 */
export function buildCaloriesChartData(
  days: readonly SummaryDay[],
  weeks: readonly SummaryWeek[],
  from: string,
  to: string,
): CaloriesChartDatum[] {
  const fullWeeks = dropTruncatedWeeks(weeks, from, to);
  const forChart = mergeWeeklyAvg(days, fullWeeks);
  const raw = mergeWeeklyAvg(days, weeks);
  return forChart.map((d, i) => ({
    ...d,
    weekAvgCaloriesRaw: raw[i]?.weekAvgCalories ?? null,
  }));
}
