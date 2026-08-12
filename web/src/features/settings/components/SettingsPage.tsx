// Khung trang Cài đặt — tiêu đề + hai khối (Mục tiêu, Nhắc nhở). Trang này
// gọi hai nhóm endpoint chính (`/goal`, `/reminders`); `GoalSettingsSection`
// còn gọi `GET /api/summary` riêng để điền sẵn một ô (SPEC §2). Vẫn cấm
// TUYỆT ĐỐI hiển thị tiến độ mục tiêu (`remainingKg`/`onTrack`/`currentRate`)
// ở trang này — đó là việc của trang Biểu đồ, nhân công thức đó sang đây là
// nhân bản logic. Đọc một giá trị để điền sẵn ô nhập KHÔNG phải nhân bản
// công thức — xem SPEC §2 để phân biệt hai việc này.
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
