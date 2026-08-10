import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BodyLogForm } from './BodyLogForm';
import * as todayApi from '../api/today.api';
import { ApiError } from '../../../types/api';
import type { BodyLog } from '../../../types/api';

vi.mock('../api/today.api', () => ({
  putBodyLog: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function makeBodyLog(overrides: Partial<BodyLog> = {}): BodyLog {
  return {
    date: '2026-08-07',
    weightKg: null,
    waistCm: null,
    note: null,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('BodyLogForm — 404 (bodyLog=null) không phải lỗi (bẫy B2 #3, SPEC §6)', () => {
  it('hai ô rỗng, không có thông báo lỗi nào', () => {
    render(<BodyLogForm date="2026-08-07" bodyLog={null} isLoading={false} />);

    expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Vòng bụng (cm)') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BodyLogForm — disable khi đang tải (SPEC §7 câu hỏi 8)', () => {
  it('isLoading=true → hai ô bị disable', () => {
    render(<BodyLogForm date="2026-08-07" bodyLog={null} isLoading={true} />);
    expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Vòng bụng (cm)') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('BodyLogForm — lỗi 400 hiện dưới đúng ô + aria-invalid (bẫy B2 #4)', () => {
  it('server trả 400 fields weightKg → ô cân nặng có aria-invalid và message, focus chuyển tới ô đó', async () => {
    vi.mocked(todayApi.putBodyLog).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', [
        { path: 'weightKg', message: 'phải lớn hơn 0' },
      ]),
    );
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-07" bodyLog={makeBodyLog()} isLoading={false} />);

    const weightInput = screen.getByLabelText('Cân nặng (kg)');
    await user.type(weightInput, '-5');
    await user.tab();

    await waitFor(() => expect(screen.getByText('phải lớn hơn 0')).toBeTruthy());
    expect(weightInput.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(weightInput));
  });
});

describe('BodyLogForm — "Đã lưu" hiện sau khi blur thành công', () => {
  it('sửa vòng bụng rồi blur, request thành công → hiện "Đã lưu ✓"', async () => {
    vi.mocked(todayApi.putBodyLog).mockResolvedValue(makeBodyLog({ waistCm: 90 }));
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-07" bodyLog={makeBodyLog()} isLoading={false} />);

    const waistInput = screen.getByLabelText('Vòng bụng (cm)');
    await user.type(waistInput, '90');
    await user.tab();

    await waitFor(() => expect(screen.getByText(/Đã lưu/)).toBeTruthy());
  });
});
