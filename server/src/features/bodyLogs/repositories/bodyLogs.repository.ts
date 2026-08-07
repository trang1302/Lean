import type { BodyLog } from '../../../generated/prisma/client.js';
import { prisma } from '../../../lib/db.js';
import { LOCAL_USER_ID } from '../../../shared/constants.js';
import type { BodyLogUpsertPatch } from '../dtos/bodyLogs.request.js';

/**
 * Lớp DUY NHẤT của feature này được chạm vào `prisma`.
 *
 * Khóa của BodyLog là `@@id([userId, date])`, nên mọi truy vấn đều mang
 * `userId` — kể cả khi bản này chỉ có một người dùng.
 */

function whereKey(date: string) {
  return { userId_date: { userId: LOCAL_USER_ID, date } };
}

export async function findByDate(date: string): Promise<BodyLog | null> {
  return prisma.bodyLog.findUnique({ where: whereKey(date) });
}

/** Bao gồm cả hai đầu mút, sắp xếp tăng dần theo `date`. */
export async function findInRange(from: string, to: string): Promise<BodyLog[]> {
  return prisma.bodyLog.findMany({
    where: { userId: LOCAL_USER_ID, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });
}

/**
 * `patch` chỉ chứa các trường người gửi thực sự gửi lên, nên `update: patch`
 * tự nhiên bỏ qua trường vắng mặt — đó chính là ngữ nghĩa "giữ nguyên".
 * Trường vắng mặt lúc `create` rơi về `null` theo schema.
 */
export async function upsertByDate(
  date: string,
  patch: BodyLogUpsertPatch,
): Promise<BodyLog> {
  return prisma.bodyLog.upsert({
    where: whereKey(date),
    create: { userId: LOCAL_USER_ID, date, ...patch },
    update: patch,
  });
}

/** `false` khi không có gì để xóa — service dịch thành 404. */
export async function deleteByDate(date: string): Promise<boolean> {
  // deleteMany thay vì delete: không có bản ghi thì trả count 0 chứ không ném
  // P2025, khỏi phải bắt lỗi Prisma chỉ để phân biệt "không tìm thấy".
  const result = await prisma.bodyLog.deleteMany({
    where: { userId: LOCAL_USER_ID, date },
  });
  return result.count > 0;
}
