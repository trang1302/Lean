// Bốn nhóm endpoint quản trị của server (docs/features/rbac/SPEC.md §10 và
// design doc §6.1). Không state, không React — `apiClient` là nơi duy nhất gọi
// `fetch()` và nó đã lo cookie phiên + header CSRF.

import { apiClient } from '../../../lib/apiClient';
import type { AdminUser, Permission, Role } from '../../../types/api';

export function listUsers(): Promise<AdminUser[]> {
  return apiClient.get<AdminUser[]>('/users');
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Tài khoản tạo ra LUÔN mang vai trò `USER` — server gán cứng và từ chối
 * `roleId` trong body (400). Đổi vai trò là một lời gọi riêng, xem `assignRole`.
 */
export function createUser(input: CreateUserInput): Promise<AdminUser> {
  return apiClient.post<AdminUser>('/users', input);
}

export function updateUser(
  id: string,
  patch: { displayName?: string | null; status?: 'active' | 'disabled' },
): Promise<AdminUser> {
  return apiClient.patch<AdminUser>(`/users/${id}`, patch);
}

export function deleteUser(id: string): Promise<void> {
  return apiClient.delete<void>(`/users/${id}`);
}

/** Thu hồi mọi phiên của tài khoản đó ở phía server. */
export function resetPassword(id: string, password: string): Promise<void> {
  return apiClient.post<void>(`/users/${id}/password`, { password });
}

/** Cần `rbac:manage` — chỉ `SYSTEM_ADMIN` gọi được. */
export function assignRole(id: string, roleId: string): Promise<AdminUser> {
  return apiClient.put<AdminUser>(`/users/${id}/role`, { roleId });
}

export function listPermissions(): Promise<Permission[]> {
  return apiClient.get<Permission[]>('/permissions');
}

export function listRoles(): Promise<Role[]> {
  return apiClient.get<Role[]>('/roles');
}

export function getRolePermissions(roleId: string): Promise<{ codes: string[] }> {
  return apiClient.get<{ codes: string[] }>(`/roles/${roleId}/permissions`);
}

/** THAY THẾ toàn bộ tập quyền, không cộng dồn — gửi đủ danh sách muốn giữ. */
export function setRolePermissions(roleId: string, codes: string[]): Promise<{ codes: string[] }> {
  return apiClient.put<{ codes: string[] }>(`/roles/${roleId}/permissions`, { codes });
}
