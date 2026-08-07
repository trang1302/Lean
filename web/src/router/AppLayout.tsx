import type { KeyboardEvent } from 'react';
import { NavLink, Outlet } from 'react-router';
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
 * Bọc ba route đầu (`/`, `/charts`, `/settings` — SPEC §5.2). Chưa có guard
 * phiên ở đây — đó là Bước 10, cần backend `auth`. Vùng danh tính + nút đăng
 * xuất chỉ CHỪA CHỖ: chưa có `SessionContext` (Bước 9) nên chưa có tên người
 * dùng thật để hiện, và nút đăng xuất chưa có gì để gọi — cố tình để
 * `disabled` thay vì gắn một handler rỗng giả vờ hoạt động.
 */
export function AppLayout() {
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

        <div className={s.identity}>
          {/* Chỗ cho danh tính người dùng — nạp thật ở Bước 9 (SessionContext). */}
          {/*
            KHÔNG render nút "Đăng xuất" khi chưa có phiên đăng nhập.

            Bản trước để một nút `disabled` làm chỗ chừa. Nhưng người dùng thấy
            chữ "Đăng xuất" thì mặc định là đang đăng nhập — bấm không được chỉ
            trông như nút hỏng, không nói được rằng tính năng chưa tồn tại.
            `title` giải thích chỉ hiện khi rê chuột, mà người ta thì bấm.

            Bước 9 dựng `SessionContext`: render nút ở ĐÂY, chỉ khi có phiên thật,
            và thay `identityPlaceholder` bằng tên người dùng.
          */}
          <span className={s.identityPlaceholder}>chưa đăng nhập</span>
        </div>
      </header>

      <main className={s.content}>
        <Outlet />
      </main>
    </div>
  );
}
