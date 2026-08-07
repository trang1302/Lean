import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../types/api';

export interface ApiResourceState<T> {
  /** `null` trước lần nạp thành công đầu tiên, hoặc sau một lần nạp lỗi. */
  data: T | null;
  isLoading: boolean;
  /** `null` khi lần nạp gần nhất (KHÔNG bị huỷ) thành công. */
  error: ApiError | null;
  /** Gọi lại đúng hàm nạp hiện tại. Không có cache (SPEC §8.2) — luôn đi lại
   * từ đầu, kể cả khi `data` hiện tại vẫn còn nguyên trên màn hình. */
  reload: () => void;
}

/**
 * `useApiResource` — nạp một tài nguyên qua `apiClient` và tự chống race khi
 * tham số truy vấn đổi liên tục (docs/features/web-shell/SPEC.md §8.1).
 *
 * Dự án CỐ Ý không dùng TanStack Query (SPEC §3.2) — hook này là nơi trả nợ
 * phần khó nhất mà thư viện đó lẽ ra lo hộ: **thứ tự response không đảm bảo
 * khớp thứ tự request**. Kịch bản cụ thể (SPEC §8): người dùng đổi ngày
 * `06 → 07 → 06` thật nhanh; nếu response của lần gọi `07` (đã bị bỏ) về
 * SAU response của lần gọi `06` cuối cùng, một `setState` không kiểm soát sẽ
 * làm màn hình hiện dữ liệu ngày `07` trong khi ô chọn ngày đang ghi `06` —
 * không có lỗi nào báo, người dùng có thể ghi đè nhầm dữ liệu.
 *
 * Cách chặn: cờ `cancelled` cục bộ trong closure của MỖI lần effect chạy.
 * `useEffect` đặt `cancelled = false` khi bắt đầu; hàm cleanup (chạy trước
 * lần effect kế tiếp, hoặc lúc unmount) đặt `cancelled = true`. Sau `await`,
 * luôn kiểm `if (cancelled) return;` TRƯỚC khi `setState` bất kỳ.
 *
 * **Cờ áp dụng cho CẢ nhánh `.then` lẫn nhánh `.catch`** (SPEC §8.1 luật 2).
 * Bỏ sót nhánh lỗi là bug tinh vi hơn nhánh thành công: request cũ đã bị huỷ
 * mà vẫn lỡ tay `setError` sẽ vẽ một khối lỗi đỏ đè lên dữ liệu MỚI đang hiển
 * thị đúng — người dùng thấy lỗi giả trong khi dữ liệu trên màn hình không
 * hề sai.
 *
 * `AbortController` CỐ Ý không dùng ở đây — SPEC §8.1 luật 3 nói rõ nó là
 * tuỳ chọn tối ưu băng thông, không thay được cờ `cancelled`: một request đã
 * về tới `.then()`/`.catch()` thì gọi `abort()` không còn tác dụng gì, chỉ
 * cờ mới chặn được `setState`. Thêm `AbortController` mà không giữ cờ vẫn sai.
 *
 * `load` được giữ trong `ref` và KHÔNG nằm trong mảng phụ thuộc của
 * `useEffect` — nếu caller truyền một arrow function mới mỗi lần render (rất
 * phổ biến, vd. `() => apiClient.get(...)`), đưa thẳng nó vào dependency sẽ
 * làm effect chạy lại ở MỌI render, không chỉ khi `deps` đổi. `ref` được gán
 * lại trong thân render (không phải trong effect) nên khi effect chạy nó
 * luôn thấy đúng closure mới nhất của lần render vừa xảy ra.
 *
 * **`error` được dọn về `null` ngay khi một request MỚI bắt đầu (do `deps`
 * đổi hoặc `reload()`), `data` thì KHÔNG.** Đây là quyết định có chủ đích,
 * không đối xứng:
 * - Giữ `data` cũ trong lúc tải là **tốt** — tránh nhấp nháy màn hình về
 *   rỗng rồi lại có dữ liệu ngay sau đó (SPEC §8.2 không cache, nhưng "không
 *   cache" nghĩa là luôn gọi lại API, không có nghĩa là phải xoá sạch màn
 *   hình trong lúc chờ).
 * - Xoá `error` cũ là **bắt buộc**, không phải tuỳ chọn: nếu không, đổi
 *   tham số sau một lần lỗi sẽ để lại một cửa sổ `isLoading: true` **và**
 *   `error` của THAM SỐ CŨ cùng tồn tại. Trang nào vẽ theo thứ tự "còn lỗi
 *   thì hiện `ErrorState`, không thì hiện data" sẽ hiện khối lỗi của tham số
 *   cũ chồng lên trạng thái đang tải của tham số mới — người dùng đổi ngày
 *   và thấy lỗi của ngày trước đó, dù request mới có thể sẽ thành công.
 */
export function useApiResource<T>(load: () => Promise<T>, deps: readonly unknown[]): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    // Dọn lỗi của THAM SỐ CŨ ngay khi request MỚI bắt đầu — xem đoạn
    // "error được dọn về null…" trong docstring ở trên. `data` cố ý KHÔNG bị
    // xoá ở đây (giữ nguyên cho tới khi có kết quả mới, tránh nhấp nháy).
    setError(null);

    loadRef
      .current()
      .then((result) => {
        if (cancelled) return; // request cũ đã bị thay — bỏ qua, không setState
        setData(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return; // NHÁNH LỖI cũng phải kiểm — luật 2 ở docstring trên
        setError(
          err instanceof ApiError ? err : new ApiError(0, 'NETWORK_ERROR', 'Lỗi không xác định'),
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `deps` do caller kiểm soát nội dung — effect phải chạy lại đúng khi nó
    // đổi (đổi ngày, đổi khoảng biểu đồ…) hoặc khi `reload()` tăng `reloadTick`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadTick]);

  // Không cache (SPEC §8.2): reload() không dùng lại `data` cũ, nó chỉ bump
  // một số để effect ở trên chạy lại từ đầu — y hệt một dependency đổi.
  const reload = useCallback(() => setReloadTick((tick) => tick + 1), []);

  return { data, isLoading, error, reload };
}
