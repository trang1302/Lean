import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBodyLogForm } from './useBodyLogForm';
import { ApiError } from '../../../types/api';
import type { BodyLog } from '../../../types/api';
import { MEASURE_FIELDS, type MeasureField } from '../../../constants/measures';

// Test canh giữ đúng bốn luật gửi của docs/features/web-today/SPEC.md §5.1 và
// hợp đồng upsert 3 trạng thái. Mock `putBodyLog` truyền vào qua tham số thứ ba
// (dependency injection), không vi.mock module, để khẳng định trực tiếp payload.
//
// QUAN TRỌNG: `bodyLog` phải được tạo ĐÚNG MỘT LẦN bên ngoài hàm factory của
// `renderHook` — hook có `useEffect` phụ thuộc `bodyLog` theo REFERENCE; một
// object mới mỗi lần render sẽ làm effect chạy lại vô hạn.

const DATE = '2026-08-07';

function makeBodyLog(overrides: Partial<BodyLog> = {}): BodyLog {
  return {
    date: DATE,
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

/** Một ngày đã ghi đủ năm số đo — nền của mọi test "không được xoá". */
const FULL_LOG_VALUES = {
  weightKg: 72.4,
  waistCm: 88,
  chestCm: 98,
  shoulderCm: 112,
  armCm: 32,
} as const;

describe('useBodyLogForm — TEST CANH MẤT DỮ LIỆU (bắt buộc)', () => {
  it.each(MEASURE_FIELDS)(
    'ngày đã có đủ 5 số đo, chỉ sửa %s → payload KHÔNG chứa bốn khoá kia',
    async (field: MeasureField) => {
      const put = vi.fn().mockResolvedValue(makeBodyLog(FULL_LOG_VALUES));
      const initialLog = makeBodyLog(FULL_LOG_VALUES);
      const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

      act(() => result.current.onChange(field, '50'));
      act(() => result.current.onBlur(field));

      await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
      expect(put).toHaveBeenCalledWith(DATE, { [field]: 50 });

      for (const call of put.mock.calls) {
        const body = call[1] as Record<string, unknown>;
        expect(Object.keys(body)).toEqual([field]);
      }

      // Giá trị hiển thị của bốn ô kia không hề đổi.
      for (const other of MEASURE_FIELDS) {
        if (other === field) continue;
        expect(result.current.values[other]).toBe(String(FULL_LOG_VALUES[other]));
      }
    },
  );
});

// Luật 1 (cờ `touched`) KHÔNG được kiểm độc lập ở đây, và không có cách nào
// làm điều đó qua API công khai của hook: `values` chỉ có thể lệch khỏi
// `loaded` thông qua `onChange`, mà `onChange` luôn đặt `touched = true` ngay
// lúc đó (xem `useBodyLogForm.ts`); effect đồng bộ khi đổi `date`/`bodyLog`
// đặt lại CẢ HAI cùng lúc. Vậy `touched === false` LUÔN kéo theo
// `raw === loaded.current[field]` — trong ca dưới đây, luật 2 (giá trị không
// đổi thì không gửi) đã đủ để chặn request TRƯỚC KHI luật 1 kịp có tác dụng.
// Xóa cờ `touched` khỏi `commit()` sẽ KHÔNG làm test này đỏ.
//
// Cờ `touched` vẫn được giữ trong `useBodyLogForm.ts` làm phòng thủ LỚP HAI
// chống refactor tương lai (vd. đổi cách so sánh của `isUnchanged`, hoặc thêm
// một đường ghi `values` không đi qua `onChange`) — không phải một luật kiểm
// được riêng bằng test hành vi qua API công khai hiện có.
describe('useBodyLogForm — luật 1 (touched) là phòng thủ lớp hai, bị luật 2 che trong mọi ca gọi được qua API công khai', () => {
  it.each(MEASURE_FIELDS)(
    'blur %s mà chưa gõ gì → không request nào (ca này cũng thỏa luật 2, không chứng minh luật 1 riêng)',
    async (field: MeasureField) => {
      const put = vi.fn().mockResolvedValue(makeBodyLog());
      const initialLog = makeBodyLog();
      const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

      act(() => result.current.onBlur(field));

      await new Promise((r) => setTimeout(r, 0));
      expect(put).not.toHaveBeenCalled();
    },
  );
});

describe('useBodyLogForm — luật 2: giá trị không đổi thì KHÔNG gửi', () => {
  it('gõ "72.40" lên ô đang là 72.4 → không gửi (so numeric, không so chuỗi)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ weightKg: 72.4 }));
    const initialLog = makeBodyLog({ weightKg: 72.4 });
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('weightKg', '72.40'));
    act(() => result.current.onBlur('weightKg'));

    await new Promise((r) => setTimeout(r, 0));
    // Gửi patch không đổi vẫn bump `updatedAt` và có thể tạo bản ghi rỗng cho
    // ngày chưa có gì — đó là lý do luật này tồn tại, không phải vì hiệu năng.
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — luật 3: xoá trắng ô đang có giá trị → gửi null', () => {
  it.each(MEASURE_FIELDS)('xoá trắng %s → gửi { [field]: null }', async (field: MeasureField) => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const initialLog = makeBodyLog(FULL_LOG_VALUES);
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange(field, ''));
    act(() => result.current.onBlur(field));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(DATE, { [field]: null });
  });
});

describe('useBodyLogForm — luật 4: giá trị mới hợp lệ → gửi số', () => {
  it('gõ số mới vào ô rỗng → gửi Number(raw)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ chestCm: 98 }));
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('chestCm', '98'));
    act(() => result.current.onBlur('chestCm'));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(DATE, { chestCm: 98 });
  });

  it('gõ chuỗi không phải số → không gửi (chặn NaN ở client)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('armCm', 'abc'));
    act(() => result.current.onBlur('armCm'));

    await new Promise((r) => setTimeout(r, 0));
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — lỗi 400 gắn vào đúng ô', () => {
  it('server trả lỗi trường chestCm → fieldErrors mang đúng khoá đó', async () => {
    const put = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'VALIDATION_ERROR', 'sai', [{ path: 'chestCm', message: 'quá lớn' }]),
      );
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('chestCm', '9999'));
    act(() => result.current.onBlur('chestCm'));

    await waitFor(() => expect(result.current.fieldErrors.fieldErrors['chestCm']).toBe('quá lớn'));
    expect(result.current.attemptTick).toBeGreaterThan(0);
  });
});

describe('useBodyLogForm — đồng bộ lại khi đổi ngày', () => {
  it('bodyLog mới thay cả 5 ô và xoá cờ touched', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const firstLog = makeBodyLog(FULL_LOG_VALUES);
    const secondLog = makeBodyLog({ date: '2026-08-08', weightKg: 70 });

    const { result, rerender } = renderHook(
      ({ date, log }: { date: string; log: BodyLog }) => useBodyLogForm(date, log, put),
      { initialProps: { date: DATE, log: firstLog } },
    );

    expect(result.current.values.chestCm).toBe('98');

    rerender({ date: '2026-08-08', log: secondLog });

    await waitFor(() => expect(result.current.values.weightKg).toBe('70'));
    expect(result.current.values.chestCm).toBe('');
    expect(result.current.savedField).toBeNull();
  });
});
