// Một thẻ nhắc nhở (`weigh_in` hoặc `meal_log`) — công tắc, giờ, topic, nút
// Lưu riêng, và cảnh báo thiếu topic BẮT BUỘC (SPEC §6, điều phối viên B2 #2).
//
// Nút "Gửi thử" CỐ Ý KHÔNG render ở đây — SPEC §7 mô tả nút này nhưng backend
// chưa có `POST /api/reminders/:kind/test` (bốn điểm hợp đồng chưa chốt,
// xem PLAN.md §2.3 và §8, brief điều phối viên B3). Quyết định của điều phối
// viên: không render gì cả, không render disabled — một nút xám không giải
// thích được chỉ tạo nghi ngờ về chất lượng app. Gắn lại khi backend có route
// (chỗ gắn: ngay dưới `.actions` bên dưới, cạnh nút Lưu).
import { useEffect, useState } from 'react';
import { Button, Input, Switch } from '../../../components/ui';
import { FieldError } from '../../../components/shared';
import { ApiError } from '../../../types/api';
import { useFieldErrors } from '../../../hooks';
import { textInputToPatchValue } from '../api/settings.api';
import type { ReminderView } from '../api/settings.types';
import s from './ReminderCard.module.css';

const KNOWN_FIELDS = ['timeOfDay', 'enabled', 'ntfyTopic'] as const;

interface ReminderCardProps {
  reminder: ReminderView;
  label: string;
  isSaving: boolean;
  saveError: ApiError | undefined;
  onSave: (patch: { timeOfDay?: string; enabled?: boolean; ntfyTopic?: string | null }) => Promise<ReminderView>;
}

export function ReminderCard({ reminder, label, isSaving, saveError, onSave }: ReminderCardProps) {
  const fieldErrorsApi = useFieldErrors(KNOWN_FIELDS);

  const [enabled, setEnabled] = useState(reminder.enabled);
  const [timeOfDay, setTimeOfDay] = useState(reminder.timeOfDay);
  const [topicInput, setTopicInput] = useState(reminder.ntfyTopic ?? '');
  const [savedFlash, setSavedFlash] = useState(false);

  // Đồng bộ lại khi `reminder` đổi — CHỈ xảy ra khi tải lần đầu hoặc khi
  // CHÍNH thẻ này vừa lưu xong (hook chỉ thay phần tử của đúng `kind` này,
  // xem useReminderSettings.ts) — không đụng tới bản nháp của thẻ kia.
  useEffect(() => {
    setEnabled(reminder.enabled);
    setTimeOfDay(reminder.timeOfDay);
    setTopicInput(reminder.ntfyTopic ?? '');
  }, [reminder]);

  // Điều BẮT BUỘC #2 (SPEC §6, điều phối viên B2): tính trên state ĐANG HIỂN
  // THỊ (bản nháp `enabled`/`topicInput`), không phải dữ liệu đã lưu — phải
  // hiện NGAY khi gạt công tắc, trước khi bấm Lưu.
  const showMissingTopicWarning = enabled && topicInput.trim() === '';

  async function handleSave() {
    fieldErrorsApi.reset();
    setSavedFlash(false);
    try {
      await onSave({
        timeOfDay,
        enabled,
        ntfyTopic: textInputToPatchValue(topicInput),
      });
      setSavedFlash(true);
    } catch (err) {
      fieldErrorsApi.setError(err instanceof ApiError ? err : null);
    }
  }

  return (
    <div className={s.card}>
      <h3 className={s.heading}>{label}</h3>

      <Switch
        id={`reminder-${reminder.kind}-enabled`}
        label="Bật nhắc nhở"
        checked={enabled}
        onChange={(e) => {
          setEnabled(e.target.checked);
          setSavedFlash(false);
        }}
      />

      <div className={s.field}>
        <label htmlFor={`reminder-${reminder.kind}-time`} className={s.label}>
          Giờ nhắc
        </label>
        <input
          id={`reminder-${reminder.kind}-time`}
          type="time"
          // BẮT BUỘC step >= 60 — dưới mức đó trình duyệt trả "HH:mm:ss",
          // server 400 vì timeOfDay chỉ khớp "HH:mm" (SPEC §8.4).
          step={60}
          className={s.timeInput}
          value={timeOfDay}
          aria-invalid={fieldErrorsApi.fieldErrors['timeOfDay'] ? true : undefined}
          onChange={(e) => {
            setTimeOfDay(e.target.value);
            setSavedFlash(false);
          }}
        />
        {fieldErrorsApi.fieldErrors['timeOfDay'] ? (
          <FieldError id={`reminder-${reminder.kind}-time`} message={fieldErrorsApi.fieldErrors['timeOfDay']} />
        ) : null}
      </div>

      <Input
        id={`reminder-${reminder.kind}-topic`}
        label="ntfy topic"
        placeholder="vd. lean-7f3ka92x"
        value={topicInput}
        error={fieldErrorsApi.fieldErrors['ntfyTopic']}
        onChange={(e) => {
          setTopicInput(e.target.value);
          setSavedFlash(false);
        }}
      />
      <p className={s.hint}>
        Chữ, số, <code>-</code>, <code>_</code>; tối đa 64 ký tự. Không được có khoảng trắng
        ở giữa.
      </p>

      {showMissingTopicWarning ? (
        <p className={s.missingTopicWarning}>
          Đã bật nhưng chưa có topic — sẽ không có thông báo nào được gửi. Nhập topic ntfy để
          nhắc nhở hoạt động.
        </p>
      ) : null}

      {fieldErrorsApi.formErrors.length > 0 ? (
        <p className={s.generalError} role="alert">
          {fieldErrorsApi.summary} {fieldErrorsApi.formErrors.map((f) => f.message).join(' ')}
        </p>
      ) : null}
      {saveError && !fieldErrorsApi.errorCount ? (
        <p className={s.generalError} role="alert">
          {saveError.status === 0 ? saveError.message : 'Lưu thất bại. Vui lòng thử lại.'}
        </p>
      ) : null}

      <div className={s.actions}>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Đang lưu…' : 'Lưu'}
        </Button>
        {savedFlash ? <span className={s.savedFlash}>Đã lưu.</span> : null}
      </div>
    </div>
  );
}
