/** Hàng `Goal` đọc từ Prisma. Khai lại tại chỗ để tầng dto không phụ thuộc client sinh ra. */
export interface GoalRow {
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetChestCm: number | null;
  targetShoulderCm: number | null;
  targetArmCm: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  updatedAt: Date;
}

export interface GoalResponse {
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetChestCm: number | null;
  targetShoulderCm: number | null;
  targetArmCm: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  /** `null` khi chưa từng đặt mục tiêu — dùng để phân biệt với "đặt rồi nhưng để trống". */
  updatedAt: string | null;
}

/** Chín trường dữ liệu, không kể `updatedAt` (kiểu khác, xử lý riêng). */
const GOAL_FIELDS = [
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
 * `null` = chưa có hàng nào trong bảng → trả object toàn `null`, KHÔNG phải 404.
 * Đây là ngoại lệ có chủ đích ở spec §5: mục tiêu là singleton, "chưa đặt" là
 * một trạng thái hợp lệ chứ không phải tài nguyên không tồn tại.
 */
export function toGoalResponse(goal: GoalRow | null): GoalResponse {
  const response = { updatedAt: goal ? goal.updatedAt.toISOString() : null } as GoalResponse;
  for (const field of GOAL_FIELDS) {
    (response as unknown as Record<string, unknown>)[field] = goal ? goal[field] : null;
  }
  return response;
}
