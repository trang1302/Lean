import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { PERMISSION_RULES } from '../../../src/shared/rbac/permissionRegistry.js';
import { createTestUser, loginAgent, resetPermissionCache } from '../../helpers/auth.js';

const app = createApp();

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.user.deleteMany();
  // Cache sống xuyên suốt tiến trình; không dọn là ca trước làm bẩn ca sau.
  resetPermissionCache();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * `USER` có 6 quyền dữ liệu, `ADMIN` thêm `user:*`, `SYSTEM_ADMIN` đủ 10.
 * Suite này canh đúng ranh giới đó — và canh rằng ranh giới nằm ở MỘT chỗ.
 */
describe('USER — 6 quyền dữ liệu, không có quyền quản trị', () => {
  it.each([
    ['GET', '/api/goal'],
    ['GET', '/api/reminders'],
    ['GET', '/api/summary?from=2026-08-01&to=2026-08-10'],
    ['GET', '/api/body-logs?from=2026-08-01&to=2026-08-10'],
    ['GET', '/api/meals?date=2026-08-10'],
  ])('vào được %s %s', async (_method, path) => {
    const agent = await loginAgent(app, await createTestUser('u@lean.local', undefined, 'USER'));

    expect((await agent.get(path)).status).toBe(200);
  });

  it.each([['/api/users'], ['/api/roles'], ['/api/permissions']])(
    'bị 403 FORBIDDEN ở %s',
    async (path) => {
      const agent = await loginAgent(app, await createTestUser('u@lean.local', undefined, 'USER'));

      const res = await agent.get(path);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    },
  );

  it('message nêu mã quyền còn thiếu, KHÔNG nêu vai trò nào có nó', async () => {
    // Nêu mã quyền giúp gỡ lỗi và không lộ gì. Nêu "cần vai trò ADMIN" là vẽ
    // bản đồ hệ thống phân quyền cho người không có quyền xem nó.
    const agent = await loginAgent(app, await createTestUser('u@lean.local', undefined, 'USER'));

    const res = await agent.get('/api/users');

    expect(res.body.error.message).toContain('user:view');
    expect(res.body.error.message).not.toContain('ADMIN');
  });
});

