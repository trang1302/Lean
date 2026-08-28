import { prisma } from '../../../lib/db.js';

// Chỗ DUY NHẤT của feature này được import `prisma`.

export interface UserRole {
  id: string;
  code: string;
  name: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  status: string;
  /** `null` khi tài khoản chưa được cấp vai trò → tập quyền rỗng, fail closed. */
  role: UserRole | null;
}

const PUBLIC_AND_HASH = {
  id: true,
  email: true,
  passwordHash: true,
  displayName: true,
  status: true,
  role: { select: { id: true, code: true, name: true } },
} as const;

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { email }, select: PUBLIC_AND_HASH });
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_AND_HASH });
}

export async function emailExists(email: string): Promise<boolean> {
  return (await prisma.user.count({ where: { email } })) > 0;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName: string | null;
  roleId: string | null;
}): Promise<UserRecord> {
  return prisma.user.create({ data, select: PUBLIC_AND_HASH });
}

/** Vai trò mặc định của tài khoản tự đăng ký. Gán CỨNG phía server. */
export async function findRoleIdByCode(code: string): Promise<string | null> {
  const role = await prisma.role.findUnique({ where: { code }, select: { id: true } });
  return role?.id ?? null;
}

export async function updateLastLoginAt(userId: string, at: Date): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
}
