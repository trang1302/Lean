import type { BodyLog } from '../../../generated/prisma/client.js';
import { prisma } from '../../../lib/db.js';
import type { BodyLogUpsertPatch } from '../dtos/bodyLogs.request.js';

/**
 * Lớp DUY NHẤT của feature này được chạm vào `prisma`.
 *
 * Khóa của BodyLog là `@@id([userId, date])`, nên mọi truy vấn đều mang
 * `userId` — và `userId` là THAM SỐ ĐẦU TIÊN của cả năm hàm, khớp quán lệ
 * của `goal.repository.ts` và `meals.repository.ts`.
 */

function whereKey(userId: string, date: string) {
  return { userId_date: { userId, date } };
}

export async function findByDate(userId: string, date: string): Promise<BodyLog | null> {
  return prisma.bodyLog.findUnique({ where: whereKey(userId, date) });
}

/** Bao gồm cả hai đầu mút, sắp xếp tăng dần theo `date`. */
export async function findInRange(
  userId: string,
  from: string,
  to: string,
): Promise<BodyLog[]> {
  return prisma.bodyLog.findMany({
    where: { userId, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });
}

/**
 * `patch` chỉ chứa các trường người gửi thực sự gửi lên, nên `update: patch`
 * tự nhiên bỏ qua trường vắng mặt — đó chính là ngữ nghĩa "giữ nguyên".
 * Trường vắng mặt lúc `create` rơi về `null` theo schema.
 */
export async function upsertByDate(
  userId: string,
  date: string,
  patch: BodyLogUpsertPatch,
): Promise<BodyLog> {
  return prisma.bodyLog.upsert({
    where: whereKey(userId, date),
    create: { userId, date, ...patch },
    update: patch,
  });
}

/** `false` khi không có gì để xóa — service dịch thành 404. */
export async function deleteByDate(userId: string, date: string): Promise<boolean> {
  // deleteMany thay vì delete: không có bản ghi thì trả count 0 chứ không ném
  // P2025, khỏi phải bắt lỗi Prisma chỉ để phân biệt "không tìm thấy".
  //
  // Với nhiều người dùng, `where: { userId, date }` còn là LỚP CÁCH LY HÀNG:
  // `delete({ where: { date } })` sẽ xóa bản ghi cùng ngày của người khác.
  const result = await prisma.bodyLog.deleteMany({ where: { userId, date } });
  return result.count > 0;
}
