import { prisma } from '../../../lib/db.js';
import type { GoalPatch } from '../dtos/goal.request.js';
import type { GoalRow } from '../dtos/goal.response.js';

// Chỗ DUY NHẤT của feature này được import `prisma`. Service và controller
// không biết Prisma tồn tại.

/** Mục tiêu của một user. `null` khi chưa đặt bao giờ. */
export async function findGoal(userId: string): Promise<GoalRow | null> {
  // `userId` là KHÓA CHÍNH của Goal (không có cột `id` riêng) — mỗi user đúng
  // một mục tiêu, nên findUnique theo userId là đủ.
  return prisma.goal.findUnique({ where: { userId } });
}

/**
 * Tạo nếu chưa có, cập nhật nếu đã có.
 *
 * `patch` chỉ chứa các trường thực sự được gửi lên: trường vắng mặt là
 * `undefined`, mà Prisma diễn giải `undefined` là "không đụng tới" — đúng
 * ngữ nghĩa upsert ba trạng thái. `null` thì ghi thẳng null vào cột.
 * Ở nhánh `create`, trường vắng mặt để cột ở giá trị mặc định `null`.
 */
export async function upsertGoal(userId: string, patch: GoalPatch): Promise<GoalRow> {
  return prisma.goal.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
}
