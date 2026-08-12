import { z } from 'zod';
import { isValidIsoDate, daysBetween, todayIso } from '../../lib/time.js';

/** Khoảng truy vấn tối đa, chốt ở spec §5. */
export const MAX_RANGE_DAYS = 730;

/** Chuỗi "YYYY-MM-DD" đúng định dạng VÀ là ngày có thật (loại 2026-02-30). */
export const dateString = z.string().refine(isValidIsoDate, {
  message: 'Ngày phải có dạng YYYY-MM-DD và là ngày có thật',
});

/**
 * Ngày không được ở tương lai. "Hôm nay" tính theo Asia/Ho_Chi_Minh qua
 * `todayIso()` — không dùng `new Date()` trần, sẽ lệch múi giờ.
 */
export const pastOrTodayDateString = dateString.refine((value) => value <= todayIso(), {
  message: 'Ngày không được ở tương lai',
});

/** Ràng buộc số đo, spec §5. */
export const weightKgSchema = z.number().positive().lt(500);
/**
 * Dùng chung cho CẢ BỐN vòng: bụng, ngực, vai, bắp tay.
 *
 * Cố ý KHÔNG siết trần riêng cho từng vòng (bắp tay ~30cm, ngực ~98cm): trần
 * chung `lt(300)` vẫn chặn được ca gõ nhầm 30 thành 3000, còn ca gõ nhầm 30
 * thành 80 thì không schema nào cứu được. Bốn schema gần-giống-nhau là bốn chỗ
 * để lệch nhau về sau.
 */
export const circumferenceCmSchema = z.number().positive().lt(300);
export const caloriesSchema = z.number().int().min(0).max(20_000);
export const mealNameSchema = z.string().trim().min(1).max(200);
export const slotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm, 00:00–23:59');

/**
 * Khoảng ngày cho các endpoint dạng `?from=&to=`.
 * `from <= to` và độ dài tối đa MAX_RANGE_DAYS ngày.
 */
export const dateRangeSchema = z
  .object({ from: dateString, to: dateString })
  .refine((range) => daysBetween(range.from, range.to) >= 0, {
    message: '`from` phải nhỏ hơn hoặc bằng `to`',
    path: ['from'],
  })
  .refine((range) => daysBetween(range.from, range.to) < MAX_RANGE_DAYS, {
    message: `Khoảng truy vấn tối đa ${MAX_RANGE_DAYS} ngày`,
    path: ['to'],
  });

export type DateRange = z.infer<typeof dateRangeSchema>;
