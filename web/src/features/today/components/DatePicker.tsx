import { todayIso } from '../../../lib/format';
import s from './DatePicker.module.css';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

/**
 * `<input type="date">` — `max` = hôm nay tính CỨNG theo `Asia/Ho_Chi_Minh`
 * (`todayIso()`, `lib/format.ts`), KHÔNG theo giờ máy trình duyệt (SPEC §7
 * câu hỏi 4, phương án (b) đã chốt). Đây không phải trang trí: `POST
 * /meals` và `PUT /body-logs/:date` đều chặn ngày tương lai theo cùng
 * timezone ở server — không có `max` đúng, người dùng chọn được một ngày
 * mà server coi là tương lai và chỉ biết khi bấm lưu ra `400` (SPEC §5.4).
 */
export function DatePicker({ value, onChange }: DatePickerProps) {
  const max = todayIso();
  return (
    <div className={s.field}>
      <label htmlFor="today-date" className={s.label}>
        Ngày
      </label>
      <input
        id="today-date"
        type="date"
        className={s.input}
        value={value}
        max={max}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
    </div>
  );
}
