import { daysBetween } from '../../lib/time.js';

const DAYS_PER_WEEK = 7;

/** Khoảng lùi để đo xu hướng: so MA7 hôm nay với MA7 của 14 ngày trước. */
const TREND_WINDOW_WEEKS = 2;

/**
 * Tốc độ thay đổi cân nặng hiện tại, kg/tuần. Âm = đang giảm.
 *
 * Dùng MA7 ở CẢ HAI đầu chứ không dùng số đo thô — cân nặng dao động 1–2 kg/ngày
 * nên lấy hai điểm thô sẽ cho ra tốc độ vô nghĩa.
 *
 * Trả `null` nếu một trong hai MA7 là `null`.
 */
export function currentRateKgPerWeek(
  ma7Today: number | null,
  ma7TwoWeeksAgo: number | null,
): number | null {
  if (ma7Today === null || ma7TwoWeeksAgo === null) return null;
  return (ma7Today - ma7TwoWeeksAgo) / TREND_WINDOW_WEEKS;
}

/**
 * Tốc độ cần đạt để chạm mục tiêu đúng hạn, kg/tuần. Âm = cần giảm.
 *
 * Trả `null` khi chưa đặt mục tiêu, khi MA7 hiện tại là `null`, hoặc khi
 * `targetDateIso` đã qua / rơi đúng hôm nay (không còn tuần nào để chia).
 */
export function requiredRateKgPerWeek(
  ma7Today: number | null,
  targetWeightKg: number | null,
  targetDateIso: string | null,
  todayIso: string,
): number | null {
  if (ma7Today === null || targetWeightKg === null || targetDateIso === null) return null;

  const daysLeft = daysBetween(todayIso, targetDateIso);
  if (daysLeft <= 0) return null;

  return (targetWeightKg - ma7Today) / (daysLeft / DAYS_PER_WEEK);
}

/**
 * Có đang đi đúng tiến độ không.
 *
 * Hướng đọc từ dấu của `requiredRate`: cần giảm (âm) thì `currentRate` phải âm
 * hơn hoặc bằng; cần tăng (dương) thì phải dương hơn hoặc bằng.
 *
 * `requiredRate === 0` nghĩa là đã ở đúng mục tiêu — tính là đúng tiến độ.
 * (Spec §6 không nói rõ ca này; quyết định tại đây.)
 *
 * Trả `null` nếu thiếu một trong hai vế.
 */
export function isOnTrack(
  currentRate: number | null,
  requiredRate: number | null,
): boolean | null {
  if (currentRate === null || requiredRate === null) return null;
  if (requiredRate === 0) return true;
  return requiredRate < 0 ? currentRate <= requiredRate : currentRate >= requiredRate;
}

/**
 * Khoảng cách còn lại tới mục tiêu, LUÔN dương — biểu thị độ lớn chứ không
 * biểu thị hướng. Hướng đọc từ dấu của `requiredRateKgPerWeek`.
 *
 * Trả `null` khi chưa đặt mục tiêu hoặc MA7 hiện tại là `null`.
 */
export function remainingKg(
  ma7Today: number | null,
  targetWeightKg: number | null,
): number | null {
  if (ma7Today === null || targetWeightKg === null) return null;
  return Math.abs(targetWeightKg - ma7Today);
}
