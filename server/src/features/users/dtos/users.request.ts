import { z } from 'zod';

/**
 * Chuẩn hóa email ở ĐÚNG MỘT KIỂU với `auth.request.ts` — `@unique` của SQLite
 * phân biệt hoa thường, hai đường tạo tài khoản mà chuẩn hóa khác nhau là hai
 * tài khoản cho cùng một người.
 */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

const passwordSchema = z.string().min(8).max(200);

/**
 * `.strict()` là chốt chống leo thang quyền, không phải sự cầu kỳ.
 *
 * Thiếu nó, `ADMIN` (chỉ có `user:manage`) gửi kèm `roleId = <id SYSTEM_ADMIN>`;
 * Zod mặc định BỎ QUA khóa lạ một cách im lặng, và nếu có ngày ai đó spread
 * nguyên `req.body` xuống repository thì tài khoản mới thành `SYSTEM_ADMIN` —
 * đi vòng qua đúng ràng buộc thứ tự registry vốn dựng lên để chặn việc này.
 *
 * `.strict()` biến nó thành `400` ồn ào ngay ở request đầu tiên.
 *
 * Vai trò chỉ đổi qua `PUT /api/users/:id/role` (quyền `rbac:manage`).
 */
export const createUserSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).nullable().optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .strict();

export const resetPasswordSchema = z.object({ password: passwordSchema }).strict();

export const assignRoleSchema = z.object({ roleId: z.string().min(1) }).strict();

export const userIdParamSchema = z.object({ id: z.string().min(1) });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
