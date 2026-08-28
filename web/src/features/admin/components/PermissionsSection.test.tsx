import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../../lib/apiClient';
import type { Permission, Role } from '../../../types/api';

let permissions = new Set<string>();

vi.mock('../../auth', () => ({
  useSession: () => ({
    user: null,
    permissions: [...permissions],
    loading: false,
    hasPermission: (code: string) => permissions.has(code),
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// eslint-disable-next-line import/first -- phải nằm sau vi.mock
import { PermissionsSection } from './PermissionsSection';

const PERMISSIONS: Permission[] = [
  { id: 'p1', code: 'log:view', name: 'Xem nhật ký', resource: 'log', action: 'view', sequence: 10 },
  { id: 'p2', code: 'log:manage', name: 'Ghi nhật ký', resource: 'log', action: 'manage', sequence: 20 },
  { id: 'p3', code: 'rbac:manage', name: 'Sửa phân quyền', resource: 'rbac', action: 'manage', sequence: 100 },
];

const ROLES: Role[] = [
  { id: 'r-user', code: 'USER', name: 'Người dùng', description: 'Ghi dữ liệu của mình.', userCount: 3 },
  { id: 'r-sys', code: 'SYSTEM_ADMIN', name: 'Quản trị hệ thống', description: null, userCount: 1 },
];

function mockLoads(codesByRole: Record<string, string[]> = { 'r-user': ['log:view'] }) {
  vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
    if (path === '/permissions') return Promise.resolve(PERMISSIONS as unknown);
    if (path === '/roles') return Promise.resolve(ROLES as unknown);
    const match = /^\/roles\/(.+)\/permissions$/.exec(path);
    if (match) return Promise.resolve({ codes: codesByRole[match[1]!] ?? [] } as unknown);
    throw new Error(`không mong đợi GET ${path}`);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  permissions = new Set<string>();
});

async function renderSection(codes: string[]) {
  permissions = new Set(codes);
  mockLoads();
  render(<PermissionsSection />);
  await screen.findByLabelText(/Xem nhật ký/);
}

describe('PermissionsSection — chỉ đọc (rbac:view)', () => {
  it('checkbox bị disable và KHÔNG có nút Lưu', async () => {
    await renderSection(['rbac:view']);

    expect((screen.getByLabelText(/Xem nhật ký/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Lưu phân quyền/ })).toBeNull();
    expect(screen.getByText('Bạn chỉ có quyền xem phân quyền.')).toBeTruthy();
  });

  it('vai trò đầu tiên được chọn sẵn, kèm số tài khoản đang mang', async () => {
    await renderSection(['rbac:view']);

    expect(screen.getByRole('button', { name: 'Người dùng (3)' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('nhóm quyền theo resource — lý do Permission mang sẵn hai cột tách rời', async () => {
    await renderSection(['rbac:view']);

    expect(screen.getByText('log')).toBeTruthy();
    expect(screen.getByText('rbac')).toBeTruthy();
  });

  it('KHÔNG có nút tạo/xóa vai trò — danh mục là đóng', async () => {
    await renderSection(['rbac:view']);

    expect(screen.queryByRole('button', { name: /Thêm vai trò/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Xóa vai trò/ })).toBeNull();
  });
});

describe('PermissionsSection — sửa được (rbac:manage)', () => {
  it('gửi ĐỦ danh sách muốn giữ, không phải phần thay đổi', async () => {
    // API thay thế chứ không cộng dồn — gửi thiếu là vô tình gỡ quyền.
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ codes: ['log:view', 'log:manage'] } as never);
    await renderSection(['rbac:view', 'rbac:manage']);

    await userEvent.click(screen.getByLabelText(/Ghi nhật ký/));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu phân quyền' }));

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith('/roles/r-user/permissions', {
        codes: ['log:view', 'log:manage'],
      });
    });
  });

  it('bỏ tick rồi lưu thì gửi danh sách ngắn hơn — đây là cách ẩn chức năng', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ codes: [] } as never);
    await renderSection(['rbac:view', 'rbac:manage']);

    await userEvent.click(screen.getByLabelText(/Xem nhật ký/));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu phân quyền' }));

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith('/roles/r-user/permissions', { codes: [] });
    });
  });

  it('lưu hỏng → hiện lỗi VÀ nạp lại sự thật từ server', async () => {
    // Để nguyên thứ đang tick sau một lần lưu hỏng là nói dối người dùng về
    // trạng thái thật của ma trận.
    const { ApiError } = await import('../../../types/api');
    vi.spyOn(apiClient, 'put').mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', [
        { path: 'codes', message: 'Không gỡ được rbac:manage khỏi vai trò quản trị hệ thống' },
      ]),
    );
    await renderSection(['rbac:view', 'rbac:manage']);

    await userEvent.click(screen.getByLabelText(/Ghi nhật ký/));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu phân quyền' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Không gỡ được rbac:manage khỏi vai trò quản trị hệ thống',
    );
    await waitFor(() => {
      expect((screen.getByLabelText(/Ghi nhật ký/) as HTMLInputElement).checked).toBe(false);
    });
  });

  it('đổi vai trò thì nạp tập quyền của vai trò đó', async () => {
    vi.restoreAllMocks();
    permissions = new Set(['rbac:view', 'rbac:manage']);
    mockLoads({ 'r-user': ['log:view'], 'r-sys': ['log:view', 'log:manage', 'rbac:manage'] });
    render(<PermissionsSection />);
    await screen.findByLabelText(/Xem nhật ký/);

    await userEvent.click(screen.getByRole('button', { name: 'Quản trị hệ thống (1)' }));

    await waitFor(() => {
      expect((screen.getByLabelText(/Sửa phân quyền/) as HTMLInputElement).checked).toBe(true);
    });
  });
});
