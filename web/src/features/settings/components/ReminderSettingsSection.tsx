// Khối Nhắc nhở — lặp 2 `kind` cố định từ `GET /api/reminders`, mỗi cái một
// `ReminderCard`. Cảnh báo scheduler BẮT BUỘC (SPEC §5) đặt ngay trong khối
// này, LUÔN hiện phía trên hai thẻ. Hướng dẫn ntfy (SPEC §9) đặt phía dưới.
import { ErrorState, LoadingState } from '../../../components/shared';
import { useReminderSettings } from '../hooks/useReminderSettings';
import type { ReminderKind } from '../api/settings.types';
import { NtfyHelp } from './NtfyHelp';
import { ReminderCard } from './ReminderCard';
import { SchedulerLimitationNotice } from './SchedulerLimitationNotice';
import s from './ReminderSettingsSection.module.css';

// Nhãn tiếng Việt cho từng `kind` — cục bộ trong feature này, không thuộc
// `constants/` dùng chung (chỉ hai giá trị, không tái sử dụng ở đâu khác).
const KIND_LABELS: Record<ReminderKind, string> = {
  weigh_in: 'Nhắc cân nặng',
  meal_log: 'Nhắc ghi bữa ăn',
};

export function ReminderSettingsSection() {
  const { reminders, isLoading, loadError, reload, savingKind, saveErrors, save } = useReminderSettings();

  return (
    <div className={s.section}>
      <SchedulerLimitationNotice />

      {loadError ? (
        <ErrorState error={loadError} onRetry={reload} />
      ) : !reminders ? (
        <LoadingState label="Đang tải nhắc nhở…" />
      ) : (
        <div className={s.cards}>
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.kind}
              reminder={reminder}
              label={KIND_LABELS[reminder.kind]}
              isSaving={savingKind === reminder.kind}
              saveError={saveErrors[reminder.kind]}
              onSave={(patch) => save(reminder.kind, patch)}
            />
          ))}
        </div>
      )}

      <NtfyHelp />
    </div>
  );
}
