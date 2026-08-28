import { describe, it, expect } from 'vitest';
import {
  PERMISSION_RULES,
  resolvePermission,
} from '../../../src/shared/rbac/permissionRegistry.js';

/**
 * Bảng §7 của docs/features/rbac/SPEC.md **là** code, và thứ tự các dòng là một
 * phần của đặc tả. Suite này canh đúng thứ tự đó.
 *
 * Hàm thuần: không DB, không HTTP, không cache. Nó chỉ trả lời "method + path
 * này đòi mã quyền nào" — ai được cấp mã đó là việc của guard.
 */

describe('luật mở — phải đứng đầu bảng', () => {
  it.each([
    ['GET', '/health'],
    ['POST', '/auth/login'],
    ['POST', '/auth/register'],
    ['POST', '/auth/logout'],
    ['GET', '/auth/csrf'],
    ['GET', '/auth/session'],
  ])('%s %s → mở (permission null)', (method, path) => {
    const res = resolvePermission(method, path);

    expect(res.matched).toBe(true);
    expect(res.permission).toBeNull();
  });

  it('nếu một luật rộng khớp /auth trước thì đăng nhập cần đăng nhập', () => {
    // Ca này không kiểm một hành vi mới — nó khóa THỨ TỰ. `/auth/**` phải nằm
    // trước mọi luật có thể khớp nó.
    const authIndex = PERMISSION_RULES.findIndex((rule) => rule.path.startsWith('/auth'));
    const firstGuardedIndex = PERMISSION_RULES.findIndex((rule) => rule.permission !== null);

    expect(authIndex).toBeLessThan(firstGuardedIndex);
  });
});

describe('năm router dữ liệu', () => {
  it.each([
    ['GET', '/body-logs', 'log:view'],
    ['GET', '/body-logs/2026-08-10', 'log:view'],
    ['PUT', '/body-logs/2026-08-10', 'log:manage'],
    ['DELETE', '/body-logs/2026-08-10', 'log:manage'],
    ['GET', '/meals', 'log:view'],
    ['POST', '/meals', 'log:manage'],
    ['PATCH', '/meals/abc123', 'log:manage'],
    ['DELETE', '/meals/abc123', 'log:manage'],
    ['GET', '/summary', 'log:view'],
    ['GET', '/goal', 'goal:view'],
    ['PUT', '/goal', 'goal:manage'],
    ['GET', '/reminders', 'reminder:view'],
    ['PUT', '/reminders/weigh_in', 'reminder:manage'],
  ])('%s %s → %s', (method, path, permission) => {
    expect(resolvePermission(method, path)).toEqual({ matched: true, permission });
  });
});

describe('API quản trị', () => {
  it.each([
    ['GET', '/permissions', 'rbac:view'],
    ['GET', '/roles', 'rbac:view'],
    ['GET', '/roles/r1/permissions', 'rbac:view'],
    ['PUT', '/roles/r1/permissions', 'rbac:manage'],
    ['GET', '/users', 'user:view'],
    ['GET', '/users/u1', 'user:view'],
    ['POST', '/users', 'user:manage'],
    ['PATCH', '/users/u1', 'user:manage'],
    ['DELETE', '/users/u1', 'user:manage'],
    ['POST', '/users/u1/password', 'user:manage'],
  ])('%s %s → %s', (method, path, permission) => {
    expect(resolvePermission(method, path)).toEqual({ matched: true, permission });
  });

  it('PUT /users/:id/role đòi rbac:manage, KHÔNG phải user:manage', () => {
    // Bất biến thứ tự quan trọng nhất của cả registry. Đảo hai dòng là ai quản
    // lý được tài khoản thì tự nâng mình lên SYSTEM_ADMIN.
    expect(resolvePermission('PUT', '/users/u1/role')).toEqual({
      matched: true,
      permission: 'rbac:manage',
    });
  });

  it('dòng /users/*/role đứng TRƯỚC dòng /users/*', () => {
    const roleRule = PERMISSION_RULES.findIndex((r) => r.path === '/users/*/role');
    const usersWrite = PERMISSION_RULES.findIndex(
      (r) => r.path === '/users/*' && r.permission === 'user:manage',
    );

    expect(roleRule).toBeGreaterThanOrEqual(0);
    expect(usersWrite).toBeGreaterThanOrEqual(0);
    expect(roleRule).toBeLessThan(usersWrite);
  });
});

describe('mặc định TỪ CHỐI', () => {
  it.each([
    ['GET', '/khong-ton-tai'],
    ['POST', '/body-logs'],
    ['GET', '/users/u1/sessions'],
    ['DELETE', '/summary'],
  ])('%s %s → không khớp luật nào', (method, path) => {
    const res = resolvePermission(method, path);

    expect(res.matched).toBe(false);
    expect(res.permission).toBeNull();
  });

  it('quên khai route mới là lỗi ỒN ÀO (403), không phải lỗ hổng im lặng', () => {
    // Đây là chỗ Lean cố ý lệch khỏi upip (SPEC §6.4). Nếu ai đó đổi mặc định
    // thành "cho qua", ca này đỏ ngay.
    expect(resolvePermission('POST', '/mot-route-vua-them').matched).toBe(false);
  });
});

describe('bất biến của bảng luật', () => {
  it('mọi mã quyền trong registry đều thuộc danh mục 10 mã', () => {
    // Sai chính tả một mã ở đây là một endpoint KHÔNG vai trò nào vào được —
    // không ném lỗi lúc khởi động, chỉ 403 mãi mãi.
    const CATALOG = new Set([
      'log:view',
      'log:manage',
      'goal:view',
      'goal:manage',
      'reminder:view',
      'reminder:manage',
      'user:view',
      'user:manage',
      'rbac:view',
      'rbac:manage',
    ]);

    const unknown = PERMISSION_RULES.filter(
      (rule) => rule.permission !== null && !CATALOG.has(rule.permission),
    );

    expect(unknown).toEqual([]);
  });

  it('không có hai luật trùng hệt nhau (method + path)', () => {
    const keys = PERMISSION_RULES.flatMap((rule) =>
      (rule.methods === 'ANY' ? ['ANY'] : rule.methods).map((m) => `${m} ${rule.path}`),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
