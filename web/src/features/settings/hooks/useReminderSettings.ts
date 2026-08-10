// State + load/save cho nhóm Nhắc nhở. Giữ mảng 2 phần tử theo `kind`
// (SPEC §4). Lưu một `kind` chỉ thay đúng phần tử đó trong mảng cục bộ —
// KHÔNG gọi lại GET toàn bộ — để không xóa mất bản nháp CHƯA lưu của thẻ
// còn lại (hai thẻ độc lập, mỗi thẻ có nút Lưu riêng, PLAN.md §3).

import { useCallback, useEffect, useState } from 'react';
import { useApiResource } from '../../../hooks';
import { ApiError } from '../../../types/api';
import { fetchReminders, updateReminder } from '../api/settings.api';
import type { ReminderKind, ReminderView, UpdateReminderInput } from '../api/settings.types';

export interface UseReminderSettingsResult {
  /** `null` chỉ trước lần nạp đầu tiên. Sau đó luôn là mảng đủ 2 phần tử
   * (SPEC §4 — DB rỗng vẫn trả đủ, không có trạng thái "chưa cấu hình"). */
  reminders: ReminderView[] | null;
  isLoading: boolean;
  loadError: ApiError | null;
  reload: () => void;
  /** `kind` đang lưu, `null` khi không có thẻ nào đang lưu. Dùng để disable
   * đúng nút Lưu của đúng thẻ, không disable cả hai thẻ cùng lúc. */
  savingKind: ReminderKind | null;
  /** Lỗi lưu theo từng `kind` — mỗi thẻ chỉ đọc đúng lỗi của `kind` mình. */
  saveErrors: Partial<Record<ReminderKind, ApiError>>;
  save: (kind: ReminderKind, patch: UpdateReminderInput) => Promise<ReminderView>;
}

export function useReminderSettings(): UseReminderSettingsResult {
  const { data, isLoading, error: loadError, reload } = useApiResource(fetchReminders, []);

  const [reminders, setReminders] = useState<ReminderView[] | null>(null);
  useEffect(() => {
    if (data) setReminders(data);
  }, [data]);

  const [savingKind, setSavingKind] = useState<ReminderKind | null>(null);
  const [saveErrors, setSaveErrors] = useState<Partial<Record<ReminderKind, ApiError>>>({});

  const save = useCallback(
    async (kind: ReminderKind, patch: UpdateReminderInput): Promise<ReminderView> => {
      setSavingKind(kind);
      setSaveErrors((prev) => {
        const next = { ...prev };
        delete next[kind];
        return next;
      });
      try {
        const updated = await updateReminder(kind, patch);
        setReminders((prev) => (prev ? prev.map((r) => (r.kind === kind ? updated : r)) : prev));
        return updated;
      } catch (err) {
        const apiErr =
          err instanceof ApiError ? err : new ApiError(0, 'NETWORK_ERROR', 'Lỗi không xác định');
        setSaveErrors((prev) => ({ ...prev, [kind]: apiErr }));
        throw apiErr;
      } finally {
        setSavingKind(null);
      }
    },
    [],
  );

  return { reminders, isLoading, loadError, reload, savingKind, saveErrors, save };
}
