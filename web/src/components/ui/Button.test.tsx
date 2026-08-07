import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('gọi onClick khi bấm', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Lưu</Button>);

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('mặc định type="button" — không vô tình submit form khi đặt trong <form>', () => {
    render(<Button>Thử lại</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('cho phép trang ghi đè type="submit" khi thật sự cần submit form', () => {
    render(<Button type="submit">Gửi</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });

  it('disabled thì không gọi onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Lưu
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
