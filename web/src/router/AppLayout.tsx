import type { KeyboardEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '../components/ui';
import { useSession } from '../features/auth';
import s from './AppLayout.module.css';

// Ba tab điều hướng cấp ứng dụng. Đây là ĐIỀU HƯỚNG THẬT giữa các trang (mỗi
// tab đổi URL sang một route khác), không phải một widget "ARIA tabs" đổi nội
// dung tại chỗ — vì vậy dùng liên kết thật (`NavLink` → thẻ <a>), đúng
// khuyến nghị WAI-ARIA APG cho điều hướng trang: "dùng <nav> + liên kết +
// aria-current, không dùng role=tab cho điều hướng trang".
// (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
//
// `NavLink` tự gắn `aria-current="page"` lên tab đang mở (không chỉ đổi màu
// — SPEC yêu cầu đánh dấu cho công nghệ trợ giúp, không riêng thị giác) và
// tự thêm class được truyền qua hàm khi active, dùng để tô màu.
//
// Enter kích hoạt liên kết theo hành vi mặc định của trình duyệt. Phím
// Space thì KHÔNG kích hoạt thẻ <a> theo đặc tả HTML (chỉ <button> mới có
// hành vi đó) — `handleSpaceActivate` bù thêm đúng phím này mà không đụng gì
// tới hành vi liên kết thật (click chuột giữa mở tab mới, chuột phải "Copy
// link", v.v. vẫn nguyên vẹn vì phần tử vẫn là <a href>).
function handleSpaceActivate(event: KeyboardEvent<HTMLAnchorElement>) {
  if (event.key !== ' ') return;
  event.preventDefault(); // chặn cuộn trang — hành vi mặc định của Space
  event.currentTarget.click();
}

const TABS = [
  { to: '/', label: 'Hôm nay', end: true },
  { to: '/charts', label: 'Biểu đồ', end: false },
  { to: '/settings', label: 'Cài đặt', end: false },
] as const;

/**
 * Bọc ba route đầu (`/`, `/charts`, `/settings` — SPEC §5.2).
 *
 * Guard phiên KHÔNG ở đây mà ở `RequireSession` bọc ngoài trong `routes.tsx` —
 * nhờ vậy layout này luôn chạy với một phiên đã có thật, và `user` dưới đây
 * không bao giờ `null`. Vẫn dùng optional chaining khi đọc email để layout
 * không nổ nếu sau này ai đó cắm nó vào một route công khai.
 */
export function AppLayout() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    // `replace` để nút Back không quay lại trang đã đăng nhập sau khi đăng xuất.
    void navigate('/login', { replace: true });
  }

  return (
    <div className={s.shell}>
      <header className={s.header}>
        <span className={s.brand}>Lean</span>

        <nav className={s.tabs} aria-label="Điều hướng chính">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              onKeyDown={handleSpaceActivate}
              className={({ isActive }) => (isActive ? `${s.tab} ${s.tabActive}` : s.tab)}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {/*
          Nút "Đăng xuất" chỉ render KHI CÓ phiên thật. Bản trước để một nút
          `disabled` làm chỗ chừa và đã bị bỏ vì đúng lý do này: người dùng thấy
          chữ "Đăng xuất" thì mặc định là đang đăng nhập, bấm không được chỉ
          trông như nút hỏng.
        */}
        {user ? (
          <div className={s.identity}>
            <span className={s.identityEmail} title={user.email}>
              {user.displayName ?? user.email}
            </span>
            <Button variant="secondary" onClick={() => void handleSignOut()}>
              Đăng xuất
            </Button>
          </div>
        ) : null}
      </header>

      <main className={s.content}>
        <Outlet />
      </main>
    </div>
  );
}
