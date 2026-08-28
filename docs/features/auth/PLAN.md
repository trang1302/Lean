# Feature `auth` — Kế hoạch & trạng thái

## 1. Trạng thái: **XONG** (2026-08-28)

Các bước ở §2 đã có code và test — xem [`SPEC.md`](SPEC.md) §10 cho danh sách chỗ đã sửa
và commit tương ứng.

Verify: `cd server && npm test`.

### Trạng thái cũ (giữ để đối chiếu)

Chưa có dòng code nào. Chưa có file nào trong `server/src/features/auth/`.
Tài liệu duy nhất là [`SPEC.md`](SPEC.md) cạnh file này.

Trước khi gõ dòng đầu tiên, đọc [`SPEC.md`](SPEC.md) §1 (vì sao đổi quyết định), §2 (bảng
ánh xạ upip → Lean) và §6 (danh sách chỗ phải sửa). Bước 3 và Bước 8 là hai bước nguy hiểm
nhất — đọc kỹ trước khi chạm.

### Thứ tự bắt buộc so với các feature khác

```
auth  ──►  rbac  ──►  (mọi thứ cần phân quyền)
```

**`auth` phải xong trước `rbac`** (`docs/features/rbac/`, một agent khác đang viết tài liệu
song song). Lý do không thể đảo: RBAC quyết định *"người này được làm gì"*, mà câu đó chỉ có
nghĩa khi đã trả lời được *"người này là ai"*. Không có `req.session.userId` thì không có gì
để tra vai trò.

Ranh giới trách nhiệm, giữ nghiêm:

| Feature | Trả lời câu hỏi | Sở hữu |
|---|---|---|
| `auth` | Ai đang gọi? | `User.id`, `User.email`, `User.passwordHash`, `User.status`, `Session` |
| `rbac` | Người đó được làm gì? | Vai trò, quyền, bảng nối |

**`auth` KHÔNG thêm cột `role` vào `User`** ([`SPEC.md`](SPEC.md) §5.1). Thêm nó là quyết
định trước hộ feature khác, và sẽ phải gỡ ra khi `rbac` cần bảng nối nhiều-nhiều.

### Phụ thuộc phía web — đang bị chặn

Lúc viết kế hoạch này, `web/` **chưa tồn tại**. Trang đăng nhập và route guard vì thế
**chưa làm được ở giai đoạn đó**. Chi tiết ở §5 và diễn biến thật ở Bước 11 dưới đây.

## 2. Các bước

Mỗi bước có deliverable **kiểm chứng được**. Không gộp bước — đặc biệt là Bước 3.
Commit sau mỗi bước, format `<type>(<scope>): <subject>` (`docs/overview/04-conventions.md:66-71`).

---

### Bước 1 — Phụ thuộc và biến môi trường

**Làm:**

- Cài từ `Lean/server`: `express-session@1.19.0`, `@node-rs/argon2@2.0.2`, `helmet@8.3.0`,
  `csrf-csrf@4.0.3`, và `@types/express-session` (dev).
  Tra lại bản mới nhất trước khi cài — ràng buộc `docs/overview/04-conventions.md:13`.
  **Không** cài `connect-sqlite3`: lý do loại ở [`SPEC.md`](SPEC.md) §2.
- Thêm `SESSION_SECRET` vào `envSchema` (`server/src/config/env.ts:3-7`): bắt buộc, `min(32)`,
  **không có `.default()`** ([`SPEC.md`](SPEC.md) §7.8).
- Thêm `NODE_ENV` (hoặc một cờ tương đương) để quyết định `cookie.secure` — §3.2 của SPEC.
- Cập nhật `.env.example` nếu có.
- Khai báo mở rộng kiểu cho `express-session`: `declare module 'express-session'` thêm
  `userId` vào `SessionData`. Đặt ở `server/src/features/auth/types.d.ts` hoặc
  `server/src/shared/types/`. Thiếu bước này thì `req.session.userId` không qua được
  `tsc --noEmit`.

**Deliverable:** `npx tsc --noEmit` sạch; chạy server thiếu `SESSION_SECRET` thì **chết ngay
lúc khởi động** với thông báo rõ ràng (không phải cảnh báo rồi chạy tiếp).

