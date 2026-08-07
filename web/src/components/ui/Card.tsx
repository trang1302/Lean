import type { HTMLAttributes, ReactNode } from 'react';
import s from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Tiêu đề hiển thị trong thẻ. Đặt tên `heading`, KHÔNG `title` — `title`
   * đã là thuộc tính native của `<div>` (tooltip khi hover), đặt trùng tên
   * sẽ đè kiểu `string | undefined` của HTMLAttributes lên `ReactNode` mà
   * ta cần (TS báo lỗi kế thừa không tương thích ngay khi build). */
  heading?: ReactNode;
  children: ReactNode;
}

/**
 * Khung thẻ dùng chung — bo góc, viền, khoảng đệm. Không state, không hành
 * vi — thuần trình bày (SPEC §1.1: `web-shell` không render nội dung riêng
 * của trang nào, `heading`/`children` do trang truyền vào).
 */
export function Card({ heading, children, className, ...rest }: CardProps) {
  return (
    <div className={[s.card, className].filter(Boolean).join(' ')} {...rest}>
      {heading ? <h2 className={s.title}>{heading}</h2> : null}
      {children}
    </div>
  );
}
