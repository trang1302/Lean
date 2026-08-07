import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch', () => {
  it('là input[type=checkbox] role="switch" — giữ hành vi bàn phím/focus native của checkbox', () => {
    render(<Switch id="reminder" label="Nhắc nhở" checked={false} onChange={() => {}} />);
    const input = screen.getByRole('switch', { name: 'Nhắc nhở' }) as HTMLInputElement;
    expect(input.type).toBe('checkbox');
  });

  it('bấm vào nhãn (label) cũng bật/tắt được — không chỉ bấm trúng ô vuông nhỏ', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch id="reminder" label="Nhắc nhở" checked={false} onChange={onChange} />);

    await user.click(screen.getByText('Nhắc nhở'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('nhấn Space khi đang focus cũng bật/tắt — hành vi native của checkbox, không tự viết onKeyDown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch id="reminder" label="Nhắc nhở" checked={false} onChange={onChange} />);

    const input = screen.getByRole('switch', { name: 'Nhắc nhở' });
    input.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('checked=true phản ánh đúng trạng thái (controlled)', () => {
    render(<Switch id="reminder" label="Nhắc nhở" checked={true} onChange={() => {}} />);
    const input = screen.getByRole('switch', { name: 'Nhắc nhở' }) as HTMLInputElement;
    expect(input.checked).toBe(true);
  });
});
