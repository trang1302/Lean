import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingState } from '../../../components/shared';
import { useSession } from '../hooks/useSession';

/**
 * Bọc các route cần đăng nhập. Mặc định là ĐÓNG: route nào muốn công khai thì
 * đặt ngoài phần tử này trong `routes.tsx`, không phải tự nhớ khóa từng route.
 *
 * PHẢI chờ `loading === false` trước khi điều hướng. Coi `user === null` lúc
 * đang nạp là "chưa đăng nhập" sẽ đá người dùng có phiên hợp lệ về `/login`
 * trong khoảnh khắc đầu mỗi lần tải trang (rồi lại quay về) — nhảy màn hình
 * mỗi lần F5.
 */
export function RequireSession() {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) return <LoadingState label="Đang kiểm tra phiên đăng nhập…" />;

  if (!user) {
    // Mang đường dẫn đang muốn vào theo `?next=` để sau khi đăng nhập quay lại
    // đúng chỗ, không phải luôn về trang chủ. `LoginPage` chỉ nhận lại giá trị
    // này khi nó là đường dẫn nội bộ.
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
