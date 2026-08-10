// Tầng gọi HTTP DUY NHẤT của feature `settings` — không có React, không giữ
// state. Mọi nơi khác trong feature (`hooks/`, `components/`) gọi qua đây,
// không tự `import { apiClient } from '../../../lib/apiClient'` rải rác.
//
// Hai phép map biên BẮT BUỘC nằm ở đây (điều phối viên B2 #4, PLAN.md §3):
//   1. ô số / ô ngày / ô topic trống → `null`, KHÔNG BAO GIỜ `''`, `NaN`,
//      `undefined` trong body JSON.
//   2. body `PUT /reminders/:kind` chỉ mang đúng ba khóa `timeOfDay`,
//      `enabled`, `ntfyTopic` — không bao giờ để `kind` lọt vào (`.strict()`
//      sẽ trả 400, SPEC §8.2).

import { apiClient } from '../../../lib/apiClient';
import type {
  GoalPatch,
  GoalResponse,
  ReminderKind,
  ReminderView,
  UpdateReminderInput,
} from './settings.types';

// ---------------------------------------------------------------------------
// Map biên dùng chung cho cả hai nhóm — export để test khóa hành vi trực tiếp
// (đây là đúng ba chỗ PLAN.md §5 liệt kê là "đáng viết test trước").
// ---------------------------------------------------------------------------

/**
 * Ô nhập số (cân nặng, calo mục tiêu) → giá trị patch. Trống (hoặc chỉ toàn
 * khoảng trắng) → `null` (xóa). Chuỗi không parse được số → cũng `null`,
 * KHÔNG BAO GIỜ trả `NaN` — `NaN` không serialize được sang JSON hợp lệ
 * (`JSON.stringify(NaN)` ra chuỗi `"null"` về HÌNH THỨC, nhưng phụ thuộc vào
 * đó là tình cờ, không phải hợp đồng — hàm này tự chốt rõ ràng thay vì dựa
 * vào tình cờ đó). Có giá trị hợp lệ → number thô, không định dạng lại
 * (KHÔNG đi qua `formatNumber`/`formatNullable` — hai hàm đó chỉ để hiển thị).
 */
export function numericInputToPatchValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Ô nhập chuỗi trống (ngày đích, ntfy topic) → `null`. KHÔNG trim giá trị
 * không-rỗng trước khi gửi — với `ntfyTopic`, khoảng trắng ở GIỮA là lỗi
 * 400 có chủ đích (SPEC §8.3), tự trim ở client sẽ che mất lỗi đó khỏi
 * người dùng thay vì để server báo đúng vị trí.
 */
export function textInputToPatchValue(raw: string): string | null {
  return raw.trim() === '' ? null : raw;
}

// ---------------------------------------------------------------------------
// Mục tiêu
// ---------------------------------------------------------------------------

export function fetchGoal(): Promise<GoalResponse> {
  return apiClient.get<GoalResponse>('/goal');
}

/**
 * Dựng patch bằng kiểu tường minh (`GoalPatch`), KHÔNG spread object nhận từ
 * `GET` — `goalUpsertSchema` không `.strict()` nên gõ sai tên trường sẽ
 * trả 200 im lặng, không có 400 nào để bắt lỗi chính tả (SPEC §3). Hàm này nhận
 * đúng những gì form đã map qua `numericInputToPatchValue`/
 * `textInputToPatchValue`, không nhận thẳng string thô của input.
 */
export function updateGoal(patch: GoalPatch): Promise<GoalResponse> {
  const body: GoalPatch = {
    targetWeightKg: patch.targetWeightKg,
    targetDate: patch.targetDate,
    dailyCalorieTarget: patch.dailyCalorieTarget,
  };
  return apiClient.put<GoalResponse>('/goal', body);
}

// ---------------------------------------------------------------------------
// Nhắc nhở
// ---------------------------------------------------------------------------

export function fetchReminders(): Promise<ReminderView[]> {
  return apiClient.get<ReminderView[]>('/reminders');
}

/**
 * Bóc đúng ba khóa `timeOfDay`/`enabled`/`ntfyTopic` từ input, bỏ mọi khóa
 * khác (đặc biệt là `kind`) — chốt chặn thật cho luật `.strict()` (SPEC
 * §8.2). Chỉ đưa vào body những khóa THẬT SỰ có mặt trong `input` (kiểm
 * bằng `in`, không phải `!== undefined`) để giữ đúng ngữ nghĩa "vắng mặt =
 * giữ nguyên" của partial update (SPEC §8.1) — ví dụ gạt công tắc chỉ gửi
 * `{ enabled: true }`, không kèm `timeOfDay`/`ntfyTopic` hiện tại.
 */
export function buildReminderPatch(input: {
  timeOfDay?: string;
  enabled?: boolean;
  ntfyTopic?: string | null;
}): UpdateReminderInput {
  const patch: UpdateReminderInput = {};
  if ('timeOfDay' in input) patch.timeOfDay = input.timeOfDay;
  if ('enabled' in input) patch.enabled = input.enabled;
  if ('ntfyTopic' in input) patch.ntfyTopic = input.ntfyTopic;
  return patch;
}

export function updateReminder(kind: ReminderKind, input: UpdateReminderInput): Promise<ReminderView> {
  // `input` đã được `buildReminderPatch` (hoặc caller khác tuân theo cùng
  // kiểu `UpdateReminderInput`) lọc sạch — gửi thẳng, không spread thêm.
  return apiClient.put<ReminderView>(`/reminders/${kind}`, buildReminderPatch(input));
}