**Commit:** `chore(auth): add session/argon2/helmet/csrf deps and SESSION_SECRET`

---

### Bước 2 — Lược đồ Prisma: `User`, `Session`, `LoginAttempt`

**Làm:** thêm ba model theo [`SPEC.md`](SPEC.md) §5.1–5.3 vào `server/prisma/schema.prisma`.

**CHƯA thêm quan hệ vào `BodyLog` / `Meal` / `Goal` / `Reminder`.** Quan hệ bắt buộc trên dữ
liệu chưa có `User` tương ứng sẽ hỏng — đó là Bước 3. Cảnh báo ở [`SPEC.md`](SPEC.md) §5.4.

**Deliverable:**

```bash
npx prisma db push        # thành công, không mất dữ liệu cũ
```

Một test nhỏ trong `server/test/lib/db.test.ts` kiểu như các test hiện có: tạo `User`, tạo
`User` thứ hai cùng email → phải văng lỗi unique. Xác nhận `@unique` thật sự có hiệu lực.

**Commit:** `feat(auth): add User, Session, LoginAttempt models`

---

### Bước 3 — MIGRATE DỮ LIỆU ⚠️ **Bước dễ mất dữ liệu nhất**

> **BỎ (2026-08-28).** Bước này giả định có sẵn bản ghi `userId = 'local'` cần cứu. DB thật không
> có bản ghi nào như vậy lúc bật auth, nên không migrate gì. Việc còn lại — gán vai trò cho tài
> khoản chưa có — nằm ở `npm run seed:rbac`. Xem `06-open-questions.md` Q13.

Toàn bộ dữ liệu hiện có mang `userId = 'local'` (`server/src/shared/constants.ts:9`). Bảng
`User` thì trống. Bước này nối hai thứ đó lại.

**Đọc hết mục này trước khi gõ lệnh.**

#### Trước tiên: backup

```bash
# Từ Lean/server. SQLite = một file, backup = copy file.
cp data.db "data.db.bak-$(date +%Y%m%d-%H%M%S)"
```

Không có backup thì không được chạy tiếp. Đây là lợi thế lớn nhất của SQLite
(`docs/overview/01-architecture.md:82`) — dùng nó.

#### Hai phương án

| | **A — giữ nguyên `id = 'local'`** ✅ khuyến nghị | **B — id mới, cập nhật lại mọi bảng** |
|---|---|---|
| Cách làm | Tạo hàng `User` với `id: 'local'`, gán `email` + `passwordHash` thật | Tạo `User` với `cuid()` mới, rồi `UPDATE` `userId` ở cả 4 bảng |
| Dữ liệu phải ghi lại | **Không hàng nào** | Mọi hàng của 4 bảng |
| Rủi ro | Gần bằng 0 | `BodyLog` có khóa chính `@@id([userId, date])` → đổi `userId` là **ghi lại khóa chính**; `Goal` có `userId` là khóa chính. Bỏ sót một bảng = dữ liệu mồ côi, và sau khi thêm quan hệ ở Bước 4 thì nó thành không đọc được |
| Nhược điểm | Một hàng `User` mang id `'local'` trông lạc lõng giữa các cuid | Sạch về mặt thẩm mỹ |

**Chốt: dùng phương án A.** `id` là khóa thay thế (surrogate key) — giá trị của nó không
mang ý nghĩa nghiệp vụ, không hiển thị cho ai. Đánh đổi *"một chuỗi trông lạ trong DB"* lấy
*"không ghi lại một hàng dữ liệu nào"* là đánh đổi đúng. Người dùng thứ hai trở đi vẫn nhận
`cuid()` bình thường.

> Nếu chủ dự án vẫn muốn phương án B: bắt buộc chạy trong **một transaction Prisma duy
> nhất**, cập nhật đủ **cả bốn** bảng, và **kiểm tra `COUNT` từng bảng trước/sau** phải bằng
> nhau. Không có transaction thì một lỗi giữa chừng để lại DB ở trạng thái nửa vời mà không
> ràng buộc nào phát hiện được.

#### Việc phải làm

Viết `server/prisma/seed.ts` (hoặc `server/scripts/createFirstUser.ts`) — một script chạy tay:

1. Nhận `email` và mật khẩu qua biến môi trường hoặc tham số dòng lệnh. **Không hard-code
   mật khẩu vào file được commit.**
