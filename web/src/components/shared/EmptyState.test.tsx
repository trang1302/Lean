import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

// Deliverable Bước 5 #3 — ranh giới "rỗng ≠ lỗi" (SPEC.md §7.1). EmptyState
// KHÔNG được mượn role="alert" hay biến màu lỗi của ErrorState.

describe('EmptyState', () => {
  it('render đúng nội dung message được truyền vào', () => {
    render(<EmptyState message="Chưa ghi bữa nào cho ngày này." />);
    expect(screen.getByText('Chưa ghi bữa nào cho ngày này.')).toBeTruthy();
  });

  it('KHÔNG có role="alert" — rỗng không phải lỗi', () => {
    render(<EmptyState message="Cần ít nhất 2 ngày dữ liệu để vẽ xu hướng." />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dùng class CSS Module RIÊNG của chính nó, không phải class của ErrorState', async () => {
    // CSS Modules tự cách ly theo file — import trực tiếp cả hai object
    // class để khoá bất biến "EmptyState không mang tên class của
    // ErrorState" (tránh ca copy-paste nhầm class lỗi vào state rỗng).
    const emptyStyles = (await import('./EmptyState.module.css')).default;
    const errorStyles = (await import('./ErrorState.module.css')).default;

    render(<EmptyState message="rỗng" />);
    const node = screen.getByText('rỗng');

    expect(node.className).toBe(emptyStyles.emptyState);
    expect(node.className).not.toBe(errorStyles.errorState);
  });
});
