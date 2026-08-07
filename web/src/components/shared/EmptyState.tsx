import type { ReactNode } from 'react';
import s from './EmptyState.module.css';

interface EmptyStateProps {
  message: ReactNode;
}

/**
 * Trạng thái "lấy được rồi nhưng không có gì" (SPEC §7.1) — ranh giới quan
 * trọng nhất của mục này: **rỗng KHÔNG PHẢI lỗi**. Component này CỐ Ý:
 *   - không có `role="alert"` (role đó dành riêng cho `ErrorState`);
 *   - không dùng biến màu `--color-danger*` (đó là màu của `ErrorState`).
 * Hai ca chuẩn theo SPEC: `GET /body-logs/:date` 404 = "chưa ghi" (không
 * phải lỗi), `GET /summary` trên DB trắng vẫn trả `days` đủ độ dài toàn
 * `null` (rỗng không đồng nghĩa mảng rỗng).
 *
 * Câu chữ cụ thể ("Chưa ghi bữa nào cho ngày này." / "Cần ít nhất 2 ngày dữ
 * liệu để vẽ xu hướng") do TỪNG TRANG quyết định qua `message` — component
 * chung không đoán hộ điều kiện "khi nào là rỗng" của một trang cụ thể.
 */
export function EmptyState({ message }: EmptyStateProps) {
  return <div className={s.emptyState}>{message}</div>;
}
