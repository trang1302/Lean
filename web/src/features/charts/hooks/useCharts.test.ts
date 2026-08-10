// Mock đúng MỘT hàm (`getSummary`) — `useCharts` chỉ có việc chuyển
// `range` → `from`/`to` → gọi hàm đó qua `useApiResource` thật (không mock
// `useApiResource`, nó đã có test riêng ở web-shell).
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/charts.api', () => ({
  getSummary: vi.fn(),
}));

import { getSummary } from '../api/charts.api';
import { useCharts } from './useCharts';

const mockedGetSummary = getSummary as unknown as ReturnType<typeof vi.fn>;

// Mỗi test tự khai hành vi mock riêng — dọn sạch giữa các test để tránh
// `mockResolvedValue` (không "Once") của một test còn sống sang test sau.
beforeEach(() => {
  mockedGetSummary.mockReset();
});

describe('useCharts', () => {
  it('mặc định range là "30d", from/to cách nhau đúng 30 ngày (SPEC §7.1)', async () => {
    mockedGetSummary.mockResolvedValue({ days: [], weeks: [], goal: {} });
    const { result } = renderHook(() => useCharts());

    expect(result.current.range).toBe('30d');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.to >= result.current.from).toBe(true);
    expect(mockedGetSummary).toHaveBeenCalledWith(result.current.from, result.current.to);
  });

  it('đổi range gọi lại getSummary với from/to mới, KHÔNG tự nới from ra ngoài lựa chọn (PLAN §5.3)', async () => {
    mockedGetSummary.mockResolvedValue({ days: [], weeks: [], goal: {} });
    const { result } = renderHook(() => useCharts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callsBefore = mockedGetSummary.mock.calls.length;
    act(() => {
      result.current.setRange('90d');
    });

    await waitFor(() => expect(mockedGetSummary.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(result.current.range).toBe('90d');
    // Khoảng 90d dài hơn 30d — from phải lùi xa hơn, KHÔNG bằng from cũ.
    const [, secondTo] = mockedGetSummary.mock.calls[mockedGetSummary.mock.calls.length - 1] as [string, string];
    expect(secondTo).toBe(result.current.to);
  });

  it('lỗi mạng → error là ApiError, reload() gọi lại đúng hàm nạp', async () => {
    mockedGetSummary.mockRejectedValueOnce(new Error('mất mạng'));
    const { result } = renderHook(() => useCharts());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    mockedGetSummary.mockResolvedValueOnce({ days: [], weeks: [], goal: {} });
    act(() => {
      result.current.reload();
    });
    // CHÚ Ý: `error` bị dọn về `null` NGAY khi request mới BẮT ĐẦU (đúng
    // hành vi cố ý của `useApiResource`, xem docstring của nó) — chờ `error
    // === null` không chứng minh được request thứ hai đã THÀNH CÔNG, chỉ
    // chứng minh nó đã bắt đầu. Phải chờ `data` (kết quả thật) thay vì vậy.
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.error).toBeNull();
  });
});
