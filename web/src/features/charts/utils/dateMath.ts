// Số học ngày lịch thuần cho `features/charts/` — CHỈ cộng/trừ số ngày trên
// chuỗi "YYYY-MM-DD" và so sánh thứ tự. Không phải logic thống kê (không có
// gì ở đây tính MA7/tốc độ/…, xem docs/features/web-charts/PLAN.md §5.3:
// "đừng tính lại thống kê ở client"), chỉ là số học lịch phục vụ việc CHỌN
// khoảng ngày (`RangePicker`) và LỌC tuần cắt cụt (`dropTruncatedWeeks`).
//
// Cố ý dùng `Date.UTC(...)` + getters UTC, KHÔNG dùng `new Date(iso)` rồi đọc
// giờ máy — "date" trong toàn app là NHÃN NGÀY LỊCH, không phải một thời
// điểm (docs/overview/04-conventions.md). Dùng mốc UTC thuần cho phép cộng
// trừ ngày mà không bao giờ vô tình lệch sang ngày trước/sau vì DST hay
// timezone của máy chạy trình duyệt — ta không bao giờ đọc giờ thật từ nó.

/** "YYYY-MM-DD" → cộng (hoặc trừ, nếu `days` âm) số ngày, trả "YYYY-MM-DD". */
export function addDaysIso(iso: string, days: number): string {
  const parts = iso.split('-');
  // `noUncheckedIndexedAccess` (tsconfig.json) làm truy cập theo chỉ số của
  // MỌI mảng thường (không phải tuple cố định) ra `T | undefined`, kể cả
  // khi biết chắc `iso` đúng dạng "YYYY-MM-DD" và luôn có 3 phần — `?? NaN`
  // tôn trọng cờ đó (cùng cách Button.tsx dùng `?? ''`) mà không cần `!`.
  const year = Number(parts[0] ?? NaN);
  const month = Number(parts[1] ?? NaN);
  const day = Number(parts[2] ?? NaN);
  const utcMs = Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000;
  const d = new Date(utcMs);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
