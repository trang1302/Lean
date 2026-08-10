// Khung trang Cài đặt — tiêu đề + hai khối (Mục tiêu, Nhắc nhở). Trang này
// gọi đúng hai nhóm endpoint (`/goal`, `/reminders`) và KHÔNG gọi
// `GET /api/summary` (SPEC §2 — tiến độ mục tiêu là việc của trang Biểu đồ,
// nhân công thức đó sang đây là nhân bản logic).
import { Card } from '../../../components/ui';
import { GoalSettingsSection } from './GoalSettingsSection';
import { ReminderSettingsSection } from './ReminderSettingsSection';
import s from './SettingsPage.module.css';

export function SettingsPage() {
  return (
    <div className={s.page}>
      <h1 className={s.heading}>Cài đặt</h1>

      <Card heading="Mục tiêu">
        <GoalSettingsSection />
      </Card>

      <Card heading="Nhắc nhở">
        <ReminderSettingsSection />
      </Card>
    </div>
  );
}