describe('ADMIN — thêm user:*, KHÔNG có rbac:*', () => {
  it('qua được cửa quyền ở /api/users', async () => {
    const agent = await loginAgent(app, await createTestUser('a@lean.local', undefined, 'ADMIN'));

    // Khẳng định "không phải 403" chứ không phải một status cụ thể: giai đoạn C
    // dựng route thật ở đây, và ca này phải vẫn đúng sau đó.
    expect((await agent.get('/api/users')).status).not.toBe(403);
  });

  it('bị 403 ở PUT /api/users/:id/role — không tự nâng mình lên được', async () => {
    // Bất biến chống leo thang quyền quan trọng nhất của cả registry.
    const admin = await createTestUser('a@lean.local', undefined, 'ADMIN');
    const agent = await loginAgent(app, admin);

    const res = await agent.put(`/api/users/${admin.id}/role`).send({ roleId: 'bat-ky' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('rbac:manage');
  });

  it('bị 403 ở PUT /api/roles/:id/permissions', async () => {
    const agent = await loginAgent(app, await createTestUser('a@lean.local', undefined, 'ADMIN'));

    expect((await agent.put('/api/roles/r1/permissions').send({ codes: [] })).status).toBe(403);
  });
});

describe('SYSTEM_ADMIN — đủ 10 quyền, không bao giờ bị 403', () => {
  it.each([
    ['/api/users'],
    ['/api/roles'],
    ['/api/permissions'],
    ['/api/goal'],
    ['/api/reminders'],
  ])('qua được cửa quyền ở %s', async (path) => {
    const agent = await loginAgent(
      app,
      await createTestUser('s@lean.local', undefined, 'SYSTEM_ADMIN'),
    );

    expect((await agent.get(path)).status).not.toBe(403);
  });
});

describe('tài khoản chưa được cấp vai trò — fail CLOSED', () => {
  it('đăng nhập được nhưng mọi route cần quyền đều 403', async () => {
    // `roleId = null` phải là tập quyền RỖNG, không phải "bỏ qua kiểm tra".
    const agent = await loginAgent(app, await createTestUser('x@lean.local', undefined, null));

    expect((await agent.get('/api/auth/session')).status).toBe(200);
    expect((await agent.get('/api/goal')).status).toBe(403);
    expect((await agent.get('/api/users')).status).toBe(403);
  });
});

describe('401 / 403 / 404 — ba lớp, ba chủ thể quyết định khác nhau', () => {
  it('chưa đăng nhập → 401 (requireAuth)', async () => {
    const res = await request(app).get('/api/goal');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('đã đăng nhập, thiếu quyền → 403 (permissionGuard)', async () => {
    const agent = await loginAgent(app, await createTestUser('u@lean.local', undefined, 'USER'));

    expect((await agent.get('/api/users')).status).toBe(403);
  });

  it('có quyền, nhưng hàng của người khác → 404 (ownership)', async () => {
    // Ba lớp trực giao. RBAC cho vào chức năng; ownership quyết định hàng nào
    // hiện ra. Trộn hai thứ là chỗ sinh lỗ hổng.
    const alice = await createTestUser('alice@lean.local', undefined, 'USER');
    const bob = await createTestUser('bob@lean.local', undefined, 'USER');
    const bobMeal = await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'x', calories: 500 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.patch(`/api/meals/${bobMeal.id}`).send({ calories: 1 });

    expect(res.status).toBe(404);
    expect((await prisma.meal.findUnique({ where: { id: bobMeal.id } }))!.calories).toBe(500);
  });

  it('SYSTEM_ADMIN cũng KHÔNG đọc được dữ liệu người khác — RBAC không thay ownership', async () => {
    // Test quan trọng nhất của cả feature (rbac/SPEC.md §11 dòng 1). Có
    // `log:view` nghĩa là được vào chức năng "xem nhật ký", không có nghĩa là
    // xem được nhật ký của ai khác.
    const bob = await createTestUser('bob@lean.local', undefined, 'USER');
    const bobMeal = await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'x', calories: 900 },
    });

    const agent = await loginAgent(
      app,
      await createTestUser('s@lean.local', undefined, 'SYSTEM_ADMIN'),
    );

    expect((await agent.get('/api/meals?date=2026-08-10')).body).toHaveLength(0);
    expect((await agent.patch(`/api/meals/${bobMeal.id}`).send({ calories: 1 })).status).toBe(404);
    expect((await prisma.meal.findUnique({ where: { id: bobMeal.id } }))!.calories).toBe(900);
  });

  it('path lạ dưới /api → 403 mặc-định-từ-chối, không phải 404', async () => {
    const agent = await loginAgent(app, await createTestUser('u@lean.local', undefined, 'USER'));

    const res = await agent.get('/api/mot-route-chua-khai');

    expect(res.status).toBe(403);
  });

  it('path ngoài /api không rơi vào nhánh mặc-định-từ-chối của guard', async () => {
    // Guard cắm ở '/api' nên nó không bao giờ thấy path này — `requireAuth`
    // (cắm ở cấp app) trả lời trước bằng 401. Điều cần khóa ở đây là "không
    // phải 403": cắm guard ở cấp app sẽ biến mọi path lạ thành 403 và nuốt mất
    // `notFoundHandler`.
    const outside = await request(app).get('/khong-phai-api');
    expect(outside.status).not.toBe(403);

    // Đã đăng nhập thì qua `requireAuth`, và lúc đó đúng là 404 của notFoundHandler.
    const agent = await loginAgent(app, await createTestUser('u@lean.local', undefined, 'USER'));
    expect((await agent.get('/khong-phai-api')).status).toBe(404);
  });
});

describe('evict cache — đổi quyền có hiệu lực NGAY, không chờ TTL', () => {
  it('gỡ log:view khỏi USER → request kế tiếp 403 ngay', async () => {
    // Nếu ca này phải chờ TTL mới xanh thì đang thiếu một lời gọi evict.
    const agent = await loginAgent(app, await createTestUser('u@lean.local', undefined, 'USER'));
    expect((await agent.get('/api/meals?date=2026-08-10')).status).toBe(200);

    const role = (await prisma.role.findUnique({ where: { code: 'USER' } }))!;
    const permission = (await prisma.permission.findUnique({ where: { code: 'log:view' } }))!;
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    });
    const { evictRole } = await import('../../../src/shared/rbac/permissionCache.js');
    await evictRole(role.id);

    expect((await agent.get('/api/meals?date=2026-08-10')).status).toBe(403);

    // Trả lại ma trận cho ca sau — seed chỉ chạy một lần cho cả run.
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
  });
});

describe('bất biến registry ↔ DB', () => {
  it('mọi mã quyền registry yêu cầu đều tồn tại trong bảng Permission', async () => {
    // Sai chính tả một mã là một endpoint KHÔNG vai trò nào vào được. Không có
    // lỗi lúc khởi động, chỉ 403 mãi mãi.
    const needed = [
      ...new Set(
        PERMISSION_RULES.map((rule) => rule.permission).filter(
          (code): code is string => code !== null,
        ),
      ),
    ];
    const rows = await prisma.permission.findMany({
      where: { code: { in: needed } },
      select: { code: true },
    });

    expect(new Set(rows.map((r) => r.code))).toEqual(new Set(needed));
  });

  it('SYSTEM_ADMIN có đủ 10 quyền — vai trò cao nhất không bao giờ bị 403', async () => {
    const count = await prisma.rolePermission.count({
      where: { role: { code: 'SYSTEM_ADMIN' } },
    });

    expect(count).toBe(await prisma.permission.count());
  });

  it('ADMIN có user:* nhưng KHÔNG có rbac:*', async () => {
    const rows = await prisma.rolePermission.findMany({
      where: { role: { code: 'ADMIN' } },
      select: { permission: { select: { code: true } } },
    });
    const codes = new Set(rows.map((r) => r.permission.code));

    expect(codes.has('user:view')).toBe(true);
    expect(codes.has('user:manage')).toBe(true);
    expect(codes.has('rbac:view')).toBe(false);
    expect(codes.has('rbac:manage')).toBe(false);
  });
});
