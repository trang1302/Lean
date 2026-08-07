import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApiResource } from './useApiResource';
import { ApiError } from '../types/api';

// Bốn deliverable của buoc-6-brief.md #1–#4. Đây là nơi DUY NHẤT của cả app
// khoá hành vi chống race — ba trang (today, charts, settings) đều dựa vào
// đúng cơ chế này, không viết lại (docs/features/web-shell/SPEC.md §8.1).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useApiResource — chống race, ca chính (deliverable #1)', () => {
  it('đổi tham số hai lần, response của lần ĐẦU về SAU → state mang dữ liệu của lần SAU', async () => {
    // Mỗi "id" có một resolver riêng, điều khiển thủ công thời điểm response
    // về — mô phỏng đúng kịch bản SPEC §8: đổi 06 → 07, nhưng response của
    // 06 (request cũ) về sau response của 07 (request mới).
    const resolvers = new Map<string, (value: string) => void>();
    const load = (id: string) =>
      new Promise<string>((resolve) => {
        resolvers.set(id, resolve);
      });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useApiResource(() => load(id), [id]),
      { initialProps: { id: '2026-08-06' } },
    );

    // Đổi tham số ngay lập tức, trước khi request đầu tiên kịp trả lời —
    // đúng kịch bản "đổi ngày hai lần liên tiếp thật nhanh".
    rerender({ id: '2026-08-07' });

    // Request MỚI (07) về TRƯỚC.
    act(() => resolvers.get('2026-08-07')?.('data-07'));
    await waitFor(() => expect(result.current.data).toBe('data-07'));

    // Request CŨ (06) về SAU — phải bị bỏ qua, không được ghi đè state.
    act(() => resolvers.get('2026-08-06')?.('data-06-cu'));
    // Không có tín hiệu nào để "await" tới (đúng ý đồ: không có gì xảy ra) —
    // đợi một vòng microtask để chắc chắn `.then` (nếu có setState) đã chạy.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data).toBe('data-07');
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useApiResource — chống race, nhánh lỗi (deliverable #2)', () => {
  it('request cũ HỎNG về sau khi request mới đã thành công → error vẫn null', async () => {
    const resolvers = new Map<string, { resolve: (v: string) => void; reject: (e: unknown) => void }>();
    const load = (id: string) =>
      new Promise<string>((resolve, reject) => {
        resolvers.set(id, { resolve, reject });
      });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useApiResource(() => load(id), [id]),
      { initialProps: { id: '2026-08-06' } },
    );

    rerender({ id: '2026-08-07' });

    // Request MỚI (07) thành công trước.
    act(() => resolvers.get('2026-08-07')?.resolve('data-07'));
    await waitFor(() => expect(result.current.data).toBe('data-07'));

    // Request CŨ (06) HỎNG, về sau — không được che dữ liệu mới bằng lỗi.
    act(() => {
      resolvers.get('2026-08-06')?.reject(new ApiError(500, 'INTERNAL_ERROR', 'lỗi máy chủ'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('data-07');
  });
});

describe('useApiResource — dọn error cũ khi deps đổi (review Bước 6, Important 1)', () => {
  it('bắt đầu từ trạng thái đã lỗi → đổi deps → error sạch NGAY trong lúc đang tải, trước khi request mới kịp trả lời', async () => {
    // Không phải test race giữa hai response (đó là hai describe trên) — đây
    // là test cho khoảnh khắc GIỮA lúc effect mới bắt đầu và lúc nó có kết
    // quả: nếu lần gọi trước đã lỗi, `error` cũ không được "trôi" sang tham
    // số mới trong lúc `isLoading: true`.
    const resolvers = new Map<string, { resolve: (v: string) => void; reject: (e: unknown) => void }>();
    const load = (id: string) =>
      new Promise<string>((resolve, reject) => {
        resolvers.set(id, { resolve, reject });
      });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useApiResource(() => load(id), [id]),
      { initialProps: { id: '2026-08-06' } },
    );

    // Request đầu tiên (06) HỎNG.
    act(() => {
      resolvers.get('2026-08-06')?.reject(new ApiError(500, 'INTERNAL_ERROR', 'lỗi máy chủ'));
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Đổi tham số — request mới (07) CHƯA về, cố tình không resolve/reject nó.
    rerender({ id: '2026-08-07' });

    // Ngay tại thời điểm này (đang isLoading, chưa có response mới), error
    // của tham số CŨ phải đã bị dọn — không được hiện lỗi của "06" trong khi
    // ô chọn đã ghi "07".
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });
});

describe('useApiResource — reload() (deliverable #3)', () => {
  it('reload() gọi lại hàm nạp và cập nhật data', async () => {
    let callCount = 0;
    const load = vi.fn(() => {
      callCount += 1;
      return Promise.resolve(`ket-qua-${callCount}`);
    });

    const { result } = renderHook(() => useApiResource(load, []));

    await waitFor(() => expect(result.current.data).toBe('ket-qua-1'));
    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.data).toBe('ket-qua-2'));
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('useApiResource — unmount giữa chừng (deliverable #4)', () => {
  it('unmount trước khi request về → không crash / không log lỗi khi response tới sau', async () => {
    // GIỚI HẠN ĐÃ KIỂM THỰC NGHIỆM (xem buoc-6-report.md mục "Phát hiện quan
    // trọng"): React 18+ đã bỏ cảnh báo "Can't perform a React state update
    // on an unmounted component" — test này VẪN XANH ngay cả khi cờ
    // `cancelled` bị xoá hoàn toàn khỏi useApiResource.ts, vì không còn tín
    // hiệu console.error nào để phân biệt hai trường hợp. Giữ lại test vì nó
    // vẫn khoá một hồi quy thật khác (crash/log lỗi khi resolve sau unmount,
    // vd. nếu sau này thêm side-effect ngoài setState) — KHÔNG coi đây là
    // bằng chứng cho cơ chế `cancelled` ở nhánh unmount. Bằng chứng thật cho
    // cơ chế đó nằm ở hai test "chống race" phía trên: chúng thực thi đúng
    // cùng một closure cleanup (`cancelled = true`) mà React cũng gọi khi
    // unmount, chỉ khác đường kích hoạt (rerender vs. unmount).
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let resolveLoad!: (value: string) => void;
    const load = () =>
      new Promise<string>((resolve) => {
        resolveLoad = resolve;
      });

    const { unmount } = renderHook(() => useApiResource(load, []));

    unmount();

    // Response về SAU khi đã unmount — hook phải tự chặn bằng cờ `cancelled`
    // trong cleanup, không dựa vào React tự phát hiện.
    await act(async () => {
      resolveLoad('data-sau-khi-unmount');
      await Promise.resolve();
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
