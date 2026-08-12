import { z } from 'zod';
import {
  caloriesSchema,
  circumferenceCmSchema,
  dateString,
  pastOrTodayDateString,
  weightKgSchema,
} from '../../../shared/validation/commonSchemas.js';

/**
 * Body của `PUT /api/goal`.
 *
 * Mọi trường đều optional VÀ nullable — hai chuyện khác nhau:
 *   vắng mặt → giữ nguyên giá trị cũ
 *   `null`   → xóa giá trị
 * `.partial()` gộp cả hai thành `undefined` sau khi parse, nên phần phân biệt
 * nằm ở `toGoalPatch()` bên dưới, đọc trên body THÔ.
 *
 * HAI TRƯỜNG NGÀY DÙNG HAI SCHEMA KHÁC NHAU, cố ý:
 * - `targetDate` là `dateString` — mục tiêu nằm ở TƯƠNG LAI;
 * - `startDate` là `pastOrTodayDateString` — điểm xuất phát là mốc ĐÃ XẢY RA.
 *   Một mốc xuất phát ở tương lai sẽ làm % tiến độ (đợt `charts-mui`) ra số vô nghĩa.
 */
export const goalUpsertSchema = z
  .object({
    startWeightKg: weightKgSchema.nullable(),
    startDate: pastOrTodayDateString.nullable(),
    targetWeightKg: weightKgSchema.nullable(),
    targetWaistCm: circumferenceCmSchema.nullable(),
    targetChestCm: circumferenceCmSchema.nullable(),
    targetShoulderCm: circumferenceCmSchema.nullable(),
    targetArmCm: circumferenceCmSchema.nullable(),
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
  startWeightKg?: number | null;
  startDate?: string | null;
  targetWeightKg?: number | null;
  targetWaistCm?: number | null;
  targetChestCm?: number | null;
  targetShoulderCm?: number | null;
  targetArmCm?: number | null;
  targetDate?: string | null;
  dailyCalorieTarget?: number | null;
}

/**
 * Nguồn sự thật DUY NHẤT cho danh sách khoá. Quan trọng hơn bình thường ở đây
 * vì `goalUpsertSchema` KHÔNG `.strict()`: khoá lạ bị strip im lặng, không có
 * 400 nào. Quên một khoá = trường đó không bao giờ lưu được và không ai biết.
 */
const GOAL_PATCH_KEYS = [
  'startWeightKg',
  'startDate',
  'targetWeightKg',
  'targetWaistCm',
  'targetChestCm',
  'targetShoulderCm',
  'targetArmCm',
  'targetDate',
  'dailyCalorieTarget',
] as const;

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

  for (const key of GOAL_PATCH_KEYS) {
    if (!(key in body)) continue;
    (patch as Record<string, unknown>)[key] = parsed[key] ?? null;
  }

  return patch;
}