2. Hash bằng Argon2 (Bước 4 — nên làm Bước 4 trước, hoặc gọi thẳng thư viện ở đây).
3. `upsert` hàng `User` với `id = LOCAL_USER_ID`.
4. In ra số hàng của cả bốn bảng để đối chiếu.

**Cần từ chủ dự án:** email thật của chủ dữ liệu — câu hỏi mở [`SPEC.md`](SPEC.md) §9.8.
Không có nó thì bước này không chạy được.

**Deliverable:**

```bash
node --experimental-strip-types prisma/seed.ts   # hoặc chạy qua tsx
npx prisma studio                                 # mắt thường xác nhận:
#   - bảng User có đúng 1 hàng, id = 'local', passwordHash KHÔNG phải chuỗi thô
#   - COUNT của BodyLog / Meal / Goal / Reminder khớp với trước khi chạy
```

**Commit:** `feat(auth): seed script creating the first real user`

---

### Bước 4 — Thêm quan hệ vào bốn bảng hiện có

Chỉ chạy được **sau khi** Bước 3 xong và đã xác nhận bằng mắt.

**Làm:** thêm đúng một dòng vào mỗi model `BodyLog`, `Meal`, `Goal`, `Reminder`
([`SPEC.md`](SPEC.md) §5.4):

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

**Không đổi khóa chính. Không đổi ràng buộc unique. Không thêm cột.**

**Deliverable:** `npx prisma db push` thành công; `npm test` — **toàn bộ test hiện có vẫn
pass**. Nếu có test đỏ ở đây thì là do `beforeEach` tạo dữ liệu với `userId` không có `User`
tương ứng → sửa fixture, đừng gỡ quan hệ.

> **Kiểm tra bắt buộc:** SQLite chỉ cưỡng chế khóa ngoại khi `PRAGMA foreign_keys = ON`. Xác
> nhận adapter `@prisma/adapter-better-sqlite3` (`server/src/lib/db.ts`) thật sự bật nó —
> bằng cách thử chèn một `BodyLog` với `userId` không tồn tại và **kỳ vọng lỗi**. Nếu chèn
> lọt, quan hệ chỉ là trang trí trong schema và không bảo vệ gì.

**Commit:** `feat(auth): relate existing tables to User`

---

### Bước 5 — `shared/security/password.ts`

Module thuần, không DB, không HTTP — cùng tinh thần với `shared/stats/`
(`docs/overview/04-conventions.md:21`).

**Làm:** hai hàm bọc `@node-rs/argon2`:

- `hashPassword(plain): Promise<string>`
- `verifyPassword(hash, plain): Promise<boolean>`

Thêm một hằng `DUMMY_HASH` — hash của một chuỗi cố định, dùng cho nhánh "email không tồn
tại" ở [`SPEC.md`](SPEC.md) §7.3 để hai nhánh mất thời gian tương đương.

> **Không bịa chữ ký.** `@node-rs/argon2` phơi ra hàm băm và hàm xác minh, cả hai bất đồng
> bộ, mặc định thuật toán Argon2id. **Thứ tự tham số của hàm xác minh phải kiểm lại bằng
> README/kiểu TypeScript của đúng bản 2.0.2** — đảo nhầm hash với plaintext sẽ cho ra một
> hàm *luôn trả `false`*, và test "mật khẩu sai bị từ chối" vẫn xanh. Bắt buộc có test
> **mật khẩu đúng trả `true`**.

**Deliverable:** `server/test/shared/security/password.test.ts`

- hash cùng một mật khẩu hai lần → **hai chuỗi khác nhau** (salt ngẫu nhiên)
- `verifyPassword(hash, đúng)` → `true`
- `verifyPassword(hash, sai)` → `false`
- hash **không** chứa mật khẩu gốc dưới dạng chuỗi con

**Commit:** `feat(auth): argon2 password hashing helpers`

---

### Bước 6 — Session store trên Prisma

**Làm:** `server/src/features/auth/repositories/session.repository.ts` (mọi truy vấn Prisma)
+ `server/src/features/auth/prismaSessionStore.ts` (class hiện thực interface `Store` của
`express-session`).

Bắt buộc:

