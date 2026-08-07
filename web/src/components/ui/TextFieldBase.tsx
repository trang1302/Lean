import type { InputHTMLAttributes } from 'react';
import { FieldError } from '../shared/FieldError';
import s from './TextFieldBase.module.css';

export interface TextFieldBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  /** Thông báo lỗi field-level (đã dịch từ `fields[]` của server ở tầng
   * gọi, xem `useFieldErrors` — Bước 6). Chuỗi rỗng/`undefined` = không lỗi. */
  error?: string;
}

/**
 * Khối dùng lại giữa `Input` và `NumberInput` — hai component đó CHỈ khác
 * nhau ở `type` ("text" vs "number"), mọi hành vi khác (label gắn `id`,
 * `aria-invalid`, `aria-describedby` trỏ vào `FieldError`) giống hệt nhau.
 * Không export khỏi `components/ui` — đây là chi tiết cài đặt dùng chung,
 * không phải một control thứ ba mà brief yêu cầu.
 */
export function TextFieldBase({ id, label, error, className, ...rest }: TextFieldBaseProps) {
  const errorId = `${id}-error`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <input
        id={id}
        className={[s.input, className].filter(Boolean).join(' ')}
        // `undefined` khi không lỗi (không render thuộc tính) thay vì
        // `aria-invalid="false"` — cả hai đều hợp lệ về ARIA, chọn cách
        // ngắn hơn. Khi có lỗi PHẢI ra đúng chuỗi "true" (deliverable Bước 5
        // #4) — React tự stringify `true` thành `"true"` cho thuộc tính aria-*.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error ? <FieldError id={id} message={error} /> : null}
    </div>
  );
}
