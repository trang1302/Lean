import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';
import { todayIso } from '../../../lib/format';

describe('DatePicker', () => {
  it('max = hôm nay tính theo Asia/Ho_Chi_Minh (SPEC §5.4, bắt buộc không phải trang trí)', () => {
    render(<DatePicker value="2026-08-01" onChange={() => {}} />);
    expect(screen.getByLabelText('Ngày').getAttribute('max')).toBe(todayIso());
  });

  it('đổi ngày gọi onChange với giá trị mới', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-08-01" onChange={onChange} />);

    const input = screen.getByLabelText('Ngày') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-08-06' } });

    expect(onChange).toHaveBeenCalledWith('2026-08-06');
  });

  it('render type="date"', () => {
    render(<DatePicker value="2026-08-01" onChange={() => {}} />);
    expect(screen.getByLabelText('Ngày').getAttribute('type')).toBe('date');
  });
});
