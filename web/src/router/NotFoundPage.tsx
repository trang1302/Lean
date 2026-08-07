import { Link } from 'react-router';
import s from './NotFoundPage.module.css';

// Route "còn lại" của bảng 4 route (docs/features/web-shell/SPEC.md §5.2).
// Không có nội dung nghiệp vụ nào ở đây — chỉ một thông báo và một lối quay
// lại "/", nên không thuộc phạm vi của bất kỳ trang nào trong ba trang.
export function NotFoundPage() {
  return (
    <main className={s.wrap}>
      <h1>404 — Không tìm thấy trang</h1>
      <p>Đường dẫn này không tồn tại trong ứng dụng.</p>
      <Link to="/" className={s.link}>
        Về trang Hôm nay
      </Link>
    </main>
  );
}
