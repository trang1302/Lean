// Khối Mục tiêu — 9 ô nhập chia hai nhóm (Điểm xuất phát / Đích đến), nút Lưu
// riêng, hiện `updatedAt` (PLAN.md §3, §10.4: "nghiêng về có" — trả lời câu
// "mục tiêu này đặt từ bao giờ").
//
// Lưu tay bằng nút (PLAN.md §10.3, §0 — kế hoạch giả định lưu tay, tách riêng
// từng nhóm; áp dụng nguyên vẹn cho khối này).
import { useEffect, useRef, useState } from 'react';
import { Button, NumberInput } from '../../../components/ui';
import { ErrorState, FieldError, LoadingState } from '../../../components/shared';
import { ApiError } from '../../../types/api';
import { useApiResource, useFieldErrors } from '../../../hooks';
import { useGoalSettings } from '../hooks/useGoalSettings';
import { fetchCurrentMa7WeightKg, numericInputToPatchValue, textInputToPatchValue } from '../api/settings.api';
import type { GoalPatch } from '../api/settings.types';
import s from './GoalSettingsSection.module.css';

const KNOWN_FIELDS = [
  'startWeightKg',
  'startDate',
  'targetWeightKg',
  'targetWaistCm',
  'targetChestCm',
  'targetShoulderCm',
  'targetArmCm',
  'targetDate',
  'dailyCalorieTarget',
] as const;

type GoalField = (typeof KNOWN_FIELDS)[number];

/** Sáu ô SỐ. Hai ô ngày (`startDate`, `targetDate`) không nằm đây vì
 * `<input type="date">` là loại control khác, render riêng bên dưới. */
