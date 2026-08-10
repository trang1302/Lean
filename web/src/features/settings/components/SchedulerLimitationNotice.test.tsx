import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchedulerLimitationNotice } from './SchedulerLimitationNotice';

// Điều BẮT BUỘC #1 của brief điều phối viên (B2): cảnh báo phải LUÔN hiện,
// đủ ba ý — chỉ chạy khi server bật · máy tắt là mất lượt · không gửi bù.

describe('SchedulerLimitationNotice — cảnh báo BẮT BUỘC, luôn hiển thị (SPEC §5)', () => {
  it('hiện đủ ba ý bắt buộc trong nội dung, không cần tương tác nào để lộ ra', () => {
    render(<SchedulerLimitationNotice />);

    const text = screen.getByText(/nhắc nhở chỉ hoạt động khi server đang chạy/i);
    expect(text).toBeTruthy();

    // Cả ba ý nằm trong cùng khối văn bản render sẵn — không có <details>,
    // không có nút "hiện thêm" nào phải bấm trước khi thấy được nội dung
    // này (khác NtfyHelp, cố ý thu gọn được).
    expect(screen.getByText(/máy tắt hoặc server dừng/i)).toBeTruthy();
    expect(screen.getByText(/không gửi bù khi chạy lại/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /hiện|mở rộng|xem thêm/i })).toBeNull();
  });
});
