import { prisma } from '../../../lib/db.js';

/**
 * Lớp duy nhất của feature `summary` được import `prisma`.
 *
 * `summary` KHÔNG gọi sang repository của `bodyLogs` / `meals` / `goal`: nó chỉ
 * đọc, và một endpoint tổng hợp phụ thuộc vào ba feature khác là cách chắc chắn
 * nhất để một thay đổi nhỏ ở đó làm vỡ dashboard.
 *
 * Mọi truy vấn mang `userId` — tham số đầu tiên, do service truyền xuống từ phiên.
 */

export interface BodyLogRow {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  shoulderCm: number | null;
  armCm: number | null;
}

/** Đã gộp sẵn theo NGÀY: một ngày nhiều bữa vẫn chỉ là một dòng. */
export interface DailyMealTotal {
  date: string;
  totalCalories: number;
  mealCount: number;
}

export interface GoalRow {
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
}

/**
 * Số đo trong [fromIso, toIso] (bao gồm hai đầu), tăng dần theo ngày.
 *
 * `date` là chuỗi "YYYY-MM-DD" nên so sánh chuỗi `gte`/`lte` chính là so sánh
 * thứ tự thời gian — đó là một lý do nữa để không dùng `DateTime`.
 */
export async function findBodyLogsBetween(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<BodyLogRow[]> {
  return prisma.bodyLog.findMany({
    where: { userId, date: { gte: fromIso, lte: toIso } },
    select: {
      date: true,
      weightKg: true,
      waistCm: true,
      chestCm: true,
      shoulderCm: true,
      armCm: true,
    },
    orderBy: { date: 'asc' },
  });
}

/**
 * Tổng calo và số bữa mỗi ngày trong [fromIso, toIso]. Ngày không ghi bữa nào
 * KHÔNG có dòng — service tự bù 0; đó là điều kiện để `weeklySummaries` phân
 * biệt được "ngày nhịn ăn" với "ngày quên ghi".
 */
export async function findDailyMealTotals(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<DailyMealTotal[]> {
  // Gộp ở tầng DB thay vì kéo từng bữa về rồi cộng trong JS.
  //
  // ĐỪNG chú thích kiểu cho biến này. `groupBy` suy generic NGƯỢC từ kiểu trả
  // về, nên `const groups: MealGroup[] = ...` khiến TS đem tham số đi so với
  // `args & MealGroup[]` và báo TS2345. Để suy kiểu tự chạy.
  const groups = await prisma.meal.groupBy({
    by: ['date'],
    // `userId` phải nằm Ở ĐÂY, trong `where` của chính groupBy. Thiếu nó là
    // gộp calo của MỌI người dùng vào một tổng — không ném lỗi, không test
    // feature nào bắt được, chỉ là số liệu sai một cách âm thầm.
    where: { userId, date: { gte: fromIso, lte: toIso } },
    _sum: { calories: true },
    _count: { _all: true },
  });

  return groups.map((group) => ({
    date: group.date,
    // `_sum` chỉ null khi nhóm rỗng — không xảy ra với groupBy, nhưng kiểu vẫn nullable.
    totalCalories: group._sum.calories ?? 0,
    mealCount: group._count._all,
  }));
}

/** Mục tiêu hiện tại; `null` khi người dùng chưa đặt. */
export async function findGoal(userId: string): Promise<GoalRow | null> {
  return prisma.goal.findUnique({
    where: { userId },
    select: {
      startWeightKg: true,
      startDate: true,
      targetWeightKg: true,
      targetDate: true,
      dailyCalorieTarget: true,
    },
  });
}
