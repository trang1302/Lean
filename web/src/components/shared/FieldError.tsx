import s from './FieldError.module.css';

interface FieldErrorProps {
  /** id CỦA Ô NHẬP (input/select) — không phải id của thẻ <p> này. Thẻ <p>
   * tự sinh id là `${id}-error` theo cùng công thức mà Input/NumberInput/
   * Select dùng cho `aria-describedby`, để hai bên luôn khớp nhau. */
  id: string;
  message: string;
}

/**
 * Thông báo lỗi field-level, render NGAY DƯỚI ô nhập liên quan
 * (docs/features/web-shell/SPEC.md §7.3 — đường đi `fields[]` → từng ô
 * nhập, chốt component chung ở đây một lần cho cả ba trang thay vì mỗi
 * trang tự vẽ khối lỗi riêng).
 *
 * CỐ Ý không có `role="alert"` — role đó dành riêng cho `ErrorState` cấp
 * trang (SPEC §7.1: "rỗng ≠ lỗi", và ranh giới đó mở rộng ra: lỗi-cấp-trang
 * và lỗi-cấp-ô là hai kênh khác nhau). Một form nhiều ô sai cùng lúc mà mỗi
 * `FieldError` đều `role="alert"` sẽ khiến trình đọc màn hình đọc chồng lấp
 * nhiều thông báo cùng lúc lúc submit — tệ hơn là không đọc gì.
 *
 * **HỆ QUẢ của quyết định trên, đọc trước khi dùng component này:**
 * `aria-invalid` là thuộc tính TĨNH (chỉ được trình đọc màn hình đọc lên khi
 * người dùng TAB TỚI đúng ô đó) và `aria-describedby` chỉ đọc kèm khi ô đó
 * đang được focus. Không có gì trong cặp `Input`/`Select` + `FieldError`
 * CHỦ ĐỘNG công bố khi submit thất bại. Kịch bản cụ thể: người dùng trình
 * đọc màn hình bấm Lưu, server trả `400` với 3 lỗi trong `fields[]` — focus
 * vẫn đứng ở nút Lưu, không có gì được đọc lên, người dùng không biết có
 * lỗi, không biết có 3 lỗi, không biết vì sao "không có chuyện gì xảy ra".
 *
 * **TRANG GỌI PHẢI TỰ LO việc công bố này** — `FieldError` không và không
 * thể tự làm (nó không biết khi nào một lần submit vừa thất bại, chỉ biết
 * "tôi có một message để hiện"). Tối thiểu một trong hai, nên làm cả hai:
 *   1. Đưa focus (`.focus()`) về Ô LỖI ĐẦU TIÊN ngay sau khi submit thất bại.
 *   2. Một live-region tổng hợp cấp form (`aria-live="polite"`, hoặc
 *      `role="alert"` — ở ĐÂY dùng được vì chỉ có MỘT vùng, không phải một
 *      cho mỗi ô) kiểu "Có 3 lỗi cần sửa", bắn ra đúng lúc `fields[]` mới về.
 * Đây là khoảng trống kiến trúc, không phải bug của Bước 5 (chưa có logic
 * submit nào ở tầng này) — nhưng nếu không ghi lại, ba trang (`today`,
 * `charts`, `settings`) sẽ tự dựng submit mà không ai nhớ bù chỗ này, đúng
 * kiểu lệch mà `docs/features/web-shell/PLAN.md` cảnh báo về `aria-invalid`.
 */
export function FieldError({ id, message }: FieldErrorProps) {
  return (
    <p id={`${id}-error`} className={s.fieldError}>
      {message}
    </p>
  );
}
