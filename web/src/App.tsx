import { RouterProvider } from 'react-router';
import { router } from './router/routes';

// `SessionProvider` (Bước 9, docs/features/web-shell/PLAN.md) sẽ bọc
// `RouterProvider` ở đây khi `features/auth/` dựng xong — chưa có ở Bước 7
// vì chưa có backend `auth` để nạp phiên. Hiện tại `App` chỉ là router.
export function App() {
  return <RouterProvider router={router} />;
}
