// Khung trang Cài đặt — tiêu đề + hai khối (Mục tiêu, Nhắc nhở). Trang này
// gọi hai nhóm endpoint chính (`/goal`, `/reminders`); `GoalSettingsSection`
// còn gọi `GET /api/summary` riêng để điền sẵn một ô (SPEC §2). Vẫn cấm
// TUYỆT ĐỐI hiển thị tiến độ mục tiêu (`remainingKg`/`onTrack`/`currentRate`)
// ở trang này — đó là việc của trang Biểu đồ, nhân công thức đó sang đây là
// nhân bản logic. Đọc một giá trị để điền sẵn ô nhập KHÔNG phải nhân bản
// công thức — xem SPEC §2 để phân biệt hai việc này.
import { Card } from '../../../components/ui';
import { PermissionsSection, UsersSection } from '../../admin';
import { useSession } from '../../auth';
import { GoalSettingsSection } from './GoalSettingsSection';
import { ReminderSettingsSection } from './ReminderSettingsSection';
import s from './SettingsPage.module.css';

export function SettingsPage() {
  const { hasPermission } = useSession();

  return (
    <div className={s.page}>
      <h1 className={s.heading}>Cài đặt</h1>

      <Card heading="Mục tiêu">
        <GoalSettingsSection />
      </Card>

      <Card heading="Nhắc nhở">
        <ReminderSettingsSection />
      </Card>

      {/* Hai khối quản trị: ẨN HẲN khi thiếu quyền, không render dạng xám.
          Gate bằng MÃ QUYỀN, không bằng `user.role.code` — sửa ma trận ở màn
          Phân quyền phải có hiệu lực ngay ở đây mà không phải sửa code.
          Và đây không phải bảo mật: server chặn bằng `permissionGuard`. */}
      {hasPermission('user:view') ? (
        <Card heading="Tài khoản">
          <UsersSection />
        </Card>
      ) : null}

      {hasPermission('rbac:view') ? (
        <Card heading="Phân quyền">
          <PermissionsSection />
        </Card>
      ) : null}
    </div>
  );
}
