/** Hàng `Goal` đọc từ Prisma. Khai lại tại chỗ để tầng dto không phụ thuộc client sinh ra. */
export interface GoalRow {
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  updatedAt: Date;
}

export interface GoalResponse {
  targetWeightKg: number | null;
  targetDate: string | null;
  /** `null` khi chưa từng đặt mục tiêu — dùng để phân biệt với "đặt rồi nhưng để trống". */
  dailyCalorieTarget: number | null;
  updatedAt: string | null;
}

/**
 * `null` = chưa có hàng nào trong bảng → trả object toàn `null`, KHÔNG phải 404.
 * Đây là ngoại lệ có chủ đích ở spec §5: mục tiêu là singleton, "chưa đặt" là
 * một trạng thái hợp lệ chứ không phải tài nguyên không tồn tại.
 */
export function toGoalResponse(goal: GoalRow | null): GoalResponse {
  if (!goal) {
    return {
      targetWeightKg: null,
      targetDate: null,
      dailyCalorieTarget: null,
      updatedAt: null,
    };
  }

  return {
    targetWeightKg: goal.targetWeightKg,
    targetDate: goal.targetDate,
    dailyCalorieTarget: goal.dailyCalorieTarget,
    updatedAt: goal.updatedAt.toISOString(),
  };
}
