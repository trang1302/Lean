import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBodyLogForm } from './useBodyLogForm';
import { ApiError } from '../../../types/api';
import type { BodyLog } from '../../../types/api';
import { MEASURE_FIELDS, type MeasureField } from '../../../constants/measures';

// Bất biến của file này (spec §2.1): payload chứa ĐÚNG những trường người dùng
// đã sửa, không hơn. Đây là bản kế thừa của luật "đúng một khoá" thời lưu-khi-blur
// — cùng một điều: đừng đụng vào thứ người ta không đụng.
//
// `bodyLog` phải tạo ĐÚNG MỘT LẦN ngoài factory của `renderHook`: hook có effect
// phụ thuộc `bodyLog` theo REFERENCE; object mới mỗi render sẽ làm effect chạy vô hạn.

const DATE = '2026-08-12';

function makeBodyLog(overrides: Partial<BodyLog> = {}): BodyLog {
  return {
    date: DATE,
    weightKg: null,
    waistCm: null,
    chestCm: null,
    shoulderCm: null,
    armCm: null,
    note: null,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}

/** Ngày đã ghi đủ năm số đo — nền của mọi ca "không được đụng". */
const FULL = {
  weightKg: 72.4,
  waistCm: 88,
  chestCm: 98,
  shoulderCm: 112,
  armCm: 32,
} as const;

describe('useBodyLogForm — BẤT BIẾN: payload chứa đúng trường đã sửa', () => {
  it('sửa 2/5 ô → payload có đúng 2 khoá đó, không có 3 khoá kia', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog(FULL));
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '99'));
    act(() => result.current.onChange('armCm', '33'));
    await act(async () => { await result.current.save(); });

    expect(put).toHaveBeenCalledTimes(1);
    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(body).sort()).toEqual(['armCm', 'chestCm']);
    expect(body).toEqual({ chestCm: 99, armCm: 33 });
  });

  it.each(MEASURE_FIELDS)('sửa mình %s → payload chỉ có khoá đó', async (field: MeasureField) => {
    const put = vi.fn().mockResolvedValue(makeBodyLog(FULL));
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange(field, '50'));
    await act(async () => { await result.current.save(); });

    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(body)).toEqual([field]);
  });
});

describe('useBodyLogForm — luật 1: không đổi thì không gửi', () => {
  it('không sửa gì mà bấm Lưu → không request nào', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    await act(async () => { await result.current.save(); });

    expect(put).not.toHaveBeenCalled();
  });

  it('gõ "72.40" lên ô đang là 72.4 → không gửi (so numeric, không so chuỗi)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog({ weightKg: 72.4 });
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('weightKg', '72.40'));
    await act(async () => { await result.current.save(); });

    // PUT với patch không đổi vẫn bump `updatedAt` và có thể tạo bản ghi rỗng
    // cho ngày chưa có gì — đó là lý do luật này tồn tại, không phải hiệu năng.
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — luật 2: xoá trắng ô đang có giá trị → gửi null', () => {
  it.each(MEASURE_FIELDS)('xoá trắng %s → { [field]: null }', async (field: MeasureField) => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange(field, ''));
    await act(async () => { await result.current.save(); });

    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).toEqual({ [field]: null });
  });
});

describe('useBodyLogForm — NaN không được làm hỏng cả lần lưu', () => {
  it('một ô NaN, một ô hợp lệ → chỉ ô hợp lệ vào payload', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('armCm', 'abc'));
    act(() => result.current.onChange('chestCm', '98'));
    await act(async () => { await result.current.save(); });

    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).toEqual({ chestCm: 98 });
  });
});

describe('useBodyLogForm — isDirty', () => {
  it('tắt lúc đầu, bật khi gõ, TẮT LẠI sau khi lưu xong', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ chestCm: 98 }));
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    expect(result.current.isDirty).toBe(false);

    act(() => result.current.onChange('chestCm', '98'));
    expect(result.current.isDirty).toBe(true);

    await act(async () => { await result.current.save(); });
    // Sai chỗ này thì nút Lưu sáng mãi sau khi đã lưu — spec §2.4.
    await waitFor(() => expect(result.current.isDirty).toBe(false));
  });

  it('gõ rồi gõ trả lại giá trị cũ → isDirty tắt', () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog({ chestCm: 98 });
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '99'));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.onChange('chestCm', '98'));
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useBodyLogForm — lưu hỏng', () => {
  it('400 → lỗi gắn vào đúng ô, isDirty VẪN true', async () => {
    const put = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'VALIDATION_ERROR', 'sai', [{ path: 'chestCm', message: 'quá lớn' }]),
      );
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '9999'));
    await act(async () => { await result.current.save(); });

    await waitFor(() => expect(result.current.fieldErrors.fieldErrors['chestCm']).toBe('quá lớn'));
    // Chưa lưu được thì vẫn còn thay đổi chưa lưu — ba lớp chặn ở TodayPage
    // dựa vào cờ này, tắt nhầm là mất dữ liệu lúc rời trang.
    expect(result.current.isDirty).toBe(true);
    expect(result.current.attemptTick).toBeGreaterThan(0);
  });
});

describe('useBodyLogForm — chống bấm Lưu hai lần', () => {
  it('gọi save() lần hai khi lần một chưa xong → chỉ một request', async () => {
    let resolvePut: (v: BodyLog) => void = () => {};
    const put = vi.fn().mockImplementation(
      () => new Promise<BodyLog>((res) => { resolvePut = res; }),
    );
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '98'));
    // `!` bắt buộc: TS không thấy được rằng callback của `act` chạy đồng bộ ngay,
    // nên nếu khai `let first: Promise<void>;` trần sẽ báo "used before assigned".
    let first!: Promise<void>;
    act(() => { first = result.current.save(); });
    await waitFor(() => expect(result.current.isSaving).toBe(true));
    await act(async () => { await result.current.save(); });

    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => { resolvePut(makeBodyLog({ chestCm: 98 })); await first; });
  });

  // M2 (báo cáo review): `isSaving` là STATE, nên hai lệnh `save()` gọi trong CÙNG
  // một tick (trước khi React commit lại) đều đọc cùng giá trị `isSaving === false`
  // của render đó — chốt chặn thật phải nằm ở một ref đọc/ghi đồng bộ, không đợi render.
  it('gọi save() hai lần trong CÙNG một tick (không đợi render giữa) → chỉ một request', async () => {
    let resolvePut: (v: BodyLog) => void = () => {};
    const put = vi.fn().mockImplementation(
      () => new Promise<BodyLog>((res) => { resolvePut = res; }),
    );
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '98'));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.save();
      second = result.current.save();
    });

    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePut(makeBodyLog({ chestCm: 98 }));
      await Promise.all([first, second]);
    });
  });
});

describe('useBodyLogForm — đồng bộ khi đổi ngày', () => {
  it('bodyLog mới thay cả 5 ô, isDirty về false', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const first = makeBodyLog(FULL);
    const second = makeBodyLog({ date: '2026-08-13', weightKg: 70 });

    const { result, rerender } = renderHook(
      ({ date, log }: { date: string; log: BodyLog }) => useBodyLogForm(date, log, put),
      { initialProps: { date: DATE, log: first } },
    );

    act(() => result.current.onChange('chestCm', '99'));
    expect(result.current.isDirty).toBe(true);

    rerender({ date: '2026-08-13', log: second });

    await waitFor(() => expect(result.current.values.weightKg).toBe('70'));
    expect(result.current.values.chestCm).toBe('');
    expect(result.current.isDirty).toBe(false);
  });
});
