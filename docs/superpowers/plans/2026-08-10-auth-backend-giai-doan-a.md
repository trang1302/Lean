# Giai đoạn A — `auth` backend · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa `Lean` từ một-người-dùng-cứng (`LOCAL_USER_ID`) sang xác thực thật — đăng ký, đăng
nhập, phiên server-side — mà không rò dữ liệu sức khỏe giữa những người dùng.

**Architecture:** Phiên server-side, cookie `httpOnly`, không token phía client. `express-session`
với store tự viết trên Prisma (bảng `Session` có cột `userId` riêng để truy vấn được theo người
dùng). `requireAuth` mắc **một lần** trong `app.ts` trước năm router dữ liệu — mặc định đóng, mở
bằng whitelist tường minh. Nguồn của `userId` chuyển từ hằng sang `req.session.userId`, controller
truyền xuống service, service truyền xuống repository.

**Tech Stack:** Express 5 · TypeScript 7 · Prisma 7 + SQLite (adapter `PrismaBetterSqlite3`) ·
Zod 4 · Vitest 4 + supertest 7 · `express-session` · `@node-rs/argon2` · `helmet` · `csrf-csrf`

**Nguồn:** [design doc](../specs/2026-08-10-auth-rbac-3-roles-design.md) ·
[`auth/SPEC.md`](../../features/auth/SPEC.md) · [`auth/PLAN.md`](../../features/auth/PLAN.md)

**Plan này thay thế `auth/PLAN.md` §Bước 1–10** ở bốn chỗ: Bước 3 (migrate dữ liệu) bị bỏ vì DB
rỗng · thêm `POST /api/auth/register` vào Bước 7 · min-8 mật khẩu chuyển khỏi đường login · Bước 11
(web) tách sang giai đoạn D. `auth/PLAN.md` vẫn là nguồn cho phần bối cảnh và cảnh báo.

---

## Global Constraints

Áp dụng cho **mọi task**. Không lặp lại trong từng task.

- **KHÔNG chạy `git commit` hoặc `git push`.** Chủ repo tự commit (`CLAUDE.local.md`). Mỗi task
  kết thúc bằng bước **Bàn giao** — báo cáo diff + gợi ý commit message, rồi dừng. Đây là chỗ
  plan này cố ý lệch khỏi mẫu của skill `writing-plans`.
- **KHÔNG đụng `server/data.db`** — dữ liệu sức khỏe thật. DB cho test là `server/test.db`, do
  `server/vitest.config.ts:11` quyết định; `test/globalSetup.ts:20-22` chặn cứng nếu
  `DATABASE_URL` chứa `data.db`.
- **Express 5 bắt lỗi async sẵn** — không cài `express-async-errors`, không bọc `try/catch` chỉ để
  nuốt lỗi. Ném `AppError`, `errorHandler` dịch.
- **Prisma 7** — client import từ `../generated/prisma/client.js`, **không** từ `@prisma/client`.
  Đường dẫn `file:` tương đối resolve theo `server/`.
- **`date` luôn là chuỗi `"YYYY-MM-DD"`**, không bao giờ `DateTime`. Mọi xử lý ngày qua
  `server/src/lib/time.ts`, timezone `Asia/Ho_Chi_Minh`. `Session.expiresAt` và
  `LoginAttempt.createdAt` **là** `DateTime` — chúng là thời điểm, không phải ngày lịch.
- **Zod 4** — `z.email()` top-level, **không** `z.string().email()`.
- **4 lớp không ngoại lệ**: controller → service → repository → Prisma. `repositories/` là chỗ
  duy nhất được import `prisma`. Service **không** biết `req`.
- **Hình dạng lỗi**: `{ error: { code, message } }`, thêm `fields` khi validate.
  **KHÔNG** dùng envelope `{ success: false }` của upip.
- **Không thêm cột `role` vào `User`** — vai trò là của giai đoạn B.
- **Không lưu gì về đăng nhập trong `localStorage`** (áp cho giai đoạn D, ghi ở đây để không
  ai vô tình làm sớm).
- Style: 2 spaces, single quotes, có semicolon. File server camelCase. Commit message
  `<type>(<scope>): <subject>`.
- Verify chạy từ `C:\Project\WorkSpace\Lean\server`. Nếu `forks` treo trong sandbox thì
  `VITEST_POOL=threads npm test` (`vite.config.ts` ghi chú cách này).

**Bất biến phải xanh sau MỖI task:** `npm test` và `npx tsc --noEmit`. Không để task nào kết
thúc với test đỏ.

---

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|---|---|
| `src/shared/security/password.ts` | Bọc Argon2id. Hàm thuần, không DB, không HTTP |
| `src/shared/types/express-session.d.ts` | Mở rộng `SessionData` + `Express.Request` |
| `src/features/auth/index.ts` | Export `authRouter` |
| `src/features/auth/controllers/auth.controller.ts` | 5 route. Lớp **duy nhất** chạm `req.session` |
| `src/features/auth/services/auth.service.ts` | Đăng ký, xác thực, quyết định mã lỗi |
| `src/features/auth/repositories/user.repository.ts` | Truy vấn `User` |
| `src/features/auth/repositories/session.repository.ts` | Truy vấn `Session` |
| `src/features/auth/repositories/loginAttempt.repository.ts` | Truy vấn `LoginAttempt` |
| `src/features/auth/prismaSessionStore.ts` | Class hiện thực `Store` của `express-session` |
| `src/features/auth/dtos/auth.request.ts` | `registerSchema`, `loginSchema` |
| `src/features/auth/dtos/auth.response.ts` | `toSessionResponse` — chọn trường tường minh |
| `src/features/auth/middleware/requireAuth.ts` | Chốt chặn phiên |
| `test/helpers/auth.ts` | Helper dựng user + agent supertest đã đăng nhập |

**Sửa:** `prisma/schema.prisma` · `src/config/env.ts` · `.env` + `.env.example` ·
`src/shared/errors/AppError.ts` · `src/shared/errors/errorHandler.ts` · `src/app.ts` ·
5 feature (`goal`, `meals`, `bodyLogs`, `summary`, `reminders`) · 5 file test hiện có.

**Xóa (task cuối):** `src/shared/constants.ts`.

---

## Task 1: Phụ thuộc, biến môi trường, mã lỗi

**Files:**
- Modify: `server/package.json` (deps)
- Modify: `server/src/config/env.ts:3-13`
- Modify: `server/.env`, `server/.env.example`
- Create: `server/src/shared/types/express-session.d.ts`
- Modify: `server/src/shared/errors/AppError.ts:1,22-28`
- Modify: `server/src/shared/errors/errorHandler.ts:43-52`
- Test: `server/test/shared/errors/appError.test.ts`

**Interfaces:**
- Produces: `env.SESSION_SECRET: string` · `env.NODE_ENV: 'development' | 'production' | 'test'` ·
  `AppError.unauthorized(msg)`, `AppError.forbidden(msg)`, `AppError.invalidCredentials()`,
  `AppError.accountDisabled()`, `AppError.csrfFailed()`, `AppError.tooManyAttempts()` ·
  `req.session.userId?: string` · `req.user?: { id: string }`

- [ ] **Step 1: Cài phụ thuộc**

Tra bản mới nhất trước khi cài — ràng buộc `docs/overview/04-conventions.md:13`. **Không** cài
`connect-sqlite3` (lý do loại ở `auth/SPEC.md:109-125`).

```bash
cd C:/Project/WorkSpace/Lean/server
npm i express-session @node-rs/argon2 helmet csrf-csrf
npm i -D @types/express-session
```

- [ ] **Step 2: Viết test thất bại cho 6 mã lỗi mới**

```ts
// server/test/shared/errors/appError.test.ts
import { describe, it, expect } from 'vitest';
import { AppError } from '../../../src/shared/errors/AppError.js';

describe('AppError — mã lỗi của auth', () => {
  it('unauthorized → 401 UNAUTHORIZED', () => {
    const err = AppError.unauthorized('Cần đăng nhập');
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('forbidden → 403 FORBIDDEN', () => {
    expect(AppError.forbidden('x').status).toBe(403);
    expect(AppError.forbidden('x').code).toBe('FORBIDDEN');
  });

  it('invalidCredentials → 401, message KHÔNG tiết lộ email có tồn tại hay không', () => {
    // auth/SPEC.md §7.3: sai email và sai mật khẩu phải cùng mã VÀ cùng message.
    // Test này khóa message lại để không ai "cải thiện" nó thành hai câu khác nhau.
    const err = AppError.invalidCredentials();
    expect(err.status).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
    expect(err.message).toBe('Email hoặc mật khẩu không đúng');
  });

  it('accountDisabled → 403 ACCOUNT_DISABLED', () => {
    expect(AppError.accountDisabled().status).toBe(403);
    expect(AppError.accountDisabled().code).toBe('ACCOUNT_DISABLED');
  });

  it('csrfFailed → 403 CSRF_ERROR', () => {
    expect(AppError.csrfFailed().status).toBe(403);
    expect(AppError.csrfFailed().code).toBe('CSRF_ERROR');
  });

  it('tooManyAttempts → 429 TOO_MANY_ATTEMPTS', () => {
    expect(AppError.tooManyAttempts().status).toBe(429);
    expect(AppError.tooManyAttempts().code).toBe('TOO_MANY_ATTEMPTS');
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/shared/errors/appError.test.ts`
Expected: FAIL — `AppError.unauthorized is not a function`, và `tsc` báo mã lỗi không thuộc union.

- [ ] **Step 4: Mở rộng `AppErrorCode` + factory**

```ts
// server/src/shared/errors/AppError.ts — thay dòng 1
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'CSRF_ERROR'
  | 'TOO_MANY_ATTEMPTS';
```

Thêm vào class, cạnh `notFound` / `validation`:

```ts
  static unauthorized(message = 'Cần đăng nhập'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message: string): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  /**
   * Sai email và sai mật khẩu dùng CHUNG factory này — cùng mã, cùng message.
   * Tách ra hai câu khác nhau biến form đăng nhập thành công cụ liệt kê tài
   * khoản (auth/SPEC.md §7.3). Đừng thêm tham số `message`.
   */
  static invalidCredentials(): AppError {
    return new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  }

  static accountDisabled(): AppError {
    return new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa');
  }

  static csrfFailed(): AppError {
    return new AppError(403, 'CSRF_ERROR', 'CSRF token thiếu hoặc không hợp lệ');
  }

  static tooManyAttempts(): AppError {
    return new AppError(429, 'TOO_MANY_ATTEMPTS', 'Thử quá nhiều lần. Đợi ít phút rồi thử lại');
  }
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `npx vitest run test/shared/errors/appError.test.ts`
Expected: PASS — 6 test.

- [ ] **Step 6: Thêm `SESSION_SECRET` và `NODE_ENV` vào `env.ts`**

```ts
// server/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NTFY_BASE_URL: z.url().default('https://ntfy.sh'),
  // KHÔNG có .default(): fallback cho secret nghĩa là mọi bản triển khai dùng
  // chung một khóa ký (auth/SPEC.md §7.8). Thiếu biến → tiến trình chết ngay.
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data.db',
  PORT: process.env.PORT,
  NTFY_BASE_URL: process.env.NTFY_BASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NODE_ENV: process.env.NODE_ENV,
});
```

Thêm vào `server/.env` và `server/.env.example` (giá trị trong `.env.example` là placeholder,
**không** phải secret thật):

```
SESSION_SECRET="thay-bang-32-ky-tu-ngau-nhien-tro-len"
```

Sinh secret thật cho `.env`: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

- [ ] **Step 7: Thêm `SESSION_SECRET` cho môi trường test**

Không có bước này thì mọi test import `app.ts` sẽ chết ở `envSchema.parse`.

```ts
// server/vitest.config.ts — bổ sung vào khối `env`
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
      NODE_ENV: 'test',
    },
