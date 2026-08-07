import type { SelectHTMLAttributes } from 'react';
import { FieldError } from '../shared/FieldError';
import s from './Select.module.css';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
}

/**
 * Bọc mỏng <select> — cùng khuôn label/id/error/aria-invalid với
 * Input/NumberInput (xem TextFieldBase). Danh sách <option> do TRANG GỌI
 * truyền vào qua `children`: component chung không biết trước tập lựa chọn
 * của trang nào (vd. `MEAL_SLOTS` chỉ trang `today` cần — đưa nó vào đây sẽ
 * là "component chứa logic riêng của một trang", đúng thứ brief cấm).
 */
export function Select({ id, label, error, className, children, ...rest }: SelectProps) {
  const errorId = `${id}-error`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <select
        id={id}
        className={[s.select, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? <FieldError id={id} message={error} /> : null}
    </div>
  );
}
