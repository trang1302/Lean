import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../../lib/apiClient';
import type { AdminUser, Role } from '../../../types/api';

const ME = 'me-1';
let permissions = new Set<string>();

vi.mock('../../auth', () => ({
  useSession: () => ({
    user: { id: ME, email: 'me@lean.local', displayName: null, status: 'active', role: null },
    permissions: [...permissions],
    loading: false,
    hasPermission: (code: string) => permissions.has(code),
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// eslint-disable-next-line import/first -- phải nằm sau vi.mock
import { UsersSection } from './UsersSection';

const ROLES: Role[] = [
  { id: 'r-user', code: 'USER', name: 'Người dùng', description: null, userCount: 1 },
  { id: 'r-admin', code: 'ADMIN', name: 'Quản trị tài khoản', description: null, userCount: 1 },
];

const USERS: AdminUser[] = [
  {
    id: ME,
    email: 'me@lean.local',
    displayName: 'Tôi',
    status: 'active',
    role: ROLES[1]!,
    lastLoginAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'u-2',
    email: 'other@lean.local',
    displayName: null,
    status: 'active',
    role: ROLES[0]!,
    lastLoginAt: null,
    createdAt: '2026-08-02T00:00:00.000Z',
  },
];

function mockLoads() {
  vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
    if (path === '/users') return Promise.resolve(USERS as unknown);
    if (path === '/roles') return Promise.resolve(ROLES as unknown);
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
  render(<UsersSection />);
  await screen.findByText('other@lean.local');
}

describe('UsersSection — chỉ xem (user:view)', () => {
  it('hiện danh sách nhưng KHÔNG có ô thêm tài khoản', async () => {
    await renderSection(['user:view']);

    expect(screen.getByText('me@lean.local')).toBeTruthy();
    expect(screen.queryByText('Thêm tài khoản')).toBeNull();
  });

  it('KHÔNG có nút Khóa / Xóa — ẩn hẳn, không phải nút xám', async () => {
    // Nút bấm vào chắc chắn 403 chỉ làm người dùng nghĩ app hỏng.
    await renderSection(['user:view']);

    expect(screen.queryByRole('button', { name: 'Khóa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa' })).toBeNull();
  });

  it('vai trò hiện dạng chữ, không phải dropdown', async () => {
    await renderSection(['user:view']);

    expect(screen.getByText('Người dùng')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('UsersSection — quản lý tài khoản (user:manage)', () => {
  it('hiện ô thêm tài khoản, kèm lời nhắc vai trò luôn là USER', async () => {
    // Không có ô chọn vai trò ở form tạo: server gán cứng và từ chối `roleId`.
    await renderSection(['user:view', 'user:manage']);

    expect(screen.getByText('Thêm tài khoản')).toBeTruthy();
    expect(screen.getByText(/luôn mang vai trò Người dùng/)).toBeTruthy();
  });

  it('KHÔNG có nút Xóa ở dòng của chính mình', async () => {
    // Server trả 400 cho ca này; bày nút ra chỉ để người dùng bấm rồi nhận lỗi.
    await renderSection(['user:view', 'user:manage']);

    const rows = screen.getAllByRole('row');
    const myRow = rows.find((row) => row.textContent?.includes('me@lean.local'))!;
    const otherRow = rows.find((row) => row.textContent?.includes('other@lean.local'))!;

    expect(within(myRow).queryByRole('button', { name: 'Xóa' })).toBeNull();
    expect(within(otherRow).getByRole('button', { name: 'Xóa' })).toBeTruthy();
  });

  it('vẫn KHÔNG đổi được vai trò khi thiếu rbac:manage', async () => {
    await renderSection(['user:view', 'user:manage']);

    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('khóa tài khoản gọi PATCH với status disabled', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({} as never);
    await renderSection(['user:view', 'user:manage']);

    const rows = screen.getAllByRole('row');
    const otherRow = rows.find((row) => row.textContent?.includes('other@lean.local'))!;
    await userEvent.click(within(otherRow).getByRole('button', { name: 'Khóa' }));

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith('/users/u-2', { status: 'disabled' });
    });
  });
});

describe('UsersSection — gán vai trò (rbac:manage)', () => {
  it('dòng người khác có dropdown vai trò, dòng của mình thì không', async () => {
    // Tự đổi vai trò của chính mình bị server chặn (400).
    await renderSection(['user:view', 'user:manage', 'rbac:manage']);

    const rows = screen.getAllByRole('row');
    const myRow = rows.find((row) => row.textContent?.includes('me@lean.local'))!;
    const otherRow = rows.find((row) => row.textContent?.includes('other@lean.local'))!;

    expect(within(otherRow).getByRole('combobox')).toBeTruthy();
    expect(within(myRow).queryByRole('combobox')).toBeNull();
  });

  it('đổi dropdown gọi PUT /users/:id/role', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({} as never);
    await renderSection(['user:view', 'user:manage', 'rbac:manage']);

    const rows = screen.getAllByRole('row');
    const otherRow = rows.find((row) => row.textContent?.includes('other@lean.local'))!;
    await userEvent.selectOptions(within(otherRow).getByRole('combobox'), 'r-admin');

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith('/users/u-2/role', { roleId: 'r-admin' });
    });
  });
});
