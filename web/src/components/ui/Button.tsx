import type { ButtonHTMLAttributes } from 'react';
import s from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// `noUncheckedIndexedAccess` (tsconfig.json) làm mọi truy cập vào object
// CSS Module (index signature) ra `string | undefined`, kể cả khi tên class
// chắc chắn tồn tại trong file .module.css — `?? ''` là cách tôn trọng cờ
// đó thay vì `!` non-null assertion (SPEC §3.3 giải thích lý do bật cờ).
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: s.primary ?? '',
  secondary: s.secondary ?? '',
  danger: s.danger ?? '',
};

/**
 * Bọc mỏng <button> — chỉ thêm style qua CSS Module và một biến thể màu.
 * Focus/disabled/`type`… là hành vi native của <button>, component chung
 * không giả lập lại (nếu thấy mình viết `onKeyDown` để bắt Enter/Space ở
 * đây là dấu hiệu đang đi lạc — native button đã làm việc đó).
 */
export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return (
    <button
      // `type="button"` mặc định — nút trong `web/` phần lớn dùng để gọi
      // hành động (Thử lại, Lưu qua onClick xử lý riêng), không phải submit
      // form nguyên thủy của trình duyệt. Trang nào thật sự cần submit form
      // có thể ghi đè bằng cách truyền `type="submit"` qua `...rest`.
      type="button"
      className={[s.button, VARIANT_CLASS[variant], className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}
