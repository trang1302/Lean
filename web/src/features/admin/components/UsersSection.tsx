import { useCallback, useEffect, useState } from 'react';
import { Button, Input, PasswordInput, Select } from '../../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../../components/shared';
import { useApiResource, useFieldErrors } from '../../../hooks';
import { ApiError, type AdminUser, type Role } from '../../../types/api';
import { useSession } from '../../auth';
import * as adminApi from '../api/admin.api';
import s from './UsersSection.module.css';

const KNOWN_FIELDS = ['email', 'password', 'displayName', 'roleId', 'id'] as const;

/**
 * Khối "Tài khoản" của trang Cài đặt — quyền `user:view` để thấy, `user:manage`
 * để sửa, `rbac:manage` để đổi vai trò.
 *
 * Ba mức quyền, ba mức hiển thị, và ĐỀU ẨN HẲN chứ không phải nút xám: một nút
 * bấm vào chắc chắn 403 chỉ làm người dùng nghĩ app hỏng.
 *
 * Ẩn nút KHÔNG phải bảo mật — server chặn bằng `permissionGuard`. Khối này chỉ
 * lo không bày ra thứ không dùng được.
 */
export function UsersSection() {
  const { user: me, hasPermission } = useSession();
  const canManage = hasPermission('user:manage');
  const canAssignRole = hasPermission('rbac:manage');

  const { data: users, error, reload } = useApiResource(adminApi.listUsers, []);
  const { data: roles } = useApiResource(adminApi.listRoles, []);

  const fieldErrors = useFieldErrors(KNOWN_FIELDS);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  /** Mọi thao tác ghi đi qua đây: dọn lỗi cũ, gọi, nạp lại, dịch lỗi một kiểu. */
  const run = useCallback(
    async (id: string, action: () => Promise<unknown>): Promise<boolean> => {
      fieldErrors.reset();
      setGeneralError(null);
      setBusyId(id);
      try {
        await action();
        reload();
        return true;
      } catch (err) {
        if (err instanceof ApiError) {
          fieldErrors.setError(err);
          // 400 đã có lỗi từng ô; 403 và 409 cần một câu chữ ở cấp khối.
          if (err.status !== 400) setGeneralError(err.message);
          else if (err.fields?.length === 0) setGeneralError(err.message);
        } else {
          setGeneralError('Lỗi không xác định.');
        }
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [fieldErrors, reload],
  );

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!users) return <LoadingState label="Đang tải danh sách tài khoản…" />;

  async function handleCreate() {
    setCreating(true);
    const ok = await run('new', () =>
      adminApi.createUser({
        email,
        password,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      }),
    );
    setCreating(false);
    if (ok) {
      setEmail('');
      setDisplayName('');
      setPassword('');
    }
  }

  return (
    <div className={s.section}>
      {generalError ? (
        <p className={s.generalError} role="alert">
          {generalError}
        </p>
      ) : null}

      {users.length === 0 ? (
        <EmptyState message="Chưa có tài khoản nào." />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Tên hiển thị</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                {canManage ? <th aria-label="Thao tác" /> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <UserRow
                  key={account.id}
                  account={account}
                  roles={roles ?? []}
                  isMe={account.id === me?.id}
                  canManage={canManage}
                  canAssignRole={canAssignRole}
                  busy={busyId === account.id}
                  run={run}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <div className={s.createBox}>
          <h4 className={s.createHeading}>Thêm tài khoản</h4>
          {/* Không có ô chọn vai trò: server gán cứng `USER` và từ chối `roleId`
              trong body. Bày một ô ra đây là hứa một thứ API không cho. */}
          <p className={s.hint}>Tài khoản mới luôn mang vai trò Người dùng.</p>
          <div className={s.createRow}>
            <Input
              id="new-user-email"
              label="Email"
              value={email}
              error={fieldErrors.fieldErrors['email']}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="new-user-name"
              label="Tên hiển thị (không bắt buộc)"
              value={displayName}
              error={fieldErrors.fieldErrors['displayName']}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <PasswordInput
              id="new-user-password"
              label="Mật khẩu"
              autoComplete="new-password"
              value={password}
              error={fieldErrors.fieldErrors['password']}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              className={s.createButton}
              onClick={() => void handleCreate()}
              disabled={creating}
            >
              {creating ? 'Đang tạo…' : 'Tạo'}
            </Button>
          </div>
          <p className={s.hint}>Mật khẩu tối thiểu 8 ký tự.</p>
        </div>
      ) : null}
    </div>
  );
}

interface UserRowProps {
  account: AdminUser;
  roles: Role[];
  isMe: boolean;
  canManage: boolean;
  canAssignRole: boolean;
  busy: boolean;
  run: (id: string, action: () => Promise<unknown>) => Promise<boolean>;
}

function UserRow({ account, roles, isMe, canManage, canAssignRole, busy, run }: UserRowProps) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const disabled = account.status === 'disabled';

  return (
    <>
      <tr className={disabled ? s.rowDisabled : undefined}>
        <td>
          {account.email}
          {isMe ? <span className={s.meTag}>bạn</span> : null}
        </td>
        <td>{account.displayName ?? '—'}</td>
        <td>
          {canAssignRole && !isMe ? (
            <Select
              id={`role-${account.id}`}
              label=""
              value={account.role?.id ?? ''}
              disabled={busy}
              onChange={(e) => void run(account.id, () => adminApi.assignRole(account.id, e.target.value))}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          ) : (
            (account.role?.name ?? 'Chưa cấp')
          )}
        </td>
        <td>{disabled ? 'Đã khóa' : 'Hoạt động'}</td>
        {canManage ? (
          <td className={s.actions}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(account.id, () =>
                  adminApi.updateUser(account.id, {
                    status: disabled ? 'active' : 'disabled',
                  }),
                )
              }
            >
              {disabled ? 'Mở khóa' : 'Khóa'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setResetting((v) => !v)}>
              Đổi mật khẩu
            </Button>
            {/* Nút Xóa vắng mặt ở chính mình: server trả 400, bày ra chỉ để
                người dùng bấm rồi nhận lỗi. */}
            {isMe ? null : (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Xóa ${account.email}? Toàn bộ dữ liệu của tài khoản này sẽ mất.`)) return;
                  void run(account.id, () => adminApi.deleteUser(account.id));
                }}
              >
                Xóa
              </Button>
            )}
          </td>
        ) : null}
      </tr>
      {resetting ? (
        <tr>
          <td colSpan={canManage ? 5 : 4}>
            <div className={s.resetRow}>
              <PasswordInput
                id={`reset-${account.id}`}
                label={`Mật khẩu mới cho ${account.email}`}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                disabled={busy}
                onClick={async () => {
                  const ok = await run(account.id, () =>
                    adminApi.resetPassword(account.id, newPassword),
                  );
                  if (ok) {
                    setNewPassword('');
                    setResetting(false);
                  }
                }}
              >
                Lưu mật khẩu
              </Button>
              <span className={s.hint}>Đặt lại mật khẩu sẽ đăng xuất tài khoản đó khỏi mọi thiết bị.</span>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
