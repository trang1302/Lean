import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

// `createMemoryRouter` thay vì `createBrowserRouter` — test không nên đụng
// `window.history` thật, và `initialEntries` cho phép mô phỏng "vào thẳng
// một đường dẫn" (đúng ca F5 ở deliverable Bước 7) mà không cần render lại
// từ "/" trước.
//
// Dự án CHƯA cài `@testing-library/jest-dom` (không file test nào khác dùng
// `toBeInTheDocument`/`toHaveAttribute`) — dùng đúng idiom đã có trong repo:
// `toBeTruthy()`/`toBeNull()` cho sự hiện diện, đọc thuộc tính DOM trực tiếp
// cho `aria-current`/`disabled`. Không âm thầm thêm một dependency test mới
// ở bước này.
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('router: 4 route + NotFoundPage (SPEC §5.2)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Bằng chứng "không lỗi console" — không chỉ khẳng định bằng lời.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('render ở "/" → placeholder Hôm nay, không phải của Cài đặt hay Biểu đồ', () => {
    renderAt('/');
    expect(screen.getByText(/Trang Hôm nay/)).toBeTruthy();
    expect(screen.queryByText(/Trang Cài đặt/)).toBeNull();
    expect(screen.queryByText(/Trang Biểu đồ/)).toBeNull();
  });

  it('render thẳng ở "/settings" (mô phỏng F5) → placeholder Cài đặt, KHÔNG phải Hôm nay', () => {
    // Đây là ca "F5 ở /charts vẫn ở /charts" của deliverable: vào thẳng route
    // qua initialEntries (không đi qua click) và không bị văng về "/".
    renderAt('/settings');
    expect(screen.getByText(/Trang Cài đặt/)).toBeTruthy();
    expect(screen.queryByText(/Trang Hôm nay/)).toBeNull();
  });

  it('render thẳng ở "/charts" (mô phỏng F5) → vẫn ở /charts, không văng về "/"', () => {
    renderAt('/charts');
    expect(screen.getByText(/Trang Biểu đồ/)).toBeTruthy();
    expect(screen.queryByText(/Trang Hôm nay/)).toBeNull();
  });

  it('đường dẫn lạ "/khong-co" → NotFoundPage, không phải màn hình trắng', () => {
    renderAt('/khong-co');
    expect(screen.getByRole('heading', { name: /404/ })).toBeTruthy();
  });

  it('render "/login" → placeholder Đăng nhập, KHÔNG có thanh tab (route này không dùng AppLayout)', () => {
    // Đây là điểm khác biệt cấu trúc quan trọng nhất của "/login" so với ba
    // route kia (SPEC §5.2: "/login không dùng AppLayout — không có tab để
    // bấm khi chưa đăng nhập"). Trước bản sửa này, "/login" không được
    // render ở bất kỳ test nào trong file — lỗ hổng do reviewer phát hiện.
    renderAt('/login');
    expect(screen.getByText(/Trang Đăng nhập/)).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Hôm nay' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
  });

  // Trước bản sửa này, test dưới đây chỉ `renderAt('/')` một lần dù tên test
  // nói "bất kỳ route nào trong bốn route" — ba route kia (dù có render ở
  // các `it` khác trong cùng `beforeEach` mock) không có assertion riêng, nên
  // nếu chúng thật sự log lỗi, test vẫn xanh. Lặp tường minh qua cả bốn route
  // và assert cho từng route (reviewer phát hiện, Important 1).
  const ALL_FOUR_ROUTES = ['/', '/charts', '/settings', '/login'];

  it.each(ALL_FOUR_ROUTES)('không gọi console.error khi render route "%s"', (path) => {
    renderAt(path);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('AppLayout: thanh tab — click, đường dẫn đổi, tab đang mở được đánh dấu', () => {
  it('bấm qua lại ba tab bằng chuột → nội dung và đường dẫn đổi đúng', async () => {
    const user = userEvent.setup();
    renderAt('/');

    expect(screen.getByText(/Trang Hôm nay/)).toBeTruthy();

    await user.click(screen.getByRole('link', { name: 'Biểu đồ' }));
    expect(screen.getByText(/Trang Biểu đồ/)).toBeTruthy();
    expect(screen.queryByText(/Trang Hôm nay/)).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Cài đặt' }));
    expect(screen.getByText(/Trang Cài đặt/)).toBeTruthy();
    expect(screen.queryByText(/Trang Biểu đồ/)).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Hôm nay' }));
    expect(screen.getByText(/Trang Hôm nay/)).toBeTruthy();
  });

  it('tab đang mở mang aria-current="page" — đánh dấu cho công nghệ trợ giúp, không chỉ màu sắc', async () => {
    const user = userEvent.setup();
    renderAt('/');

    const homeTab = screen.getByRole('link', { name: 'Hôm nay' });
    const chartsTab = screen.getByRole('link', { name: 'Biểu đồ' });
    const settingsTab = screen.getByRole('link', { name: 'Cài đặt' });

    // Ở "/": chỉ "Hôm nay" mang aria-current, hai tab kia không có thuộc
    // tính này (không phải "false" — hoàn toàn vắng mặt là hành vi đúng của
    // NavLink khi không active).
    expect(homeTab.getAttribute('aria-current')).toBe('page');
    expect(chartsTab.getAttribute('aria-current')).toBeNull();
    expect(settingsTab.getAttribute('aria-current')).toBeNull();

    await user.click(chartsTab);

    expect(chartsTab.getAttribute('aria-current')).toBe('page');
    expect(homeTab.getAttribute('aria-current')).toBeNull();
  });

  it('KHÔNG render nút Đăng xuất khi chưa có phiên (chờ Bước 9)', () => {
    // Chữ "Đăng xuất" ngụ ý người dùng đang đăng nhập. Khi chưa có auth, một nút
    // `disabled` không truyền đạt được "tính năng chưa tồn tại" — nó chỉ trông
    // như nút hỏng. Bước 9 render nút này khi có `SessionContext` thật.
    renderAt('/');
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
  });
});

describe('AppLayout: điều hướng bằng bàn phím (Tab, Enter, Space)', () => {
  it('Tab từ đầu trang tới được cả ba tab theo đúng thứ tự', async () => {
    const user = userEvent.setup();
    renderAt('/');

    const homeTab = screen.getByRole('link', { name: 'Hôm nay' });
    const chartsTab = screen.getByRole('link', { name: 'Biểu đồ' });
    const settingsTab = screen.getByRole('link', { name: 'Cài đặt' });

    await user.tab();
    expect(document.activeElement).toBe(homeTab);

    await user.tab();
    expect(document.activeElement).toBe(chartsTab);

    await user.tab();
    expect(document.activeElement).toBe(settingsTab);
  });

  it('Enter khi tab "Biểu đồ" đang focus → điều hướng sang /charts', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.tab(); // Hôm nay
    await user.tab(); // Biểu đồ
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Biểu đồ' }));

    await user.keyboard('{Enter}');

    expect(screen.getByText(/Trang Biểu đồ/)).toBeTruthy();
    expect(screen.queryByText(/Trang Hôm nay/)).toBeNull();
  });

  it('Space khi tab "Cài đặt" đang focus → điều hướng sang /settings', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.tab(); // Hôm nay
    await user.tab(); // Biểu đồ
    await user.tab(); // Cài đặt
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Cài đặt' }));

    await user.keyboard(' ');

    expect(screen.getByText(/Trang Cài đặt/)).toBeTruthy();
    expect(screen.queryByText(/Trang Hôm nay/)).toBeNull();
  });

  it('thứ tự Tab đi hết ba tab rồi rời khỏi <nav>, không kẹt lại', async () => {
    const user = userEvent.setup();
    renderAt('/');

    const homeTab = screen.getByRole('link', { name: 'Hôm nay' });
    const chartsTab = screen.getByRole('link', { name: 'Biểu đồ' });
    const settingsTab = screen.getByRole('link', { name: 'Cài đặt' });

    await user.tab();
    expect(document.activeElement).toBe(homeTab);
    await user.tab();
    expect(document.activeElement).toBe(chartsTab);
    await user.tab();
    expect(document.activeElement).toBe(settingsTab);
    await user.tab();
    // Sau ba tab, focus phải RỜI KHỎI <nav> hẳn — không quay vòng lại tab đầu,
    // không kẹt ở một phần tử nào trong thanh điều hướng. Vùng danh tính hiện
    // chỉ là text, không nhận focus (nút Đăng xuất sẽ xuất hiện ở Bước 9).
    const nav = screen.getByRole('navigation');
    expect(nav.contains(document.activeElement)).toBe(false);
  });
});
