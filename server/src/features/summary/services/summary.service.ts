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

function earlier(a: string, b: string): string {
  return a <= b ? a : b;
}

function later(a: string, b: string): string {
  return a >= b ? a : b;
}

function ma7ByDate(points: readonly MovingAveragePoint[]): Map<string, number | null> {
  return new Map(points.map((point) => [point.date, point.ma7]));
}

export async function getSummary(range: SummaryQuery): Promise<SummaryResponse> {
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
    summaryRepository.findBodyLogsBetween(dataFrom, dataTo),
    // Calo không đi vào phép trung bình trượt nào nên chỉ cần đúng [from, to].
    summaryRepository.findDailyMealTotals(range.from, range.to),
    summaryRepository.findGoal(),
  ]);

  const weightPoints: DatedValue[] = [];
  const waistPoints: DatedValue[] = [];
  for (const log of bodyLogs) {
    if (log.weightKg !== null) weightPoints.push({ date: log.date, value: log.weightKg });
    if (log.waistCm !== null) waistPoints.push({ date: log.date, value: log.waistCm });
  }

  const weightMa7 = ma7ByDate(movingAverage7(weightPoints, range.from, range.to));
  const waistMa7 = ma7ByDate(movingAverage7(waistPoints, range.from, range.to));

  // Một lần gọi cho cả hai đầu của xu hướng: MA7 tại `today` và tại `today - 14`.
  const trendMa7 = ma7ByDate(movingAverage7(weightPoints, trendFrom, today));
  const ma7Today = trendMa7.get(today) ?? null;
  const ma7TwoWeeksAgo = trendMa7.get(trendFrom) ?? null;

  const bodyLogByDate = new Map(bodyLogs.map((log) => [log.date, log]));
  const mealsByDate = new Map(mealTotals.map((total) => [total.date, total]));

  const days: SummaryDay[] = enumerateDates(range.from, range.to).map((date) => {
    const log = bodyLogByDate.get(date);
    const meals = mealsByDate.get(date);
    return {
      date,
      weightKg: log?.weightKg ?? null,
      weightMa7: weightMa7.get(date) ?? null,
      waistCm: log?.waistCm ?? null,
      waistMa7: waistMa7.get(date) ?? null,
      totalCalories: meals?.totalCalories ?? 0,
      mealCount: meals?.mealCount ?? 0,
    };
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
