import { act, render, screen, waitFor } from '@testing-library/react';
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
    chestCm: null,
    shoulderCm: null,
    armCm: null,
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
    // Lưu-khi-blur đã bị bỏ (Task 2) — lỗi chỉ xuất hiện sau khi bấm nút Lưu.
    await user.click(screen.getByRole('button', { name: /Lưu số đo/i }));

    await waitFor(() => expect(screen.getByText('phải lớn hơn 0')).toBeTruthy());
    expect(weightInput.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(weightInput));
  });
});

describe('BodyLogForm — "Đã lưu" hiện sau khi bấm nút Lưu thành công', () => {
  it('sửa vòng bụng rồi bấm Lưu, request thành công → hiện "Đã lưu ✓"', async () => {
    vi.mocked(todayApi.putBodyLog).mockResolvedValue(makeBodyLog({ waistCm: 90 }));
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-07" bodyLog={makeBodyLog()} isLoading={false} />);

    const waistInput = screen.getByLabelText('Vòng bụng (cm)');
    await user.type(waistInput, '90');
    // Lưu-khi-blur đã bị bỏ (Task 2) — chỉ nút Lưu mới gửi request.
    await user.click(screen.getByRole('button', { name: /Lưu số đo/i }));

    await waitFor(() => expect(screen.getByText(/Đã lưu/)).toBeTruthy());
  });
});

describe('BodyLogForm — năm ô số đo', () => {
  it('render đủ 5 ô với nhãn kèm đơn vị', () => {
    render(<BodyLogForm date="2026-08-07" bodyLog={null} isLoading={false} />);

    expect(screen.getByLabelText('Cân nặng (kg)')).toBeDefined();
    expect(screen.getByLabelText('Vòng bụng (cm)')).toBeDefined();
    expect(screen.getByLabelText('Vòng ngực (cm)')).toBeDefined();
    expect(screen.getByLabelText('Vòng vai (cm)')).toBeDefined();
    expect(screen.getByLabelText('Vòng bắp tay (cm)')).toBeDefined();
  });

  it('cả 5 ô bị disable khi đang tải', () => {
    render(<BodyLogForm date="2026-08-07" bodyLog={null} isLoading={true} />);

    for (const label of [
      'Cân nặng (kg)',
      'Vòng bụng (cm)',
      'Vòng ngực (cm)',
      'Vòng vai (cm)',
      'Vòng bắp tay (cm)',
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
    }
  });
});

describe('BodyLogForm — nút Lưu', () => {
  it('render nút Lưu, disabled khi chưa sửa gì', async () => {
    render(<BodyLogForm date="2026-08-12" bodyLog={null} isLoading={false} />);

    const btn = screen.getByRole('button', { name: /Lưu số đo/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('gõ vào một ô → nút Lưu bật', async () => {
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-12" bodyLog={null} isLoading={false} />);

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    expect((screen.getByRole('button', { name: /Lưu số đo/i }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('báo isDirty lên trang gọi qua onDirtyChange', async () => {
    const onDirtyChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BodyLogForm
        date="2026-08-12"
        bodyLog={null}
        isLoading={false}
        onDirtyChange={onDirtyChange}
      />,
    );

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    // Trang gọi cần cờ này để chặn đổi ngày khi còn thay đổi chưa lưu.
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it('rời ô KHÔNG còn tự lưu — chỉ nút mới lưu', async () => {
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-12" bodyLog={null} isLoading={false} />);

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');
    await user.tab();

    // Sau khi blur mà vẫn còn "chưa lưu" nghĩa là lưu-khi-blur đã thật sự bị bỏ.
    expect((screen.getByRole('button', { name: /Lưu số đo/i }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('còn bẩn từ ngày cũ nhưng đang tải ngày mới → nút Lưu vẫn disabled', async () => {
    // Khung hình hẹp: `useApiResource` giữ `values`/`isDirty` của ngày CŨ trong
    // khi `isLoading` đã lên `true` cho ngày MỚI (hook chỉ reset form trong
    // `useEffect`, chạy SAU render này). Không chặn ở đây thì bấm Lưu ngay
    // khung đó ghi số của ngày cũ vào bản ghi ngày mới.
    const user = userEvent.setup();
    const { rerender } = render(
      <BodyLogForm date="2026-08-12" bodyLog={null} isLoading={false} />,
    );

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');
    expect((screen.getByRole('button', { name: /Lưu số đo/i }) as HTMLButtonElement).disabled)
      .toBe(false); // vẫn cùng ngày — bẩn thì nút phải bật, xác nhận đúng tiền đề

    rerender(<BodyLogForm date="2026-08-12" bodyLog={null} isLoading={true} />);

    expect((screen.getByRole('button', { name: /Lưu số đo/i }) as HTMLButtonElement).disabled)
      .toBe(true);
  });
});

describe('BodyLogForm — M1 (báo cáo review): "Đã lưu ✓" không được hiện khi vẫn còn thay đổi chưa lưu', () => {
  it('gõ tiếp ô khác trong lúc request đầu còn treo, request đó thành công → hiện "Có thay đổi chưa lưu.", KHÔNG hiện "Đã lưu ✓"', async () => {
    let resolvePut: (v: BodyLog) => void = () => {};
    vi.mocked(todayApi.putBodyLog).mockImplementation(
      () => new Promise<BodyLog>((res) => { resolvePut = res; }),
    );
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-07" bodyLog={makeBodyLog()} isLoading={false} />);

    await user.type(screen.getByLabelText('Vòng bụng (cm)'), '90');
    await user.click(screen.getByRole('button', { name: /Lưu số đo/i }));
    await waitFor(() => expect(screen.getByText('Đang lưu…')).toBeTruthy());

    // Gõ ô KHÁC trong lúc request đầu chưa xong — đây là dữ liệu THẬT chưa lưu,
    // `setJustSaved(true)` của request đang treo (dưới) không được phép xoá cờ này.
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '95');

    await act(async () => {
      resolvePut(makeBodyLog({ waistCm: 90 }));
    });

    await waitFor(() => expect(screen.getByText('Có thay đổi chưa lưu.')).toBeTruthy());
    expect(screen.queryByText('Đã lưu ✓')).toBeNull();
  });
});

describe('BodyLogForm — M3 (báo cáo review): unmount lúc còn bẩn phải báo hết bẩn', () => {
  it('unmount khi còn thay đổi chưa lưu → onDirtyChange được gọi lại với false', async () => {
    const onDirtyChange = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <BodyLogForm
        date="2026-08-12"
        bodyLog={null}
        isLoading={false}
        onDirtyChange={onDirtyChange}
      />,
    );

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    // `TodayPage` thay form này bằng `ErrorState` khi `GET` lỗi giữa lúc gõ (spec §5.5,
    // M3) — dữ liệu gõ biến mất theo unmount, `isDirty` ở trang gọi phải theo về false.
    unmount();

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
