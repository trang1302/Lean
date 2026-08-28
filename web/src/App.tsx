import { RouterProvider } from 'react-router';
import { router } from './router/routes';
import { SessionProvider } from './features/auth';
import { setOnUnauthorized } from './lib/apiClient';

// Móc thứ 2 mà `apiClient.ts` chừa sẵn: xử lý "hết phiên" (401 UNAUTHORIZED)
// ở ĐÚNG MỘT chỗ, thay cho no-op mặc định.
//
// Gắn ở cấp module chứ không trong một `useEffect`: phiên có thể hết hạn ngay
// ở request đầu tiên, trước khi effect nào kịp chạy.
//
// Dùng `router.navigate` chứ không `window.location.href` — đổi location là
// tải lại cả trang, mất toàn bộ state React và nháy trắng. `apiClient` CỐ Ý
// không gọi hàm này cho `401 INVALID_CREDENTIALS`, nên đăng nhập sai mật khẩu
// không tự đá người dùng ra khỏi `/login`.
setOnUnauthorized(() => {
  const { pathname, search } = window.location;
  if (pathname === '/login' || pathname === '/register') return;
  void router.navigate(`/login?next=${encodeURIComponent(`${pathname}${search}`)}`, {
    replace: true,
  });
});

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
