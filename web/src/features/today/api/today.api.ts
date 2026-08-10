// Bảy hàm mỏng ánh xạ đúng bảy endpoint của docs/features/web-today/SPEC.md
// §2 — không state, không React, không try/catch nuốt lỗi (điều phối viên
// B4/B5, docs/features/web-today/PLAN.md §3, bước 1).
//
// `apiClient` (web/src/lib/apiClient.ts) là nơi DUY NHẤT gọi `fetch()` —
// mọi hàm dưới đây đi qua nó, không tự thêm logic HTTP.

import { apiClient } from '../../../lib/apiClient';
import type { BodyLog, Goal, Meal, MealSlot } from '../../../types/api';

/**
 * Patch gửi cho `PUT /api/body-logs/:date` — hợp đồng upsert 3 trạng thái
 * (SPEC §5.1): khóa VẮNG MẶT = giữ nguyên, khóa mang `null` = xóa, khóa
 * mang giá trị = đặt. Hàm `putBodyLog` dưới đây gửi NGUYÊN object nhận
 * được, không tự bù trường thiếu, không tự lọc `null` — chỗ này là nơi hợp
 * đồng 3 trạng thái sống hoặc chết (PLAN §4 bước 1).
 */
export type BodyLogPatch = Partial<Record<'weightKg' | 'waistCm' | 'note', number | string | null>>;

/** `GET /api/body-logs/:date` — `404` (ngày chưa ghi) dịch thành `null`,
 * KHÔNG ném lỗi (SPEC §6: đây là trạng thái bình thường). Lỗi khác vẫn ném. */
export function getBodyLog(date: string): Promise<BodyLog | null> {
  return apiClient.getOrNull<BodyLog>(`/body-logs/${date}`);
}

/** `PUT /api/body-logs/:date` — trả `200` cho cả tạo mới lẫn cập nhật. */
export function putBodyLog(date: string, patch: BodyLogPatch): Promise<BodyLog> {
  return apiClient.put<BodyLog>(`/body-logs/${date}`, patch);
}

/** `GET /api/meals?date=` — rỗng là `200 []`, không phải `404` (SPEC §2.3). */
export function getMeals(date: string): Promise<Meal[]> {
  return apiClient.get<Meal[]>(`/meals?date=${encodeURIComponent(date)}`);
}

export interface CreateMealInput {
  date: string;
  slot: MealSlot;
  name: string;
  calories: number;
  note?: string | null;
}

/** `POST /api/meals` — `201` kèm `id` vừa sinh (SPEC §2.4). */
export function createMeal(input: CreateMealInput): Promise<Meal> {
  return apiClient.post<Meal>('/meals', input);
}

/** Partial thật: chỉ `note` nhận `null` (SPEC §2.5) — các trường khác nếu
 * gửi `null` sẽ bị server trả `400`, hàm này không tự chặn, để lỗi đó tới
 * đúng nơi hiển thị qua `ApiError.fields`. */
export type MealPatch = Partial<{
  date: string;
  slot: MealSlot;
  name: string;
  calories: number;
  note: string | null;
}>;

/** `PATCH /api/meals/:id` — `{}` hợp lệ, là no-op trả `200` (SPEC §2.5). */
export function updateMeal(id: string, patch: MealPatch): Promise<Meal> {
  return apiClient.patch<Meal>(`/meals/${id}`, patch);
}

/** `DELETE /api/meals/:id` — `204` không body; KHÔNG idempotent, xóa lần
 * hai ra `404` (SPEC §2.5). Chỗ gọi (MealRow) tự quyết định coi `404` là
 * "đã xóa xong" — hàm này chỉ chuyển tiếp nguyên trạng thái HTTP. */
export function deleteMeal(id: string): Promise<void> {
  return apiClient.delete<void>(`/meals/${id}`);
}

/** `GET /api/goal` — luôn `200`, không bao giờ `404` (SPEC §2.6). */
export function getGoal(): Promise<Goal> {
  return apiClient.get<Goal>('/goal');
}
