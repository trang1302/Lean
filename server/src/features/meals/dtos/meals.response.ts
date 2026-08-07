import type { MealRecord } from '../repositories/meals.repository.js';

/** Hình dạng một bữa ăn trả về cho client. */
export interface MealResponse {
  id: string;
  date: string;
  slot: string;
  name: string;
  calories: number;
  note: string | null;
  /** ISO 8601 — `Date` của Prisma đã được chuyển sang chuỗi ở đây. */
  createdAt: string;
  updatedAt: string;
}

/**
 * Bản ghi DB → response.
 *
 * `userId` bị bỏ ra có chủ đích: nó là chi tiết nội bộ của tầng lưu trữ, client
 * không cần và không được đặt nó. Không `return { ...meal }` cho tiện, vì thêm
 * cột vào schema sau này sẽ tự động rò ra API mà không ai nhận ra.
 */
export function toMealResponse(meal: MealRecord): MealResponse {
  return {
    id: meal.id,
    date: meal.date,
    slot: meal.slot,
    name: meal.name,
    calories: meal.calories,
    note: meal.note,
    createdAt: meal.createdAt.toISOString(),
    updatedAt: meal.updatedAt.toISOString(),
  };
}
