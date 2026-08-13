import { z } from 'zod';

/**
 * Chuẩn hóa TRƯỚC khi validate: `.trim().toLowerCase()` rồi mới kiểm định dạng.
 * Ngược thứ tự thì "  A@x.com " bị từ chối vì khoảng trắng.
 *
 * Chuẩn hóa ở ĐÚNG MỘT CHỖ này là thứ khiến không đường vào nào bỏ sót —
 * @unique của SQLite phân biệt hoa thường (auth/SPEC.md:353).
 *
 * Zod 4: `z.email()` top-level, KHÔNG `z.string().email()`.
 */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Trần 200 ký tự chặn DoS: Argon2 trên chuỗi 10 MB tốn CPU thật.
 * KHÔNG có `.min(8)` ở đây — policy độ dài thuộc đường ĐẶT mật khẩu, không
 * thuộc đường xác thực (design doc quyết định 4). Min ở đây còn khóa ngoài
 * chính chủ khi policy siết lên sau này.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

/** Min 8 chỉ ở đây và ở đường reset mật khẩu (giai đoạn C). */
export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(100).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
