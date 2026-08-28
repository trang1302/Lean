export interface PermissionView {
  id: string;
  code: string;
  name: string;
  resource: string;
  action: string;
  sequence: number;
}

export interface RoleView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** Số tài khoản đang mang vai trò này — màn Phân quyền cần để cảnh báo trước khi sửa. */
  userCount: number;
}
