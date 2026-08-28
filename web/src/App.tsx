import { RouterProvider } from 'react-router';
import { router } from './router/routes';
import { SessionProvider } from './features/auth';
import { currentCsrfToken } from './features/auth/api/auth.api';
import { setCsrfTokenProvider, setOnUnauthorized } from './lib/apiClient';

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

// Móc thứ nhất mà `apiClient.ts` chừa sẵn. Cắm ở cấp module cùng lý do với
// `setOnUnauthorized`: request ghi đầu tiên có thể xảy ra trước khi effect nào
// kịp chạy. Hàm đọc đồng bộ từ bộ nhớ module của `auth.api.ts`; việc đi lấy
// token là của `refreshCsrfToken`, do `SessionProvider` gọi lúc khởi động.
setCsrfTokenProvider(currentCsrfToken);

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
