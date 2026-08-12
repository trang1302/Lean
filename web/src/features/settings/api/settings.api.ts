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
import { todayIso } from '../../../lib/format';
import type { SummaryResponse } from '../../../types/api';
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
 * Mọi property của `GoalPatch` đều optional (`?`), nên gán/PASS một literal
 * thiếu khoá vào kiểu `GoalPatch` compile sạch — TypeScript KHÔNG bắt được
 * việc bỏ sót một khoá ở đó. `FullGoalPatch` vá đúng lỗ đó: bắt buộc đủ chín
 * khoá phải CÓ MẶT, nhưng vẫn cho giá trị là `undefined` (input của hàm này
 * hợp lệ khi là `undefined` — patch chỉ đổi các trường người dùng chạm tới).
 *
 * KHÔNG viết `{ [K in keyof GoalPatch]-?: GoalPatch[K] | undefined }` — trông
 * đúng nhưng compile sai: `-?` trên mapped type kiểu này tự lọc sạch
 * `undefined` khỏi giá trị luôn, kể cả khi mình cố thêm lại bằng
 * `| undefined` (đã kiểm bằng `tsc` thật, không suy diễn). Cách dưới đây là
 * lách qua bằng cách giao (`&`) một mapped type chỉ ép "khoá bắt buộc, giá
 * trị `unknown`" với `GoalPatch` gốc để lấy lại kiểu giá trị thật.
 */
type FullGoalPatch = { [K in keyof GoalPatch]-?: unknown } & GoalPatch;

/**
 * Dựng patch bằng kiểu tường minh (`FullGoalPatch`), KHÔNG spread object nhận
 * từ `GET` — `goalUpsertSchema` không `.strict()` nên gõ sai tên trường sẽ trả
 * 200 im lặng, không có 400 nào để bắt lỗi chính tả (SPEC §3). Whitelist này
 * cũng là chốt chặn ngăn caller lỡ spread thêm khoá lạ vào body.
 *
 * Liệt kê tay cả CHÍN khoá, cố ý không lặp: annotate `body` bằng
 * `FullGoalPatch` (không phải `GoalPatch`) là chỗ TypeScript kiểm được rằng
 * không khoá nào bị bỏ sót — xem định nghĩa `FullGoalPatch` ngay trên. Thêm
 * trường mục tiêu mới mà quên dòng ở đây thì TypeScript báo lỗi ngay, không
 * còn phải trông cậy vào việc tự nhớ.
 */
export function updateGoal(patch: GoalPatch): Promise<GoalResponse> {
  const body: FullGoalPatch = {
    startWeightKg: patch.startWeightKg,
    startDate: patch.startDate,
    targetWeightKg: patch.targetWeightKg,
    targetWaistCm: patch.targetWaistCm,
    targetChestCm: patch.targetChestCm,
    targetShoulderCm: patch.targetShoulderCm,
    targetArmCm: patch.targetArmCm,
    targetDate: patch.targetDate,
    dailyCalorieTarget: patch.dailyCalorieTarget,
  };
  return apiClient.put<GoalResponse>('/goal', body);
}

/**
 * MA7 cân nặng của HÔM NAY, để form Mục tiêu điền sẵn ô "Cân nặng lúc bắt đầu".
 *
 * Đi qua `GET /api/summary` sẵn có thay vì thêm trường vào `/api/goal`: bắt
 * `goal.service` tính MA7 là kéo dữ liệu `BodyLog` xuyên qua ranh giới feature,
 * chỉ để tiện điền một ô nháp (spec §8.3). Cái giá là một request thừa ở trang
 * Cài đặt — đã cân nhắc và chấp nhận.
 *
 * Khoảng ngày truyền vào KHÔNG ảnh hưởng kết quả: `summary.service` tính
 * `currentMa7WeightKg` neo vào hôm nay bất kể `from`/`to`. Dùng `today..today`
 * cho payload nhỏ nhất.
 *
 * `null` khi chưa đủ dữ liệu để có MA7 — form để ô trống, không bịa số.
 */
export function fetchCurrentMa7WeightKg(): Promise<number | null> {
  const today = todayIso();
  return apiClient
    .get<SummaryResponse>(`/summary?from=${today}&to=${today}`)
    .then((res) => res.goal.currentMa7WeightKg);
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