const NUMERIC_FIELDS = [
  { field: 'startWeightKg', label: 'Cân nặng lúc bắt đầu (kg)', step: '0.1', group: 'start' },
  { field: 'targetWeightKg', label: 'Cân nặng đích (kg)', step: '0.1', group: 'target' },
  { field: 'targetWaistCm', label: 'Vòng bụng đích (cm)', step: '0.1', group: 'target' },
  { field: 'targetChestCm', label: 'Vòng ngực đích (cm)', step: '0.1', group: 'target' },
  { field: 'targetShoulderCm', label: 'Vòng vai đích (cm)', step: '0.1', group: 'target' },
  { field: 'targetArmCm', label: 'Vòng bắp tay đích (cm)', step: '0.1', group: 'target' },
  { field: 'dailyCalorieTarget', label: 'Calo mục tiêu / ngày', step: '1', group: 'target' },
] as const;

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

  const [inputs, setInputs] = useState<Record<GoalField, string>>(
    () => Object.fromEntries(KNOWN_FIELDS.map((f) => [f, ''])) as Record<GoalField, string>,
  );
  const [initialized, setInitialized] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Đồng bộ ô nhập từ dữ liệu server ĐÚNG MỘT LẦN khi tải xong lần đầu — sau
  // đó `goal` chỉ còn đổi khi CHÍNH form này lưu (giá trị mới đã khớp input),
  // nên không cần đồng bộ lại và không có rủi ro đè bản nháp đang gõ.
  useEffect(() => {
    if (goal && !initialized) {
      setInputs(
        Object.fromEntries(
          KNOWN_FIELDS.map((field) => [field, goal[field] == null ? '' : String(goal[field])]),
        ) as Record<GoalField, string>,
      );
      setInitialized(true);
    }
  }, [goal, initialized]);

  // Nguồn của giá trị điền sẵn. `useApiResource` đã chống race sẵn; lỗi mạng
  // làm `data` là `null` → không điền gì, form vẫn dùng được bình thường.
  const { data: currentMa7 } = useApiResource(fetchCurrentMa7WeightKg, []);
  const prefilledRef = useRef(false);

  /**
   * Điền sẵn ô "Cân nặng lúc bắt đầu" bằng MA7 hôm nay, ĐÚNG MỘT LẦN.
   *
   * Bốn điều kiện, thiếu một là không điền:
   * - chưa từng điền trong phiên này (`prefilledRef`) — nếu không, mỗi lần
   *   `currentMa7` đổi tham chiếu sẽ đè lên thứ người dùng đang gõ;
   * - `goal` đã về (`initialized`) — điền trước đó sẽ bị effect đồng bộ ghi đè;
   * - `goal.startWeightKg` đang là `null` — ĐÃ đặt rồi thì tuyệt đối không đè,
   *   giá trị đã lưu là ý định của người dùng, MA7 chỉ là gợi ý;
   * - có MA7 thật — chưa đủ dữ liệu thì để ô TRỐNG, không bịa số.
   *
   * Đây là BẢN NHÁP trong ô, không phải một lần ghi: không bấm Lưu thì DB
   * không đổi.
   */
  useEffect(() => {
    if (prefilledRef.current) return;
    if (!initialized) return;
    if (goal?.startWeightKg !== null) return;
    if (currentMa7 == null) return;
    prefilledRef.current = true;
    setInputs((prev) =>
      prev.startWeightKg === '' ? { ...prev, startWeightKg: String(currentMa7) } : prev,
    );
  }, [initialized, goal, currentMa7]);

  if (loadError) {
    return <ErrorState error={loadError} onRetry={reload} />;
  }
  if (!goal) {
    return <LoadingState label="Đang tải mục tiêu…" />;
  }

  function setField(field: GoalField, value: string) {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setSavedFlash(false);
  }

  async function handleSave() {
    fieldErrorsApi.reset();
    setGeneralError(null);
    setSavedFlash(false);
    try {
      // Annotate bằng `Required<GoalPatch>` (không phải `GoalPatch`, vốn có
      // mọi khoá optional) — thiếu một dòng dưới đây giờ là lỗi TypeScript
      // thật, không còn chỉ là một câu comment nhắc tự nhớ. Mọi giá trị ở
      // đây là `number | null` hoặc `string | null`, không bao giờ
      // `undefined`, nên kiểu khớp vừa đủ.
      const patch: Required<GoalPatch> = {
        startWeightKg: numericInputToPatchValue(inputs.startWeightKg),
        startDate: textInputToPatchValue(inputs.startDate),
        targetWeightKg: numericInputToPatchValue(inputs.targetWeightKg),
        targetWaistCm: numericInputToPatchValue(inputs.targetWaistCm),
        targetChestCm: numericInputToPatchValue(inputs.targetChestCm),
        targetShoulderCm: numericInputToPatchValue(inputs.targetShoulderCm),
        targetArmCm: numericInputToPatchValue(inputs.targetArmCm),
        targetDate: textInputToPatchValue(inputs.targetDate),
        dailyCalorieTarget: numericInputToPatchValue(inputs.dailyCalorieTarget),
      };
      await save(patch);
      setSavedFlash(true);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      fieldErrorsApi.setError(apiErr);
      if (!apiErr?.fields || apiErr.fields.length === 0) {
        setGeneralError(apiErr?.status === 0 ? apiErr.message : 'Lưu thất bại. Vui lòng thử lại.');
      }
    }
  }

  function renderDateField(field: 'startDate' | 'targetDate', label: string) {
    const id = `goal-${field}`;
    return (
      <div className={s.field} key={field}>
        <label htmlFor={id} className={s.label}>
          {label}
        </label>
        <input
          id={id}
          type="date"
          className={s.dateInput}
          value={inputs[field]}
          aria-invalid={fieldErrorsApi.fieldErrors[field] ? true : undefined}
          onChange={(e) => setField(field, e.target.value)}
        />
        {fieldErrorsApi.fieldErrors[field] ? (
          <FieldError id={id} message={fieldErrorsApi.fieldErrors[field]} />
        ) : null}
      </div>
    );
  }

  function renderNumericField(spec: (typeof NUMERIC_FIELDS)[number]) {
    return (
      <NumberInput
        key={spec.field}
        id={spec.field}
        label={spec.label}
        step={spec.step}
        value={inputs[spec.field]}
        error={fieldErrorsApi.fieldErrors[spec.field]}
        onChange={(e) => setField(spec.field, e.target.value)}
      />
    );
  }

  return (
    <div className={s.section}>
      {/* Chín ô phẳng trên một lưới thì không đọc được. Hai nhóm trả lời hai
          câu khác nhau: "tôi bắt đầu từ đâu" và "tôi muốn tới đâu". */}
      <h3 className={s.groupHeading}>Điểm xuất phát</h3>
      <div className={s.grid}>
        {NUMERIC_FIELDS.filter((f) => f.group === 'start').map(renderNumericField)}
        {renderDateField('startDate', 'Ngày bắt đầu')}
      </div>

      <h3 className={s.groupHeading}>Đích đến</h3>
      <div className={s.grid}>
        {NUMERIC_FIELDS.filter((f) => f.group === 'target').map(renderNumericField)}
        {renderDateField('targetDate', 'Ngày đích')}
      </div>

      {fieldErrorsApi.formErrors.length > 0 ? (
        <p className={s.generalError} role="alert">
          {fieldErrorsApi.summary} {fieldErrorsApi.formErrors.map((f) => f.message).join(' ')}
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
          {goal.updatedAt
            ? `Cập nhật lần cuối ${formatUpdatedAt(goal.updatedAt)}`
            : 'Chưa từng đặt mục tiêu'}
        </span>
      </div>
    </div>
  );
}