```

- [ ] **Step 8: Mở rộng kiểu cho `express-session`**

Thiếu file này thì `req.session.userId` không qua được `tsc --noEmit`.

```ts
// server/src/shared/types/express-session.d.ts
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Do `requireAuth` gắn. Giai đoạn B thêm `roleId` vào đây — khi đó
       * `permissionGuard` đọc nó để tra tập quyền.
       */
      user?: { id: string };
    }
  }
}
```

- [ ] **Step 9: Thêm nhánh nhận diện lỗi CSRF vào `errorHandler`**

`csrf-csrf` ném ra thứ **không phải** `AppError`. Không nhận diện thì nó rơi vào nhánh `500` ở
`errorHandler.ts:54-58` và client thấy sai mã (`auth/SPEC.md:320`).

Chèn **trước** nhánh `if (err instanceof AppError)`:

```ts
  if (isCsrfError(err)) {
    const appError = AppError.csrfFailed();
    res.status(appError.status).json({
      error: { code: appError.code, message: appError.message },
    });
    return;
  }
```

Và hàm nhận diện, đặt cạnh `toFieldErrors` trong cùng file:

```ts
/**
 * `csrf-csrf` ném lỗi riêng của nó, KHÔNG phải AppError — không nhận diện thì
 * nó rơi vào nhánh 500 ở dưới và client thấy sai mã (auth/SPEC.md:320).
 *
 * Nhận diện bằng `code` của thư viện. **Tra README bản đang cài để lấy đúng
 * giá trị của `code`** — nó đã đổi giữa các major version. Ở đây kiểm cả hai
 * dạng đã biết để không phụ thuộc một chuỗi duy nhất; sửa lại thành một chuỗi
 * đúng sau khi xác nhận, đừng để kiểm mò mãi.
 */
function isCsrfError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 'EBADCSRFTOKEN' || code === 'ERR_BAD_CSRF_TOKEN';
}
```

- [ ] **Step 10: Verify toàn bộ**

```bash
npx tsc --noEmit
npm test
```
Expected: `tsc` sạch · 208 test cũ + 6 test mới đều xanh.

Kiểm bằng tay rằng thiếu secret là chết ngay, không phải cảnh báo rồi chạy tiếp:

```bash
node -e "delete process.env.SESSION_SECRET" # minh họa; thực tế: tạm đổi tên biến trong .env
npm run dev   # kỳ vọng: tiến trình thoát với lỗi Zod nêu rõ SESSION_SECRET
```

- [ ] **Step 11: Bàn giao**

Không commit. Báo cáo diff và đề xuất: `chore(auth): add session deps, SESSION_SECRET, auth error codes`

---

## Task 2: Lược đồ Prisma — `User`, `Session`, `LoginAttempt` + quan hệ

**Files:**
- Modify: `server/prisma/schema.prisma`
- Test: `server/test/lib/schema.test.ts`

**Interfaces:**
- Produces: model `User` (`id`, `email` unique, `passwordHash`, `displayName?`, `status`,
  `lastLoginAt?`, `createdAt`, `updatedAt`) · model `Session` (`id`, `userId`, `data`,
  `expiresAt`, `createdAt`) · model `LoginAttempt` (`id`, `emailKey`, `ip`, `succeeded`,
  `createdAt`) · quan hệ `user` trên `BodyLog`/`Meal`/`Goal`/`Reminder`

> **Vì sao task này gộp cả quan hệ, khác `auth/PLAN.md` Bước 2–4.** `auth/PLAN.md` tách quan hệ
> thành bước riêng vì sợ 4 bảng đã có dữ liệu mang `userId='local'` mà bảng `User` trống. Đã
> kiểm ngày 2026-08-10: `BodyLog=0 Meal=0 Goal=0 Reminder=0`. Không có hàng nào để mồ côi, nên
> cảnh báo `auth/SPEC.md:420` không áp dụng và hai bước gộp được an toàn.
>
> **Kiểm lại trước khi làm** — nếu `COUNT` khác 0 thì DỪNG và tách bước theo `auth/PLAN.md`:
> ```bash
> node -e "const D=require('better-sqlite3');const d=new D('./data.db',{readonly:true});for(const n of ['BodyLog','Meal','Goal','Reminder'])console.log(n,d.prepare('select count(*) c from \"'+n+'\"').get().c)"
> ```

- [ ] **Step 1: Viết test thất bại cho `@unique` và khóa ngoại**

```ts
// server/test/lib/schema.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db.js';

