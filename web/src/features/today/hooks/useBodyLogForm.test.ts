import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBodyLogForm } from './useBodyLogForm';
import { ApiError } from '../../../types/api';
import type { BodyLog } from '../../../types/api';

// Test canh giữ đúng bốn cạm bẫy của điều phối viên §B2 #1 và
// docs/features/web-today/SPEC.md §5.1/§5.2/§6 — mock `putBodyLog` được
// truyền vào qua tham số thứ ba (dependency injection), không vi.mock
// module, để khẳng định trực tiếp payload gửi đi.
//
// QUAN TRỌNG: `bodyLog` phải được tạo ĐÚNG MỘT LẦN bên ngoài hàm factory
// của `renderHook` (không gọi `makeBodyLog()` trực tiếp trong callback) —
// hook có `useEffect` phụ thuộc `bodyLog` theo REFERENCE; một object mới
// mỗi lần render sẽ làm effect chạy lại vô hạn (mỗi lần setState trong
// effect gây re-render, callback tạo object mới, effect lại chạy...).

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

describe('useBodyLogForm — sửa một ô CHỈ gửi đúng khóa của ô đó (bẫy B2 #1)', () => {
  it('sửa cân nặng rồi blur → putBodyLog gọi với { weightKg }, KHÔNG chứa waistCm', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ weightKg: 72.4 }));
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', initialLog, put));

    act(() => result.current.onWeightChange('72.4'));
    act(() => result.current.onWeightBlur());

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('2026-08-07', { weightKg: 72.4 });
    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).not.toHaveProperty('waistCm');
  });
});

describe('useBodyLogForm — TEST CANH MẤT DỮ LIỆU (bẫy B2 #1, bắt buộc)', () => {
  it('ngày đã có waistCm=88, chỉ sửa cân nặng → không có request nào mang khóa waistCm, ô waist vẫn hiển thị 88', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ weightKg: 70, waistCm: 88 }));
    const initialLog = makeBodyLog({ weightKg: 70, waistCm: 88 });
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', initialLog, put));

    expect(result.current.waistValue).toBe('88');

    act(() => result.current.onWeightChange('71'));
    act(() => result.current.onWeightBlur());

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));

    // Sau request: KHÔNG request nào từng mang khóa waistCm, và giá trị
    // hiển thị của ô vòng bụng không hề đổi — 88 không bị "xóa mất" chỉ vì
    // người dùng không đụng vào ô đó.
    for (const call of put.mock.calls) {
      expect(call[1]).not.toHaveProperty('waistCm');
    }
    expect(result.current.waistValue).toBe('88');
  });
});

describe('useBodyLogForm — xóa trắng một ô đang có giá trị (SPEC §5.1 ca 2)', () => {
  it('xóa trắng waistCm rồi blur → gửi { waistCm: null }', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ waistCm: null }));
    const initialLog = makeBodyLog({ waistCm: 88 });
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', initialLog, put));

    act(() => result.current.onWaistChange(''));
    act(() => result.current.onWaistBlur());

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('2026-08-07', { waistCm: null });
  });
});

describe('useBodyLogForm — blur không sửa gì (SPEC §5.1 quy tắc 1)', () => {
  it('blur qua ô không sửa gì → không có request nào', async () => {
    const put = vi.fn();
    const initialLog = makeBodyLog({ weightKg: 70 });
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', initialLog, put));

    act(() => result.current.onWeightBlur());
    act(() => result.current.onWaistBlur());

    await act(async () => {
      await Promise.resolve();
    });

    expect(put).not.toHaveBeenCalled();
  });

  it('ô rỗng ngay từ đầu, không gõ gì, blur → không có request', async () => {
    const put = vi.fn();
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', initialLog, put));

    act(() => result.current.onWeightBlur());

    await act(async () => {
      await Promise.resolve();
    });

    expect(put).not.toHaveBeenCalled();
  });

  it('gõ lại đúng giá trị cũ (khác chuỗi, cùng số trị) rồi blur → không gửi', async () => {
    const put = vi.fn();
    const initialLog = makeBodyLog({ weightKg: 72.4 });
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', initialLog, put));

    act(() => result.current.onWeightChange('72.40'));
    act(() => result.current.onWeightBlur());

    await act(async () => {
      await Promise.resolve();
    });

    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — lỗi 400 gắn vào đúng ô (bẫy B2 #4, SPEC §5.2)', () => {
  it('server trả 400 fields weightKg → fieldErrors.weightKg có message, không lẫn sang waistCm', async () => {
    const put = vi.fn().mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', [
        { path: 'weightKg', message: 'phải lớn hơn 0' },
      ]),
    );
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', initialLog, put));

    act(() => result.current.onWeightChange('-5'));
    act(() => result.current.onWeightBlur());

    await waitFor(() => expect(result.current.fieldErrors.fieldErrors['weightKg']).toBe('phải lớn hơn 0'));
    expect(result.current.fieldErrors.fieldErrors['waistCm']).toBeUndefined();
  });
});

describe('useBodyLogForm — 404 của GET (bodyLog=null) không phải lỗi (bẫy B2 #3, SPEC §6)', () => {
  it('bodyLog=null → hai ô rỗng, không có lỗi nào', () => {
    const put = vi.fn();
    const { result } = renderHook(() => useBodyLogForm('2026-08-07', null, put));

    expect(result.current.weightValue).toBe('');
    expect(result.current.waistValue).toBe('');
    expect(result.current.fieldErrors.errorCount).toBe(0);
  });
});
