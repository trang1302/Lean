import { Store, type SessionData } from 'express-session';
import * as sessionRepository from './repositories/session.repository.js';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày — auth/SPEC.md §3.2

function expiresAtOf(session: SessionData): Date {
  const expires = session.cookie?.expires;
  if (expires) return new Date(expires);
  return new Date(Date.now() + DEFAULT_TTL_MS);
}

/**
 * Store phiên trên Prisma/SQLite. Tự viết thay vì dùng connect-sqlite3 để có
 * CỘT userId truy vấn được (auth/SPEC.md §2, §5.2).
 *
 * Mọi hàm gọi callback đúng MỘT lần trên MỌI nhánh. Quên nhánh reject là làm
 * request treo im lặng tới timeout, không phải ném lỗi.
 */
export class PrismaSessionStore extends Store {
  get(sid: string, callback: (err?: unknown, session?: SessionData | null) => void): void {
    sessionRepository
      .findSessionById(sid)
      .then(async (row) => {
        if (!row) {
          callback(null, null);
          return;
        }
        // Hàng quá hạn: coi như không tồn tại VÀ dọn luôn. Không dọn thì bảng
        // phình ra vì hàng chết không bao giờ bị đọc lại để phát hiện.
        if (row.expiresAt.getTime() <= Date.now()) {
          await sessionRepository.deleteSession(sid);
          callback(null, null);
          return;
        }
        callback(null, JSON.parse(row.data) as SessionData);
      })
      .catch((err: unknown) => callback(err));
  }

  set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    // Phiên vô danh (chưa login) KHÔNG được ghi: cột userId có khóa ngoại tới
    // User, không có giá trị hợp lệ nào để điền. express-session với
    // `saveUninitialized: false` sẽ không gọi set cho phiên rỗng — cấu hình đó
    // là BẮT BUỘC, không phải tùy chọn (xem app.ts ở Task 6).
    const userId = session.userId ?? null;
    sessionRepository
      .upsertSession(sid, userId, JSON.stringify(session), expiresAtOf(session))
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    sessionRepository
      .deleteSession(sid)
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  /** Cần cho `rolling: true` — mỗi request hợp lệ đẩy expiresAt xa thêm. */
  touch(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    sessionRepository
      .touchSession(sid, expiresAtOf(session))
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }
}

/** Dọn hàng chết. Gọi định kỳ; xem Task 6 để biết chỗ mắc. */
export async function pruneExpiredSessions(): Promise<number> {
  return sessionRepository.deleteExpiredSessions(new Date());
}
