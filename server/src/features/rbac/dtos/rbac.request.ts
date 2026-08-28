import { z } from 'zod';

export const roleIdParamSchema = z.object({ roleId: z.string().min(1) });

/**
 * ĐẶT LẠI toàn bộ tập quyền của vai trò, không cộng dồn.
 *
 * "Thay thế" là ngữ nghĩa duy nhất diễn đạt được "ẩn chức năng X khỏi vai trò
 * Y" — với cộng dồn thì không có cách nào GỠ một quyền, và ẩn chức năng chính
 * là mục đích tồn tại của endpoint này.
 */
export const setRolePermissionsSchema = z
  .object({ codes: z.array(z.string().min(1)).max(100) })
  .strict();
