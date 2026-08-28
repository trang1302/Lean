import { prisma } from '../../../lib/db.js';

/** Chỗ DUY NHẤT của feature này chạm `prisma`. */

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: { sequence: 'asc' } });
}

export async function listRolesWithUserCount() {
  return prisma.role.findMany({
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      _count: { select: { users: true } },
    },
  });
}

export async function findRoleById(roleId: string) {
  return prisma.role.findUnique({ where: { id: roleId }, select: { id: true, code: true } });
}

export async function findPermissionCodesByRoleId(roleId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { code: true } } },
    orderBy: { permission: { sequence: 'asc' } },
  });
  return rows.map((row) => row.permission.code);
}

export async function findPermissionIdsByCodes(
  codes: readonly string[],
): Promise<{ id: string; code: string }[]> {
  return prisma.permission.findMany({
    where: { code: { in: [...codes] } },
    select: { id: true, code: true },
  });
}

/**
 * Thay thế nguyên tập quyền trong MỘT transaction.
 *
 * Xóa rồi tạo mà không bọc transaction thì một lỗi ở bước tạo để lại vai trò
 * KHÔNG CÓ QUYỀN NÀO — tệ hơn hẳn trạng thái cũ.
 */
export async function replaceRolePermissions(
  roleId: string,
  permissionIds: readonly string[],
): Promise<void> {
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    }),
  ]);
}
