// Trạng thái rỗng CỦA TỪNG BIỂU ĐỒ (SPEC §6) — khác trạng thái "đang tải"
// (`LoadingState`) và "đã hỏi, không lấy được" (`ErrorState`, cấp trang,
// xem `ChartsPage`). Bọc `EmptyState` dùng chung (`components/shared`) với
// chiều cao cố định khớp `chartWrapper` của các chart thật, để chuyển từ
// rỗng → có dữ liệu không làm trang giật cục (đổi chiều cao đột ngột).
import { EmptyState } from '../../../components/shared';
import s from './ChartEmptyState.module.css';

interface ChartEmptyStateProps {
  message?: string;
}

/** Câu chữ mặc định đúng nguyên văn spec gốc (docs/archive/2026-08-06-original-design.md
 * §7 "Xử lý trạng thái rỗng") — không phải một biến thể tự nghĩ ra. */
const DEFAULT_MESSAGE = 'Cần ít nhất 2 ngày dữ liệu để vẽ xu hướng.';

export function ChartEmptyState({ message = DEFAULT_MESSAGE }: ChartEmptyStateProps) {
  return (
    <div className={s.wrapper}>
      <EmptyState message={message} />
    </div>
  );
}
