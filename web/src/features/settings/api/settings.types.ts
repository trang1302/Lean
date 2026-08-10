// Kiểu riêng của feature `settings`. Theo B1 của brief điều phối viên
// ("DÙNG LẠI, đừng viết trùng"), `GoalResponse` KHÔNG được định nghĩa lại ở
// đây — nó là alias của `Goal` đã có sẵn ở `src/types/api.ts` (chép đúng
// theo `docs/features/goal/SPEC.md` §2 rồi, y hệt hình dạng ở
// `docs/features/web-settings/SPEC.md` §3). Chỉ những kiểu KHÔNG có sẵn ở
// `types/api.ts` (nhóm Nhắc nhở) mới định nghĩa mới ở file này — xem báo cáo
// mục "thứ thiếu ở thư mục dùng chung" vì `types/api.ts` chưa có `ReminderView`.

import type { Goal } from '../../../types/api';

// ---------------------------------------------------------------------------
// Mục tiêu — docs/features/web-settings/SPEC.md §3, docs/features/goal/SPEC.md §2, §6
// ---------------------------------------------------------------------------

/** Response của `GET /api/goal` — alias của `Goal` dùng chung, đặt lại tên
 * theo đúng bảng file dự kiến ở `PLAN.md` §3. */
export type GoalResponse = Goal;

/**
 * Body của `PUT /api/goal`. Cả ba trường optional + nullable (SPEC §3):
 * vắng mặt = giữ nguyên, `null` = xóa, có giá trị = ghi đè. `goalUpsertSchema`
 * ở server KHÔNG `.strict()` (SPEC §3, "cạm bẫy im lặng") — vì vậy `GoalPatch`
 * chỉ khai đúng ba khóa này, không mở rộng, để không ai lỡ tay spread thêm
 * khóa lạ (server sẽ strip im lặng, không báo lỗi).
 */
export interface GoalPatch {
  targetWeightKg?: number | null;
  targetDate?: string | null;
  dailyCalorieTarget?: number | null;
}

// ---------------------------------------------------------------------------
// Nhắc nhở — docs/features/web-settings/SPEC.md §4, docs/features/reminders/SPEC.md §3, §4, §8
// ---------------------------------------------------------------------------

/** Tập `kind` là ĐÓNG (SPEC §1) — chép nguyên từ
 * `server/src/features/reminders/reminders.constants.ts` (`REMINDER_KINDS`).
 * Không tự thêm loại mới ở đây. */
export const REMINDER_KINDS = ['weigh_in', 'meal_log'] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

/**
 * Một phần tử của mảng trả bởi `GET /api/reminders` — mảng trần, luôn đủ 2
 * phần tử, thứ tự cố định theo `REMINDER_KINDS` (SPEC §4). KHÔNG có `id`,
 * `userId`, `updatedAt` và sẽ không bao giờ có (`reminders/SPEC.md` §8.4) —
 * đừng suy diễn thêm trường.
 */
export interface ReminderView {
  kind: ReminderKind;
  timeOfDay: string; // "HH:mm", khớp ^([01]\d|2[0-3]):[0-5]\d$
  enabled: boolean;
  ntfyTopic: string | null;
}

/**
 * Body của `PUT /api/reminders/:kind`. Server dùng `.strict()` (SPEC §8.2) —
 * KHÔNG thêm `kind` vào kiểu này. Đây là rào chắn kiểu học đầu tiên chống lại
 * cạm bẫy "gửi ngược nguyên `ReminderView` nhận từ GET": `ReminderView` có
 * `kind`, kiểu này thì không — TypeScript sẽ báo lỗi nếu code cố gán thẳng
 * một `ReminderView` vào chỗ cần `UpdateReminderInput` bằng object literal.
 * (Rào chắn KHÔNG tuyệt đối — TypeScript vẫn cho qua nếu gán qua một biến đã
 * có kiểu rộng hơn, vì đó là structural typing. `settings.api.ts` là nơi
 * chốt chặn thật: nó luôn dựng `UpdateReminderInput` bằng
 * `buildReminderPatch`, không bao giờ spread một `ReminderView` trực tiếp.)
 */
export interface UpdateReminderInput {
  timeOfDay?: string;
  enabled?: boolean;
  ntfyTopic?: string | null;
}
