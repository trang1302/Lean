import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui';
import { ErrorState, LoadingState } from '../../../components/shared';
import { useApiResource } from '../../../hooks';
import { ApiError, type Permission, type Role } from '../../../types/api';
import { useSession } from '../../auth';
import * as adminApi from '../api/admin.api';
import s from './PermissionsSection.module.css';

/**
 * Ma trận Role × Permission — ĐÂY là cơ chế "ẩn chức năng khỏi vai trò".
 *
 * Chỉ đọc với `rbac:view`, sửa được với `rbac:manage`.
 *
 * CỐ TÌNH KHÔNG có nút tạo/xóa vai trò và tạo quyền: danh mục là ĐÓNG, sửa
 * bằng seed + review code. Một UI tạo vai trò là một UI để vô tình tạo ra một
 * vai trò có `rbac:manage`.
 */
export function PermissionsSection() {
  const { hasPermission } = useSession();
  const canManage = hasPermission('rbac:manage');

  const { data: permissions, error: permError, reload: reloadPerms } = useApiResource(
    adminApi.listPermissions,
    [],
  );
  const { data: roles, error: roleError, reload: reloadRoles } = useApiResource(
    adminApi.listRoles,
    [],
  );

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [codes, setCodes] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Vai trò đầu tiên được chọn sẵn — màn hình trống với một dropdown chưa chọn
  // gì là một màn hình không nói được điều gì.
  const activeRoleId = selectedRoleId ?? roles?.[0]?.id ?? null;

  useEffect(() => {
    if (!activeRoleId) return;
    let cancelled = false;
    setCodes(null);
    setGeneralError(null);
    void adminApi
      .getRolePermissions(activeRoleId)
      .then((res) => {
        if (!cancelled) setCodes(new Set(res.codes));
      })
      .catch(() => {
        if (!cancelled) setGeneralError('Không tải được tập quyền của vai trò này.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeRoleId]);

  /** Nhóm theo `resource` — đó là lý do `Permission` mang sẵn hai cột tách rời. */
  const groups = useMemo(() => {
    const byResource = new Map<string, Permission[]>();
    for (const permission of permissions ?? []) {
      const list = byResource.get(permission.resource) ?? [];
      list.push(permission);
      byResource.set(permission.resource, list);
    }
    return [...byResource.entries()];
  }, [permissions]);

  if (permError) return <ErrorState error={permError} onRetry={reloadPerms} />;
  if (roleError) return <ErrorState error={roleError} onRetry={reloadRoles} />;
  if (!permissions || !roles) return <LoadingState label="Đang tải phân quyền…" />;

  const activeRole = roles.find((role) => role.id === activeRoleId) ?? null;

  function toggle(code: string) {
    setCodes((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setSavedFlash(false);
  }

  async function handleSave() {
    if (!activeRoleId || !codes) return;
    setSaving(true);
    setGeneralError(null);
    setSavedFlash(false);
    try {
      // Gửi ĐỦ danh sách muốn giữ: API thay thế, không cộng dồn.
      const res = await adminApi.setRolePermissions(activeRoleId, [...codes]);
      setCodes(new Set(res.codes));
      setSavedFlash(true);
    } catch (err) {
      setGeneralError(
        err instanceof ApiError
          ? (err.fields?.[0]?.message ?? err.message)
          : 'Lưu thất bại. Vui lòng thử lại.',
      );
      // Nạp lại sự thật từ server: sau một lần lưu hỏng, thứ đang tick trên màn
      // hình không còn khớp DB, và để nguyên là nói dối người dùng.
      if (activeRoleId) {
        const current = await adminApi.getRolePermissions(activeRoleId).catch(() => null);
        if (current) setCodes(new Set(current.codes));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.section}>
      <div className={s.roleTabs} role="group" aria-label="Chọn vai trò">
        {roles.map((role) => (
          <Button
            key={role.id}
            variant={role.id === activeRoleId ? 'primary' : 'secondary'}
            aria-pressed={role.id === activeRoleId}
            onClick={() => {
              setSelectedRoleId(role.id);
              setSavedFlash(false);
            }}
          >
            {role.name} ({role.userCount})
          </Button>
        ))}
      </div>

      {activeRole?.description ? <p className={s.hint}>{activeRole.description}</p> : null}

      {generalError ? (
        <p className={s.generalError} role="alert">
          {generalError}
        </p>
      ) : null}

      {!codes ? (
        <LoadingState label="Đang tải tập quyền…" />
      ) : (
        <>
          <div className={s.grid}>
            {groups.map(([resource, items]) => (
              <fieldset key={resource} className={s.group}>
                <legend className={s.groupLegend}>{resource}</legend>
                {items.map((permission) => (
                  <label key={permission.id} className={s.checkRow} htmlFor={`perm-${permission.id}`}>
                    <input
                      id={`perm-${permission.id}`}
                      type="checkbox"
                      checked={codes.has(permission.code)}
                      disabled={!canManage}
                      onChange={() => toggle(permission.code)}
                    />
                    <span className={s.permName}>{permission.name}</span>
                    <code className={s.permCode}>{permission.code}</code>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>

          {canManage ? (
            <div className={s.actions}>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu phân quyền'}
              </Button>
              {savedFlash ? <span className={s.savedFlash}>Đã lưu.</span> : null}
              <span className={s.hint}>
                Thay đổi có hiệu lực ngay với người đang đăng nhập, không cần họ đăng nhập lại.
              </span>
            </div>
          ) : (
            <p className={s.hint}>Bạn chỉ có quyền xem phân quyền.</p>
          )}
        </>
      )}
    </div>
  );
}