- Nhấc `userId` từ payload phiên ra **cột riêng** khi ghi ([`SPEC.md`](SPEC.md) §5.2). Không
  có bước này thì Bước 10 không làm được.
- Đọc phiên đã quá `expiresAt` → coi như không tồn tại.
- Hiện thực `touch` để `rolling: true` gia hạn được.
- Một hàm dọn hàng hết hạn, gọi định kỳ.

> `Store` của `express-session` là API **callback** (`get(sid, cb)`, `set(sid, sess, cb)`,
> `destroy(sid, cb)`), còn Prisma là Promise. Cầu nối này là chỗ dễ nuốt lỗi nhất: quên gọi
> `cb(err)` ở nhánh reject sẽ làm request treo im lặng cho tới timeout. Mỗi hàm phải gọi
> callback đúng **một** lần trên **mọi** nhánh.

**Deliverable:** `server/test/features/auth/prismaSessionStore.test.ts` — set → get trả đúng
payload; destroy → get trả rỗng; phiên đã hết hạn → get trả rỗng **và** hàng bị dọn; hàng
ghi ra có cột `userId` đúng.

**Commit:** `feat(auth): Prisma-backed express-session store`

---

### Bước 7 — Feature `auth`, bốn lớp

Cấu trúc bắt buộc theo `docs/overview/01-architecture.md:39-45`, không ngoại lệ kể cả khi
service chỉ chuyển tiếp (`:67`).

| File | Lớp | Trách nhiệm |
|---|---|---|
| `features/auth/index.ts` | router | Export `authRouter`, path bên trong tương đối (theo mẫu `features/goal/index.ts`) |
| `features/auth/controllers/auth.controller.ts` | HTTP | 4 route §4 của SPEC. Parse Zod, gọi service, trả JSON. **Không try/catch** — Express 5 tự đẩy lỗi async sang `errorHandler` (`docs/overview/04-conventions.md:15`). Đây là lớp duy nhất chạm `req.session` |
| `features/auth/services/auth.service.ts` | nghiệp vụ | Xác minh mật khẩu, kiểm ngưỡng brute-force, quyết định mã lỗi. **Không biết `req`, không biết Prisma** |
| `features/auth/repositories/user.repository.ts` | dữ liệu | `findByEmail`, `updateLastLoginAt`. **Chỗ duy nhất** import `prisma` |
| `features/auth/repositories/loginAttempt.repository.ts` | dữ liệu | Ghi lần thử, đếm theo cửa sổ, xóa khi thành công |
| `features/auth/repositories/session.repository.ts` | dữ liệu | Bước 6 |
| `features/auth/dtos/auth.request.ts` | DTO vào | `loginSchema` — `z.email()` top-level (Zod 4), `.transform()` chuẩn hóa `trim().toLowerCase()` |
| `features/auth/dtos/auth.response.ts` | DTO ra | `toSessionResponse()`. **Chọn trường tường minh, không trả nguyên row Prisma** ([`SPEC.md`](SPEC.md) §4) |
| `features/auth/middleware/requireAuth.ts` | middleware | Đọc `req.session.userId`, không có → ném `AppError` `401 UNAUTHORIZED` |

Kèm theo: thêm 5 mã lỗi mới vào `AppErrorCode` và factory tương ứng trong
`server/src/shared/errors/AppError.ts:1,22-28` ([`SPEC.md`](SPEC.md) §4).

**Deliverable:** `server/test/features/auth/auth.controller.test.ts` — supertest trên app
thật + DB thật, theo đúng mẫu `server/test/features/goal/goal.controller.test.ts`:

- login đúng → `200`, có `Set-Cookie`, cookie mang `HttpOnly`
- login sai mật khẩu → `401` `INVALID_CREDENTIALS`
- login **email không tồn tại** → `401` `INVALID_CREDENTIALS`, **message giống hệt ca trên**
- email sai định dạng → `400` `VALIDATION_ERROR`, có `fields`
- `GET /session` không cookie → `401` `UNAUTHORIZED`
- `GET /session` có cookie → `200`, **không có `passwordHash`** ở bất kỳ đâu trong body
- `POST /logout` → `204`; gọi lại `GET /session` → `401`
- `POST /logout` khi chưa đăng nhập → vẫn `204`
- `status = "disabled"` + mật khẩu **đúng** → `403` `ACCOUNT_DISABLED`
- session id **đổi** sau khi login (chống fixation, [`SPEC.md`](SPEC.md) §7.4)

