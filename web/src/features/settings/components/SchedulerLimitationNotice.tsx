// Cảnh báo BẮT BUỘC — "chỉ chạy khi server bật, không gửi bù"
// (docs/features/web-settings/SPEC.md §5, CLAUDE.md mục "Cạm bẫy đã biết").
// Tách file riêng có chủ đích (PLAN.md §3): để không ai xóa nhầm khi dọn
// layout. LUÔN hiển thị — không phải tooltip, không phải accordion đóng sẵn,
// không phải chỉ hiện khi có lỗi. Khác NtfyHelp (thu gọn được) ở đúng điểm này.
import s from './SchedulerLimitationNotice.module.css';

export function SchedulerLimitationNotice() {
  return (
    <div className={s.notice}>
      <p className={s.text}>
        <strong>Nhắc nhở chỉ hoạt động khi server đang chạy.</strong> Máy tắt hoặc server
        dừng vào đúng giờ nhắc thì lượt nhắc đó mất — hệ thống không gửi bù khi chạy lại.
      </p>
    </div>
  );
}
