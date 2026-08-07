// Hàm thuần dùng chung cho định dạng ngày/số trong toàn bộ `web/`. Không
// React, không gọi API — xem docs/features/web-shell/SPEC.md §3.4.

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Ngày hôm nay theo Asia/Ho_Chi_Minh, dạng "YYYY-MM-DD" — CỨNG theo
 * timezone này, không theo giờ máy chạy trình duyệt. Chốt cho câu hỏi mở
 * docs/features/web-today/SPEC.md §7 câu 4, phương án (b): server chặn
 * ngày tương lai theo cùng timezone (server/src/lib/time.ts); client tính
 * "hôm nay" theo giờ máy sẽ có lúc cho phép chọn một ngày mà server coi
 * là tương lai → 400 ở path "date" ngay lần bấm lưu đầu tiên.
 *
 * KHÔNG dùng `new Date().toISOString().slice(0, 10)` — đó là ngày theo
 * UTC, lệch múi giờ VN (ví dụ 17:00–24:00 UTC đã sang ngày mới theo VN).
 */
export function todayIso(): string {
  // 'en-CA' cho ra đúng định dạng YYYY-MM-DD — cùng cách server tính
  // (server/src/lib/time.ts). Cố tình lặp lại logic thay vì import: client
  // và server chạy khác runtime (trình duyệt / Node), không chia sẻ module
  // được, nên đây là hai bản độc lập có chủ đích, không phải trùng lặp cẩu thả.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/**
 * "YYYY-MM-DD" → "dd/MM" cho trục X của biểu đồ. Cắt chuỗi trực tiếp,
 * KHÔNG đi qua `new Date()` — parse rồi format lại theo giờ máy đúng là
 * lỗi lệch múi giờ mà cả dự án đang tránh (`date` là nhãn ngày lịch,
 * không phải một thời điểm — xem 04-conventions.md).
 */
export function formatDateShort(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

/**
 * "YYYY-MM-DD" cho tooltip. Identity có chủ đích: `date` trong toàn app
 * luôn đã ở đúng định dạng này (quy ước, không phải Date/DateTime). Hàm
 * này tồn tại để chỗ gọi nói rõ ý định ("đây là nhãn ĐẦY ĐỦ cho tooltip",
 * đối lập với `formatDateShort`), không phải để biến đổi giá trị.
 */
export function formatDateFull(iso: string): string {
  return iso;
}

/**
 * Định dạng số có dấu phân cách hàng nghìn kiểu Việt Nam (vd. `1234` →
 * `"1.234"`, `72.4` → `"72,4"`).
 *
 * CHỈ dùng để HIỂN THỊ (text, tooltip, nhãn) — KHÔNG dùng làm `value` của
 * `<input type="number">`. Ô nhập cân nặng/vòng bụng của trang Hôm nay là
 * `<input type="number" step="0.1">` (docs/features/web-today/SPEC.md
 * §7 dòng ~157, ~176); phần tử này CHỈ chấp nhận chuỗi số kiểu US
 * (dấu `.` thập phân, không dấu phân cách nghìn) — gán `"72,4"` hay
 * `"1.840"` vào `value` của nó khiến trình duyệt coi là không hợp lệ và
 * hiển thị Ô RỖNG, không báo lỗi gì. Muốn giá trị thô cho input thì dùng
 * thẳng số gốc (`String(value)`), không đi qua hàm này.
 *
 * Cũng KHÔNG parse ngược kết quả bằng `Number()`/`parseFloat()` —
 * `Number("72,4")` ra `NaN` một cách im lặng vì dấu phẩy không phải cú
 * pháp số của JS. Hàm này một chiều: số → chuỗi hiển thị, không có chiều
 * ngược lại.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

/**
 * `value` là một số đo có thể vắng mặt (chưa ghi cân nặng/vòng bụng hôm
 * đó, hoặc MA7 chưa đủ điểm — xem movingAverage.ts). Trả '—', KHÔNG phải
 * '0 kg'/'null kg'/'' — số 0 là một giá trị đo thật (vd. có thể là hằng
 * số hợp lệ ở phép đo khác), không được lẫn với "chưa có dữ liệu".
 *
 * Đi qua `formatNumber` nên thừa hưởng NGUYÊN VẸN giới hạn của nó: kết
 * quả (`"72,4 kg"`, `"—"`) chỉ để HIỂN THỊ, không dùng làm `value` cho
 * input người dùng sửa được và không parse ngược — xem docstring của
 * `formatNumber` để biết hậu quả cụ thể (ô input hóa rỗng, `Number()`
 * ngược ra `NaN` im lặng).
 */
export function formatNullable(value: number | null, unit: string): string {
  if (value === null) return '—';
  return `${formatNumber(value)} ${unit}`;
}