beforeEach(async () => {
  await prisma.bodyLog.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('lược đồ User', () => {
  it('email trùng bị chặn ở tầng DB, không chỉ ở tầng app', async () => {
    await prisma.user.create({
      data: { email: 'a@lean.local', passwordHash: 'x' },
    });

    await expect(
      prisma.user.create({ data: { email: 'a@lean.local', passwordHash: 'y' } }),
    ).rejects.toThrow();
  });

  it('email khác hoa thường là HAI tài khoản — nên chuẩn hóa phải làm ở tầng DTO', async () => {
    // Không phải bug: @unique của SQLite phân biệt hoa thường. Test này ghi lại
    // sự thật đó để không ai tin rằng DB tự chống trùng (auth/SPEC.md:353).
    await prisma.user.create({ data: { email: 'a@lean.local', passwordHash: 'x' } });
    const upper = await prisma.user.create({
      data: { email: 'A@lean.local', passwordHash: 'y' },
    });

    expect(upper.id).toBeTruthy();
  });
});

describe('khóa ngoại thật sự được cưỡng chế', () => {
  it('BodyLog với userId không tồn tại bị từ chối', async () => {
    // SQLite chỉ cưỡng chế FK khi PRAGMA foreign_keys = ON. Nếu test này pass
    // ngược (chèn lọt) thì quan hệ trong schema chỉ là trang trí và không bảo
    // vệ gì — auth/PLAN.md:168.
    await expect(
      prisma.bodyLog.create({
        data: { userId: 'khong-ton-tai', date: '2026-08-10', weightKg: 70 },
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/lib/schema.test.ts`
Expected: FAIL — `prisma.user` không tồn tại.

- [ ] **Step 3: Thêm ba model vào `schema.prisma`**

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  displayName  String?
  status       String    @default("active")   // "active" | "disabled"
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  bodyLogs  BodyLog[]
  meals     Meal[]
  goal      Goal?
  reminders Reminder[]
  sessions  Session[]
}

model Session {
  id        String   @id                      // session id do express-session sinh
  userId    String
  data      String                            // payload phiên đã JSON.stringify
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model LoginAttempt {
  id        String   @id @default(cuid())
  emailKey  String                            // email đã chuẩn hóa
  ip        String
  succeeded Boolean
  createdAt DateTime @default(now())

  @@index([emailKey, createdAt])
  @@index([ip, createdAt])
}
```

`status` là `String` chứ không phải enum Prisma — nhất quán với `Meal.slot` và `Reminder.kind`,
SQLite không có enum native; ràng buộc giá trị đặt ở Zod.

`LoginAttempt` **cố ý không có quan hệ tới `User`**: lần thử vào email **không tồn tại** cũng
phải ghi được, đó chính là dấu hiệu dò tài khoản (`auth/SPEC.md:404`).

- [ ] **Step 4: Thêm đúng một dòng quan hệ vào bốn model hiện có**

Vào `BodyLog`, `Meal`, `Goal`, `Reminder` — **không đổi khóa chính, không đổi ràng buộc unique,
không thêm cột nào khác**:

```prisma
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

- [ ] **Step 5: Push schema**

```bash
npx prisma db push
```
Expected: `Your database is now in sync with your Prisma schema`. Prisma 7 chặn agent chạy lệnh
migrate — nếu bị chặn, đặt `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes` **chỉ** cho lệnh này
và báo lại cho chủ repo.

- [ ] **Step 6: Chạy test, xác nhận xanh**

Run: `npx vitest run test/lib/schema.test.ts`
Expected: PASS — 3 test.

Nếu test khóa ngoại **fail vì chèn lọt**: adapter chưa bật `PRAGMA foreign_keys`. Sửa
`server/src/lib/db.ts` để bật, **đừng** gỡ quan hệ khỏi schema.

- [ ] **Step 7: Toàn bộ test cũ phải còn xanh**

```bash
npm test
```
Expected: test cũ sẽ **đỏ hàng loạt** — chúng tạo `BodyLog`/`Meal`/`Goal`/`Reminder` với
`userId = 'local'` mà không có hàng `User` nào. Đây là hệ quả **đúng** của việc thêm khóa ngoại.

Sửa tối thiểu để xanh lại: thêm vào `beforeEach` của 5 file test hiện có
(`test/features/{bodyLogs,meals,summary,reminders}/*.test.ts`, `test/lib/db.test.ts`) một
`prisma.user.upsert` tạo hàng `User` với `id = LOCAL_USER_ID`:

```ts
await prisma.user.upsert({
  where: { id: LOCAL_USER_ID },
  update: {},
  create: { id: LOCAL_USER_ID, email: 'local@lean.local', passwordHash: 'x' },
});
```

Đây là bản vá tạm; Task 10 thay nó bằng helper thật. Ghi chú `// TODO(Task 10)` **không** được —
thay bằng một dòng comment nêu rõ helper nào sẽ thế chỗ.

- [ ] **Step 8: Bàn giao**

Đề xuất: `feat(auth): add User, Session, LoginAttempt models and relations`

---

## Task 3: `shared/security/password.ts`

**Files:**
- Create: `server/src/shared/security/password.ts`
- Test: `server/test/shared/security/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>` ·
  `verifyPassword(hash: string, plain: string): Promise<boolean>` ·
  `dummyHash(): Promise<string>`

> **Không bịa chữ ký.** `@node-rs/argon2` phơi ra hàm băm và hàm xác minh, cả hai bất đồng bộ,
> mặc định Argon2id. **Kiểm thứ tự tham số của hàm xác minh bằng kiểu TypeScript của đúng bản
> đang cài** — đảo nhầm hash với plaintext cho ra một hàm *luôn trả `false`*, và test "mật khẩu
> sai bị từ chối" **vẫn xanh**. Đó là lý do Step 1 bắt buộc có ca "mật khẩu đúng trả `true`".

- [ ] **Step 1: Viết test thất bại**

```ts
// server/test/shared/security/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, dummyHash } from '../../../src/shared/security/password.js';

describe('hashPassword', () => {
  it('hash cùng một mật khẩu hai lần cho hai chuỗi khác nhau (salt ngẫu nhiên)', async () => {
    const [a, b] = await Promise.all([hashPassword('123456'), hashPassword('123456')]);
    expect(a).not.toBe(b);
  });

  it('hash không chứa mật khẩu gốc dưới dạng chuỗi con', async () => {
    const hash = await hashPassword('mat-khau-rat-de-nhan-ra');
    expect(hash).not.toContain('mat-khau-rat-de-nhan-ra');
  });
});

describe('verifyPassword', () => {
  it('mật khẩu ĐÚNG trả true', async () => {
    // Ca quan trọng nhất của file này: nếu đảo nhầm thứ tự tham số thì
    // verifyPassword luôn trả false và mọi ca "sai" vẫn xanh.
    const hash = await hashPassword('123456');
    expect(await verifyPassword(hash, '123456')).toBe(true);
  });

  it('mật khẩu sai trả false', async () => {
    const hash = await hashPassword('123456');
    expect(await verifyPassword(hash, '123457')).toBe(false);
  });

  it('hash rác trả false, không ném lỗi', async () => {
    // Nhánh "email không tồn tại" ở §7.3 chạy verify với một hash cố định.
    // Nếu hash hỏng làm hàm ném lỗi thì login trả 500 thay vì 401.
    expect(await verifyPassword('khong-phai-hash', '123456')).toBe(false);
  });
});

describe('dummyHash', () => {
  it('trả một hash hợp lệ và verify với mật khẩu bất kỳ đều false', async () => {
    const hash = await dummyHash();
    expect(hash.length).toBeGreaterThan(20);
    expect(await verifyPassword(hash, '123456')).toBe(false);
  });

  it('gọi hai lần trả cùng một chuỗi (memoize, không hash lại mỗi request)', async () => {
    expect(await dummyHash()).toBe(await dummyHash());
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/shared/security/password.test.ts`
Expected: FAIL — không phân giải được module.

- [ ] **Step 3: Hiện thực**

```ts
// server/src/shared/security/password.ts
import { hash, verify } from '@node-rs/argon2';

/**
 * Bọc Argon2id. Module thuần: không DB, không HTTP — cùng tinh thần với
 * shared/stats/ (docs/overview/04-conventions.md:21).
 *
 * Dùng tham số mặc định của @node-rs/argon2 (Argon2id). Không tự chỉnh
 * memory/time cost mà không đo — chỉnh sai làm yếu hơn mặc định.
 */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/**
 * Thứ tự tham số: (hash, plain). Trả `false` thay vì ném khi `hash` không phải
 * chuỗi Argon2 hợp lệ — nhánh "email không tồn tại" của auth.service truyền vào
 * một hash cố định, và một exception ở đó biến 401 thành 500.
 */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

const DUMMY_PLAIN = 'lean-dummy-password-for-timing-equalisation';
let dummyHashPromise: Promise<string> | null = null;

/**
 * Hash cố định dùng cho nhánh "không tìm thấy user" ở auth/SPEC.md §7.3: vẫn
 * chạy verify để hai nhánh mất thời gian tương đương, nếu không thì chênh lệch
 * thời gian phản hồi trở thành oracle đoán email nào có tài khoản.
 *
 * Memoize: chỉ lần gọi ĐẦU TIÊN phải hash. Không dùng top-level await để không
 * cộng thời gian hash vào lúc khởi động server.
 */
export function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(DUMMY_PLAIN);
  return dummyHashPromise;
}
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx vitest run test/shared/security/password.test.ts`
Expected: PASS — 7 test.

- [ ] **Step 5: Bàn giao**

Đề xuất: `feat(auth): argon2 password hashing helpers`

---

## Task 4: Session store trên Prisma

**Files:**
- Create: `server/src/features/auth/repositories/session.repository.ts`
- Create: `server/src/features/auth/prismaSessionStore.ts`
- Test: `server/test/features/auth/prismaSessionStore.test.ts`

**Interfaces:**
- Consumes: model `Session` (Task 2)
- Produces: `findSessionById(sid: string): Promise<{ data: string; expiresAt: Date } | null>` ·
  `upsertSession(sid: string, userId: string | null, data: string, expiresAt: Date): Promise<void>` ·
  `touchSession(sid: string, expiresAt: Date): Promise<void>` ·
  `deleteSession(sid: string): Promise<void>` ·
  `deleteSessionsByUserId(userId: string): Promise<number>` ·
  `deleteExpiredSessions(now: Date): Promise<number>` ·
  `class PrismaSessionStore extends Store`

> **`Store` của `express-session` là API callback**, Prisma là Promise. Cầu nối này là chỗ dễ
> nuốt lỗi nhất: quên gọi `cb(err)` ở nhánh reject làm request **treo im lặng** tới timeout. Mỗi
> hàm phải gọi callback đúng **một** lần trên **mọi** nhánh (`auth/PLAN.md:221`).

- [ ] **Step 1: Viết test thất bại**

```ts
// server/test/features/auth/prismaSessionStore.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../src/lib/db.js';
import { PrismaSessionStore } from '../../../src/features/auth/prismaSessionStore.js';

const store = new PrismaSessionStore();
let userId: string;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { email: 'store@lean.local', passwordHash: 'x' },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function setSession(sid: string, data: Record<string, unknown>, expiresAt: Date): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sid, { cookie: { expires: expiresAt }, ...data } as never, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

function getSession(sid: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    store.get(sid, (err, session) => (err ? reject(err) : resolve(session)));
  });
}

describe('PrismaSessionStore', () => {
  it('set rồi get trả lại đúng payload', async () => {
    const future = new Date(Date.now() + 60_000);
    await setSession('sid-1', { userId }, future);

    const session = await getSession('sid-1');
    expect(session).toMatchObject({ userId });
  });

  it('nhấc userId ra CỘT RIÊNG, không chỉ nằm trong blob data', async () => {
    // Không có cột này thì không truy vấn được "mọi phiên của user X", tức là
    // §7.6 (đá phiên cũ) và §7.7 (thu hồi khi đổi mật khẩu) không làm được.
    // Đây là lý do connect-sqlite3 bị loại (auth/SPEC.md:109-122).
    await setSession('sid-2', { userId }, new Date(Date.now() + 60_000));

    const row = await prisma.session.findUnique({ where: { id: 'sid-2' } });
    expect(row?.userId).toBe(userId);
  });

  it('destroy rồi get trả rỗng', async () => {
    await setSession('sid-3', { userId }, new Date(Date.now() + 60_000));
    await new Promise<void>((resolve, reject) => {
      store.destroy('sid-3', (err) => (err ? reject(err) : resolve()));
    });

    expect(await getSession('sid-3')).toBeFalsy();
  });

  it('phiên đã quá expiresAt coi như không tồn tại VÀ hàng bị dọn', async () => {
    await setSession('sid-4', { userId }, new Date(Date.now() - 1_000));

    expect(await getSession('sid-4')).toBeFalsy();
    expect(await prisma.session.findUnique({ where: { id: 'sid-4' } })).toBeNull();
  });

  it('touch đẩy expiresAt xa thêm (rolling session)', async () => {
    const near = new Date(Date.now() + 1_000);
    await setSession('sid-5', { userId }, near);

    const far = new Date(Date.now() + 600_000);
    await new Promise<void>((resolve, reject) => {
      store.touch('sid-5', { cookie: { expires: far } } as never, (err) =>
        err ? reject(err) : resolve(),
      );
    });

    const row = await prisma.session.findUnique({ where: { id: 'sid-5' } });
    expect(row!.expiresAt.getTime()).toBeGreaterThan(near.getTime());
  });

  it('get trên sid chưa từng tồn tại trả rỗng, KHÔNG ném lỗi', async () => {
    expect(await getSession('chua-bao-gio-co')).toBeFalsy();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/features/auth/prismaSessionStore.test.ts`
Expected: FAIL — không phân giải được `prismaSessionStore.js`.

- [ ] **Step 3: Hiện thực repository**

```ts
// server/src/features/auth/repositories/session.repository.ts
import { prisma } from '../../../lib/db.js';

// Chỗ DUY NHẤT của phiên được import `prisma`.

export async function findSessionById(
  sid: string,
): Promise<{ data: string; expiresAt: Date } | null> {
  return prisma.session.findUnique({
    where: { id: sid },
    select: { data: true, expiresAt: true },
  });
}

export async function upsertSession(
  sid: string,
  userId: string | null,
  data: string,
  expiresAt: Date,
): Promise<void> {
  // userId null xảy ra với phiên chưa đăng nhập (ví dụ phiên chỉ mang CSRF
  // secret). Cột userId là NOT NULL + có FK, nên phiên vô danh KHÔNG ghi được
  // vào bảng này — xem ghi chú ở prismaSessionStore.set.
  if (userId === null) return;

  await prisma.session.upsert({
    where: { id: sid },
    create: { id: sid, userId, data, expiresAt },
    update: { userId, data, expiresAt },
  });
}

export async function touchSession(sid: string, expiresAt: Date): Promise<void> {
  await prisma.session.updateMany({ where: { id: sid }, data: { expiresAt } });
}

export async function deleteSession(sid: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sid } });
}

/** Thu hồi mọi phiên của một user — dùng cho §7.6 và §7.7. */
export async function deleteSessionsByUserId(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

export async function deleteExpiredSessions(now: Date): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}
```

- [ ] **Step 4: Hiện thực store**

```ts
// server/src/features/auth/prismaSessionStore.ts
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
  get(
    sid: string,
    callback: (err?: unknown, session?: SessionData | null) => void,
  ): void {
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
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `npx vitest run test/features/auth/prismaSessionStore.test.ts`
Expected: PASS — 6 test.

- [ ] **Step 6: Bàn giao**

Đề xuất: `feat(auth): Prisma-backed express-session store`

---

## Task 5: Feature `auth` — 4 lớp, 5 endpoint

**Files:**
- Create: `server/src/features/auth/repositories/user.repository.ts`
- Create: `server/src/features/auth/dtos/auth.request.ts`
- Create: `server/src/features/auth/dtos/auth.response.ts`
- Create: `server/src/features/auth/services/auth.service.ts`
- Create: `server/src/features/auth/middleware/requireAuth.ts`
- Create: `server/src/features/auth/controllers/auth.controller.ts`
- Create: `server/src/features/auth/index.ts`
- Test: `server/test/features/auth/auth.controller.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword`, `dummyHash` (Task 3) · `AppError` factory (Task 1)
- Produces: `authRouter` · `requireAuth` middleware ·
  `registerUser(input: RegisterInput): Promise<PublicUser>` ·
  `authenticate(input: LoginInput): Promise<PublicUser>` ·
  `findPublicUserById(id: string): Promise<PublicUser | null>` ·
  `PublicUser = { id: string; email: string; displayName: string | null; status: string }`

Chống brute-force **chưa** vào task này — Task 9 thêm, để endpoint đăng nhập được chứng minh
đúng trước khi thêm lớp phòng thủ (`auth/PLAN.md:350`).

- [ ] **Step 1: Viết test thất bại**

```ts
// server/test/features/auth/auth.controller.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { hashPassword } from '../../../src/shared/security/password.js';

const app = createApp();

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: {
      email: 'user@lean.local',
      passwordHash: await hashPassword('123456'),
      displayName: 'Người dùng',
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('đăng ký thành công → 201, KHÔNG có passwordHash trong body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'moi@lean.local', password: 'matkhaudai12' });

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.body.user.email).toBe('moi@lean.local');
  });

  it('mật khẩu 6 ký tự → 400: min 8 áp ở đường ĐẶT mật khẩu', async () => {
    // Đối xứng với ca "123456 đăng nhập được" bên dưới. Hai ca này cùng nhau
    // mã hóa quyết định 4 của design doc: policy độ dài thuộc lúc tạo, không
    // thuộc lúc xác thực.
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ngan@lean.local', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.some((f: { path: string }) => f.path === 'password')).toBe(true);
  });

  it('email trùng → 400 với fields chỉ vào email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@lean.local', password: 'matkhaudai12' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].path).toBe('email');
  });

  it('email khác hoa thường vẫn là trùng — chuẩn hóa ở DTO', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: '  USER@Lean.Local  ', password: 'matkhaudai12' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('đúng mật khẩu → 200, Set-Cookie có HttpOnly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toMatch(/HttpOnly/i);
    expect(cookies.join(';')).toMatch(/lean\.sid/);
  });

  it('mật khẩu 6 ký tự đăng nhập ĐƯỢC — không áp min 8 ở đường login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(res.status).toBe(200);
  });

  it('sai mật khẩu và email không tồn tại trả GIỐNG HỆT nhau', async () => {
    // auth/SPEC.md §7.3: phân biệt hai ca biến form đăng nhập thành công cụ
    // liệt kê tài khoản. Với app sức khỏe, "email này có tài khoản" đã là
    // thông tin riêng tư.
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: 'sai-mat-khau' });
    const noSuchEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khongco@lean.local', password: 'sai-mat-khau' });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(noSuchEmail.body);
  });

  it('email sai định dạng → 400 kèm fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khong-phai-email', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('status disabled + mật khẩu ĐÚNG → 403 ACCOUNT_DISABLED', async () => {
    await prisma.user.update({
      where: { email: 'user@lean.local' },
      data: { status: 'disabled' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('status disabled + mật khẩu SAI → 401, không lộ việc tài khoản bị khóa', async () => {
    await prisma.user.update({
      where: { email: 'user@lean.local' },
      data: { status: 'disabled' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: 'sai' });

    expect(res.status).toBe(401);
  });

  it('session id ĐỔI sau khi đăng nhập (chống session fixation)', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/csrf');
    const before = await prisma.session.findMany();

    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });
    const after = await prisma.session.findMany();

    const beforeIds = new Set(before.map((s) => s.id));
    expect(after.some((s) => !beforeIds.has(s.id))).toBe(true);
  });
});

describe('GET /api/auth/session', () => {
  it('không cookie → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/auth/session');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('có cookie → 200, KHÔNG có passwordHash ở bất kỳ đâu trong body', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    const res = await agent.get('/api/auth/session');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@lean.local');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

describe('POST /api/auth/logout', () => {
  it('đăng xuất → 204, sau đó GET /session trả 401', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/session')).status).toBe(401);
  });

  it('đăng xuất khi CHƯA đăng nhập vẫn 204 (idempotent)', async () => {
    // Trả 401 ở đây chỉ tạo nhánh lỗi cho hành động vốn đã đạt mục đích:
    // người dùng muốn hết đăng nhập, và họ đang hết đăng nhập.
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/features/auth/auth.controller.test.ts`
Expected: FAIL — 404 trên mọi route `/api/auth/*` vì chưa cắm router.

- [ ] **Step 3: `user.repository.ts`**

```ts
// server/src/features/auth/repositories/user.repository.ts
import { prisma } from '../../../lib/db.js';

// Chỗ DUY NHẤT của feature này được import `prisma`.

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  status: string;
}

const PUBLIC_AND_HASH = {
  id: true,
  email: true,
  passwordHash: true,
  displayName: true,
  status: true,
} as const;

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { email }, select: PUBLIC_AND_HASH });
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_AND_HASH });
}

export async function emailExists(email: string): Promise<boolean> {
  return (await prisma.user.count({ where: { email } })) > 0;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName: string | null;
}): Promise<UserRecord> {
  return prisma.user.create({ data, select: PUBLIC_AND_HASH });
}

export async function updateLastLoginAt(userId: string, at: Date): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
}
```

- [ ] **Step 4: DTO vào và ra**

```ts
// server/src/features/auth/dtos/auth.request.ts
import { z } from 'zod';

/**
 * Chuẩn hóa TRƯỚC khi validate: `.trim().toLowerCase()` rồi mới kiểm định dạng.
 * Ngược thứ tự thì "  A@x.com " bị từ chối vì khoảng trắng.
 *
 * Chuẩn hóa ở ĐÚNG MỘT CHỖ này là thứ khiến không đường vào nào bỏ sót —
 * @unique của SQLite phân biệt hoa thường (auth/SPEC.md:353).
 *
 * Zod 4: `z.email()` top-level, KHÔNG `z.string().email()`. Kiểm cú pháp
 * `.pipe()` với bản Zod đang cài trước khi tin đoạn này.
 */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Trần 200 ký tự chặn DoS: Argon2 trên chuỗi 10 MB tốn CPU thật.
 * KHÔNG có `.min(8)` ở đây — policy độ dài thuộc đường ĐẶT mật khẩu, không
 * thuộc đường xác thực (design doc quyết định 4). Min ở đây còn khóa ngoài
 * chính chủ khi policy siết lên sau này.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

/** Min 8 chỉ ở đây và ở đường reset mật khẩu (giai đoạn C). */
export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(100).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
```

```ts
// server/src/features/auth/dtos/auth.response.ts
import type { UserRecord } from '../repositories/user.repository.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
}

export interface SessionResponse {
  user: PublicUser;
  expiresAt: string | null;
}

/**
 * Chọn trường TƯỜNG MINH, không trả nguyên row Prisma (auth/SPEC.md §4).
 * Đây là cách duy nhất khiến việc thêm một cột nhạy cảm vào `User` sau này
 * không tự động rò ra API.
 *
 * Giai đoạn B mở rộng SessionResponse thêm `permissions: string[]` — sửa ở
 * đây, KHÔNG tạo endpoint /api/auth/me riêng (rbac/SPEC.md:660).
 */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
  };
}

/**
 * Nhận `PublicUser`, KHÔNG nhận `UserRecord`. Hàm này không được có cơ hội
 * nhìn thấy `passwordHash`: kiểu đầu vào là lớp bảo vệ, không chỉ là chú thích.
 */
export function toSessionResponse(user: PublicUser, expiresAt: Date | null): SessionResponse {
  return { user, expiresAt: expiresAt ? expiresAt.toISOString() : null };
}
```

- [ ] **Step 5: `auth.service.ts`**

```ts
// server/src/features/auth/services/auth.service.ts
import { AppError } from '../../../shared/errors/AppError.js';
import { dummyHash, hashPassword, verifyPassword } from '../../../shared/security/password.js';
import type { LoginInput, RegisterInput } from '../dtos/auth.request.js';
import { toPublicUser, type PublicUser } from '../dtos/auth.response.js';
import * as userRepository from '../repositories/user.repository.js';

// Tầng này KHÔNG biết `req`, KHÔNG biết Prisma. Nhận dữ liệu đã validate,
// trả PublicUser hoặc ném AppError.

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  if (await userRepository.emailExists(input.email)) {
    // 400 + fields thay vì thêm mã CONFLICT mới: giữ union AppErrorCode nhỏ và
    // giữ đúng hình dạng lỗi 5 feature đang dùng.
    //
    // Đây là chỗ đăng ký mở tự nó tiết lộ email nào có tài khoản. Không bịt
    // được khi chưa có xác thực email — nợ đã ghi ở design doc §7.
    throw AppError.validation('Dữ liệu gửi lên không hợp lệ', [
      { path: 'email', message: 'Email này đã được dùng' },
    ]);
  }

  const user = await userRepository.createUser({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName ?? null,
  });

  return toPublicUser(user);
}

/**
 * Trả user khi mật khẩu đúng, ném AppError khi không.
 *
 * Hai nhánh phải mất thời gian TƯƠNG ĐƯƠNG: email không tồn tại vẫn chạy một
 * lần verify Argon2 với hash giả. Thoát sớm ở nhánh đó tạo chênh lệch thời gian
 * đo được, đủ để dò email nào có tài khoản (auth/SPEC.md §7.3).
 */
export async function authenticate(input: LoginInput): Promise<PublicUser> {
  const user = await userRepository.findUserByEmail(input.email);

  if (!user) {
    await verifyPassword(await dummyHash(), input.password);
    throw AppError.invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw AppError.invalidCredentials();
  }

  // Ngoại lệ CÓ CHỦ ĐÍCH so với §7.3: chỉ trả ACCOUNT_DISABLED SAU khi mật
  // khẩu đã đúng. Lúc đó người gọi đã chứng minh họ sở hữu tài khoản nên không
  // rò gì thêm — và im lặng ở đây khiến người dùng thật thử lại mật khẩu đúng
  // mãi không hiểu vì sao.
  if (user.status !== 'active') {
    throw AppError.accountDisabled();
  }

  await userRepository.updateLastLoginAt(user.id, new Date());
  return toPublicUser(user);
}

export async function findPublicUserById(id: string): Promise<PublicUser | null> {
  const user = await userRepository.findUserById(id);
  return user ? toPublicUser(user) : null;
}
```

- [ ] **Step 6: `requireAuth.ts`**

```ts
// server/src/features/auth/middleware/requireAuth.ts
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';

/**
 * Chốt chặn phiên. Mắc MỘT lần trong app.ts trước năm router dữ liệu, không
 * rải vào từng feature (auth/SPEC.md:217): mặc định là ĐÓNG, chỉ mở ra bằng
 * whitelist tường minh. Cách ngược lại — mặc định mở, tự nhớ khóa từng route —
 * chắc chắn sẽ có ngày quên một route.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!userId) {
    next(AppError.unauthorized());
    return;
  }
  req.user = { id: userId };
  next();
}
```

- [ ] **Step 7: `auth.controller.ts` + `index.ts`**

```ts
// server/src/features/auth/controllers/auth.controller.ts
import { Router, type Request, type Response } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';
import { loginSchema, registerSchema } from '../dtos/auth.request.js';
import { toSessionResponse } from '../dtos/auth.response.js';
import * as authService from '../services/auth.service.js';

export const authController = Router();

/**
 * Lớp DUY NHẤT của app được chạm `req.session`.
 *
 * API phiên của express-session là CALLBACK, không phải Promise. Quên await là
 * tạo race: response trả về trước khi phiên kịp ghi xuống store, request kế
 * tiếp thấy như chưa đăng nhập — lỗi chập chờn rất khó lần ra
 * (auth/SPEC.md:190).
 */
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

/** Đăng ký mở công khai. Vai trò gán cứng phía server ở giai đoạn B — KHÔNG đọc từ body. */
authController.post('/register', async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body ?? {});
  res.status(201).json({ user: await authService.registerUser(input) });
});

authController.post('/login', async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body ?? {});
  const user = await authService.authenticate(input);

  // Xoay session id TRƯỚC khi ghi userId. Không xoay thì id trước và sau đăng
  // nhập là một, và kẻ tấn công ép nạn nhân dùng một id hắn biết rồi dùng lại
  // chính id đó sau khi nạn nhân đăng nhập (auth/SPEC.md §7.4).
  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  res.json(toSessionResponse(user, req.session.cookie.expires ?? null));
});

/** Idempotent: gọi khi không có phiên vẫn 204. */
authController.post('/logout', async (req: Request, res: Response) => {
  if (req.session?.userId) await destroySession(req);
  res.clearCookie('lean.sid');
  res.status(204).end();
});

/**
 * Route này KHÔNG đi qua requireAuth (nó nằm trước requireAuth trong chuỗi
 * app.ts), nên tự kiểm phiên.
 */
authController.get('/session', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw AppError.unauthorized();

  const user = await authService.findPublicUserById(userId);
  if (!user) {
    // Phiên trỏ vào user đã bị xóa: hủy phiên rồi trả 401, đừng trả 500.
    await destroySession(req);
    throw AppError.unauthorized();
  }

  res.json(toSessionResponse(user, req.session.cookie.expires ?? null));
});
```

Controller vì thế **không** import `user.repository` — nó đi qua service như mọi lớp khác. Bỏ
dòng `import * as userRepository` ở đầu file.

```ts
// server/src/features/auth/index.ts
import { Router } from 'express';
import { authController } from './controllers/auth.controller.js';

// `app.ts` cắm router này ở prefix `/api/auth` — path bên trong là tương đối.
export const authRouter = Router();

authRouter.use('/', authController);

export { requireAuth } from './middleware/requireAuth.js';
```

- [ ] **Step 8: Cắm router tối thiểu để test chạy được**

Task 6 mới mắc đủ chuỗi middleware. Ở task này chỉ thêm `session` + `authRouter` vào `app.ts`,
**chưa** thêm `requireAuth` trước năm router dữ liệu (thêm sớm sẽ làm 208 test cũ đỏ hàng loạt
trước khi có helper đăng nhập ở Task 10).

```ts
// server/src/app.ts — thêm sau express.json()
  app.use(
    session({
      name: 'lean.sid',
      secret: env.SESSION_SECRET,
      store: new PrismaSessionStore(),
      resave: false,
      // BẮT BUỘC false: phiên vô danh không ghi được vào bảng Session vì cột
      // userId có khóa ngoại tới User. Đặt true là ném lỗi FK ở mọi request
      // của khách chưa đăng nhập.
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      },
    }),
  );

  app.use('/api/auth', authRouter);
```

- [ ] **Step 9: Chạy test, xác nhận xanh**

Run: `npx vitest run test/features/auth/auth.controller.test.ts`
Expected: PASS — 15 test.

Ca `GET /api/auth/csrf` chưa tồn tại nên test "session id đổi" phải bỏ lời gọi đó, hoặc đợi
Task 6. Nếu chọn đợi: đánh dấu ca đó `it.skip` **và** ghi lý do vào comment, rồi bỏ skip ở
Task 6. Không để `it.skip` không giải thích.

- [ ] **Step 10: Bàn giao**

Đề xuất: `feat(auth): register, login, logout, session endpoints`

---

## Task 6: `app.ts` — helmet, CSRF, `requireAuth`, dọn phiên

**Files:**
- Modify: `server/src/app.ts`
- Modify: `server/src/server.ts` (mắc tác vụ dọn phiên)
- Modify: `server/src/features/auth/controllers/auth.controller.ts` (thêm `GET /csrf`)
- Test: `server/test/features/auth/middleware.test.ts`

**Interfaces:**
- Consumes: `authRouter`, `requireAuth` (Task 5) · `pruneExpiredSessions` (Task 4)
- Produces: `GET /api/auth/csrf` → `200 { csrfToken: string }`

> **Thứ tự middleware là bảo mật, không phải thẩm mỹ** (`auth/SPEC.md:198`). Thứ tự chốt:
> `helmet` → `express.json` → `session` → csrf → `/api/health` → `/api/auth/*` → `requireAuth`
> → 5 router dữ liệu → `notFoundHandler` → `errorHandler`.

- [x] **Step 1: Viết test thất bại**

```ts
// server/test/features/auth/middleware.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { hashPassword } from '../../../src/shared/security/password.js';

const app = createApp();

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: { email: 'user@lean.local', passwordHash: await hashPassword('123456') },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('requireAuth chặn năm router dữ liệu', () => {
  it.each([
    ['/api/goal'],
    ['/api/summary?from=2026-08-01&to=2026-08-10'],
    ['/api/reminders'],
    ['/api/body-logs?from=2026-08-01&to=2026-08-10'],
    ['/api/meals?date=2026-08-10'],
  ])('%s không phiên → 401 UNAUTHORIZED', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('/api/health vẫn công khai', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('đã đăng nhập → vào được /api/goal', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    expect((await agent.get('/api/goal')).status).toBe(200);
  });
});

describe('helmet', () => {
  it('gắn security header vào response', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('CSRF', () => {
  it('GET /api/auth/csrf trả token', async () => {
    const res = await request(app).get('/api/auth/csrf');

    expect(res.status).toBe(200);
    expect(typeof res.body.csrfToken).toBe('string');
  });

  it('PUT không kèm CSRF token → 403 CSRF_ERROR, không phải 500', async () => {
    // Nếu ca này trả 500 thì thiếu nhánh nhận diện lỗi CSRF trong
    // errorHandler (Task 1 Step 9).
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    const res = await agent.put('/api/goal').send({ targetWeightKg: 68 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ERROR');
  });

  it('PUT kèm CSRF token đúng → không bị 403', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    const res = await agent
      .put('/api/goal')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ targetWeightKg: 68 });

    expect(res.status).not.toBe(403);
  });
});
```

- [x] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/features/auth/middleware.test.ts`
Expected: FAIL — `/api/goal` trả 200 thay vì 401; `/api/auth/csrf` trả 404.

- [x] **Step 3: Thêm `GET /csrf` vào controller**

> **Không bịa chữ ký `csrf-csrf`.** API của nó đã đổi tên giữa các major version. Hàm khởi tạo
> nhận một object cấu hình (trong đó có cách lấy secret và cách lấy định danh phiên) và trả về
> một middleware bảo vệ cùng một hàm sinh token. **Tra README của đúng bản đang cài** — mô tả ở
> đây là hành vi, không phải chữ ký (`auth/SPEC.md:560`).

```ts
// server/src/features/auth/controllers/auth.controller.ts
import { generateCsrfToken } from '../../../shared/security/csrf.js';

/**
 * Web gọi endpoint này khi khởi động và gắn token vào mọi request ghi.
 * GET nên không cần token — nếu không thì không có đường nào lấy token đầu tiên.
 */
authController.get('/csrf', (req: Request, res: Response) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});
```

```ts
// server/src/shared/security/csrf.ts
import { doubleCsrf } from 'csrf-csrf';
import { env } from '../../config/env.js';

/**
 * Double-submit cookie CÓ KÝ: token nằm trong một cookie *và* phải được gửi lại
 * trong header `x-csrf-token`. Trang khác miền không đọc được cookie nên không
 * dựng được header khớp.
 *
 * Lean BẬT CSRF, cố ý khác upip (upip tắt ở gateway vì FE của nó là SPA riêng
 * miền — auth/SPEC.md:555). Lean phục vụ web CÙNG origin và dùng cookie phiên
 * → CSRF là mối đe dọa thật.
 *
 * ⚠️ **Tra README của đúng bản `csrf-csrf` đang cài trước khi tin đoạn này.**
 * Tên hàm khởi tạo và tên các trường trả về ĐÃ ĐỔI giữa các major version
 * (`doubleCsrf` → có bản đổi tên; `generateToken` → `generateCsrfToken`).
 * Mô tả ở đây là HÀNH VI, không phải chữ ký (auth/SPEC.md:560).
 */
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.SESSION_SECRET,
  // Gắn token với phiên: token của người này không dùng được cho người khác.
  getSessionIdentifier: (req) => req.sessionID,
  cookieName: 'lean.csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  },
});

export { doubleCsrfProtection as csrfProtection, generateCsrfToken };
```

`csrf-csrf` cần đọc/ghi cookie riêng của nó nên **phải có `cookie-parser`** mắc trước nó (hoặc
bản đang cài tự xử lý — kiểm README). Nếu thiếu, mọi request ghi trả `403` kể cả khi token đúng.

- [x] **Step 4: Mắc đủ chuỗi middleware trong `app.ts`**

```ts
/**
 * CSP mặc định của helmet CHẶN Vite dev server — Vite tiêm script và mở
 * WebSocket cho HMR. Nới theo môi trường, KHÔNG tắt hẳn CSP để cho dev chạy;
 * đó là cách nó vô tình lên production (auth/SPEC.md:604).
 */
function helmetOptions(nodeEnv: string) {
  if (nodeEnv === 'production') return undefined; // mặc định của helmet
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
  };
}

export function createApp(): express.Express {
  const app = express();

  app.use(helmet(helmetOptions(env.NODE_ENV)));
  app.use(express.json());
  app.use(
    session({
      name: 'lean.sid',
      secret: env.SESSION_SECRET,
      store: new PrismaSessionStore(),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      },
    }),
  );
  app.use(csrfProtection);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);

  // Chốt chặn: mọi thứ dưới đây cần phiên. Đặt requireAuth MỘT lần ở đây,
  // không rải vào từng feature.
  app.use(requireAuth);

  app.use('/api/body-logs', bodyLogsRouter);
  app.use('/api/meals', mealsRouter);
  app.use('/api/goal', goalRouter);
  app.use('/api/summary', summaryRouter);
  app.use('/api/reminders', remindersRouter);

  // Thứ tự bắt buộc: notFound trước, errorHandler cuối cùng.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

- [x] **Step 5: Mắc tác vụ dọn phiên hết hạn**

Bảng `Session` phình vô hạn nếu không dọn — hàng chết không bao giờ bị đọc lại để phát hiện.

```ts
// server/src/server.ts — trong callback của app.listen, sau startReminderScheduler()
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // mỗi giờ

const pruneTimer = setInterval(() => {
  void pruneExpiredSessions().catch((err: unknown) => {
    // Không để lỗi dọn dẹp làm chết tiến trình, nhưng cũng không im lặng.
    console.error('[prune-sessions]', err);
  });
}, PRUNE_INTERVAL_MS);

// `unref()` để timer không giữ tiến trình sống khi shutdown.
pruneTimer.unref();
```

Trong `shutdown()` (`server.ts:20-24`) thêm `clearInterval(pruneTimer)` trước
`stopReminderScheduler()`.

- [x] **Step 6: Chạy test, xác nhận xanh**

Run: `npx vitest run test/features/auth/middleware.test.ts`
Expected: PASS — 10 test.

- [x] **Step 7: `npm test` — kỳ vọng ĐỎ và đó là đúng**

```bash
npm test
```
Expected: 208 test cũ **đỏ hàng loạt** với `401 UNAUTHORIZED` — chúng gọi API mà không có phiên.
Đây là bằng chứng `requireAuth` hoạt động. Task 10 sửa chúng bằng helper đăng nhập.

**Không** gỡ `requireAuth` để test xanh lại. Ghi rõ trong bàn giao rằng test đang đỏ có chủ đích,
kèm số lượng.

- [x] **Step 8: Bàn giao**

Đề xuất: `feat(auth): wire helmet, session, csrf and requireAuth into app`

---

## Task 7: Thay `LOCAL_USER_ID` ở `goal` và `meals`

**Files:**
- Modify: `server/src/features/goal/services/goal.service.ts:1,11,16`
- Modify: `server/src/features/goal/controllers/goal.controller.ts`
- Modify: `server/src/features/meals/services/meals.service.ts:1,12,15,20,26,33`
- Modify: `server/src/features/meals/controllers/meals.controller.ts`

**Interfaces:**
- Consumes: `req.user.id` (Task 5)
- Produces: `goalService.getGoal(userId: string)` · `goalService.upsertGoal(userId: string, patch: GoalPatch)` ·
  `mealsService` — mọi hàm nhận `userId: string` làm **tham số đầu tiên**

Hai feature này làm đúng ngay từ đầu: repository của chúng **đã** nhận `userId` làm tham số, hằng
chỉ xuất hiện ở service. **Không chạm repository** (`docs/features/meals/SPEC.md:239`).

- [x] **Step 1: Sửa `goal.service.ts` — bỏ import hằng, nhận tham số**

```ts
// server/src/features/goal/services/goal.service.ts
import type { GoalPatch } from '../dtos/goal.request.js';
import { toGoalResponse, type GoalResponse } from '../dtos/goal.response.js';
import * as goalRepository from '../repositories/goal.repository.js';

/** Không ném 404 khi chưa đặt mục tiêu — `toGoalResponse` trả object toàn `null`. */
export async function getGoal(userId: string): Promise<GoalResponse> {
  return toGoalResponse(await goalRepository.findGoal(userId));
}

export async function upsertGoal(userId: string, patch: GoalPatch): Promise<GoalResponse> {
  return toGoalResponse(await goalRepository.upsertGoal(userId, patch));
}
```

- [x] **Step 2: Sửa `goal.controller.ts` — lấy `userId` từ `req.user`**

Controller là lớp duy nhất biết `req`. Service **không** đọc `req` — giữ ranh giới
`docs/overview/01-architecture.md:71-76`.

```ts
goalController.get('/', async (req: Request, res: Response) => {
  res.json(await goalService.getGoal(req.user!.id));
});

goalController.put('/', async (req: Request, res: Response) => {
  const parsed = goalUpsertSchema.parse(req.body ?? {});
  res.json(await goalService.upsertGoal(req.user!.id, toGoalPatch(req.body, parsed)));
});
```

`req.user!` an toàn vì `requireAuth` chạy trước và ném `401` khi không có phiên. Nếu thấy `!`
khó chịu: thêm một hàm `currentUserId(req): string` trong `shared/` ném `AppError.unauthorized()`
khi thiếu — nhưng **đừng** để service tự đọc `req` để tránh dấu `!`.

- [x] **Step 3: Sửa `meals.service.ts`**

Xóa hàm `currentUserId()` ở `:12` và import hằng ở `:1`. Mọi hàm export nhận `userId: string` làm
tham số **đầu tiên**, truyền thẳng xuống repository (repository đã nhận sẵn `userId` — **không
chạm**).

```ts
// server/src/features/meals/services/meals.service.ts — hình dạng sau khi sửa.
// Tên hàm và kiểu trả về giữ NGUYÊN như bản hiện có; chỉ thêm tham số đầu tiên.
export async function listMeals(userId: string, date: string): Promise<MealView[]> {
  return (await mealsRepository.findMealsByDate(userId, date)).map(toMealView);
}

export async function createMeal(userId: string, input: CreateMealInput): Promise<MealView> {
  return toMealView(await mealsRepository.insertMeal(userId, input));
}

export async function updateMeal(
  userId: string,
  id: string,
  input: UpdateMealInput,
): Promise<MealView> {
  const updated = await mealsRepository.updateMeal(userId, id, input);
  if (!updated) throw AppError.notFound('Không tìm thấy bữa ăn');
  return toMealView(updated);
}

export async function deleteMeal(userId: string, id: string): Promise<void> {
  if (!(await mealsRepository.deleteMeal(userId, id))) {
    throw AppError.notFound('Không tìm thấy bữa ăn');
  }
}
```

**Đối chiếu tên hàm thật trong file trước khi sửa** — đoạn trên viết theo chữ ký suy ra từ
`meals.controller.ts`, và tên có thể khác. Giữ tên hiện có, chỉ thêm tham số.

Controller truyền `req.user!.id` làm đối số đầu tiên cho cả bốn lời gọi.

**Không** gỡ `userId` khỏi `updateMeal`/`deleteMeal` ở repository với lý do "middleware chặn rồi":
`updateMany`/`deleteMany` với `where: { id, userId }` chính là lớp cách ly hàng, và nó là lớp
quan trọng hơn RBAC (`rbac/SPEC.md:188`).

- [x] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: sạch. Nếu còn lỗi ở `test/`, để nguyên — Task 10 xử lý test.

- [x] **Step 5: Bàn giao**

Đề xuất: hai commit — `refactor(goal): take userId from session` và
`refactor(meals): take userId from session`

---

## Task 8: Thay `LOCAL_USER_ID` ở `bodyLogs` và `summary` — đổi chữ ký repository

**Files:**
- Modify: `server/src/features/bodyLogs/repositories/bodyLogs.repository.ts:3,14,24,40,50`
- Modify: `server/src/features/bodyLogs/services/bodyLogs.service.ts`
- Modify: `server/src/features/bodyLogs/controllers/bodyLogs.controller.ts`
- Modify: `server/src/features/summary/repositories/summary.repository.ts:2,44,66,82`
- Modify: `server/src/features/summary/services/summary.service.ts:42`
- Modify: `server/src/features/summary/controllers/summary.controller.ts:11`

**Interfaces:**
- Produces: `whereKey(userId: string, date: string)` ·
  `findByDate(userId: string, date: string)` · `findInRange(userId: string, from: string, to: string)` ·
  `upsertByDate(userId: string, date: string, patch: BodyLogUpsertPatch)` ·
  `deleteByDate(userId: string, date: string)` ·
  `findBodyLogsBetween(userId: string, fromIso: string, toIso: string)` ·
  `findDailyMealTotals(userId: string, fromIso: string, toIso: string)` ·
  `findGoal(userId: string)` · `summaryService.getSummary(userId: string, range: SummaryQuery)`

> **Đừng tin lời hứa "thay hằng là xong"** ở `docs/overview/02-data-model.md:13`. Với hai
> feature này nó là **đổi chữ ký hàm ở tầng repository và sửa mọi lời gọi ở tầng service**
> (`auth/SPEC.md:457`). Vẫn cơ học, nhưng không phải một dòng.

- [x] **Step 1: Đổi chữ ký `bodyLogs.repository.ts`**

`userId` là **tham số đầu tiên** của cả 5 hàm, khớp quán lệ của `goal.repository.ts`:

```ts
function whereKey(userId: string, date: string) {
  return { userId_date: { userId, date } };
}

export async function findByDate(userId: string, date: string): Promise<BodyLog | null> {
  return prisma.bodyLog.findUnique({ where: whereKey(userId, date) });
}

export async function findInRange(
  userId: string,
  from: string,
  to: string,
): Promise<BodyLog[]> {
  return prisma.bodyLog.findMany({
    where: { userId, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });
}

export async function upsertByDate(
  userId: string,
  date: string,
  patch: BodyLogUpsertPatch,
): Promise<BodyLog> {
  return prisma.bodyLog.upsert({
    where: whereKey(userId, date),
    create: { userId, date, ...patch },
    update: patch,
  });
}

export async function deleteByDate(userId: string, date: string): Promise<boolean> {
  const result = await prisma.bodyLog.deleteMany({ where: { userId, date } });
  return result.count > 0;
}
```

Xóa `import { LOCAL_USER_ID }` ở `:3`.

**Giữ nguyên `deleteMany` thay vì `delete`** — không có bản ghi thì trả count 0 chứ không ném
P2025. Và với nhiều người dùng, `deleteMany({ where: { userId, date } })` là **lớp cách ly hàng**:
`delete({ where: { date } })` sẽ xóa bản ghi của người khác.

- [x] **Step 2: Sửa service và controller của `bodyLogs`**

Service nhận `userId` làm tham số đầu, truyền xuống repository. Controller truyền `req.user!.id`.

- [x] **Step 3: Đổi chữ ký `summary.repository.ts` — 3 hàm**

`findBodyLogsBetween`, `findDailyMealTotals`, `findGoal` nhận `userId` làm tham số đầu tiên. Xóa
import hằng ở `:2`.

```ts
export async function findBodyLogsBetween(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<BodyLogRow[]> {
  return prisma.bodyLog.findMany({
    where: { userId, date: { gte: fromIso, lte: toIso } },
    select: { date: true, weightKg: true, waistCm: true },
    orderBy: { date: 'asc' },
  });
}

export async function findGoal(userId: string): Promise<GoalRow | null> {
  return prisma.goal.findUnique({
    where: { userId },
    select: { targetWeightKg: true, targetDate: true, dailyCalorieTarget: true },
  });
}
```

`findDailyMealTotals` là chỗ **dễ bỏ sót nhất của cả giai đoạn A**: nó dùng `groupBy`, và thiếu
`userId` trong `where` thì nó gộp calo của **mọi** người dùng vào một tổng — không ném lỗi, không
test nào hiện có bắt được, chỉ là số liệu sai một cách âm thầm.

```ts
export async function findDailyMealTotals(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<DailyMealTotal[]> {
  const rows = await prisma.meal.groupBy({
    by: ['date'],
    // userId ở ĐÂY, không phải chỉ ở orderBy hay having. Thiếu nó là gộp calo
    // của mọi người dùng vào một tổng.
    where: { userId, date: { gte: fromIso, lte: toIso } },
    _sum: { calories: true },
    _count: { _all: true },
    orderBy: { date: 'asc' },
  });

  return rows.map((row) => ({
    date: row.date,
    totalCalories: row._sum.calories ?? 0,
    mealCount: row._count._all,
  }));
}
```

**Đối chiếu với bản hiện có trước khi thay** — hình dạng `_sum`/`_count` phải khớp cách hàm đang
map, và ca "trung bình calo tuần bỏ qua ngày không ghi bữa nào" (`CLAUDE.md` mục Cạm bẫy) phụ
thuộc vào `mealCount`. Test `test/features/summary/` hiện có canh hành vi đó — nếu chúng đỏ sau
bước này thì bản thay đã đổi ngữ nghĩa, **không** phải test sai.

- [x] **Step 4: Sửa `summary.service.ts:42` và `summary.controller.ts:11`**

```ts
export async function getSummary(userId: string, range: SummaryQuery): Promise<SummaryResponse> {
```

Ba lời gọi repository bên trong đều thêm `userId`. `shared/stats/` **không đổi một dòng** — chúng
là hàm thuần nhận dữ liệu đã lấy sẵn.

- [x] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: sạch trong `src/`.

- [x] **Step 6: Bàn giao**

Đề xuất: `refactor(bodyLogs,summary): pass userId through repository layer`

---

## Task 9: Thay `LOCAL_USER_ID` ở `reminders` + scheduler đa người dùng

**Files:**
- Modify: `server/src/features/reminders/repositories/reminders.repository.ts:2,35,43,59,61,75,82`
- Modify: `server/src/features/reminders/services/reminders.service.ts:37,54`
- Modify: `server/src/features/reminders/controllers/reminders.controller.ts`
- Modify: `server/src/features/reminders/dtos/reminders.response.ts:7,23`
- Modify: `server/src/features/reminders/services/reminders.scheduler.ts:35-47,118-148`
- Test: `server/test/features/reminders/scheduler.multiUser.test.ts`

**Interfaces:**
- Produces: `findAllReminders(userId: string)` · `findRemindersForAllUsers()` ·
  `findReminderByKind(userId: string, kind: string)` · `upsertReminder(userId: string, …)` ·
  `hasWeightLoggedOn(userId: string, date: string)` · `hasMealLoggedOn(userId: string, date: string)` ·
  `ReminderView` thêm `userId: string` ·
  `ReminderRunnerDeps` — `listReminders(): Promise<ReminderView[]>` (mọi user),
  `hasWeightLogged(userId, date)`, `hasMealLogged(userId, date)`, `send(message)`

> **Đây là chỗ "thêm auth" thực sự đổi logic nghiệp vụ**, không chỉ đổi nguồn của một biến
> (`auth/SPEC.md:495`). Scheduler chạy từ **cron**, không từ HTTP request — không có `req`, nên
> không có `req.session`, nên không có `userId`.
>
> **Rủi ro:** một vòng lặp sai chỗ gửi nhắc nhở của người này tới topic ntfy của người khác —
> **rò dữ liệu sức khỏe**. Đó là lý do task này có test riêng với hai user.
>
> **`selectDueReminders` (`:84`) là hàm thuần và vẫn ĐÚNG NGUYÊN** — nó lọc theo `enabled` +
> `timeOfDay` + có topic, không quan tâm ai sở hữu. **Đừng viết lại.**

- [x] **Step 1: Viết test thất bại — hai user, một người đã ghi cân**

```ts
// server/test/features/reminders/scheduler.multiUser.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../src/lib/db.js';
import {
  runDueReminders,
  type ReminderRunnerDeps,
} from '../../../src/features/reminders/services/reminders.scheduler.js';
import type { NtfyMessage, NtfySendResult } from '../../../src/shared/clients/ntfy.client.js';

let userA: string;
let userB: string;

beforeEach(async () => {
  await prisma.reminder.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.user.deleteMany();
  userA = (await prisma.user.create({ data: { email: 'a@lean.local', passwordHash: 'x' } })).id;
  userB = (await prisma.user.create({ data: { email: 'b@lean.local', passwordHash: 'x' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('runDueReminders với nhiều người dùng', () => {
  it('chỉ người CHƯA ghi cân nhận nhắc, và gửi tới ĐÚNG topic của người đó', async () => {
    // Test quan trọng nhất của task này. Gửi nhầm topic ở đây là rò dữ liệu
    // sức khỏe sang người lạ — không có test nào khác bắt được.
    const sent: NtfyMessage[] = [];
    const loggedWeight = new Set([userA]);

    const deps: ReminderRunnerDeps = {
      listReminders: async () => [
        { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-a' },
        { userId: userB, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-b' },
      ],
      hasWeightLogged: async (userId: string) => loggedWeight.has(userId),
      hasMealLogged: async () => false,
      send: async (message: NtfyMessage): Promise<NtfySendResult> => {
        sent.push(message);
        return { sent: true };
      },
    };

    // 07:00 giờ Việt Nam = 00:00 UTC.
    await runDueReminders(new Date('2026-08-10T00:00:00.000Z'), deps);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.topic).toBe('topic-b');
  });

  it('hai user cùng giờ, cả hai chưa ghi → hai lượt gửi, hai topic khác nhau', async () => {
    const sent: NtfyMessage[] = [];
    const deps: ReminderRunnerDeps = {
      listReminders: async () => [
        { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-a' },
        { userId: userB, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-b' },
      ],
      hasWeightLogged: async () => false,
      hasMealLogged: async () => false,
      send: async (message: NtfyMessage): Promise<NtfySendResult> => {
        sent.push(message);
        return { sent: true };
      },
    };

    await runDueReminders(new Date('2026-08-10T00:00:00.000Z'), deps);

    expect(sent.map((m) => m.topic).sort()).toEqual(['topic-a', 'topic-b']);
  });
});

describe('findRemindersForAllUsers', () => {
  it('lấy nhắc nhở của mọi user trong MỘT truy vấn, mỗi hàng mang userId', async () => {
    // Không lặp N+1 qua từng user (auth/SPEC.md:487).
    const { findRemindersForAllUsers } = await import(
      '../../../src/features/reminders/repositories/reminders.repository.js'
    );
    await prisma.reminder.create({
      data: { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 't' },
    });
    await prisma.reminder.create({
      data: { userId: userB, kind: 'meal_log', timeOfDay: '20:00', enabled: true, ntfyTopic: 'u' },
    });

    const rows = await findRemindersForAllUsers();

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.userId))).toEqual(new Set([userA, userB]));
  });
});
```

- [x] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/features/reminders/scheduler.multiUser.test.ts`
Expected: FAIL — `ReminderRunnerDeps.hasWeightLogged` chưa nhận `userId`;
`findRemindersForAllUsers` không tồn tại.

- [x] **Step 3: Thêm `userId` vào `ReminderView`**

```ts
// server/src/features/reminders/dtos/reminders.response.ts
export interface ReminderView {
  userId: string;
  kind: string;
  timeOfDay: string;
  enabled: boolean;
  ntfyTopic: string | null;
}
```

`toReminderView` map thêm `userId` từ row.

> **Kiểm chỗ này:** `ReminderView` cũng là hình dạng trả về của `GET /api/reminders`. Thêm
> `userId` vào đó là **lộ id người dùng ra API** — vô hại vì người gọi chỉ thấy id của chính
> mình, nhưng nếu muốn giữ response sạch thì tách hai kiểu: `ReminderView` (API, không có
> `userId`) và `ReminderRow` (scheduler, có `userId`). **Chọn một và ghi rõ lý do trong code.**

- [x] **Step 4: Đổi chữ ký `reminders.repository.ts`**

5 hàm hiện có nhận `userId` làm tham số đầu tiên. Thêm một hàm mới:

```ts
/**
 * Nhắc nhở của MỌI user trong MỘT truy vấn — dùng bởi scheduler, vốn chạy từ
 * cron nên không có phiên. Không lặp N+1 qua từng user.
 */
export async function findRemindersForAllUsers(): Promise<ReminderRecord[]> {
  return prisma.reminder.findMany({ where: { enabled: true } });
}
```

`hasWeightLoggedOn(userId, date)` và `hasMealLoggedOn(userId, date)` — mệnh đề `where` mang
`userId`, nếu không scheduler sẽ thấy "đã có người ghi cân" và im lặng với **tất cả**.

- [x] **Step 5: Đổi `ReminderRunnerDeps` và `runDueReminders`**

```ts
export interface ReminderRunnerDeps {
  /** Nhắc nhở của MỌI user. Scheduler không có phiên nên không lọc theo ai. */
  listReminders(): Promise<ReminderView[]>;
  hasWeightLogged(userId: string, date: string): Promise<boolean>;
  hasMealLogged(userId: string, date: string): Promise<boolean>;
  send(message: NtfyMessage): Promise<NtfySendResult>;
}

export const defaultReminderRunnerDeps: ReminderRunnerDeps = {
  listReminders: async () => (await findRemindersForAllUsers()).map(toReminderView),
  hasWeightLogged: hasWeightLoggedOn,
  hasMealLogged: hasMealLoggedOn,
  send: sendNtfyNotification,
};
```

`needsReminder` nhận thêm `userId` và truyền xuống. `runDueReminders` giữ nguyên cấu trúc —
vẫn gọi `selectDueReminders` rồi lặp — chỉ truyền `reminder.userId` vào `needsReminder`.
`ReminderRunOutcome` nên thêm `userId` để log phân biệt được ai.

Giữ nguyên hai quyết định đã có: **không gửi bù** khi server tắt (`:16-18`), và **không nuốt lỗi
gửi** (`:115` — lỗi trả về dưới dạng `status: 'send-failed'`).

- [x] **Step 6: Sửa service, controller của `reminders`**

`listReminders(userId)`, `updateReminder(userId, …)`. Controller truyền `req.user!.id`.

- [x] **Step 7: Chạy test, xác nhận xanh**

Run: `npx vitest run test/features/reminders/scheduler.multiUser.test.ts`
Expected: PASS — 3 test.

- [x] **Step 8: Bàn giao**

Đề xuất: `fix(reminders): scan reminders across all users`

---

## Task 10: Sửa test hiện có, test cách ly người dùng, xóa hằng

**Files:**
- Create: `server/test/helpers/auth.ts`
- Modify: `server/test/features/{bodyLogs,meals,summary,reminders}/*.test.ts`
- Modify: `server/test/lib/db.test.ts`
- Create: `server/test/features/userIsolation.test.ts`
- Delete: `server/src/shared/constants.ts`

**Interfaces:**
- Consumes: `authRouter`, `createApp` (Task 5–6)
- Produces: `createTestUser(email, password): Promise<{ id, email, password }>` ·
  `loginAgent(app, email, password): Promise<SuperAgentTest>`

- [x] **Step 1: Viết helper**

```ts
// server/test/helpers/auth.ts
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/lib/db.js';
import { hashPassword } from '../../src/shared/security/password.js';

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createTestUser(
  email: string,
  password = 'matkhaudai12',
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  return { id: user.id, email, password };
}

/**
 * `request.agent(app)` giữ cookie giữa các request — khác `request(app)`, vốn
 * tạo request độc lập và vì thế luôn nhận 401 sau khi có requireAuth.
 *
 * Lấy CSRF token trước rồi gắn vào agent, nếu không mọi POST/PUT/PATCH/DELETE
 * trong test sẽ nhận 403 CSRF_ERROR.
 */
export async function loginAgent(app: Express, user: TestUser) {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf');
  agent.set('x-csrf-token', csrf.body.csrfToken as string);
  await agent.post('/api/auth/login').send({ email: user.email, password: user.password });
  return agent;
}
```

> **Kiểm chỗ này khi code:** `agent.set(...)` có gắn header cho mọi request sau đó hay không phụ
> thuộc bản `supertest` đang cài. Nếu không, viết một hàm bọc nhận `(method, path)` và tự gắn
> header mỗi lần. **Đừng để test tự tắt CSRF** — làm thế là test một app khác với app chạy thật.

- [x] **Step 2: Viết test cách ly người dùng — deliverable quan trọng nhất**

```ts
// server/test/features/userIsolation.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/db.js';
import { createTestUser, loginAgent, type TestUser } from '../helpers/auth.js';

const app = createApp();
let alice: TestUser;
let bob: TestUser;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.user.deleteMany();
  alice = await createTestUser('alice@lean.local');
  bob = await createTestUser('bob@lean.local');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('cách ly người dùng — một truy vấn quên userId là rò dữ liệu sức khỏe', () => {
  it('body-logs: Alice không thấy số đo của Bob', async () => {
    await prisma.bodyLog.create({
      data: { userId: bob.id, date: '2026-08-10', weightKg: 99 },
    });
    await prisma.bodyLog.create({
      data: { userId: alice.id, date: '2026-08-10', weightKg: 60 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/body-logs/2026-08-10');

    expect(res.status).toBe(200);
    expect(res.body.weightKg).toBe(60);
  });

  it('body-logs khoảng ngày: chỉ trả hàng của người đang gọi', async () => {
    await prisma.bodyLog.create({ data: { userId: bob.id, date: '2026-08-09', weightKg: 99 } });
    await prisma.bodyLog.create({ data: { userId: alice.id, date: '2026-08-10', weightKg: 60 } });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/body-logs?from=2026-08-01&to=2026-08-31');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].weightKg).toBe(60);
  });

  it('meals: Alice không thấy bữa ăn của Bob', async () => {
    await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'Của Bob', calories: 500 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/meals?date=2026-08-10');

    expect(res.body).toHaveLength(0);
  });

  it('meals: Alice KHÔNG sửa được bữa ăn của Bob → 404, bản ghi không đổi', async () => {
    // 404 chứ không 403: 403 xác nhận "id này có tồn tại, chỉ không phải của
    // bạn" — một rò rỉ nhỏ (rbac/SPEC.md:186).
    const bobMeal = await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'Của Bob', calories: 500 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.patch(`/api/meals/${bobMeal.id}`).send({ calories: 1 });

    expect(res.status).toBe(404);
    const after = await prisma.meal.findUnique({ where: { id: bobMeal.id } });
    expect(after!.calories).toBe(500);
  });

  it('goal: mục tiêu của Bob không lẫn sang Alice', async () => {
    await prisma.goal.create({ data: { userId: bob.id, targetWeightKg: 99 } });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/goal');

    expect(res.body.targetWeightKg).toBeNull();
  });

  it('summary: tổng calo KHÔNG gộp bữa ăn của người khác', async () => {
    // groupBy quên userId là chỗ dễ bỏ sót nhất của Task 8.
    await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'x', calories: 900 },
    });
    await prisma.meal.create({
      data: { userId: alice.id, date: '2026-08-10', slot: 'lunch', name: 'y', calories: 100 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/summary?from=2026-08-01&to=2026-08-31');

    const day = res.body.days.find((d: { date: string }) => d.date === '2026-08-10');
    expect(day.totalCalories).toBe(100);
  });

  it('reminders: Alice không thấy topic ntfy của Bob', async () => {
    await prisma.reminder.create({
      data: {
        userId: bob.id,
        kind: 'weigh_in',
        timeOfDay: '07:00',
        enabled: true,
        ntfyTopic: 'topic-rieng-cua-bob',
      },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/reminders');

    expect(JSON.stringify(res.body)).not.toContain('topic-rieng-cua-bob');
  });
});
```

- [x] **Step 3: Chạy test cách ly, xác nhận đỏ rồi xanh**

Run: `npx vitest run test/features/userIsolation.test.ts`

Nếu có ca nào **xanh ngay từ đầu** mà chưa sửa gì: đọc lại: có thể test không thật sự kiểm điều
nó nói. Nếu ca nào **đỏ**: đó là một truy vấn còn thiếu `userId` — quay lại Task 7–9 sửa
repository, **đừng** sửa test.

- [x] **Step 4: Sửa 5 file test hiện có**

Bỏ `import { LOCAL_USER_ID }`, thay bằng `createTestUser` trong `beforeEach` và `loginAgent` cho
mọi request. Xóa bản vá tạm đã thêm ở Task 2 Step 7.

- [x] **Step 5: Xóa hằng**

```bash
grep -rn "LOCAL_USER_ID" src test
```
Expected: không còn kết quả nào ngoài chính `src/shared/constants.ts`. Rồi xóa file đó.

Nếu grep còn kết quả: **chưa xong task**. Mỗi kết quả còn lại là một chỗ đang gán dữ liệu cho
một user không tồn tại.

- [x] **Step 6: Toàn bộ test phải xanh**

```bash
npx tsc --noEmit
npm test
```
Expected: 208 test cũ + test mới của Task 1–10, **tất cả xanh**. Đây là lần đầu từ Task 6 mà
`npm test` xanh trở lại.

- [x] **Step 7: Bàn giao**

Đề xuất: `test(auth): user isolation suite and login helper` + `refactor: drop LOCAL_USER_ID`

---

## Task 11: Chống brute-force + kiểm soát phiên đồng thời

**Files:**
- Create: `server/src/features/auth/repositories/loginAttempt.repository.ts`
- Modify: `server/src/features/auth/services/auth.service.ts`
- Modify: `server/src/features/auth/controllers/auth.controller.ts`
- Modify: `server/src/app.ts` (`trust proxy`)
- Test: `server/test/features/auth/bruteForce.test.ts`

**Interfaces:**
- Consumes: `authenticate` (Task 5) · `deleteSessionsByUserId` (Task 4)
- Produces: `recordAttempt(emailKey, ip, succeeded): Promise<void>` ·
  `countRecentFailures(emailKey, ip, since: Date): Promise<{ byEmail: number; byIp: number }>` ·
  `clearFailuresForEmail(emailKey): Promise<void>` ·
  `deleteAttemptsBefore(cutoff: Date): Promise<number>` ·
  `deleteSessionsByUserIdExcept(userId: string, keepSessionId: string): Promise<number>` ·
  `authenticate(input: LoginInput, ip: string): Promise<PublicUser>` — **đổi chữ ký** so với
  Task 5, thêm tham số `ip` ·
  `revokeOtherSessions(userId: string, keepSessionId: string): Promise<number>`

**Tham số chưa chốt** (`auth/SPEC.md:684`, `:679`): ngưỡng **5 lần thất bại / 15 phút / khóa 15
phút**, và chính sách phiên đồng thời. Dùng giá trị này, khai thành hằng có tên ở đầu file để
đổi một chỗ, và **hỏi chủ repo trước khi cứng hóa**.

- [x] **Step 1: Viết test thất bại**

```ts
// server/test/features/auth/bruteForce.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { hashPassword } from '../../../src/shared/security/password.js';

const app = createApp();

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: { email: 'user@lean.local', passwordHash: await hashPassword('123456') },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function failLogin(email: string): Promise<number> {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'sai-roi' });
  return res.status;
}

describe('chống brute-force', () => {
  it('lần thất bại thứ 6 trong cửa sổ → 429 TOO_MANY_ATTEMPTS', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await failLogin('user@lean.local')).toBe(401);
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: 'sai-roi' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('email KHÔNG tồn tại cũng bị khóa sau N lần — 429 không phải oracle', async () => {
    // Nếu chỉ email tồn tại bị khóa thì mã 429 tự nó tiết lộ email nào có tài
    // khoản, phá đúng mục tiêu của §7.3 (auth/SPEC.md:528).
    for (let i = 0; i < 5; i += 1) await failLogin('khongco@lean.local');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khongco@lean.local', password: 'sai-roi' });

    expect(res.status).toBe(429);
  });

  it('mật khẩu ĐÚNG khi đang bị khóa vẫn 429 — không có đường tắt', async () => {
    for (let i = 0; i < 5; i += 1) await failLogin('user@lean.local');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(res.status).toBe(429);
  });

  it('đăng nhập thành công xóa bộ đếm thất bại của email đó', async () => {
    for (let i = 0; i < 4; i += 1) await failLogin('user@lean.local');

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(
      await prisma.loginAttempt.count({
        where: { emailKey: 'user@lean.local', succeeded: false },
      }),
    ).toBe(0);
  });

  it('ghi lần thử với email đã CHUẨN HÓA, không phải chuỗi thô', async () => {
    // Không chuẩn hóa thì "USER@Lean.Local" là một khóa đếm khác và attacker
    // nhân N lần ngưỡng chỉ bằng cách đổi hoa thường.
    await request(app)
      .post('/api/auth/login')
      .send({ email: '  USER@Lean.Local ', password: 'sai-roi' });

    expect(await prisma.loginAttempt.count({ where: { emailKey: 'user@lean.local' } })).toBe(1);
  });
});

describe('kiểm soát phiên đồng thời', () => {
  it('đăng nhập lần hai làm cookie của phiên thứ nhất vô hiệu', async () => {
    const first = request.agent(app);
    await first.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });
    expect((await first.get('/api/auth/session')).status).toBe(200);

    const second = request.agent(app);
    await second.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    expect((await first.get('/api/auth/session')).status).toBe(401);
    expect((await second.get('/api/auth/session')).status).toBe(200);
  });
});
```

- [x] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run test/features/auth/bruteForce.test.ts`
Expected: FAIL — lần thứ 6 vẫn trả 401; phiên thứ nhất vẫn sống.

- [x] **Step 3: `loginAttempt.repository.ts`**

```ts
// server/src/features/auth/repositories/loginAttempt.repository.ts
import { prisma } from '../../../lib/db.js';

export async function recordAttempt(
  emailKey: string,
  ip: string,
  succeeded: boolean,
): Promise<void> {
  await prisma.loginAttempt.create({ data: { emailKey, ip, succeeded } });
}

/**
 * Đếm theo HAI CHIỀU ĐỘC LẬP:
 *   - emailKey: chặn dò mật khẩu vào một tài khoản cụ thể
 *   - ip:       chặn quét nhiều tài khoản từ một nguồn (password spraying),
 *               thứ mà đếm theo email hoàn toàn không thấy
 */
export async function countRecentFailures(
  emailKey: string,
  ip: string,
  since: Date,
): Promise<{ byEmail: number; byIp: number }> {
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { emailKey, succeeded: false, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({ where: { ip, succeeded: false, createdAt: { gte: since } } }),
  ]);
  return { byEmail, byIp };
}

export async function clearFailuresForEmail(emailKey: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { emailKey, succeeded: false } });
}

/** Bảng tăng vô hạn nếu không dọn hàng cũ hơn cửa sổ (auth/SPEC.md:533). */
export async function deleteAttemptsBefore(cutoff: Date): Promise<number> {
  const result = await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
```

- [x] **Step 4: Chèn kiểm ngưỡng vào `authenticate`, TRƯỚC khi gọi Argon2**

Thay **toàn bộ** hàm `authenticate` của Task 5 bằng bản dưới. Ba hằng ở đầu file để đổi ngưỡng
chỉ sửa một chỗ.

```ts
// server/src/features/auth/services/auth.service.ts
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function authenticate(input: LoginInput, ip: string): Promise<PublicUser> {
  const since = new Date(Date.now() - WINDOW_MS);
  const { byEmail, byIp } = await loginAttemptRepository.countRecentFailures(
    input.email,
    ip,
    since,
  );

  // Kiểm ngưỡng TRƯỚC Argon2. Verify Argon2 tốn hàng chục ms CPU CÓ CHỦ ĐÍCH —
  // để attacker kích hoạt nó không giới hạn chính là biến chống-brute-force
  // thành lỗ DoS (auth/SPEC.md:526).
  //
  // Nhánh này chạy giống nhau bất kể email có tồn tại hay không: nếu chỉ email
  // tồn tại bị khóa thì mã 429 tự nó trở thành oracle đoán tài khoản (:529).
  // Cũng vì thế nó đứng TRƯỚC cả findUserByEmail.
  if (byEmail >= MAX_FAILURES || byIp >= MAX_FAILURES) {
    throw AppError.tooManyAttempts();
  }

  const user = await userRepository.findUserByEmail(input.email);

  if (!user) {
    // Vẫn chạy một lần verify với hash giả để hai nhánh mất thời gian tương
    // đương (auth/SPEC.md §7.3).
    await verifyPassword(await dummyHash(), input.password);
    await loginAttemptRepository.recordAttempt(input.email, ip, false);
    throw AppError.invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    await loginAttemptRepository.recordAttempt(input.email, ip, false);
    throw AppError.invalidCredentials();
  }

  // Ngoại lệ CÓ CHỦ ĐÍCH so với §7.3: chỉ trả ACCOUNT_DISABLED SAU khi mật khẩu
  // đã đúng. Lúc đó người gọi đã chứng minh họ sở hữu tài khoản nên không rò gì
  // thêm. Ghi nhận là THẤT BẠI: tài khoản bị khóa vẫn là đường để dò mật khẩu.
  if (user.status !== 'active') {
    await loginAttemptRepository.recordAttempt(input.email, ip, false);
    throw AppError.accountDisabled();
  }

  await loginAttemptRepository.recordAttempt(input.email, ip, true);
  await loginAttemptRepository.clearFailuresForEmail(input.email);
  await userRepository.updateLastLoginAt(user.id, new Date());
  return toPublicUser(user);
}

/**
 * Đá mọi phiên KHÁC của user — tương đương BackChannelConcurrentSessionControl
 * của upip nhưng rẻ hơn nhiều bậc: một tiến trình, một bảng, không Kafka, không
 * registry (auth/SPEC.md §7.6). Chỉ hiện thực được nhờ cột `userId` trong bảng
 * `Session`, và đó là lý do connect-sqlite3 bị loại ở §2.
 *
 * `keepSessionId` là phiên vừa tạo — thiếu tham số này thì đăng nhập tự xóa
 * chính phiên của mình.
 */
export async function revokeOtherSessions(
  userId: string,
  keepSessionId: string,
): Promise<number> {
  return sessionRepository.deleteSessionsByUserIdExcept(userId, keepSessionId);
}
```

Thêm vào `session.repository.ts` (Task 4) hàm còn thiếu:

```ts
export async function deleteSessionsByUserIdExcept(
  userId: string,
  keepSessionId: string,
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId, id: { not: keepSessionId } },
  });
  return result.count;
}
```

- [x] **Step 5: Controller truyền `ip`, đá phiên cũ sau `regenerate`**

```ts
authController.post('/login', async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body ?? {});
  const user = await authService.authenticate(input, req.ip ?? 'unknown');

  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  // Đá mọi phiên KHÁC của user này. Chạy SAU regenerate + save, nếu không nó
  // xóa luôn phiên vừa tạo. Tương đương BackChannelConcurrentSessionControl
  // của upip nhưng rẻ hơn nhiều bậc — một tiến trình, một bảng, không Kafka
  // (auth/SPEC.md §7.6).
  await authService.revokeOtherSessions(user.id, req.sessionID);

  res.json(/* ... */);
});
```

- [x] **Step 6: `trust proxy`**

```ts
// server/src/app.ts, trước app.use(session(...))
  // req.ip chỉ đúng khi trust proxy được cấu hình. Sai chỗ này thì mọi request
  // trông như đến từ một IP duy nhất của proxy → khóa nhầm TOÀN BỘ người dùng
  // (auth/SPEC.md:530). Chỉ bật khi thật sự chạy sau proxy.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
```

- [x] **Step 7: Dọn `LoginAttempt` định kỳ**

Mắc cạnh tác vụ dọn phiên ở `server.ts` (Task 6 Step 5): xóa hàng cũ hơn cửa sổ.

- [x] **Step 8: Chạy test, xác nhận xanh**

Run: `npx vitest run test/features/auth/bruteForce.test.ts`
Expected: PASS — 6 test.

- [x] **Step 9: Verify toàn bộ giai đoạn A**

```bash
npx tsc --noEmit
npm test
```
Expected: tất cả xanh.

Kiểm bằng tay, server đang chạy:

```bash
curl -i http://localhost:3000/api/health                    # 200, công khai
curl -i http://localhost:3000/api/goal                      # 401 UNAUTHORIZED
curl -i -c c.txt http://localhost:3000/api/auth/csrf        # 200, lấy token
curl -i -b c.txt -c c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -H 'x-csrf-token: <token>' \
  -d '{"email":"user@lean.local","password":"123456"}'      # 200 + Set-Cookie HttpOnly
curl -i -b c.txt http://localhost:3000/api/goal             # 200
```

Xác nhận bằng mắt: `Set-Cookie` có `HttpOnly`, và **không** có `passwordHash` ở bất kỳ đâu trong
body.

- [x] **Step 10: Bàn giao**

Đề xuất: `feat(auth): brute-force lockout and concurrent session control`

---

## Sau giai đoạn A

**Chưa làm, có chủ đích:**

- Ba tài khoản seed (`user@`, `admin@`, `system@`) — cần bảng `Role`, thuộc **giai đoạn B**.
  Cuối giai đoạn A chỉ có tài khoản tạo qua `POST /api/auth/register`.
- `permissions: string[]` trong `SessionResponse` — **giai đoạn B**.
- API quản trị `/api/users`, `/api/roles`, `/api/permissions` — **giai đoạn C**.
- Trang đăng nhập, đăng ký, màn Tài khoản, màn Phân quyền — **giai đoạn D**. Đến lúc đó
  `web/src/lib/apiClient.ts` mới cần `credentials: 'include'` và header `x-csrf-token`.

**Tài liệu phải cập nhật** — chỉ **sau** khi code chạy, theo ràng buộc `auth/SPEC.md:702`
(*"tài liệu Lean mô tả hành vi thật, không mô tả ý định"*): 11 chỗ ở `auth/SPEC.md` §10 cộng 5
chỗ ở design doc §12. Trong đó có `docs/overview/04-conventions.md:22`
(*"Không có auth, không có middleware xác thực"*) và `CLAUDE.md:60`
(*"Chưa có đăng nhập; dùng hằng LOCAL_USER_ID"*).

**Ba câu hỏi cần chủ repo chốt trước khi Task 11 cứng hóa số:** ngưỡng brute-force (5/15/15),
chính sách phiên đồng thời (một phiên duy nhất — Task 11 đang giả định thế), thời hạn phiên
(7 ngày + rolling).
