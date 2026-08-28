import { createBrowserRouter } from 'react-router';
import { AppLayout } from './AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { TodayPage } from '../features/today';
import { ChartsPage } from '../features/charts';
import { SettingsPage } from '../features/settings';
import { LoginPage, RegisterPage, RequireSession } from '../features/auth';

// `/login` và `/register` KHÔNG dùng `AppLayout` — không có tab nào để bấm khi
// chưa đăng nhập (SPEC §5.2), và chúng phải nằm NGOÀI `RequireSession` nếu
// không sẽ tự chặn chính đường vào.
//
// Ba route dữ liệu nằm trong `RequireSession` → `AppLayout`: mặc định ĐÓNG.
// Thêm một trang cần đăng nhập chỉ là thêm một dòng vào `children` bên dưới;
// không có bước "nhớ khóa route mới" nào để quên.
export const routes = [
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: 'charts', element: <ChartsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
