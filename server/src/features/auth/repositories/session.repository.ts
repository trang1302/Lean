import { prisma } from '../../../lib/db.js';

// Chỗ DUY NHẤT của phiên được import `prisma`.

export async function findSessionById(
  sid: string,
): Promise<{ data: string; expiresAt: Date } | null> {
  return prisma.session.findUnique({
    where: { id: sid },
    select: { data: true, expiresAt: true },
  });
}

export async function upsertSession(
  sid: string,
  userId: string | null,
  data: string,
  expiresAt: Date,
): Promise<void> {
  // userId null xảy ra với phiên chưa đăng nhập (ví dụ phiên chỉ mang CSRF
  // secret). Cột userId là NOT NULL + có FK, nên phiên vô danh KHÔNG ghi được
  // vào bảng này — xem ghi chú ở prismaSessionStore.set.
  if (userId === null) return;

  await prisma.session.upsert({
    where: { id: sid },
    create: { id: sid, userId, data, expiresAt },
    update: { userId, data, expiresAt },
  });
}

export async function touchSession(sid: string, expiresAt: Date): Promise<void> {
  await prisma.session.updateMany({ where: { id: sid }, data: { expiresAt } });
}

export async function deleteSession(sid: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sid } });
}

/** Thu hồi mọi phiên của một user — dùng cho §7.6 và §7.7. */
export async function deleteSessionsByUserId(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

export async function deleteExpiredSessions(now: Date): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}
