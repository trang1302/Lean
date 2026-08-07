import { z } from 'zod';
import {
  caloriesSchema,
  dateString,
  weightKgSchema,
} from '../../../shared/validation/commonSchemas.js';

/**
 * Body của `PUT /api/goal`.
 *
 * Cả ba trường đều optional VÀ nullable — đó là hai chuyện khác nhau ở đây:
 *   vắng mặt → giữ nguyên giá trị cũ
 *   `null`   → xóa giá trị
 * `.partial()` gộp cả hai thành `undefined` sau khi parse, nên phần phân biệt
 * nằm ở `toGoalPatch()` bên dưới, đọc trên body THÔ.
 *
 * `targetDate` dùng `dateString` chứ KHÔNG dùng `pastOrTodayDateString`:
 * mục tiêu nằm ở tương lai, ngược hẳn với `date` của bodyLogs/meals.
 */
export const goalUpsertSchema = z
  .object({
    targetWeightKg: weightKgSchema.nullable(),
    targetDate: dateString.nullable(),
    dailyCalorieTarget: caloriesSchema.nullable(),
  })
  .partial();

export type GoalUpsertRequest = z.infer<typeof goalUpsertSchema>;

/**
 * Các trường sẽ được ghi. Trường vắng mặt trong object này = không đụng tới;
 * trường mang `null` = xóa. Prisma hiểu đúng cả hai vì `undefined` là "bỏ qua".
 */
export interface GoalPatch {
  targetWeightKg?: number | null;
  targetDate?: string | null;
  dailyCalorieTarget?: number | null;
}

/**
 * Dựng patch từ body thô + kết quả đã validate.
 *
 * Phải nhìn `key in rawBody` chứ không nhìn `parsed[key] !== undefined`:
 * sau khi Zod parse, `{ targetDate: null }` và `{}` không còn phân biệt được,
 * mà chúng mang hai ý nghĩa trái ngược nhau.
 */
export function toGoalPatch(rawBody: unknown, parsed: GoalUpsertRequest): GoalPatch {
  // Zod đã chặn body không phải object trước khi tới đây; ép kiểu chỉ để đọc key.
  const body = (rawBody ?? {}) as Record<string, unknown>;
  const patch: GoalPatch = {};

  if ('targetWeightKg' in body) patch.targetWeightKg = parsed.targetWeightKg ?? null;
  if ('targetDate' in body) patch.targetDate = parsed.targetDate ?? null;
  if ('dailyCalorieTarget' in body) patch.dailyCalorieTarget = parsed.dailyCalorieTarget ?? null;

  return patch;
}