**Commit:** `feat(auth): login, logout, session endpoints`

---

### Bước 8 — Mắc `requireAuth` và thay `LOCAL_USER_ID` ⚠️ **Bước lan rộng nhất**

Đây là bước chạm vào cả năm feature khác. Làm **từng feature một, commit riêng** — gộp cả
năm vào một commit sẽ không bisect được khi có test đỏ.

**8.0 — `app.ts`:** thêm `helmet`, `session`, csrf, `authRouter`, và `requireAuth` trước
năm router dữ liệu. Thứ tự chính xác ở [`SPEC.md`](SPEC.md) §3.4. Giữ nguyên vị trí
`notFoundHandler` → `errorHandler` (`server/src/app.ts:27-29`).

**8.1 → 8.5 — thay hằng.** Danh sách chính xác từ `grep LOCAL_USER_ID server/src`, đã có ở
[`SPEC.md`](SPEC.md) §6.2. Làm theo thứ tự **dễ trước, khó sau**:

| # | Feature | Mức | Việc |
|---|---|---|---|
| 8.1 | `goal` | ✅ dễ | Chỉ `services/goal.service.ts:1,11,16`. Repository đã nhận `userId` — **không chạm** |
| 8.2 | `meals` | ✅ dễ | Chỉ `services/meals.service.ts:1,12,15,20,26,33` — thay thân `currentUserId()` (`:12`). Repository **không chạm** (`docs/features/meals/SPEC.md:239`) |
| 8.3 | `bodyLogs` | ⚠️ đổi chữ ký | `repositories/bodyLogs.repository.ts:3,14,24,40,50` — thêm `userId` vào `whereKey()` và 4 hàm, rồi sửa service gọi |
| 8.4 | `summary` | ⚠️ đổi chữ ký | `repositories/summary.repository.ts:2,44,66,82` — 3 hàm |
| 8.5 | `reminders` | ⚠️⚠️ khó nhất | `repositories/reminders.repository.ts:2,35,43,59,61,75,82` — 5 hàm, **và kéo theo Bước 9** |

Controller lấy `userId` từ `req.session.userId` rồi truyền xuống service. **Service không
đọc `req`** — giữ đúng ranh giới `docs/overview/01-architecture.md:71-76`.

**8.6 — test hiện có.** Năm file test import `LOCAL_USER_ID`
(`server/test/features/{bodyLogs,meals,summary,reminders}/*.test.ts`,
`server/test/lib/db.test.ts`). Cần:

- `beforeEach` tạo một `User` thật thay vì dựa vào chuỗi `'local'`.
- Một helper đăng nhập dùng chung, đặt ở `server/test/helpers/auth.ts`: login rồi giữ agent
  supertest có cookie (`request.agent(app)` giữ cookie giữa các request — khác `request(app)`).
- Mọi request trong test đi qua agent đã đăng nhập, nếu không sẽ nhận `401` hàng loạt.

**8.7 — xóa hằng.** Sau khi `grep LOCAL_USER_ID server/src` **không còn kết quả nào ngoài
chính file định nghĩa**, xóa `server/src/shared/constants.ts` (hoặc chỉ xóa hằng nếu file
còn thứ khác). Cùng lúc đó, cập nhật danh sách tài liệu ở [`SPEC.md`](SPEC.md) §10 — lúc này
mới đúng thời điểm, vì hành vi đã thật.

**Deliverable bắt buộc — test cách ly người dùng.** Không có test này thì bước 8 coi như
chưa xong:

> Tạo **hai** user, mỗi người một `BodyLog` cùng ngày. Đăng nhập bằng user A → `GET
> /api/body-logs/:date` **chỉ** thấy dữ liệu của A. Lặp cho `meals`, `goal`, `summary`,
> `reminders`.

Đây là test quan trọng nhất của toàn bộ feature. Một truy vấn quên `userId` sẽ **rò dữ liệu
sức khỏe giữa những người dùng** và không có test nào khác bắt được.

**Commit:** một commit mỗi tiểu bước, ví dụ `refactor(goal): take userId from session`

---

