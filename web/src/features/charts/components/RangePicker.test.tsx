import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RangePicker } from './RangePicker';

describe('RangePicker', () => {
  it('hiện đúng ba nút cố định (SPEC §7.2 — không có ô "tùy chọn" ở bản này)', () => {
    render(<RangePicker value="30d" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '30 ngày' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '90 ngày' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 năm' })).toBeTruthy();
  });

  it('nút đang chọn có aria-pressed="true", các nút khác "false"', () => {
    render(<RangePicker value="90d" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '90 ngày' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '30 ngày' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: '1 năm' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('bấm một nút gọi onChange với đúng giá trị', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RangePicker value="30d" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '1 năm' }));
    expect(onChange).toHaveBeenCalledWith('365d');
  });
});
