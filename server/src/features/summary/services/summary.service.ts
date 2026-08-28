import { addDays, enumerateDates, todayIso } from '../../../lib/time.js';
import {
  movingAverage7,
  currentRateKgPerWeek,
  requiredRateKgPerWeek,
  isOnTrack,
  remainingKg,
  weeklySummaries,
} from '../../../shared/stats/index.js';
import type { DatedValue, MovingAveragePoint } from '../../../shared/stats/index.js';
import type { SummaryQuery } from '../dtos/summary.request.js';
import type { SummaryDay, SummaryGoal, SummaryResponse } from '../dtos/summary.response.js';
import * as summaryRepository from '../repositories/summary.repository.js';

/**
 * Service KHÔNG chứa công thức nào. Mọi phép tính nằm ở `shared/stats` và đã có
 * unit test riêng; ở đây chỉ là lấy dữ liệu → nối vào hàm → xếp lại hình dạng.
 */

/**
 * Cửa sổ MA7 của ngày `d` là [d-6, d], nên muốn MA7 của chính ngày `from` đúng
 * thì phải lấy dữ liệu từ `from - 6`. Thiếu 6 ngày này là bug im lặng: MA7 của
 * 6 ngày đầu khoảng sẽ ra `null` oan.
 */
const MA7_LOOKBACK_DAYS = 6;

/** `currentRateKgPerWeek` so MA7 hôm nay với MA7 của 14 ngày trước. */
const TREND_LOOKBACK_DAYS = 14;

/**
 * Năm số đo, mỗi cái một cặp (trường thô, trường MA7). Đây là nguồn sự thật
 * cho toàn bộ vòng lặp bên dưới — trước đây mỗi số đo là một khối code chép
 * lại, và chép lại chính là cách chắc chắn nhất để hai chỗ lệch nhau.
 */
const MEASURES = [
  { raw: 'weightKg', ma7: 'weightMa7' },
  { raw: 'waistCm', ma7: 'waistMa7' },
  { raw: 'chestCm', ma7: 'chestMa7' },
  { raw: 'shoulderCm', ma7: 'shoulderMa7' },
  { raw: 'armCm', ma7: 'armMa7' },
] as const;

function earlier(a: string, b: string): string {
  return a <= b ? a : b;
}

function later(a: string, b: string): string {
  return a >= b ? a : b;
}

function ma7ByDate(points: readonly MovingAveragePoint[]): Map<string, number | null> {
  return new Map(points.map((point) => [point.date, point.ma7]));
}

