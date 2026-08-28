import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth.api';
import type { SessionUser } from '../../../types/api';

/**
 * `loading` là trạng thái THỨ BA, không phải `user === null`.
 *
 * Gộp "đang hỏi server" với "chưa đăng nhập" làm route guard đá người dùng về
 * `/login` trong khoảnh khắc đầu mỗi lần tải trang — kể cả khi họ đang có phiên
 * hợp lệ. Đó là lý do `RequireSession` phải chờ `loading === false`.
 */
interface SessionState {
  user: SessionUser | null;
  loading: boolean;
}

interface SessionContextValue extends SessionState {
  /** Đăng nhập rồi nạp user vào context. Ném `ApiError` để form hiện lỗi. */
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Đăng xuất. KHÔNG BAO GIỜ reject — luôn kết thúc ở trạng thái đã đăng xuất
   * phía client, kể cả khi request lỗi. Xem ghi chú ở phần cài đặt.
   */
  signOut: () => Promise<void>;
  /** Hỏi lại server. Dùng sau khi đăng ký, hoặc khi cần kiểm phiên còn sống. */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ user: null, loading: true });

  const refresh = useCallback(async () => {
    // Lấy CSRF token TRƯỚC khi hỏi phiên: ba trang dữ liệu nằm sau
    // `RequireSession`, vốn chờ `loading === false` mới render — nên khi người
    // dùng bấm Lưu được thì token chắc chắn đã có. Thiếu nó là 403 ở lần ghi
    // đầu tiên sau mỗi lần tải trang.
    await authApi.refreshCsrfToken();
    const session = await authApi.getSession();
    setState({ user: session?.user ?? null, loading: false });
  }, []);

  // Nạp phiên một lần khi app khởi động. `void` vì `useEffect` không nhận
  // hàm async, và lỗi mạng ở đây KHÔNG được làm app trắng màn hình: coi như
  // chưa đăng nhập, người dùng thấy trang đăng nhập và biết đường thử lại.
  useEffect(() => {
    void refresh().catch(() => {
      setState({ user: null, loading: false });
    });
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await authApi.login({ email, password });
    setState({ user: session.user, loading: false });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // `catch`, KHÔNG phải `finally`: `finally` vẫn để lỗi ném tiếp, và nơi gọi
      // là một `onClick` nên promise bị thả rơi → unhandled rejection đỏ console
      // trên trình duyệt thật. Hàm này cố ý không bao giờ reject.
      //
      // Nuốt lỗi ở đây là có lý, không phải cho tiện: nếu request lỗi (mất mạng)
      // mà ta giữ user trong context thì giao diện nói "đang đăng nhập" trong
      // khi người dùng đã bấm đăng xuất — sai lệch nguy hiểm hơn. Xóa phía
      // client là hướng an toàn; phần còn lại chỉ là một hàng phiên sống thêm ở
      // server, và endpoint logout idempotent nên lần bấm sau dọn nốt.
      //
      // Vẫn log để lỗi không biến mất hoàn toàn.
      console.warn('Đăng xuất phía server thất bại, vẫn xóa phiên phía client:', err);
    } finally {
      setState({ user: null, loading: false });
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, signIn, signOut, refresh }),
    [state, signIn, signOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Ném khi dùng ngoài `SessionProvider` thay vì trả giá trị mặc định im lặng —
 * một component đọc `user === null` vì thiếu provider trông y hệt "chưa đăng
 * nhập", và bug đó rất khó lần ra.
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession phải nằm trong <SessionProvider>');
  return ctx;
}
