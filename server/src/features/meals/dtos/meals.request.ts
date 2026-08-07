import { z } from 'zod';
import {
  caloriesSchema,
  dateString,
  mealNameSchema,
  pastOrTodayDateString,
  slotSchema,
} from '../../../shared/validation/commonSchemas.js';

/**
 * Ghi chú: chỉ đây là trường nullable của bữa ăn. Gửi `null` = xóa ghi chú.
 * `.trim()` để "   " không lọt vào DB thành ghi chú toàn khoảng trắng.
 */
const noteSchema = z.string().trim().nullable();

/**
 * `GET /api/meals?date=`
 *
 * Dùng `dateString` chứ KHÔNG dùng `pastOrTodayDateString`: đây là bộ lọc đọc,
 * hỏi một ngày tương lai chỉ trả mảng rỗng — trả 400 cho thao tác chỉ-đọc là
 * gây khó hiểu vô ích. Ràng buộc "không được ở tương lai" ở spec §5 áp cho
 * ngày được GHI vào bản ghi, tức body của POST/PATCH bên dưới.
 */
export const listMealsQuerySchema = z.object({
  date: dateString,
});

/** `POST /api/meals` — mọi trường trừ `note` là bắt buộc. */
export const createMealSchema = z.object({
  date: pastOrTodayDateString,
  slot: slotSchema,
  name: mealNameSchema,
  calories: caloriesSchema,
  note: noteSchema.optional(),
});

/**
 * `PATCH /api/meals/:id` — partial thật: trường vắng mặt là KHÔNG ĐỔI.
 *
 * Khác `PUT /body-logs/:date`, ở đây KHÔNG có ngữ nghĩa "gửi null để xóa" cho
 * các trường bắt buộc — `date`, `slot`, `name`, `calories` không thể null vì
 * cột DB là NOT NULL. Chỉ `note` nhận `null`.
 */
export const updateMealSchema = z.object({
  date: pastOrTodayDateString.optional(),
  slot: slotSchema.optional(),
  name: mealNameSchema.optional(),
  calories: caloriesSchema.optional(),
  note: noteSchema.optional(),
});

/** `:id` của Prisma là cuid; chỉ cần chắc nó là chuỗi không rỗng, còn lại để 404 lo. */
export const mealIdParamSchema = z.object({
  id: z.string().min(1),
});

export type ListMealsQuery = z.infer<typeof listMealsQuerySchema>;
export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
