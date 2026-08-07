import { useCallback, useState } from 'react';
import { ApiError, type FieldError } from '../types/api';

export interface UseFieldErrorsResult {
  /** `path → message`, chỉ cho những `path` có mặt trong `knownFields` truyền
   * vào hook — đây là những lỗi trang biết cách render ngay dưới một ô nhập
   * cụ thể bằng component `FieldError` (SPEC §7.3). */
  fieldErrors: Record<string, string>;
  /** Lỗi có `path` KHÔNG thuộc `knownFields` — vd. `path: "date"` khi form
   * chỉ có ô `weightKg`/`waistCm`. SPEC §7.3 cấm nuốt im lặng nhóm này; trang
   * phải có một chỗ hiển thị lỗi cấp form riêng cho danh sách này. */
  formErrors: FieldError[];
  /** Tổng số lỗi hiện có (field + form) — 0 khi không có lỗi nào. */
  errorCount: number;
  /** `path` của lỗi ĐẦU TIÊN theo đúng thứ tự server trả về trong `fields[]`
   * (server không sắp xếp lại — trả đúng thứ tự Zod phát hiện). Dành cho
   * trang tự đưa focus về ô lỗi đầu tiên sau khi submit hỏng — xem "Quyết
   * định" trong docstring `useFieldErrors` bên dưới về vì sao hook DỪNG Ở
   * ĐÂY, không tự gọi `.focus()`.
   *
   * **CẢNH BÁO — `firstErrorPath` KHÔNG đảm bảo có ô nhập DOM tương ứng.**
   * `fields[]` không được sắp xếp lại theo "đã map được vào ô hay chưa" —
   * phần tử đầu tiên có thể thuộc `formErrors` (path không nằm trong
   * `knownFields`, vd. `"date"` ở một form không có ô ngày). Trang gọi
   * `document.getElementById(firstErrorPath)?.focus()` mà không kiểm tra
   * trước sẽ IM LẶNG không làm gì trong ca đó: không lỗi, không focus, người
   * dùng bấm Lưu và không thấy phản hồi nào — bẫy tinh vi vì `formErrors`/
   * `summary` vẫn mang đủ thông tin (không nuốt lỗi), chỉ riêng hành vi focus
   * là câm. Trang PHẢI tự kiểm `firstErrorPath` có nằm trong `fieldErrors`
   * hay không trước khi gọi `.focus()`, và có phương án dự phòng khi không
   * (vd. focus vào chính vùng tổng hợp lỗi cấp form đang hiện `summary`). */
  firstErrorPath: string | null;
  /** Câu tổng hợp tiếng Việt kiểu "Có 3 lỗi cần sửa.", `null` khi không có
   * lỗi. Dành cho trang bắn vào một live-region cấp form (`aria-live` hoặc
   * `role="alert"` — ĐÚNG MỘT vùng cho cả form, khác với `FieldError` từng ô
   * cố ý không có `role="alert"`, xem docstring `FieldError`). */
  summary: string | null;
  /** Nạp lỗi mới sau một lần gọi API hỏng. Truyền `null` hoặc một `ApiError`
   * không có `fields[]` (vd. lỗi mạng, `500`) đều dọn về trạng thái "không có
   * lỗi field nào" — hook này chỉ có ý nghĩa với `400 VALIDATION_ERROR`. */
  setError: (error: ApiError | null) => void;
  /** Xoá sạch mọi lỗi đang giữ. SPEC §7.3: "Xoá toàn bộ lỗi cũ trước mỗi lần
   * gửi" — gọi `reset()` ngay trước khi bắn request ghi, không đợi response
   * mới về mới xoá, để lỗi tồn đọng của lần trước trên một ô đã sửa đúng
   * không còn hiển thị trong lúc chờ. */
  reset: () => void;
}

