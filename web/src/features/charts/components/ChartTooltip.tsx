// Tooltip dùng chung cho ba biểu đồ — Recharts gọi `content` với `active`/
// `payload`/`label`, kiểu ở đây chỉ khai đúng phần được dùng (Recharts 3
// không export một kiểu `TooltipContentProps` đơn giản dễ tái dùng qua
// generic, xem comment tại chỗ dùng). Tập trung định dạng ở một chỗ để cả
// ba biểu đồ xử lý `null` giống nhau (SPEC §5.3: "formatter phải xử lý null
// → '—', không để lọt NaN/null/0 giả").
import type { ReactNode } from 'react';
import { formatDateFull } from '../../../lib/format';
import s from './ChartTooltip.module.css';

export interface ChartTooltipRow {
  label: string;
  /** Chuỗi ĐÃ định dạng xong (qua `formatNullable`/`formatNumber`, hoặc một
   * câu chữ đặc biệt như "Không ghi bữa nào") — component này không tự
   * format số, tránh mỗi chart viết lại quy tắc `null → '—'` một kiểu khác. */
  value: ReactNode;
}

interface ChartTooltipProps {
  active?: boolean;
  /** Kiểu `label` của Recharts 3 là `string | number` (trục X có thể mang
   * giá trị số ở biểu đồ khác) — ở cả ba biểu đồ của trang này, giá trị
   * THẬT LUÔN LÀ chuỗi "YYYY-MM-DD" (SPEC §2.2/§2.3, `dataKey="date"`).
   * `String(label)` ở dưới chỉ để khớp kiểu rộng của Recharts, không đổi
   * giá trị — không phải `new Date()` (đó mới là lỗi lệch múi giờ cần
   * tránh, docs/overview/04-conventions.md). */
  label?: string | number;
  rows: ChartTooltipRow[];
}

/** Hiện đủ "YYYY-MM-DD" trong tooltip (SPEC §5.3) — trục X chỉ hiện `dd/MM`
 * rút gọn, mơ hồ về năm trên biểu đồ 1 năm nếu không có tooltip đầy đủ. */
export function ChartTooltip({ active, label, rows }: ChartTooltipProps) {
  if (!active || label === undefined) return null;
  return (
    <div className={s.tooltip}>
      <p className={s.date}>{formatDateFull(String(label))}</p>
      {rows.map((row) => (
        <p key={row.label} className={s.row}>
          <span className={s.rowLabel}>{row.label}</span>
          <span className={s.rowValue}>{row.value}</span>
        </p>
      ))}
    </div>
  );
}
