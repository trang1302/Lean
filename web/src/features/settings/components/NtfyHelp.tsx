// Hướng dẫn ntfy — docs/features/web-settings/SPEC.md §9. Không có mục này
// thì ô "topic" là một ô trống vô nghĩa. Dạng nội dung thu gọn được (khác
// SchedulerLimitationNotice §5, PHẢI luôn hiện) — dùng <details> gốc, không
// cần state/JS riêng.
import s from './NtfyHelp.module.css';

export function NtfyHelp() {
  return (
    <details className={s.help}>
      <summary className={s.summary}>ntfy là gì? Cách nhận thông báo trên điện thoại</summary>
      <div className={s.body}>
        <p>
          <strong>ntfy</strong> là dịch vụ gửi thông báo đẩy miễn phí. Server Lean gửi một
          tin HTTP tới <code>https://ntfy.sh/&lt;topic&gt;</code>; điện thoại nào đang đăng
          ký đúng topic đó thì nhận được thông báo. Không cần tài khoản, không cần đăng nhập.
        </p>
        <p>
          <strong>Topic</strong> là một chuỗi tự đặt, đóng vai trò địa chỉ.{' '}
          <strong>Bất kỳ ai biết chuỗi đó cũng đọc được thông báo của bạn</strong> — nên đặt
          chuỗi dài và khó đoán (ví dụ <code>lean-7f3ka92x</code>, không nên chỉ đặt{' '}
          <code>lean</code>).
        </p>
        <p>Cách đăng ký trên điện thoại:</p>
        <ol>
          <li>
            Cài app <strong>ntfy</strong> (App Store / Google Play / F-Droid).
          </li>
          <li>
            Bấm <strong>+</strong>, nhập đúng chuỗi topic đã điền ở đây, rồi bấm{' '}
            <strong>Subscribe</strong>.
          </li>
          <li>
            Cũng xem được trên web tại <code>https://ntfy.sh/&lt;topic&gt;</code>.
          </li>
        </ol>
        <p>Ký tự cho phép trong topic: chữ, số, <code>-</code>, <code>_</code>; tối đa 64 ký tự.</p>
      </div>
    </details>
  );
}