/**
 * `useFieldErrors` — biến `ApiError.fields[]` (từ `400 VALIDATION_ERROR`)
 * thành thứ UI render được: `Record<path, message>` cho từng ô nhập, cộng
 * một danh sách lỗi cấp form cho `path` không map được vào ô nào (SPEC
 * §7.3). Dùng chung cho `web-today` VÀ `web-settings` — chuyển từ
 * `features/today/hooks/` (dự kiến ban đầu của `web-today/PLAN.md` §3) lên
 * đây theo brief Bước 6, vì `web-settings` cần đúng cùng hành vi.
 *
 * `knownFields` là danh sách `path` mà FORM ĐANG MỞ thật sự có ô nhập tương
 * ứng — hook không tự đoán. Đây là điểm mấu chốt của test "`path: 'date'`
 * rơi vào nhóm lỗi cấp form khi form không có ô `date`": cùng một `path`
 * `"date"` có thể là lỗi field-level ở `DatePicker` (nếu `knownFields` khai
 * `'date'`) hoặc lỗi cấp form ở một form không có ô ngày (vd. form sửa một
 * bữa ăn theo `id`, nhưng server validate `date` trong body) — hook không có
 * cách nào tự biết trừ khi được cho biết.
 *
 * Hàm thuần bên trong (map `fields[]` → hai nhóm) không gọi API — chỉ phần
 * giữ state (`setError`/`reset`) cần là hook.
 *
 * ---
 * ### Quyết định: hook dừng ở dữ liệu, KHÔNG tự làm side-effect DOM/focus
 *
 * `FieldError.tsx` (Bước 5) để lại một khoảng trống kiến trúc: bỏ
 * `role="alert"` trên từng ô (tránh nhiều alert đọc chồng lấp) có nghĩa là
 * không có gì CHỦ ĐỘNG công bố "có N lỗi" hay đưa focus về ô sai khi submit
 * thất bại — trang gọi phải tự lo (xem docstring `FieldError`).
 *
 * Hook này trả `firstErrorPath` và `summary` để trang **không phải tự viết
 * lại** phần tính toán (thứ tự lỗi nào là đầu tiên, đếm tổng số lỗi, ghép
 * câu tiếng Việt) — đó là dữ liệu thuần, đúng ranh giới "hàm thuần hoặc hook
 * mỏng" của SPEC.
 *
 * Nhưng hook CỐ Ý KHÔNG tự gọi `document.getElementById(path)?.focus()` hay
 * tự dựng một `<div aria-live>` — hai lý do:
 * 1. Hook không biết ô nhập nào tương ứng với `path` nằm ở đâu trong DOM
 *    (id, ref, có đang render hay không) — đó là kiến thức của trang, không
 *    phải của hook dùng chung.
 * 2. Nhét side-effect DOM vào một hook lẽ ra chỉ biến đổi dữ liệu sẽ làm nó
 *    khó test (phải mock DOM thay vì chỉ assert object trả về) và khó tái sử
 *    dụng cho ca không cần focus (vd. `web-settings` có thể muốn hành vi
 *    khác `web-today`).
 *
 * Trang gọi vẫn phải tự làm tối thiểu một trong hai việc `FieldError.tsx` đã
 * nêu, dùng `firstErrorPath`/`summary` do hook này cung cấp:
 * 1. Sau khi `setError(err)` với lỗi thật, `useEffect` của TRANG (không phải
 *    của hook) đọc `firstErrorPath`, tìm đúng phần tử DOM và gọi `.focus()`.
 *    **Kiểm `firstErrorPath` có nằm trong `fieldErrors` trước** (xem cảnh báo
 *    ở JSDoc của trường này) — nó có thể là một lỗi cấp form, không có ô DOM
 *    nào để focus; ca đó cần một phương án dự phòng (focus vào vùng tổng hợp
 *    lỗi thay vì im lặng không làm gì).
 * 2. Render `summary` vào một live-region cấp form.
 */
export function useFieldErrors(knownFields: readonly string[] = []): UseFieldErrorsResult {
  const [fields, setFields] = useState<FieldError[]>([]);

  const setError = useCallback((error: ApiError | null) => {
    // Không có `fields[]` (lỗi mạng, 500, hoặc null) → không có gì để map;
    // KHÔNG ném lỗi, chỉ đơn giản là danh sách rỗng (ErrorState cấp trang lo
    // phần hiển thị của những lỗi đó, không phải hook này — SPEC §7.2).
    setFields(error?.fields ?? []);
  }, []);

  const reset = useCallback(() => setFields([]), []);

  const known = new Set(knownFields);
  const fieldErrors: Record<string, string> = {};
  const formErrors: FieldError[] = [];

  for (const f of fields) {
    if (known.has(f.path)) {
      fieldErrors[f.path] = f.message;
    } else {
      // path không map được vào ô nào của form đang mở — KHÔNG nuốt im lặng
      // (SPEC §7.3), rơi vào nhóm lỗi cấp form.
      formErrors.push(f);
    }
  }

  const errorCount = fields.length;
  const firstErrorPath = fields.length > 0 ? (fields[0]?.path ?? null) : null;
  const summary = errorCount > 0 ? `Có ${errorCount} lỗi cần sửa.` : null;

  return { fieldErrors, formErrors, errorCount, firstErrorPath, summary, setError, reset };
}
