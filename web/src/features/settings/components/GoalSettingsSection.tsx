// Khối Mục tiêu — 3 ô nhập, nút Lưu riêng, hiện `updatedAt` (PLAN.md §3, §10.4:
// "nghiêng về có" — trả lời câu "mục tiêu này đặt từ bao giờ").
//
// Lưu tay bằng nút (PLAN.md §10.3, §0 — kế hoạch giả định lưu tay, tách riêng
// từng nhóm; áp dụng nguyên vẹn cho khối này).
import { useEffect, useState } from 'react';
import { Button, NumberInput } from '../../../components/ui';
import { ErrorState, FieldError, LoadingState } from '../../../components/shared';
import { ApiError } from '../../../types/api';
import { useFieldErrors } from '../../../hooks';
import { useGoalSettings } from '../hooks/useGoalSettings';
import { numericInputToPatchValue, textInputToPatchValue } from '../api/settings.api';
import s from './GoalSettingsSection.module.css';

const KNOWN_FIELDS = ['targetWeightKg', 'targetDate', 'dailyCalorieTarget'] as const;

/** "2026-08-07T10:22:31.000Z" → "07/08/2026 17:22" theo Asia/Ho_Chi_Minh.
 * Cục bộ trong file này — `lib/format.ts` (dùng chung) chưa có hàm định
 * dạng ngày-giờ đầy đủ, và feature này không được tự thêm vào `lib/`
 * (ranh giới B4 của điều phối viên) nên viết một hàm nhỏ tại chỗ dùng. */
function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function GoalSettingsSection() {
  const { goal, isLoading, loadError, reload, isSaving, save } = useGoalSettings();
  const fieldErrorsApi = useFieldErrors(KNOWN_FIELDS);

  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [calorieInput, setCalorieInput] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Đồng bộ ô nhập từ dữ liệu server ĐÚNG MỘT LẦN khi tải xong lần đầu — sau
  // đó `goal` chỉ còn đổi khi CHÍNH form này lưu (giá trị mới đã khớp input),
  // nên không cần đồng bộ lại và không có rủi ro đè bản nháp đang gõ.
  useEffect(() => {
    if (goal && !initialized) {
      setWeightInput(goal.targetWeightKg === null ? '' : String(goal.targetWeightKg));
      setDateInput(goal.targetDate ?? '');
      setCalorieInput(goal.dailyCalorieTarget === null ? '' : String(goal.dailyCalorieTarget));
      setInitialized(true);
    }
  }, [goal, initialized]);

  if (loadError) {
    return <ErrorState error={loadError} onRetry={reload} />;
  }
  if (!goal) {
    return <LoadingState label="Đang tải mục tiêu…" />;
  }

  async function handleSave() {
    fieldErrorsApi.reset();
    setGeneralError(null);
    setSavedFlash(false);
    try {
      await save({
        targetWeightKg: numericInputToPatchValue(weightInput),
        targetDate: textInputToPatchValue(dateInput),
        dailyCalorieTarget: numericInputToPatchValue(calorieInput),
      });
      setSavedFlash(true);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      fieldErrorsApi.setError(apiErr);
      if (!apiErr?.fields || apiErr.fields.length === 0) {
        setGeneralError(
          apiErr?.status === 0 ? apiErr.message : 'Lưu thất bại. Vui lòng thử lại.',
        );
      }
    }
  }

  function onFieldChange() {
    setSavedFlash(false);
  }

  return (
    <div className={s.section}>
      <div className={s.grid}>
        <NumberInput
          id="goal-target-weight"
          label="Cân nặng đích (kg)"
          step="0.1"
          value={weightInput}
          error={fieldErrorsApi.fieldErrors['targetWeightKg']}
          onChange={(e) => {
            setWeightInput(e.target.value);
            onFieldChange();
          }}
        />
        <div className={s.field}>
          <label htmlFor="goal-target-date" className={s.label}>
            Ngày đích
          </label>
          <input
            id="goal-target-date"
            type="date"
            className={s.dateInput}
            value={dateInput}
            aria-invalid={fieldErrorsApi.fieldErrors['targetDate'] ? true : undefined}
            onChange={(e) => {
              setDateInput(e.target.value);
              onFieldChange();
            }}
          />
          {fieldErrorsApi.fieldErrors['targetDate'] ? (
            <FieldError id="goal-target-date" message={fieldErrorsApi.fieldErrors['targetDate']} />
          ) : null}
        </div>
        <NumberInput
          id="goal-daily-calorie-target"
          label="Calo mục tiêu / ngày"
          step="1"
          value={calorieInput}
          error={fieldErrorsApi.fieldErrors['dailyCalorieTarget']}
          onChange={(e) => {
            setCalorieInput(e.target.value);
            onFieldChange();
          }}
        />
      </div>

      {fieldErrorsApi.formErrors.length > 0 ? (
        <p className={s.generalError} role="alert">
          {fieldErrorsApi.summary}{' '}
          {fieldErrorsApi.formErrors.map((f) => f.message).join(' ')}
        </p>
      ) : null}
      {generalError ? (
        <p className={s.generalError} role="alert">
          {generalError}
        </p>
      ) : null}

      <div className={s.actions}>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Đang lưu…' : 'Lưu mục tiêu'}
        </Button>
        {savedFlash ? <span className={s.savedFlash}>Đã lưu.</span> : null}
        <span className={s.updatedAt}>
          {goal.updatedAt ? `Cập nhật lần cuối ${formatUpdatedAt(goal.updatedAt)}` : 'Chưa từng đặt mục tiêu'}
        </span>
      </div>
    </div>
  );
}
