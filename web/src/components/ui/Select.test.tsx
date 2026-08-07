import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

describe('Select', () => {
  it('không có lỗi: không gắn aria-invalid, không render FieldError', () => {
    render(
      <Select id="slot" label="Buổi">
        <option value="breakfast">Sáng</option>
        <option value="lunch">Trưa</option>
      </Select>,
    );
    const select = screen.getByLabelText('Buổi');
    expect(select.getAttribute('aria-invalid')).toBeNull();
  });

  it('có lỗi: gắn aria-invalid="true" và FieldError liên kết bằng aria-describedby', () => {
    render(
      <Select id="slot" label="Buổi" error="Vui lòng chọn một buổi">
        <option value="breakfast">Sáng</option>
      </Select>,
    );
    const select = screen.getByLabelText('Buổi');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe('slot-error');
    expect(screen.getByText('Vui lòng chọn một buổi').id).toBe('slot-error');
  });

  it('đổi lựa chọn gọi đúng onChange, giữ nguyên hành vi native của <select>', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select id="slot" label="Buổi" onChange={onChange}>
        <option value="breakfast">Sáng</option>
        <option value="lunch">Trưa</option>
      </Select>,
    );

    await user.selectOptions(screen.getByLabelText('Buổi'), 'lunch');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
