// Tính `from`/`to` cho bộ chọn khoảng (RangePicker). Hàm thuần — nhận
// "hôm nay" như một tham số thay vì tự gọi `todayIso()` bên trong, để test
// không phải phụ thuộc ngày thật lúc chạy (`todayIso()` vẫn là nơi DUY NHẤT
// tính "hôm nay" cho web, `lib/format.ts` — nơi gọi hàm này truyền vào).
//
// Quyết định đã chốt cho SPEC §7.1/§7.2 (xem báo cáo để biết lý do đầy đủ):
// BA nút cố định — 30 / 90 / 365 ngày — KHÔNG có ô "tùy chọn" ở bản này.
// Ba nút cố định không bao giờ sinh `from > to`, không bao giờ chạm biên 730
// ngày (MAX_RANGE_DAYS của backend), và không bao giờ đặt `to` ở tương lai
// (SPEC §7.3 chỉ phát sinh nếu có ô ngày tự do) — tức không cần xử lý `400`
// từ backend ở trang này, khớp gợi ý của chính SPEC §7.2/§7.3.

import { addDaysIso } from './dateMath';

export type RangeOption = '30d' | '90d' | '365d';

export interface DateRange {
  from: string;
  to: string;
}

/** Số ngày lịch của mỗi lựa chọn, TÍNH CẢ `to` — "30 ngày" nghĩa là 30 phần
 * tử trong `days[]` (hôm nay và 29 ngày trước), không phải 30 ngày trước
 * hôm nay cộng thêm hôm nay thành 31. */
const RANGE_DAYS: Record<RangeOption, number> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

export const RANGE_OPTIONS: readonly { value: RangeOption; label: string }[] = [
  { value: '30d', label: '30 ngày' },
  { value: '90d', label: '90 ngày' },
  { value: '365d', label: '1 năm' },
];

/** `option` + "hôm nay" → `{ from, to }`. `to` luôn là hôm nay (ba nút cố
 * định không có khái niệm "xem khoảng đã qua" — đó là việc của một ô ngày
 * tự do, cố ý chưa làm ở bản này). */
export function rangeToDates(option: RangeOption, today: string): DateRange {
  const span = RANGE_DAYS[option];
  return { from: addDaysIso(today, -(span - 1)), to: today };
}
