import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './routes';
import { SessionProvider } from '../features/auth';
import type { SessionResponse } from '../types/api';

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

// Ba route dữ liệu giờ nằm sau `RequireSession`, nên mỗi test PHẢI nói rõ nó
// đang ở trạng thái đăng nhập hay chưa. Mock ở tầng `auth.api` (không mock
// `fetch`, không mock `SessionProvider`) để guard, provider và layout thật đều
// chạy — chỉ chặn đúng một đường ra mạng.
vi.mock('../features/auth/api/auth.api', () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  // `SessionProvider.refresh()` lấy CSRF token trước khi hỏi phiên. Thiếu hai
  // hàm này trong mock thì provider ném ngay ở dòng đầu và MỌI test "đã đăng
  // nhập" thất bại với lý do chẳng liên quan gì tới điều nó đang kiểm.
  refreshCsrfToken: vi.fn().mockResolvedValue('test-csrf-token'),
  currentCsrfToken: vi.fn().mockReturnValue('test-csrf-token'),
}));

// eslint-disable-next-line import/first -- phải nằm sau vi.mock để lấy bản mock
import * as authApi from '../features/auth/api/auth.api';

const SESSION: SessionResponse = {
  user: {
    id: 'u1',
    email: 'user@lean.local',
    displayName: null,
    status: 'active',
    role: { id: 'r1', code: 'USER', name: 'Người dùng' },
  },
  // Sáu quyền dữ liệu của vai trò USER — đủ để ba trang dữ liệu render, và
  // KHÔNG có quyền quản trị, nên các mục quản trị phải vắng mặt.
  permissions: [
    'log:view',
    'log:manage',
    'goal:view',
    'goal:manage',
    'reminder:view',
    'reminder:manage',
  ],
  expiresAt: null,
};

function renderRoutes(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
}

/**
 * Render với một phiên hợp lệ và CHỜ `RequireSession` nạp xong.
 *
 * Không chờ là test nhìn thấy `LoadingState` của guard thay vì trang thật —
 * và sẽ đỏ với thông báo rất khó đọc ("không tìm thấy heading Hôm nay").
 */
async function renderSignedIn(path: string) {
  vi.mocked(authApi.getSession).mockResolvedValue(SESSION);
  const result = renderRoutes(path);
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  return result;
}

function renderSignedOut(path: string) {
  vi.mocked(authApi.getSession).mockResolvedValue(null);
  return renderRoutes(path);
}

