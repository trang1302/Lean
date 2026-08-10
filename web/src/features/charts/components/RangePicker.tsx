// Bộ chọn khoảng — 3 nút cố định (30/90/365 ngày). KHÔNG có ô "tùy chọn"
// ở bản này — quyết định đã chốt cho SPEC §7.2, xem
// `utils/dateRange.ts` và báo cáo cho lý do đầy đủ.
import { Button } from '../../../components/ui';
import { RANGE_OPTIONS, type RangeOption } from '../utils/dateRange';
import s from './RangePicker.module.css';

interface RangePickerProps {
  value: RangeOption;
  onChange: (value: RangeOption) => void;
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div className={s.picker} role="group" aria-label="Chọn khoảng thời gian">
      {RANGE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={option.value === value ? 'primary' : 'secondary'}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
