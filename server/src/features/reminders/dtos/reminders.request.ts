import { z } from 'zod';
import { timeOfDaySchema } from '../../../shared/validation/commonSchemas.js';

/**
 * Tập loại nhắc nhở là CỐ ĐỊNH, chốt ở spec §8 — không phải thứ người dùng
 * tự thêm. `PUT /reminders/:kind` với kind ngoài danh sách này trả 404.
 */
export const REMINDER_KINDS = ['weigh_in', 'meal_log'] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

export function isReminderKind(value: string): value is ReminderKind {
  return (REMINDER_KINDS as readonly string[]).includes(value);
}

/**
 * Topic ntfy: chuỗi không rỗng, hoặc `null` để xóa cấu hình.
 * Trường vắng mặt = giữ nguyên (xem `updateReminderSchema`).
 */
const ntfyTopicSchema = z
  .string()
  .trim()
  .min(1, 'Topic không được rỗng')
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Topic chỉ gồm chữ, số, gạch ngang và gạch dưới')
  .nullable();

/**
 * Cập nhật một phần. `.strict()` để gõ nhầm tên trường báo 400 thay vì im lặng
 * lưu thiếu — người dùng sẽ không hiểu vì sao nhắc nhở không đổi giờ.
 */
export const updateReminderSchema = z
  .object({
    timeOfDay: timeOfDaySchema.optional(),
    enabled: z.boolean().optional(),
    ntfyTopic: ntfyTopicSchema.optional(),
  })
  .strict();

export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
