/**
 * Hàm thuần thống kê. Service import từ đây, không import thẳng từng file —
 * đổi cách chia file bên trong không kéo theo sửa mọi chỗ gọi.
 *
 * KHÔNG file nào trong thư mục này được import `lib/db.ts`, express, hay đọc
 * `Date.now()`. "Hôm nay" luôn là tham số truyền vào.
 */
export { movingAverage7 } from './movingAverage.js';
export type { DatedValue, MovingAveragePoint } from './movingAverage.js';

export { currentRateKgPerWeek, requiredRateKgPerWeek, isOnTrack, remainingKg } from './rate.js';

export { weeklySummaries } from './weekly.js';
export type { DatedCalories, DatedWeight, WeekSummary } from './weekly.js';
