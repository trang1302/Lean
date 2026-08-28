import { prisma } from '../../../lib/db.js';

/** Chỗ DUY NHẤT của feature này chạm `prisma`. */

const USER_VIEW = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, code: true, name: true } },
} as const;

export type UserRow = Awaited<ReturnType<typeof findUserById>> extends infer T
  ? T extends null | undefined
    ? never
    : NonNullable<T>
  : never;

export async function listUsers() {
  return prisma.user.findMany({ select: USER_VIEW, orderBy: { createdAt: 'asc' } });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: USER_VIEW });
}

export async function emailExists(email: string): Promise<boolean> {
  return (await prisma.user.count({ where: { email } })) > 0;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName: string | null;
  roleId: string | null;
}) {
  return prisma.user.create({ data, select: USER_VIEW });
}

export async function updateUser(
  id: string,
  data: { displayName?: string | null; status?: string },
) {
  return prisma.user.update({ where: { id }, data, select: USER_VIEW });
}

export async function updateRole(id: string, roleId: string) {
  return prisma.user.update({ where: { id }, data: { roleId }, select: USER_VIEW });
}

export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

export async function findRoleById(roleId: string) {
  return prisma.role.findUnique({ where: { id: roleId }, select: { id: true, code: true } });
}

export async function findRoleIdByCode(code: string): Promise<string | null> {
  const role = await prisma.role.findUnique({ where: { code }, select: { id: true } });
  return role?.id ?? null;
}

/** Đếm tài khoản ĐANG HOẠT ĐỘNG mang một vai trò — dùng cho bất biến "còn ít nhất một". */
export async function countActiveUsersWithRoleCode(code: string): Promise<number> {
  return prisma.user.count({ where: { status: 'active', role: { code } } });
}