describe('router: route dữ liệu + auth + NotFoundPage (SPEC §5.2)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Bằng chứng "không lỗi console" — không chỉ khẳng định bằng lời.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.mocked(authApi.getSession).mockReset();
  });

  it('render ở "/" → trang Hôm nay, không phải Cài đặt hay Biểu đồ', async () => {
    await renderSignedIn('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Cài đặt' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'Biểu đồ' })).toBeNull();
  });

  it('render thẳng ở "/settings" (mô phỏng F5) → trang Cài đặt, KHÔNG phải Hôm nay', async () => {
    // Đây là ca "F5 ở /charts vẫn ở /charts" của deliverable: vào thẳng route
    // qua initialEntries (không đi qua click) và không bị văng về "/".
    await renderSignedIn('/settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Hôm nay' })).toBeNull();
  });

  it('render thẳng ở "/charts" (mô phỏng F5) → vẫn ở /charts, không văng về "/"', async () => {
    await renderSignedIn('/charts');
    expect(screen.getByRole('heading', { level: 1, name: 'Biểu đồ' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Hôm nay' })).toBeNull();
  });

  it('đường dẫn lạ "/khong-co" → NotFoundPage, không phải màn hình trắng', async () => {
    // `/*` nằm NGOÀI `RequireSession`: 404 phải hiện ngay cả khi chưa đăng nhập,
    // không bị đổi thành màn hình đăng nhập (đường dẫn sai vẫn là đường dẫn sai).
    renderSignedOut('/khong-co');
    expect(await screen.findByRole('heading', { name: /404/ })).toBeTruthy();
  });

  it('render "/login" → trang Đăng nhập thật, KHÔNG có thanh tab (route này không dùng AppLayout)', async () => {
    // Đây là điểm khác biệt cấu trúc quan trọng nhất của "/login" so với ba
    // route kia (SPEC §5.2: "/login không dùng AppLayout — không có tab để
    // bấm khi chưa đăng nhập").
    renderSignedOut('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Hôm nay' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
  });

  it('render "/register" → trang Đăng ký thật, cũng không có thanh tab', async () => {
    renderSignedOut('/register');
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng ký' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
  });

  it.each(['/', '/charts', '/settings'])(
    'không gọi console.error khi render route "%s" (đã đăng nhập)',
    async (path) => {
      await renderSignedIn(path);
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it.each(['/login', '/register'])('không gọi console.error khi render route "%s"', async (path) => {
    renderSignedOut(path);
    await screen.findByRole('heading', { level: 1 });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('RequireSession: mặc định ĐÓNG', () => {
  afterEach(() => {
    vi.mocked(authApi.getSession).mockReset();
  });

  it.each(['/', '/charts', '/settings'])(
    'chưa đăng nhập, vào "%s" → bị đá về trang Đăng nhập',
    async (path) => {
      renderSignedOut(path);

      expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
      // Nội dung sau guard KHÔNG được render dù chỉ một nhịp.
      expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    },
  );

  it('mang đường dẫn đang muốn vào theo ?next= để đăng nhập xong quay lại đúng chỗ', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);
    const router = createMemoryRouter(routes, { initialEntries: ['/charts'] });
    render(
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/charts')}`);
  });

  it('trong lúc còn đang hỏi server thì KHÔNG đá về /login', async () => {
    // Ca hồi quy quan trọng nhất của guard: coi `user === null` lúc đang nạp là
    // "chưa đăng nhập" sẽ đá người dùng có phiên hợp lệ về /login mỗi lần F5,
    // rồi lại quay về — nháy màn hình. Phiên chỉ resolve khi ta cho phép.
    let resolveSession: (value: SessionResponse | null) => void = () => {};
    vi.mocked(authApi.getSession).mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    // Còn đang chờ: thấy trạng thái đang tải, và VẪN Ở "/" — chưa đá đi đâu.
    expect(screen.getByRole('status')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeNull();

    resolveSession(SESSION);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hôm nay' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('AppLayout: thanh tab — click, đường dẫn đổi, tab đang mở được đánh dấu', () => {
  afterEach(() => {
    vi.mocked(authApi.getSession).mockReset();
  });

  it('bấm qua lại ba tab bằng chuột → nội dung và đường dẫn đổi đúng', async () => {
    const user = userEvent.setup();
    await renderSignedIn('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeTruthy();

    await user.click(screen.getByRole('link', { name: 'Biểu đồ' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Biểu đồ' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Hôm nay' })).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Cài đặt' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Biểu đồ' })).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Hôm nay' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeTruthy();
  });

  it('tab đang mở mang aria-current="page" — đánh dấu cho công nghệ trợ giúp, không chỉ màu sắc', async () => {
    const user = userEvent.setup();
    await renderSignedIn('/');

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

  it('CÓ phiên → hiện danh tính và nút Đăng xuất bấm được', async () => {
    // Thay test cũ "KHÔNG render nút Đăng xuất khi chưa có phiên (chờ Bước 9)".
    // Bước đó đã xong: nút giờ render, và chỉ render khi có phiên thật —
    // trường hợp "chưa có phiên" giờ được `RequireSession` phủ (không tới được
    // AppLayout), xem describe ở trên.
    await renderSignedIn('/');

    expect(screen.getByText('user@lean.local')).toBeTruthy();
    const logoutButton = screen.getByRole('button', { name: 'Đăng xuất' });
    expect(logoutButton.hasAttribute('disabled')).toBe(false);
  });

  it('bấm Đăng xuất → gọi API logout rồi về trang Đăng nhập', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    await renderSignedIn('/');

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(vi.mocked(authApi.logout)).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
  });

  it('logout lỗi mạng vẫn đưa người dùng ra ngoài, không kẹt ở trạng thái đã đăng nhập', async () => {
    // Giữ user trong context khi request lỗi là để giao diện nói "đang đăng
    // nhập" sau khi người dùng đã bấm đăng xuất — hướng sai an toàn.
    //
    // `signOut` phải NUỐT lỗi, không chỉ "vẫn xóa state": nơi gọi là một
    // `onClick` thả rơi promise, nên một lỗi ném tiếp sẽ thành unhandled
    // rejection đỏ console trên trình duyệt thật. Test khẳng định cả hai nửa —
    // ra được ngoài, VÀ lỗi vẫn được log chứ không biến mất.
    const user = userEvent.setup();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(authApi.logout).mockRejectedValue(new Error('mất mạng'));
    await renderSignedIn('/');

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('AppLayout: điều hướng bằng bàn phím (Tab, Enter, Space)', () => {
  afterEach(() => {
    vi.mocked(authApi.getSession).mockReset();
  });

  it('Tab từ đầu trang tới được cả ba tab theo đúng thứ tự', async () => {
    const user = userEvent.setup();
    await renderSignedIn('/');

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
    await renderSignedIn('/');

    await user.tab(); // Hôm nay
    await user.tab(); // Biểu đồ
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Biểu đồ' }));

    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { level: 1, name: 'Biểu đồ' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Hôm nay' })).toBeNull();
  });

  it('Space khi tab "Cài đặt" đang focus → điều hướng sang /settings', async () => {
    const user = userEvent.setup();
    await renderSignedIn('/');

    await user.tab(); // Hôm nay
    await user.tab(); // Biểu đồ
    await user.tab(); // Cài đặt
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Cài đặt' }));

    await user.keyboard(' ');

    expect(screen.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Hôm nay' })).toBeNull();
  });

  it('thứ tự Tab: hết ba tab thì tới nút Đăng xuất, rời khỏi <nav>, không kẹt lại', async () => {
    const user = userEvent.setup();
    await renderSignedIn('/');

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
    // không kẹt ở một phần tử nào trong thanh điều hướng. Điểm dừng tiếp theo
    // giờ là nút Đăng xuất (trước Bước 9 vùng danh tính chỉ là text, không
    // nhận focus).
    const nav = screen.getByRole('navigation');
    expect(nav.contains(document.activeElement)).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đăng xuất' }));
  });
});
