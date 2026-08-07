import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState';
import { ApiError } from '../../types/api';

// Deliverable Bước 5 #1, #2 (buoc-5-brief.md) — ErrorState nhận nguyên
// ApiError, không nhận chuỗi (khác EmptyState/LoadingState — xem
// EmptyState.test.tsx cho ranh giới rỗng ≠ lỗi).

describe('ErrorState — status 0 (lỗi mạng)', () => {
  it('hiện đúng câu "Không kết nối được server — server đã chạy chưa?" và nút Thử lại gọi đúng callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const error = new ApiError(0, 'NETWORK_ERROR', 'TypeError: Failed to fetch');

    render(<ErrorState error={error} onRetry={onRetry} />);

    expect(screen.getByText('Không kết nối được server — server đã chạy chưa?')).toBeTruthy();

    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('gắn role="alert" — trạng thái lỗi cấp trang, khác EmptyState', () => {
    const error = new ApiError(0, 'NETWORK_ERROR', 'x');
    render(<ErrorState error={error} onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('ErrorState — status 500', () => {
  it('hiện thông báo chung, KHÔNG lộ message thô từ server', () => {
    const rawServerMessage = 'PrismaClientKnownRequestError: connection refused at 10.0.0.5:5432';
    const error = new ApiError(500, 'INTERNAL_ERROR', rawServerMessage);

    render(<ErrorState error={error} onRetry={() => {}} />);

    // Không lộ chi tiết nội bộ ra UI.
    expect(screen.queryByText(rawServerMessage)).toBeNull();
    // Vẫn có một thông báo chung nào đó cho người dùng.
    expect(screen.getByRole('alert').textContent).toBeTruthy();
  });

  it('vẫn có nút Thử lại gọi đúng callback dù là lỗi 500', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const error = new ApiError(500, 'INTERNAL_ERROR', 'lỗi nội bộ');

    render(<ErrorState error={error} onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
