import { createBrowserRouter } from 'react-router';
import { AppLayout } from './AppLayout';
import { NotFoundPage } from './NotFoundPage';

// Bốn placeholder tối giản — SPEC §1.1: "web-shell không render một ô nhập
// cân nặng, một biểu đồ, hay một công tắc nhắc nhở nào." Ba trang chưa tồn
// tại (`features/{today,charts,settings}/` rỗng) nên đây CHỈ là chỗ giữ
// đường dẫn hoạt động, hiển nhiên là giữ chỗ (không phải nội dung thật nửa
// vời). `/login` cũng còn là giữ chỗ — trang thật (`LoginPage`) thuộc Bước 9
// của docs/features/web-shell/PLAN.md, cần backend `auth`.
//
// Khi một trang xong: đổi import ở đầu file này sang
// `import { TodayPage } from '../features/today'` (v.d.) và thay component
// giữ chỗ tương ứng trong bảng route bên dưới bằng nó — MỘT FILE, một cụm
// thay đổi nhỏ (thêm 1 dòng import + đổi 1 dòng JSX `element` + xoá hàm giữ
// chỗ không dùng nữa), không đụng gì khác trong file, và các trang khác/
// `AppLayout` không đụng lại (SPEC §1.1, PLAN §2.2: "mỗi trang chạm đúng một
// dòng đăng ký route" — đọc là "một điểm đăng ký", không phải nghĩa đen
// "một dòng văn bản duy nhất").
function TodayPlaceholder() {
  return <p>Trang Hôm nay — giữ chỗ, chờ feature `web-today`.</p>;
}

function ChartsPlaceholder() {
  return <p>Trang Biểu đồ — giữ chỗ, chờ feature `web-charts`.</p>;
}

function SettingsPlaceholder() {
  return <p>Trang Cài đặt — giữ chỗ, chờ feature `web-settings`.</p>;
}

function LoginPlaceholder() {
  return <p>Trang Đăng nhập — giữ chỗ, chờ Bước 9 (`features/auth`).</p>;
}

// Bốn route của SPEC §5.2, cộng `NotFoundPage` cho "còn lại". `AppLayout`
// bọc đúng ba route đầu (thanh tab); `/login` KHÔNG dùng `AppLayout` — không
// có tab để bấm khi chưa đăng nhập (SPEC §5.2). Chưa có `RequireSession`
// (guard) bọc ba route đầu — đó là Bước 10, cần backend `auth` (điều phối
// viên B1: "route guard không thuộc bước này").
export const routes = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayPlaceholder /> },
      { path: 'charts', element: <ChartsPlaceholder /> },
      { path: 'settings', element: <SettingsPlaceholder /> },
    ],
  },
  { path: 'login', element: <LoginPlaceholder /> },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
