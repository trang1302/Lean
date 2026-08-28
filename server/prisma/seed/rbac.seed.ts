import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../src/lib/db.js';

/**
 * Seed danh mục quyền + vai trò + ma trận. **Idempotent** — chạy lại nhiều lần
 * cho cùng kết quả (upsert theo `code`).
 *
 * Script này CHỈ đụng ba bảng RBAC và cột `User.roleId`. Nó KHÔNG tạo tài
 * khoản nào — việc đó là của `users.seed.ts`, tách vai có chủ đích
 * (rbac/SPEC.md §9).
 *
 * Chạy: `npm run seed:rbac`
 *
 * Export `seedRbac()` để `test/globalSetup.ts` dùng lại ĐÚNG hàm này. Chép ma
 * trận sang một bản riêng cho test là cách chắc chắn nhất để test xanh trong
 * khi app thật sai — hai bản sẽ lệch nhau ngay lần đầu sửa quyền.
 */

/** 10 quyền của rbac/SPEC.md §3. `sequence` quyết định thứ tự trên màn Phân quyền. */
const PERMISSIONS = [
  { code: 'log:view', name: 'Xem nhật ký', resource: 'log', action: 'view', sequence: 10 },
  { code: 'log:manage', name: 'Ghi nhật ký', resource: 'log', action: 'manage', sequence: 20 },
  { code: 'goal:view', name: 'Xem mục tiêu', resource: 'goal', action: 'view', sequence: 30 },
  { code: 'goal:manage', name: 'Đặt mục tiêu', resource: 'goal', action: 'manage', sequence: 40 },
  { code: 'reminder:view', name: 'Xem nhắc nhở', resource: 'reminder', action: 'view', sequence: 50 },
  { code: 'reminder:manage', name: 'Cấu hình nhắc nhở', resource: 'reminder', action: 'manage', sequence: 60 },
  { code: 'user:view', name: 'Xem tài khoản', resource: 'user', action: 'view', sequence: 70 },
  { code: 'user:manage', name: 'Quản lý tài khoản', resource: 'user', action: 'manage', sequence: 80 },
  { code: 'rbac:view', name: 'Xem phân quyền', resource: 'rbac', action: 'view', sequence: 90 },
  { code: 'rbac:manage', name: 'Sửa phân quyền', resource: 'rbac', action: 'manage', sequence: 100 },
] as const;

const DATA_PERMISSIONS = [
  'log:view',
  'log:manage',
  'goal:view',
  'goal:manage',
  'reminder:view',
  'reminder:manage',
];

/**
 * Ba vai trò của design doc §3. `ADMIN` KHÔNG có `rbac:*` — cấp `rbac:manage`
 * cho `ADMIN` là cho `ADMIN` tự nâng mình lên `SYSTEM_ADMIN`.
 */
const ROLES = [
  {
    code: 'USER',
    name: 'Người dùng',
    description: 'Ghi và đọc dữ liệu của chính mình.',
    sequence: 10,
    permissions: DATA_PERMISSIONS,
  },
  {
    code: 'ADMIN',
    name: 'Quản trị tài khoản',
    description: 'Quản lý tài khoản. Không gán được vai trò.',
    sequence: 20,
    permissions: [...DATA_PERMISSIONS, 'user:view', 'user:manage'],
  },
  {
    code: 'SYSTEM_ADMIN',
    name: 'Quản trị hệ thống',
    description: 'Toàn quyền, kể cả gán vai trò và sửa ma trận quyền.',
    sequence: 30,
    permissions: PERMISSIONS.map((p) => p.code),
  },
] as const;

async function seedPermissions(): Promise<Map<string, string>> {
  const byCode = new Map<string, string>();
  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        sequence: permission.sequence,
      },
      create: { ...permission },
      select: { id: true },
    });
    byCode.set(permission.code, row.id);
  }
  return byCode;
}

async function seedRoles(permissionIdByCode: Map<string, string>): Promise<Map<string, string>> {
  const byCode = new Map<string, string>();

  for (const role of ROLES) {
    const row = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, sequence: role.sequence },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        sequence: role.sequence,
      },
      select: { id: true },
    });
    byCode.set(role.code, row.id);

    // ĐẶT LẠI toàn bộ tập quyền, không cộng dồn: seed là nguồn sự thật của ma
    // trận. Cộng dồn thì gỡ một quyền khỏi mảng ở trên sẽ không có tác dụng gì.
    await prisma.rolePermission.deleteMany({ where: { roleId: row.id } });
    await prisma.rolePermission.createMany({
      data: role.permissions.map((code) => ({
        roleId: row.id,
        permissionId: permissionIdByCode.get(code)!,
      })),
    });
  }

  return byCode;
}

/**
 * Gán vai trò cho tài khoản chưa có.
 *
 * Tài khoản CŨ NHẤT nhận `SYSTEM_ADMIN` — nó là chủ máy, và phải tồn tại ít
 * nhất một `SYSTEM_ADMIN` thì mới có ai gán được vai trò cho người sau; không
 * thì thao tác đầu tiên bắt buộc phải sửa DB bằng tay. Những tài khoản còn lại
 * nhận `USER`.
 *
 * Chỉ chạm hàng `roleId IS NULL` nên chạy lại vô hại, và KHÔNG bao giờ hạ vai
 * trò của ai đã được gán.
 *
 * Lưu ý đúng theo rbac/SPEC.md §5: `SYSTEM_ADMIN` KHÔNG vì thế mà đọc được dữ
 * liệu sức khỏe của người khác. Ownership vẫn chặn ở tầng repository.
 */
async function backfillRoles(roleIdByCode: Map<string, string>): Promise<void> {
  const unassigned = await prisma.user.findMany({
    where: { roleId: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (unassigned.length === 0) return;

  const hasSystemAdmin =
    (await prisma.user.count({ where: { roleId: roleIdByCode.get('SYSTEM_ADMIN')! } })) > 0;

  for (const [index, user] of unassigned.entries()) {
    const code = !hasSystemAdmin && index === 0 ? 'SYSTEM_ADMIN' : 'USER';
    await prisma.user.update({
      where: { id: user.id },
      data: { roleId: roleIdByCode.get(code)! },
    });
    console.log(`  gán ${code.padEnd(12)} cho ${user.email}`);
  }
}

/**
 * `log` tắt được để test không rải chữ ra output. `backfill` tắt được vì test
 * tự dựng user và vai trò theo từng ca — backfill sẽ gán nhầm.
 */
export async function seedRbac(
  options: { log?: boolean; backfill?: boolean } = {},
): Promise<void> {
  const { log = false, backfill = true } = options;
  const say = (message: string): void => {
    if (log) console.log(message);
  };

  say('Seed RBAC…');
  const permissionIdByCode = await seedPermissions();
  say(`  ${permissionIdByCode.size} quyền`);

  const roleIdByCode = await seedRoles(permissionIdByCode);
  say(`  ${roleIdByCode.size} vai trò + ma trận`);

  if (backfill) await backfillRoles(roleIdByCode);
  say('Xong.');
}

// Chỉ chạy khi gọi thẳng file này (`npm run seed:rbac`), không chạy khi import.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seedRbac({ log: true });
  await prisma.$disconnect();
}