export async function getSummary(userId: string, range: SummaryQuery): Promise<SummaryResponse> {
  const today = todayIso();
  const trendFrom = addDays(today, -TREND_LOOKBACK_DAYS);

  // Khoảng dữ liệu THÔ cần lấy, rộng hơn [from, to] ở cả hai đầu:
  //  · lùi 6 ngày trước `from` — cửa sổ MA7 của ngày `from`;
  //  · lùi tới `today - 20` — cửa sổ MA7 của mốc `today - 14` mà currentRate cần;
  //  · tiến tới `today` khi `to` ở quá khứ — khối `goal` neo vào hôm nay, không neo vào `to`.
  const dataFrom = earlier(
    addDays(range.from, -MA7_LOOKBACK_DAYS),
    addDays(trendFrom, -MA7_LOOKBACK_DAYS),
  );
  const dataTo = later(range.to, today);

  const [bodyLogs, mealTotals, goal] = await Promise.all([
    summaryRepository.findBodyLogsBetween(userId, dataFrom, dataTo),
    // Calo không đi vào phép trung bình trượt nào nên chỉ cần đúng [from, to].
    summaryRepository.findDailyMealTotals(userId, range.from, range.to),
    summaryRepository.findGoal(userId),
  ]);

  // Gom điểm dữ liệu cho từng số đo. Bỏ qua `null` — "không đo" khác "đo ra 0".
  const pointsByMeasure = new Map<string, DatedValue[]>(
    MEASURES.map((measure) => [measure.raw, [] as DatedValue[]]),
  );
  for (const log of bodyLogs) {
    for (const measure of MEASURES) {
      const value = log[measure.raw];
      if (value !== null) {
        pointsByMeasure.get(measure.raw)!.push({ date: log.date, value });
      }
    }
  }

  const ma7ByMeasure = new Map<string, Map<string, number | null>>(
    MEASURES.map((measure) => [
      measure.raw,
      ma7ByDate(movingAverage7(pointsByMeasure.get(measure.raw)!, range.from, range.to)),
    ]),
  );

  // Cân nặng vẫn cần riêng cho xu hướng và trung bình tuần — cả hai chỉ nói về
  // cân nặng, không mở rộng sang bốn vòng.
  const weightPoints = pointsByMeasure.get('weightKg')!;

  // Một lần gọi cho cả hai đầu của xu hướng: MA7 tại `today` và tại `today - 14`.
  const trendMa7 = ma7ByDate(movingAverage7(weightPoints, trendFrom, today));
  const ma7Today = trendMa7.get(today) ?? null;
  const ma7TwoWeeksAgo = trendMa7.get(trendFrom) ?? null;

  const bodyLogByDate = new Map(bodyLogs.map((log) => [log.date, log]));
  const mealsByDate = new Map(mealTotals.map((total) => [total.date, total]));

  const days: SummaryDay[] = enumerateDates(range.from, range.to).map((date) => {
    const log = bodyLogByDate.get(date);
    const meals = mealsByDate.get(date);
    const day = {
      date,
      totalCalories: meals?.totalCalories ?? 0,
      mealCount: meals?.mealCount ?? 0,
    } as SummaryDay;

    for (const measure of MEASURES) {
      // Ép kiểu vì `measure.raw` là biến vòng lặp; `MEASURES` là `as const`
      // nên tập tên trường vẫn được kiểm tại chỗ khai báo.
      (day as unknown as Record<string, number | null>)[measure.raw] = log?.[measure.raw] ?? null;
      (day as unknown as Record<string, number | null>)[measure.ma7] =
        ma7ByMeasure.get(measure.raw)!.get(date) ?? null;
    }
    return day;
  });

  const weeks = weeklySummaries(
    mealTotals.map((total) => ({ date: total.date, calories: total.totalCalories })),
    // `weightPoints` rộng hơn [from, to]; `weeklySummaries` tự lọc lại khoảng.
    weightPoints.map((point) => ({ date: point.date, weightKg: point.value })),
    range.from,
    range.to,
  );

  const targetWeightKg = goal?.targetWeightKg ?? null;
  const targetDate = goal?.targetDate ?? null;
  const currentRate = currentRateKgPerWeek(ma7Today, ma7TwoWeeksAgo);
  const requiredRate = requiredRateKgPerWeek(ma7Today, targetWeightKg, targetDate, today);

  const goalProgress: SummaryGoal = {
    startWeightKg: goal?.startWeightKg ?? null,
    startDate: goal?.startDate ?? null,
    targetWeightKg,
    targetDate,
    dailyCalorieTarget: goal?.dailyCalorieTarget ?? null,
    // `currentMa7WeightKg` và `currentRateKgPerWeek` là sự thật về cân nặng, không
    // phải về mục tiêu — vẫn trả khi chưa đặt mục tiêu. Các trường còn lại tự ra
    // `null` vì hàm trong `shared/stats` nhận `targetWeightKg = null`.
    currentMa7WeightKg: ma7Today,
    remainingKg: remainingKg(ma7Today, targetWeightKg),
    currentRateKgPerWeek: currentRate,
    requiredRateKgPerWeek: requiredRate,
    onTrack: isOnTrack(currentRate, requiredRate),
  };

  return { days, weeks, goal: goalProgress };
}