### Bước 9 — Scheduler nhắc nhở đa người dùng

Bước riêng vì nó **đổi logic nghiệp vụ**, không chỉ đổi nguồn của một biến. Bối cảnh đầy đủ
ở [`SPEC.md`](SPEC.md) §6.4.

**Làm:** viết lại `runDueReminders` (`server/src/features/reminders/services/reminders.scheduler.ts:118`)
để quét mọi người dùng:

- `ReminderRunnerDeps` (`:35-40`) — cả ba hàm DB phải mang `userId`.
- `listReminders()` → trả nhắc nhở của **mọi** user trong **một** truy vấn, không lặp N+1.
- `ReminderView` cần mang `userId` (hoặc scheduler dùng kiểu row khác).
- `selectDueReminders` (`:84`) là **hàm thuần và vẫn đúng nguyên** — nó lọc theo `enabled` +
  `timeOfDay` + có topic, không quan tâm ai sở hữu. **Đừng viết lại.**

Giữ nguyên hai quyết định đã có: không gửi bù khi server tắt (`:16-18`), và không nuốt lỗi
gửi (`:115`).

**Deliverable:** test với **hai** user có `ntfyTopic` khác nhau, cùng `timeOfDay`, user A đã
ghi cân còn B chưa → **chỉ B nhận nhắc, và đúng topic của B**. Gửi nhầm topic ở đây là rò dữ
liệu sức khỏe sang người lạ.

**Commit:** `fix(reminders): scan reminders across all users`

---

### Bước 10 — Chống brute-force + phiên đồng thời

Tách khỏi Bước 7 để endpoint đăng nhập được chứng minh đúng trước khi thêm lớp phòng thủ.

**Làm:** [`SPEC.md`](SPEC.md) §7.1, §7.6, §7.7.

- Kiểm ngưỡng **trước** khi gọi Argon2 (nếu không là lỗ DoS).
- Đếm theo **cả** `emailKey` **lẫn** `ip`.
- `app.set('trust proxy', 1)` khi chạy sau reverse proxy, nếu không `req.ip` sai và khóa
  nhầm toàn bộ người dùng.
- Đăng nhập thành công → `deleteMany({ where: { userId } })` trên `Session` (đá phiên cũ),
  chạy **sau** `regenerate()`.
- Dọn `LoginAttempt` cũ định kỳ.

**Chờ chủ dự án chốt** ngưỡng ([`SPEC.md`](SPEC.md) §9.4) và chính sách phiên đồng thời
(§9.2) trước khi cứng hóa con số.

**Deliverable:** test — N+1 lần sai liên tiếp → `429` `TOO_MANY_ATTEMPTS`; đăng nhập đúng
sau đó reset bộ đếm; email **không tồn tại** cũng bị khóa sau N lần (không phải oracle);
đăng nhập lần hai làm cookie của phiên thứ nhất trở nên vô hiệu.

**Commit:** `feat(auth): brute-force lockout and concurrent session control`

---

### Bước 11 — Web: trang đăng nhập + route guard

**Lúc viết bước này, `web/` chưa tồn tại** — không có gì để sửa, ghi lại để không ai tưởng
đã xong. `web/` sau đó được dựng bởi feature `web-shell`; chi tiết thật ở
[`../web-shell/PLAN.md`](../web-shell/PLAN.md).

Khi `web/` được dựng (theo `docs/overview/01-architecture.md:50-62`), cần:

| Việc | Chi tiết |
|---|---|
| `features/auth/components/LoginPage.tsx` | Form email + mật khẩu |
| Route guard trong `router/routes.tsx` | Chưa đăng nhập → chuyển hướng `/login` |
| `lib/apiClient.ts` | **`credentials: 'include'`** trên mọi `fetch` — thiếu nó thì trình duyệt không gửi cookie và mọi request đều `401` |
| `lib/apiClient.ts` | Bắt `401` toàn cục → đá về `/login`. Phiên hết hạn giữa chừng là chuyện bình thường, không phải lỗi hiển thị cho người dùng |
| `lib/apiClient.ts` | Lấy CSRF token từ `GET /api/auth/csrf`, gắn header vào mọi request ghi |
| `vite.config.ts` | **Bắt buộc** `server.proxy` cho `/api` → cùng origin. Lý do ở [`SPEC.md`](SPEC.md) §3.2 — gọi thẳng `:3000` buộc phải hạ `sameSite` xuống `'none'`, tức tự tháo phòng vệ CSRF cấp cookie |
| Nút đăng xuất | Trang Cài đặt |

