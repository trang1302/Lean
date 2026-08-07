import s from './LoadingState.module.css';

interface LoadingStateProps {
  /** Câu chữ tuỳ ngữ cảnh ("Đang tải dữ liệu ngày…"). Mặc định đủ dùng cho
   * hầu hết chỗ gọi — SPEC §7.1 không yêu cầu câu chữ riêng theo trang. */
  label?: string;
}

/**
 * Trạng thái "chưa biết" (docs/features/web-shell/SPEC.md §7.1) — khác
 * `ErrorState` (đã hỏi, không lấy được) và khác `EmptyState` (lấy được rồi,
 * không có gì). `role="status"` + `aria-live="polite"` để trình đọc màn
 * hình biết đang tải mà KHÔNG ngắt lời như `role="alert"` của `ErrorState`.
 */
export function LoadingState({ label = 'Đang tải…' }: LoadingStateProps) {
  return (
    <div className={s.loadingState} role="status" aria-live="polite">
      {label}
    </div>
  );
}
