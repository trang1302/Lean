import type { InputHTMLAttributes } from 'react';
import s from './Switch.module.css';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
}

/**
 * Công tắc bật/tắt — dùng cho bật/tắt nhắc nhở ở trang Cài đặt
 * (docs/features/reminders/SPEC.md). Là `<input type="checkbox"
 * role="switch">` được style lại bằng CSS, KHÔNG phải một widget tự vẽ từ
 * `<div>` — giữ được toàn bộ hành vi bàn phím/focus/`checked` native của
 * checkbox (Space để bật/tắt, Tab để focus) mà không cần code JS quản lý
 * state riêng. `checked`/`onChange` do trang gọi truyền vào (controlled),
 * giống mọi input khác — component này không giữ state nội bộ.
 */
export function Switch({ id, label, className, ...rest }: SwitchProps) {
  return (
    <label htmlFor={id} className={[s.switch, className].filter(Boolean).join(' ')}>
      <input id={id} type="checkbox" role="switch" className={s.input} {...rest} />
      <span className={s.track} aria-hidden="true" />
      <span className={s.label}>{label}</span>
    </label>
  );
}