**KHÔNG lưu bất cứ thứ gì về đăng nhập trong `localStorage`** — không token, không "đã đăng
nhập rồi". Nguồn sự thật duy nhất là `GET /api/auth/session`. Lý do đầy đủ ở
[`SPEC.md`](SPEC.md) §3.1.

---

## 3. Lệnh verify dự kiến

Chạy từ `C:\Project\WorkSpace\Lean\server`:

```bash
# test riêng feature
npx vitest run test/features/auth/

# test cách ly người dùng — quan trọng nhất, xem Bước 8
npx vitest run test/features/ -t "user isolation"

# toàn bộ test server — phải xanh sau MỖI bước, không chỉ ở bước cuối
npm test

# kiểm kiểu
npx tsc --noEmit
```

`npm test` map sang `vitest run`, `npm run typecheck` map sang `tsc --noEmit`
(`server/package.json:9,11`).

Test dùng DB thật nên cần schema đã push:

```bash
npx prisma db push
```

Kiểm tra thủ công sau Bước 8 (từ `Lean/server`, server đang chạy):

```bash
# 401 vì chưa đăng nhập
curl -i http://localhost:3000/api/goal

# health vẫn công khai
curl -i http://localhost:3000/api/health

# đăng nhập, giữ cookie
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'

# giờ mới vào được
curl -i -b cookies.txt http://localhost:3000/api/goal
```

Xác nhận bằng mắt trong response đăng nhập: header `Set-Cookie` có `HttpOnly`, và
**không** có `passwordHash` ở bất kỳ đâu trong body.

## 4. Việc còn treo trước khi bắt đầu

Chín câu hỏi mở ở [`SPEC.md`](SPEC.md) §9. Ba câu **chặn** việc bắt đầu:

1. **§9.8 — email của chủ dữ liệu.** Bước 3 không chạy được nếu thiếu.
2. **§9.1 — SQLite có còn đúng không?** Nếu câu trả lời là "sang Postgres", thì đổi **trước**
   Bước 2 rẻ hơn nhiều lần so với sau Bước 8. Đây là câu hỏi vượt phạm vi `auth` nhưng lại
   quyết định thứ tự công việc của `auth`.
3. **§9.6 — đăng ký tự phục vụ có thuộc giai đoạn 1 không?** Nếu có, phải thêm endpoint và
   test vào Bước 7 thay vì bổ sung sau.

Sáu câu còn lại (ngưỡng khóa, thời hạn phiên, chính sách mật khẩu, phiên đồng thời,
`displayName`, audit log) có thể dùng giá trị đề xuất trong SPEC và chỉnh sau — chúng nằm
gọn trong một file mỗi thứ.

## 5. Ghi chú cho người thi công

- **Đừng gộp Bước 3 vào Bước 4.** Thêm quan hệ trước khi có hàng `User` là cách nhanh nhất
  để mất dữ liệu.
- **Đừng bê envelope `{success:false}` của upip.** Lean dùng `{ error: { code, message } }`
  (`docs/overview/04-conventions.md:39-41`). Lấy mô hình bảo mật của upip, không lấy hợp
  đồng JSON của nó.
- **Đừng thêm `role` vào `User`.** Đó là của `rbac`.
- **Đừng viết lại `selectDueReminders`.** Nó là hàm thuần và vẫn đúng nguyên (§Bước 9).
- **Đừng tin lời hứa "thay hằng là xong"** ở `docs/overview/02-data-model.md:13`. Với
  `bodyLogs`, `summary`, `reminders` nó là đổi chữ ký hàm ở tầng repository —
  [`SPEC.md`](SPEC.md) §6.2.
- **Đừng đặt `sameSite: 'none'` cho tiện lúc dev.** Dùng proxy của Vite ([`SPEC.md`](SPEC.md) §3.2).
- **Đừng quên `await` các hàm phiên callback** (`regenerate`, `destroy`, `save`). Lỗi tạo ra
  là race chập chờn, không phải exception — rất khó lần ra sau này.
