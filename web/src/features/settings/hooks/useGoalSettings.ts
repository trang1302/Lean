// State + load/save cho nhóm Mục tiêu. Không biết `fetch` — chỉ gọi
// `settings.api.ts`. Đọc dùng lại `useApiResource` (chống race có sẵn ở
// `src/hooks/`, điều phối viên B1: "DÙNG LẠI, đừng viết trùng"); ghi tự quản
// bằng `useState` vì `useApiResource` không expose setter cho ghi lạc quan.

import { useCallback, useEffect, useState } from 'react';
import { useApiResource } from '../../../hooks';
import { ApiError } from '../../../types/api';
import { fetchGoal, updateGoal } from '../api/settings.api';
import type { GoalPatch, GoalResponse } from '../api/settings.types';

export interface UseGoalSettingsResult {
  /** `null` chỉ trong khoảnh khắc trước lần nạp đầu tiên thành công — SAU
   * đó KHÔNG BAO GIỜ null, vì `GET /goal` luôn trả 200 (SPEC §3, không có
   * nhánh 404 để xử). */
  goal: GoalResponse | null;
  isLoading: boolean;
  loadError: ApiError | null;
  reload: () => void;
  isSaving: boolean;
  saveError: ApiError | null;
  /** Lưu patch, trả về `GoalResponse` mới nếu thành công (ném `ApiError` nếu
   * hỏng — caller (component) tự quyết định làm gì tiếp, hook không nuốt lỗi). */
  save: (patch: GoalPatch) => Promise<GoalResponse>;
}

export function useGoalSettings(): UseGoalSettingsResult {
  const { data, isLoading, error: loadError, reload } = useApiResource(fetchGoal, []);

  // Bản sao cục bộ để có thể cập nhật "lạc quan" ngay từ response của PUT,
  // không cần gọi lại GET sau mỗi lần lưu (tránh một round-trip thừa và
  // tránh nhấp nháy màn hình).
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  useEffect(() => {
    if (data) setGoal(data);
  }, [data]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  const save = useCallback(async (patch: GoalPatch): Promise<GoalResponse> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateGoal(patch);
      setGoal(updated);
      return updated;
    } catch (err) {
      const apiErr =
        err instanceof ApiError ? err : new ApiError(0, 'NETWORK_ERROR', 'Lỗi không xác định');
      setSaveError(apiErr);
      throw apiErr;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { goal, isLoading, loadError, reload, isSaving, saveError, save };
}
