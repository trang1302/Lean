import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('role="status" (không phải "alert") — đang tải khác lỗi', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('label tuỳ chỉnh thay cho mặc định "Đang tải…"', () => {
    render(<LoadingState label="Đang tải dữ liệu ngày…" />);
    expect(screen.getByText('Đang tải dữ liệu ngày…')).toBeTruthy();
  });
});
