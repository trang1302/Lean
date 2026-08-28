# Feature `auth` — Xác thực

> **Tài liệu định hướng, chưa có code.** Khác với `SPEC.md` của các feature đã xong
> (`goal`, `meals`, …) vốn mô tả hành vi thật của code đang chạy, file này mô tả **thứ sẽ
> được xây**. Mọi tham chiếu `đường-dẫn:dòng` trong đây trỏ tới code **hiện có** — thứ sẽ
> phải sửa — chứ không phải code của feature này.
>
> Trạng thái thi công: xem [`PLAN.md`](PLAN.md) — **CHƯA BẮT ĐẦU**.

Liên quan: [`../../overview/01-architecture.md`](../../overview/01-architecture.md) (cấu trúc 4 lớp) ·
[`../../overview/02-data-model.md`](../../overview/02-data-model.md) (vì sao mọi bảng đã có `userId`) ·
[`../../overview/04-conventions.md`](../../overview/04-conventions.md) (hình dạng lỗi) ·
`docs/features/rbac/` (feature kế tiếp, **phụ thuộc feature này**).

---

## 1. Vì sao quyết định đổi

### 1.1 Quyết định cũ

Spec gốc §2 **cố tình loại bỏ đăng nhập**:

> *"**Đăng nhập / nhiều người dùng** — chạy localhost, một người."*
> — `docs/archive/2026-08-06-original-design.md:37`

Và giải thích lý do trong bảng lựa chọn kỹ thuật:

> *"Localhost, một người. Auth chỉ thêm một màn hình phải bấm qua mỗi ngày mà không bảo vệ
> thêm điều gì."* — `docs/archive/2026-08-06-original-design.md:103`

Cùng chỗ đó đã ghi sẵn điều kiện đảo ngược:

> *"Nếu sau này mở ra mạng LAN hoặc cloud thì **bắt buộc** phải thêm auth trước."*

`docs/overview/04-conventions.md:22` phát biểu lại thành ràng buộc toàn cục:
*"Không có auth, không có middleware xác thực. Server chỉ bind localhost."*

**Quyết định cũ không sai.** Nó đúng với bối cảnh của nó, và nó ghi rõ điều kiện làm nó
hết đúng.

### 1.2 Vì sao đổi

Chủ dự án nêu hướng phát triển có thể lên tới **20 triệu người dùng**. Điều kiện đảo ngược
đã ghi trong spec gốc vì thế được kích hoạt: hệ thống sẽ không còn chạy localhost một
người, nên auth trở thành **điều kiện tiên quyết**, không phải tính năng thêm.

Hệ quả trực tiếp: mọi câu "chưa có đăng nhập" rải trong tài liệu và mã nguồn trở thành nợ
phải trả — danh sách đầy đủ ở §6.

### 1.3 Cái gì đã được chuẩn bị sẵn

Đây là phần quan trọng nhất của mục này: **việc thêm auth không phải là một cuộc phẫu thuật
lược đồ.** Nó đã được chừa chỗ từ ngày đầu.

**Mọi bảng đã mang cột `userId` ngay từ đầu, dù chưa có đăng nhập**
(`docs/overview/02-data-model.md:11`). Khóa vì thế đã là khóa **kép**:

| Bảng | Khóa | Nguồn |
|---|---|---|
| `BodyLog` | `@@id([userId, date])` | `server/prisma/schema.prisma` · `02-data-model.md:35` |
| `Meal` | `@@index([userId, date])` | `02-data-model.md:49` |
| `Goal` | `userId` là **khóa chính** | `02-data-model.md:53` |
| `Reminder` | `@@unique([userId, kind])` | `02-data-model.md:69` |

Lý do đã ghi sẵn ở `docs/overview/02-data-model.md:13`:

> *"thêm khóa người dùng vào một schema đã có dữ liệu nghĩa là sửa mọi bảng, mọi ràng buộc
> unique, mọi truy vấn, mọi route, cộng một lần migrate. Làm bây giờ tốn một cột và một
> hằng."*

Và giá trị của cột đó lấy từ **một hằng có tên duy nhất**, `LOCAL_USER_ID`
(`server/src/shared/constants.ts:9`), với ghi chú tại `:5-7` nói thẳng đây là điểm nối cho
auth.

**Vì vậy phạm vi thật của feature này là:** thêm bảng `User` + quan hệ, thêm phiên, và thay
nguồn của `userId` từ hằng sang phiên. **Không** phải sửa khóa, **không** phải thêm cột vào
bốn bảng dữ liệu.

> **Cảnh báo — sự chuẩn bị không hoàn hảo.** Ba trong năm feature nhét `LOCAL_USER_ID` thẳng
> vào **tầng repository** thay vì nhận `userId` làm tham số. Chi tiết và danh sách chính xác
> ở §6.2. Đọc trước khi ước lượng công sức.

## 2. Chuẩn công nghệ — bám upip, thay phần Spring bằng tương đương Node

Lean bám quán lệ kiến trúc của **`upip`** (`C:\Project\WorkSpace\upip`, chỉ có trên máy dev,
không thuộc repo này) — đó là lý do Lean có cấu trúc feature-first 4 lớp
(`docs/overview/01-architecture.md:11`).

**Lean là Express + TypeScript, không phải Spring.** Cái được bê sang là **mô hình và
nguyên tắc**, không phải thư viện. Bảng dưới là hợp đồng: chỗ nào viết "tương đương" thì
hành vi giống, còn API hoàn toàn khác — **đừng đọc tài liệu Spring để suy ra chữ ký hàm
Node**.

| upip (Spring) | Lean (Node) | Ghi chú |
|---|---|---|
| Spring Session + Redis (`auth-server/config/session/RedisSessionConfig.java`) | **`express-session@1.19.0`** + store trên **Prisma/SQLite** | Redis là thứ cần khi **scale ngang** nhiều instance. Giai đoạn hiện tại một tiến trình → SQLite đủ. Store là một lớp thay được: đổi sang Redis chỉ là đổi một tham số `store` |
| Spring Security filter chain (`SecurityConfig.securityWebFilterChain`) | **middleware Express** mắc trong `server/src/app.ts` | Thứ tự middleware trong Express đóng đúng vai trò của thứ tự filter trong Spring — xem §3.4 |
| Spring Authorization Server (OAuth2/OIDC provider, `services/auth-server`) | **giai đoạn sau** — xem §8 | **Giai đoạn 1 chỉ đăng nhập bằng email + mật khẩu nội bộ.** Không dựng provider, không có `/oauth2/authorize`, không có JWT |
| BCrypt (`PasswordEncoder`, `auth-server/business/services/impl/*`) | **`@node-rs/argon2@2.0.2`** | Argon2id là khuyến nghị hiện hành (OWASP). `@node-rs/argon2` là binding Rust, không phải JS thuần → nhanh và không chặn event loop |
| BFF ở `api-gateway`: trình duyệt chỉ nhận cookie phiên, không bao giờ giữ token | **Express giữ luôn vai BFF** | Lean chỉ có một server. Nó vừa là gateway vừa là resource server → không cần tách. Nguyên tắc giữ nguyên: **cookie phiên httpOnly, không token phía client** |
| JWT nội bộ giữa các service, claim `authorities` + `userid` (`auth-server/config/token/TokenConfig.java:65`, `RbacAdminAuthzFilter.java:83`) | **không có** ở giai đoạn 1 | Lean là monolith một tiến trình — không có ranh giới service nào để JWT đi qua. Vai trò của claim `userid` do `req.session.userId` đảm nhận; claim `authorities` là việc của `docs/features/rbac/` |
| Kiểm soát phiên đồng thời qua Redis + Kafka back-channel logout (`BackChannelConcurrentSessionControl.java`) | **xóa hàng `Session` của user đó trong DB** | Cùng ngữ nghĩa (đăng nhập chỗ mới đá phiên cũ), rẻ hơn nhiều bậc vì chỉ có một tiến trình → **không cần Kafka, không cần back-channel**. Xem §7.6 |
| `helmet` không có tương đương 1-1 (Spring Security tự set header) | **`helmet@8.3.0`** | Trong Spring các header bảo mật do filter chain tự gắn; Express không gắn gì mặc định |
| CSRF token của Spring Security | **`csrf-csrf@4.0.3`** (double-submit cookie) | Spring bật CSRF mặc định; upip **tắt** ở gateway (`SecurityConfig:70 — csrf(...::disable)`) vì FE của nó là SPA riêng miền. Lean **bật** — xem §7.2 |

Phiên bản trong bảng là bản mới nhất đã tra tại thời điểm viết. Ràng buộc "luôn dùng bản
mới nhất" của `docs/overview/04-conventions.md:13` áp dụng — tra lại trước khi cài.

**Lựa chọn store phiên — chốt: store tự viết trên Prisma, không dùng `connect-sqlite3`.**

`connect-sqlite3@0.9.18` là đường ngắn nhất (một dòng cấu hình, một file `sessions.db`
riêng). Không chọn nó vì hai lý do:

1. Nó lưu phiên dưới dạng blob JSON không có cột `userId` → **không truy vấn được "liệt kê
   mọi phiên của user X"**, mà đó chính là thứ §7.6 (kiểm soát phiên đồng thời) và §7.7
   (thu hồi phiên khi đổi mật khẩu) cần.
2. Nó tạo một file DB thứ hai nằm ngoài Prisma → backup không còn là "copy một file
   `data.db`", trái với lý do chọn SQLite ở `docs/overview/01-architecture.md:82`.

Store tự viết chỉ là một class hiện thực interface `Store` của `express-session`
(`get`/`set`/`destroy`, và tùy chọn `touch`/`all`/`clear`/`length`), đọc ghi bảng `Session`
ở §5.2. Đánh đổi: khoảng 80 dòng code phải tự test, đổi lấy hai khả năng trên.

> `connect-sqlite3` vẫn là phương án dự phòng hợp lệ **nếu** §7.6 bị cắt khỏi giai đoạn 1.
> Ghi ở đây để người sau biết nó đã được cân nhắc chứ không phải bị bỏ sót.

## 3. Mô hình phiên

### 3.1 Nguyên tắc: server-side session, cookie httpOnly, KHÔNG token phía client

Trình duyệt chỉ nhận đúng một thứ: **cookie phiên `httpOnly`** mang một session id ngẫu
nhiên vô nghĩa. Toàn bộ trạng thái đăng nhập nằm ở server, trong bảng `Session`.

**KHÔNG lưu token trong `localStorage`, `sessionStorage`, hay bất kỳ chỗ nào JavaScript đọc
được.** Đây là ràng buộc cứng, không phải khuyến nghị.

**Vì sao:**

- Bất cứ thứ gì JS đọc được thì **XSS cũng đọc được**. Một lỗ XSS duy nhất — một thư viện
  npm bị chèn mã, một chỗ render nội dung người dùng thiếu escape — là đủ để đánh cắp token
  trong `localStorage` và gửi đi. Token đã ra khỏi máy thì dùng được đến khi hết hạn, ở bất
  kỳ đâu, không cách nào biết.
- Cookie `httpOnly` thì `document.cookie` **không đọc được**. XSS vẫn có thể *gửi request
  kèm cookie* (trình duyệt tự đính), nhưng không **lấy được** cookie mang đi nơi khác. Thiệt
  hại bị giới hạn trong phiên trình duyệt đang bị tấn công, và **thu hồi được ngay** bằng
  cách xóa hàng `Session` phía server.
- Session id server-side còn cho phép **thu hồi tức thời**. Token tự chứa (JWT) thì không:
  đã phát ra là có hiệu lực đến hết hạn, trừ khi dựng thêm danh sách đen — tức là dựng lại
  đúng cái server-side session vừa bỏ đi.

**upip chọn kiến trúc BFF chính vì lý do này.** Ở upip, access token/refresh token của
OAuth2 nằm **hoàn toàn trong `api-gateway`**; trình duyệt chỉ thấy cookie `SESSION`
(`api-gateway/config/SessionConfig.java` — `httpOnly(true)`). Lean chỉ có một server nên
không cần tách gateway riêng, nhưng **giữ nguyên kết luận**: token (nếu sau này có) không
bao giờ rời khỏi server.

### 3.2 Thuộc tính cookie

| Thuộc tính | Giá trị | Lý do |
|---|---|---|
| tên | `lean.sid` | Không dùng `connect.sid` mặc định — tên mặc định tự khai báo stack đang chạy |
| `httpOnly` | `true` | §3.1 |
| `sameSite` | `'lax'` | Chặn CSRF cho mọi request cross-site không phải điều hướng GET. `'strict'` sẽ làm người dùng đi từ link ngoài vào thấy như chưa đăng nhập |
| `secure` | `true` khi production, `false` khi dev | Cookie `secure` không gửi qua HTTP → bật ở dev là tự khóa mình khỏi `http://localhost` |
| `maxAge` | 7 ngày (chốt lại ở §9) | |
| `path` | `/` | |

Khi chạy sau reverse proxy (Render, nginx), **bắt buộc** `app.set('trust proxy', 1)` —
thiếu nó thì Express không nhận ra kết nối là HTTPS và từ chối gửi cookie `secure`.

> **Cạm bẫy dev — `sameSite: 'lax'` chỉ đúng nếu web và API **cùng origin**.** Vite chạy
> `:7173`, Express chạy `:3000` → khác origin. Bắt buộc dùng **proxy của Vite** (`server.proxy`
> trong `vite.config.ts`) để `/api` đi qua `:7173`. Nếu gọi thẳng `http://localhost:3000` thì
> phải hạ xuống `sameSite: 'none'` + `secure: true` + CORS `credentials` — tức là **tự tháo
> lớp phòng vệ CSRF cấp cookie chỉ để tiện lúc dev**. Không làm thế.

### 3.3 Vòng đời phiên

1. `POST /api/auth/login` — xác thực mật khẩu thành công → **xoay session id**
   (`req.session.regenerate`, §7.4) → ghi `userId` vào phiên → trả thông tin người dùng.
2. Mỗi request sau đó — middleware `requireAuth` đọc `req.session.userId`; không có thì
   `401`.
3. `POST /api/auth/logout` — hủy phiên phía server **và** xóa cookie ở client.
4. Hết hạn — hàng `Session` có `expiresAt`; store bỏ qua hàng quá hạn khi đọc, và một tác vụ
   dọn dẹp định kỳ xóa hàng chết.

**Rolling session:** mỗi request hợp lệ đẩy `expiresAt` xa thêm (`rolling: true` của
`express-session`). Người dùng dùng app mỗi ngày sẽ không bị đá ra sau đúng 7 ngày.

> **Cạm bẫy — API phiên của `express-session` là callback, không phải Promise.**
> `req.session.regenerate(cb)`, `req.session.destroy(cb)`, `req.session.save(cb)` đều nhận
> callback. Trong service `async`, phải bọc bằng `promisify` hoặc `new Promise`. **Quên
> `await` ở đây tạo race**: response trả về trước khi phiên kịp ghi xuống store, và lần
> request kế tiếp thấy như chưa đăng nhập — một lỗi chập chờn rất khó lần ra.

### 3.4 Thứ tự middleware trong `app.ts`

Thứ tự này đóng đúng vai của thứ tự filter trong Spring Security chain — sai thứ tự là sai
bảo mật, không phải sai thẩm mỹ.

```
helmet()                    → security headers, đặt sớm nhất
express.json()              → có sẵn (app.ts:15)
session(...)                → phải trước mọi thứ đọc req.session
csrf protection             → phải sau session (token gắn với phiên)
/api/health                 → công khai
/api/auth/*                 → công khai một phần (login, csrf); logout+session cần phiên
requireAuth                 → chốt chặn, đặt TRƯỚC năm router dữ liệu
/api/body-logs … /reminders → app.ts:21-25, không sửa gì bên trong
notFoundHandler             → app.ts:28, giữ nguyên vị trí
errorHandler                → app.ts:29, luôn cuối cùng
```

`app.ts:27` đã ghi *"Thứ tự bắt buộc: notFound trước, errorHandler cuối cùng"* — ràng buộc
đó không đổi.

**`requireAuth` mắc một lần cho cả năm router**, không rải vào từng feature. Đó là điểm
tương đương của `.anyExchange().authenticated()` trong upip
(`api-gateway/config/SecurityConfig.java:74`): mặc định là **đóng**, chỉ mở ra bằng
whitelist tường minh (`AuthUrl.AUTH_WHITELIST` bên upip). Cách ngược lại — mặc định mở, tự
nhớ khóa từng route — chắc chắn sẽ có ngày quên một route.

## 4. Bảng endpoint

Prefix `/api/auth`, cắm vào `app.ts` như năm router hiện có.

| Method | Path | Cần phiên? | Request | Response | Lỗi |
|---|---|---|---|---|---|
| `GET` | `/api/auth/csrf` | không | — | `200` `{ "csrfToken": "…" }` | — |
| `POST` | `/api/auth/login` | không | `{ email, password }` | `200` `SessionResponse` + `Set-Cookie` | `400` `429` `401` `403` |
| `POST` | `/api/auth/logout` | không¹ | — | `204` không body | — |
| `GET` | `/api/auth/session` | có | — | `200` `SessionResponse` | `401` |

¹ `logout` **idempotent**: gọi khi không có phiên vẫn trả `204`. Trả `401` ở đây chỉ tạo
một nhánh lỗi cho hành động vốn đã đạt được mục đích (người dùng muốn hết đăng nhập, và họ
đang hết đăng nhập).

### `SessionResponse`

> **`rbac` sẽ mở rộng hình dạng này.** Khi làm feature `rbac`, thêm trường
> `permissions: string[]` vào `SessionResponse` — web lấy danh sách mã quyền từ đây,
> một chuyến gọi lúc bootstrap. Xem `../rbac/SPEC.md` mục "Áp quyền trên FE".
>
> Đừng tạo endpoint `/api/auth/me` riêng cho việc này. Bản đầu của `rbac/SPEC.md`
> có nhắc tới nó do hai tài liệu viết song song; đã sửa ngày 2026-08-07.

```jsonc
{
  "user": {
    "id": "clx…",                    // string
    "email": "toi@vidu.com",         // string
    "displayName": "Trang",          // string | null
    "status": "active"               // "active" | "disabled"
  },
  "expiresAt": "2026-08-14T03:12:00.000Z"   // string, ISO
}
```

**Không bao giờ có `passwordHash` trong response.** DTO ra chọn trường tường minh (`select`
ở repository + hàm map ở `dtos/auth.response.ts`), **không** trả nguyên row Prisma. Đây là
cách duy nhất khiến việc thêm một cột nhạy cảm vào `User` sau này không tự động rò ra API.

### Request `POST /api/auth/login`

```jsonc
{
  "email": "toi@vidu.com",     // z.email(), trim + lowercase trước khi tra
  "password": "…"              // string, 1…200 ký tự — min-8 thuộc đường ĐẶT mật khẩu, không thuộc đường đăng nhập
}
```

Zod 4: dùng `z.email()` top-level, **không** `z.string().email()`
(`docs/overview/04-conventions.md:16`).

> **Ràng buộc độ dài mật khẩu ở đây là ràng buộc *đầu vào*, không phải chính sách mật
> khẩu.** Trần 200 ký tự tồn tại để chặn DoS: Argon2 trên chuỗi 10 MB tốn CPU thật. Chính
> sách mật khẩu (độ phức tạp) là câu hỏi mở §9.

### Hình dạng lỗi — theo Lean, KHÔNG theo upip

**Bắt buộc dùng hình dạng của `docs/overview/04-conventions.md:39-41`:**

```jsonc
{ "error": { "code": "…", "message": "…" } }
```

Và với lỗi validate, thêm `fields`:

```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": [{ "path": "email", "message": "…" }] } }
```

> **KHÔNG dùng `{ "success": false, … }` của upip.** upip bọc response trong envelope
> `success`/`data`; Lean thì không — `GET /api/goal` trả thẳng object
> (`docs/features/goal/SPEC.md:41-48`). Bê envelope của upip sang sẽ khiến `auth` là feature
> duy nhất có hình dạng khác năm feature còn lại, và `web/src/lib/apiClient.ts` phải mang hai
> nhánh giải mã. **Lấy mô hình bảo mật của upip, không lấy hợp đồng JSON của nó.**

| HTTP | `code` | Khi nào |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Zod fail — email sai định dạng, thiếu trường |
| `401` | `INVALID_CREDENTIALS` | Sai email **hoặc** sai mật khẩu — **một mã duy nhất cho cả hai**, §7.3 |
| `401` | `UNAUTHORIZED` | Không có phiên hợp lệ (từ `requireAuth`) |
| `403` | `ACCOUNT_DISABLED` | Mật khẩu **đúng** nhưng `status = "disabled"` — §7.3 |
| `403` | `CSRF_ERROR` | Thiếu hoặc sai CSRF token |
| `429` | `TOO_MANY_ATTEMPTS` | Vượt ngưỡng thử đăng nhập — §7.1 |

**Việc phải làm ở `shared/errors/`:** `AppErrorCode` hiện là union đóng gồm đúng ba giá trị
(`server/src/shared/errors/AppError.ts:1`):

```ts
export type AppErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR';
```

Năm mã mới ở trên **phải được thêm vào union này**, kèm factory tương ứng bên cạnh
`AppError.notFound` / `AppError.validation` (`AppError.ts:22-28`). Không có bước này thì
TypeScript chặn ngay — đó là điểm cộng của union đóng, nó biến "thêm mã lỗi" thành thay đổi
tường minh chứ không phải chuỗi tự do.

`errorHandler` (`server/src/shared/errors/errorHandler.ts:43-52`) đã dịch `AppError` sang
response đúng hình dạng, **không cần sửa**. Nhưng cần thêm một nhánh: lỗi CSRF do
`csrf-csrf` ném ra không phải `AppError` → nếu không nhận diện, nó rơi vào nhánh `500`
`INTERNAL_ERROR` ở `:54-58` và client thấy sai mã.

## 5. Lược đồ dữ liệu

### 5.1 Bảng `User` — bảng mới

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
```

Ghi chú:

- **`status` là `String`, không phải Prisma enum.** Nhất quán với `Meal.slot` và
  `Reminder.kind` (`docs/overview/02-data-model.md:77`) — SQLite không hỗ trợ enum native,
  và ràng buộc giá trị đặt ở Zod tầng controller.
- **`email` phải được chuẩn hóa `trim().toLowerCase()` trước khi ghi và trước khi tra.**
  `@unique` của SQLite so sánh phân biệt hoa thường theo mặc định → `Toi@vidu.com` và
  `toi@vidu.com` sẽ là **hai tài khoản khác nhau** nếu không chuẩn hóa. Chuẩn hóa ở **một
  chỗ duy nhất** (`dtos/auth.request.ts`, qua `.transform()` của Zod) để không có đường vào
  nào bỏ sót.
- **`passwordHash`** — tên trường nói rõ nó là hash. Không đặt tên `password`; tên đó dễ
  khiến ai đó gán chuỗi thô vào.
- **Không có `role` ở đây.** Vai trò là việc của `docs/features/rbac/`. Đặt `role` vào
  `User` bây giờ là quyết định trước hộ feature khác.

### 5.2 Bảng `Session` — bảng mới

```prisma
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
```

**Điểm mấu chốt: `userId` được nhấc ra khỏi `data` thành cột riêng có index.** Interface
`Store` của `express-session` chỉ đưa cho ta `(sid, sessionData)` — nếu chỉ đổ nguyên
`sessionData` vào một cột blob thì không có cách nào truy vấn theo người dùng. Store tự viết
phải đọc `userId` từ payload rồi ghi vào cột. Không có cột này thì §7.6 và §7.7 **không hiện
thực được**.

`onDelete: Cascade` — xóa người dùng thì phiên đi theo, không để lại phiên mồ côi trỏ vào
hư không.

### 5.3 Bảng `LoginAttempt` — bảng mới

```prisma
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

**Cố ý KHÔNG có quan hệ tới `User`.** Lần thử vào một email **không tồn tại** cũng phải được
ghi — đó chính là dấu hiệu của việc dò tài khoản. Ràng buộc khóa ngoại ở đây sẽ làm mất đúng
loại dữ liệu cần nhất.

### 5.4 Bốn bảng hiện có — chỉ thêm quan hệ, KHÔNG thêm cột

`BodyLog`, `Meal`, `Goal`, `Reminder` **đã có `userId`** (§1.3). Việc duy nhất cần làm là
thêm một dòng quan hệ vào mỗi model:

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

**Không đổi khóa chính. Không đổi ràng buộc unique. Không đổi một truy vấn nào ở tầng
Prisma.** Đây chính là khoản đầu tư ở `02-data-model.md:13` đang được thu hồi.

> **Cảnh báo triển khai:** thêm quan hệ **bắt buộc** khiến mọi hàng hiện có phải có một hàng
> `User` tương ứng. Dữ liệu hiện tại mang `userId = 'local'` mà bảng `User` thì trống → thêm
> quan hệ **trước** khi tạo user sẽ làm `prisma db push` thất bại hoặc, tệ hơn, im lặng bỏ
> qua ràng buộc (SQLite chỉ cưỡng chế khóa ngoại khi `PRAGMA foreign_keys=ON`). Thứ tự bắt
> buộc nằm ở [`PLAN.md`](PLAN.md) §Bước 3.

## 6. Thay `LOCAL_USER_ID`

### 6.1 Vì sao nó là một hằng có tên

`server/src/shared/constants.ts:5-7` ghi thẳng ý định:

> *"Khi thêm auth: thay mọi chỗ dùng hằng này bằng user lấy từ session. Grep `LOCAL_USER_ID`
> sẽ ra đúng danh sách chỗ cần sửa — đó là lý do nó là một hằng có tên chứ không phải chuỗi
> `'local'` rải khắp nơi."*

Mục này là việc thu hồi khoản đầu tư đó. Grep đã chạy; dưới đây là **danh sách đầy đủ**.

### 6.2 Danh sách chính xác — code sản xuất

| File | Dòng | Tầng | Sửa thế nào |
|---|---|---|---|
| `server/src/shared/constants.ts` | `9` | hằng | Giữ lại **tạm thời** cho bước migrate ([`PLAN.md`](PLAN.md) §Bước 3), **xóa hẳn** ở bước cuối |
| `server/src/features/goal/services/goal.service.ts` | `1, 11, 16` | **service** ✅ | Nhận `userId` làm tham số từ controller. Repository đã nhận `userId` → **không sửa repository** |
| `server/src/features/meals/services/meals.service.ts` | `1, 12, 15, 20, 26, 33` | **service** ✅ | Thay thân hàm `currentUserId()` (`:12`) bằng tham số truyền vào. Repository đã nhận `userId` → **không sửa repository** |
| `server/src/features/bodyLogs/repositories/bodyLogs.repository.ts` | `3, 14, 24, 40, 50` | **repository** ⚠️ | Phải **đổi chữ ký** cả 4 hàm + `whereKey()` để nhận `userId`, rồi sửa service gọi chúng |
| `server/src/features/summary/repositories/summary.repository.ts` | `2, 44, 66, 82` | **repository** ⚠️ | Như trên, 3 hàm |
| `server/src/features/reminders/repositories/reminders.repository.ts` | `2, 35, 43, 59, 61, 75, 82` | **repository** ⚠️ | Như trên, 5 hàm — **và kéo theo §6.4** |

**Hai nhóm, hai mức công sức.** `goal` và `meals` làm đúng: repository của chúng nhận
`userId` làm tham số đầu tiên, hằng chỉ xuất hiện ở service. `docs/features/meals/SPEC.md:239`
khẳng định đúng cho `meals`: *"Repository không phải sửa một dòng nào."*

Ba feature còn lại thì không. Chúng import hằng thẳng vào repository — nghĩa là repository
tự quyết định nó đang làm việc cho ai, thay vì được bảo. `docs/features/body-logs/SPEC.md:188-193`
mô tả đúng hiện trạng này (và không coi đó là nợ).

> **Đây là mâu thuẫn thật giữa các tài liệu.** `02-data-model.md:13` và `constants.ts:5`
> đều hứa rằng thêm auth chỉ là "thay hằng bằng user lấy từ session". Với ba feature trên,
> nó là **đổi chữ ký hàm ở tầng repository và sửa mọi lời gọi ở tầng service**. Vẫn nhỏ và
> vẫn cơ học, nhưng không phải một dòng. Ước lượng theo lời hứa sẽ hụt.

### 6.3 File test

Năm file test import hằng để dựng dữ liệu (`server/test/features/{bodyLogs,meals,summary,reminders}/*.test.ts`,
`server/test/lib/db.test.ts`). Chúng cần một user thật trong `beforeEach` và một helper đăng
nhập cho supertest — chi tiết ở [`PLAN.md`](PLAN.md) §Bước 8.

### 6.4 Chỗ khó nhất: scheduler không có request, nên không có phiên

`server/src/features/reminders/services/reminders.scheduler.ts` chạy từ **cron**, không từ
HTTP request. **Không có `req`, nên không có `req.session`, nên không có `userId`.**

Chữ ký hiện tại giả định ngầm chỉ có một người dùng
(`reminders.scheduler.ts:35-40`):

```ts
export interface ReminderRunnerDeps {
  listReminders(): Promise<ReminderView[]>;        // ← không có userId
  hasWeightLogged(date: string): Promise<boolean>; // ← không có userId
  hasMealLogged(date: string): Promise<boolean>;   // ← không có userId
  send(message: NtfyMessage): Promise<NtfySendResult>;
}
```

Với nhiều người dùng, `runDueReminders` (`:118`) phải:

1. Truy vấn **mọi** `Reminder` đang bật và đến giờ, **của mọi user** — một truy vấn, không
   phải vòng lặp N+1 qua từng user.
2. Kiểm tra điều kiện "đã ghi chưa" **theo từng `userId`**.
3. Gửi ntfy tới topic của **đúng** người đó.

`ReminderView` (`dtos/reminders.response.ts`) hiện không mang `userId` → phải thêm, hoặc
scheduler phải làm việc trên một kiểu row khác.

**Đây là chỗ mà "thêm auth" thực sự đổi logic nghiệp vụ, không chỉ đổi nguồn của một biến.**
`selectDueReminders` (`:84`) vẫn là hàm thuần và vẫn đúng — nó lọc theo `enabled` +
`timeOfDay` + có topic, không quan tâm ai sở hữu. Phần phải viết lại là `runDueReminders`.

**Rủi ro bảo mật nếu làm ẩu:** một vòng lặp sai chỗ sẽ gửi nhắc nhở của người này tới topic
ntfy của người khác — rò dữ liệu sức khỏe. Bước này cần test riêng với **hai** user
([`PLAN.md`](PLAN.md) §Bước 9).

> Việc này **có thể hoãn** sang sau `auth` nếu chấp nhận tắt scheduler tạm thời. Nhưng không
> được **quên** — nếu để nguyên, scheduler sẽ tiếp tục đọc dữ liệu của `userId = 'local'`,
> tức là im lặng ngừng hoạt động sau khi migrate đổi id, hoặc tệ hơn, gửi nhắc của user đầu
> tiên cho tất cả.

## 7. Bảo mật bắt buộc

Mọi mục trong §7 là **bắt buộc cho giai đoạn 1**, không phải "làm sau nếu kịp".

### 7.1 Chống brute-force đăng nhập

Đếm số lần thất bại trên bảng `LoginAttempt` (§5.3), theo **hai chiều độc lập**:

- **Theo `emailKey`** — chặn dò mật khẩu vào một tài khoản cụ thể.
- **Theo `ip`** — chặn quét nhiều tài khoản từ một nguồn (password spraying), thứ mà đếm
  theo email hoàn toàn không thấy.

Ngưỡng đề xuất (số chính xác là câu hỏi mở §9): **5 lần thất bại trong 15 phút** → khóa
`emailKey` đó **15 phút**, trả `429 TOO_MANY_ATTEMPTS`. Đăng nhập thành công **xóa** các lần
thất bại của email đó.

Bốn ràng buộc dễ làm sai:

1. **Kiểm ngưỡng TRƯỚC khi gọi Argon2.** Verify Argon2 tốn hàng chục ms CPU có chủ đích —
   để attacker kích hoạt nó không giới hạn chính là biến chống-brute-force thành lỗ DoS.
2. **Response khi bị khóa phải giống nhau bất kể email có tồn tại hay không.** Ngược lại,
   `429` trở thành oracle đoán tài khoản.
3. **`ip` sau reverse proxy phải lấy đúng.** `req.ip` chỉ đúng khi `trust proxy` được cấu
   hình (§3.2). Sai chỗ này thì mọi request trông như đến từ một IP duy nhất của proxy → khóa
   nhầm toàn bộ người dùng.
4. **Bảng phải được dọn.** `LoginAttempt` tăng vô hạn nếu không xóa hàng cũ hơn cửa sổ.

> **Ghi nhận trước cho 20 triệu người dùng:** đếm bằng `SELECT COUNT(*)` trên SQLite ở mỗi
> lần đăng nhập sẽ **không** chịu nổi quy mô đó. Ở quy mô ấy việc này thuộc về Redis (`INCR`
> + `EXPIRE`) hoặc rate limiter ở tầng edge. Ranh giới đặt đúng chỗ ngay từ đầu: toàn bộ logic
> nằm trong `repositories/loginAttempt.repository.ts`, đổi hạ tầng chỉ đổi một file.

### 7.2 CSRF — `csrf-csrf@4.0.3`

Phiên dựa trên cookie **bắt buộc** phải chống CSRF: trình duyệt tự đính cookie vào request
do trang khác khởi tạo. `sameSite: 'lax'` chặn phần lớn, nhưng nó là phòng vệ của **trình
duyệt** — không phải của ta, và không phủ hết mọi kịch bản.

`csrf-csrf` hiện thực mẫu **double-submit cookie có ký**: token nằm trong một cookie *và*
phải được gửi lại trong header (`x-csrf-token`). Trang khác miền không đọc được cookie nên
không dựng được header khớp.

Áp dụng cho **mọi** method thay đổi trạng thái (`POST`, `PUT`, `PATCH`, `DELETE`) — tức là
`POST /api/auth/login` và cả năm router dữ liệu. `GET` không cần.

Web lấy token qua `GET /api/auth/csrf` khi khởi động và gắn vào mọi request ghi.

> **Đây là chỗ Lean cố ý làm khác upip.** upip **tắt** CSRF ở gateway
> (`api-gateway/config/SecurityConfig.java:70` — `csrf(ServerHttpSecurity.CsrfSpec::disable)`),
> hợp lý trong bối cảnh của nó. Lean phục vụ trang web **cùng origin** với API và dùng cookie
> phiên → CSRF là mối đe dọa thật, phải bật.

> **Không bịa chữ ký hàm.** API của `csrf-csrf` đã đổi tên giữa các major version. Hàm khởi
> tạo nhận một object cấu hình (trong đó có cách lấy secret và cách lấy định danh phiên) và
> trả về một middleware bảo vệ cùng một hàm sinh token. **Tra README của đúng bản 4.0.3 khi
> code** — mô tả ở đây là hành vi, không phải chữ ký.

### 7.3 Không lộ "email không tồn tại" vs "sai mật khẩu"

Cả hai trường hợp trả **cùng** `401` + **cùng** `INVALID_CREDENTIALS` + **cùng** message
(`'Email hoặc mật khẩu không đúng'`).

**Vì sao:** phân biệt hai ca biến form đăng nhập thành công cụ liệt kê tài khoản. Với ứng
dụng sức khỏe, chỉ riêng việc *"địa chỉ này có tài khoản"* đã là thông tin riêng tư.

**Kênh phụ phải bịt — thời gian phản hồi.** Nếu email không tồn tại thì code thoát ngay,
còn email tồn tại thì chạy Argon2 hàng chục ms. Chênh lệch đó đo được và đủ để dò. **Cách
xử lý: khi không tìm thấy user, vẫn chạy verify Argon2 với một hash giả cố định** rồi trả
lỗi. Tốn một lần verify, đổi lấy việc hai nhánh mất thời gian tương đương.

**Ngoại lệ có chủ đích — `403 ACCOUNT_DISABLED`.** Chỉ trả mã này **sau khi mật khẩu đã
được xác minh đúng**. Lúc đó người gọi đã chứng minh họ sở hữu tài khoản, nên nói cho họ
biết tài khoản bị khóa không rò gì thêm — và im lặng ở đây chỉ khiến người dùng thật ngồi
thử lại mật khẩu đúng mãi.

### 7.4 Xoay session id sau khi đăng nhập (chống session fixation)

Sau khi xác thực thành công, **bắt buộc** gọi `req.session.regenerate()` trước khi ghi
`userId` vào phiên.

**Vì sao:** không xoay thì session id trước và sau đăng nhập là một. Kẻ tấn công ép nạn nhân
dùng một session id do hắn biết (qua link, qua XSS, qua subdomain), chờ nạn nhân đăng nhập,
rồi dùng lại chính id đó — giờ đã mang quyền của nạn nhân. Xoay id làm id cũ trở thành vô
giá trị ngay tại thời điểm nâng quyền.

`regenerate` là callback (§3.3) — **phải `await` cho xong trước khi gán `req.session.userId`**,
nếu không giá trị vừa gán sẽ bị phiên mới ghi đè.

Áp dụng cùng nguyên tắc cho **đổi mật khẩu** (khi có).

### 7.5 Security headers — `helmet@8.3.0`

`app.use(helmet())` đặt sớm nhất trong chuỗi (§3.4). Mặc định của helmet đã gồm
`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`,
`Referrer-Policy`, và CSP.

> **CSP mặc định của helmet sẽ chặn Vite dev server.** Vite tiêm script và mở WebSocket cho
> HMR. Cấu hình CSP theo môi trường, **không** tắt hẳn CSP để cho dev chạy — đó là cách nó
> vô tình lên production.

Lưu ý phân vai: API trả JSON không tự nó cần CSP, nhưng khi Express phục vụ luôn bản build
tĩnh của `web/` thì CSP là lớp phòng vệ **thứ hai** cho XSS — và §3.1 đã nói toàn bộ mô hình
cookie httpOnly dựa trên việc XSS khó xảy ra.

### 7.6 Kiểm soát phiên đồng thời

upip có `BackChannelConcurrentSessionControl` (`auth-server/config/oidc/`): đăng nhập ở thiết
bị mới sẽ **đá** phiên cũ, và thông báo cho các service khác qua Kafka back-channel logout.

**Tương đương ở Lean, rẻ hơn nhiều bậc:** vì mọi phiên là hàng trong bảng `Session` (§5.2)
và chỉ có một tiến trình đọc bảng đó, "đá phiên cũ" chỉ là `deleteMany({ where: { userId } })`
chạy ngay sau `regenerate()` ở bước đăng nhập. **Không cần Kafka. Không cần back-channel.
Không cần registry.** Phiên bị xóa thì request kế tiếp mang cookie đó không tìm thấy hàng
nào → `requireAuth` trả `401`.

Chính sách cần chốt (§9): một-phiên-duy-nhất như upip, hay cho phép N phiên và chỉ đá phiên
cũ nhất khi vượt N?

> Việc này **chỉ hiện thực được nhờ cột `userId` trong bảng `Session`** (§5.2). Đó là lý do
> `connect-sqlite3` bị loại ở §2.

### 7.7 Thu hồi phiên

Hệ quả trực tiếp của §7.6: đã có `deleteMany({ where: { userId } })` thì cũng có sẵn cơ chế
thu hồi. Bắt buộc gọi khi:

- Đổi mật khẩu → hủy mọi phiên khác.
- Tài khoản chuyển `status = "disabled"` → hủy mọi phiên ngay, không chờ hết hạn.

Đây là khả năng mà JWT tự chứa **không** có, và là lý do §3.1 chọn server-side session.

### 7.8 Bí mật phiên

`SESSION_SECRET` đọc qua `server/src/config/env.ts` (`envSchema` tại `:3-7`), **bắt buộc**,
tối thiểu 32 ký tự, **không có giá trị mặc định**. So sánh với `DATABASE_URL` ở `:10` vốn có
fallback `'file:./data.db'` — fallback ở đó vô hại, còn fallback cho secret nghĩa là mọi bản
triển khai dùng chung một khóa ký. Thiếu biến này thì `env.ts` phải làm tiến trình chết ngay
lúc khởi động, không phải cảnh báo rồi chạy tiếp.

`express-session` nhận `secret` dạng mảng để **xoay khóa** (khóa đầu để ký, các khóa sau vẫn
được chấp nhận khi xác minh). Chưa cần ở giai đoạn 1; ghi lại để sau này xoay khóa không
phải đá toàn bộ người dùng ra.

## 8. Ngoài phạm vi giai đoạn 1

Liệt kê tường minh để người đọc sau biết những thứ này **đã được cân nhắc và cố ý hoãn**,
không phải bị bỏ sót.

| Thứ | Vì sao hoãn | Điều kiện mở lại |
|---|---|---|
| **OAuth2/OIDC provider** (tương đương Spring Authorization Server của upip) | Provider chỉ có nghĩa khi có **nhiều client** cần cấp token. Lean có đúng một web app cùng origin | Có app di động, hoặc có service thứ hai, hoặc cần SSO với hệ thống khác |
| **Đăng nhập mạng xã hội** (Google, …) | Phụ thuộc §8.1 — cần luồng OAuth2 client trước. upip có `AuthProvider` trong entity `User` cho việc này | Sau khi có OAuth2 client |
| **2FA / TOTP** | Cần bảng thiết bị, mã dự phòng, luồng khôi phục — một feature riêng, không phải phần thêm của đăng nhập | Chốt riêng |
| **Quên mật khẩu qua email** | Cần hạ tầng gửi email (SMTP/provider) mà Lean chưa có gì. upip có `ForgotPasswordController` + `ConfirmTokenRepository` làm tham chiếu khi tới lúc | Có kênh email |
| ~~**Đăng ký tự phục vụ**~~ — ĐÃ LÀM | Quyết định 5 của design doc 2026-08-10 đảo mục này: `POST /api/auth/register` mở công khai, vai trò `USER` gán cứng phía server. Xác thực email và chống spam vẫn là nợ — xem design doc §7 |
| **Phân quyền / vai trò** | Thuộc `docs/features/rbac/`, đang được viết song song. `auth` trả lời *"ai đang gọi"*; `rbac` trả lời *"người đó được làm gì"* | Ngay sau `auth` |
| **Redis cho phiên** | Chỉ cần khi chạy nhiều instance | Scale ngang |
| **JWT nội bộ + claim `authorities`** | Không có ranh giới service nào để token đi qua (§2) | Tách microservice |

## 9. Câu hỏi mở — cần chủ dự án chốt

Không tự quyết những mục này; mỗi mục là quyết định sản phẩm hoặc quyết định hạ tầng, không
phải quyết định kỹ thuật thuần.

1. **SQLite có còn đúng không?** Đây là câu hỏi lớn nhất và nó **vượt khỏi phạm vi `auth`**.
   `docs/overview/01-architecture.md:82` chọn SQLite với lý do *"không thành vấn đề với 1
   người dùng"*. Định hướng 20 triệu người dùng làm lý do đó hết đúng: SQLite chỉ cho **một
   writer tại một thời điểm**, và mỗi lần đăng nhập ghi ít nhất hai hàng (`Session` +
   `LoginAttempt`). Kiến trúc đã ghi đường thoát (*"đổi `provider` trong `schema.prisma` để
   sang Postgres"* — `:91`), nhưng **thời điểm** đổi cần được chốt. Đổi **trước** khi có dữ
   liệu thật thì rẻ hơn nhiều lần.
2. **Chính sách phiên đồng thời** (§7.6): một-phiên-duy-nhất như upip, hay cho phép N thiết
   bị? Sức khỏe cá nhân thường dùng ở cả điện thoại lẫn máy tính → một-phiên có thể gây khó
   chịu thật.
3. **Thời hạn phiên**: đề xuất 7 ngày + rolling. Ngắn hơn thì an toàn hơn, dài hơn thì tiện
   hơn.
4. **Ngưỡng khóa brute-force** (§7.1): 5 lần / 15 phút / khóa 15 phút — chốt hay đổi?
5. **Chính sách mật khẩu**: tối thiểu bao nhiêu ký tự? Có bắt buộc độ phức tạp không? (Khuyến
   nghị hiện hành nghiêng về **độ dài tối thiểu 12** thay vì bắt trộn ký tự đặc biệt.) Có
   kiểm tra với danh sách mật khẩu đã rò rỉ không?
6. **Đăng ký tự phục vụ có thuộc giai đoạn 1 không?** Nếu 20 triệu người dùng là đích thật
   thì tạo tài khoản bằng script seed không đi được xa. Nhưng mở đăng ký kéo theo xác thực
   email → kéo theo hạ tầng email (§8).
7. **`displayName` có bắt buộc không?** Hiện đề xuất nullable. Nếu bắt buộc thì phải có ở
   luồng tạo user.
8. **Dữ liệu hiện tại thuộc về ai?** Bước migrate ([`PLAN.md`](PLAN.md) §Bước 3) cần **email
   thật** của chủ dữ liệu. Không có nó thì không migrate được.
9. **Có cần audit log không?** upip có hẳn gói `auth/audit` ghi lại sự kiện đăng nhập. Lean
   ghi `LoginAttempt` (§5.3) là đủ cho chống brute-force nhưng không phải một audit trail.

## 10. Chỗ mâu thuẫn với tài liệu hiện có

Feature này làm **sai lệch** một loạt khẳng định đang có trong repo. Liệt kê ở đây để việc
cập nhật là hành động tường minh, không phải phát hiện tình cờ. **Không sửa file nào trong
danh sách này khi chưa có code chạy** — tài liệu Lean mô tả hành vi thật, không mô tả ý định.

| File | Dòng | Khẳng định sẽ sai |
|---|---|---|
| `docs/overview/04-conventions.md` | `22` | *"Không có auth, không có middleware xác thực. Server chỉ bind localhost."* |
| `docs/overview/04-conventions.md` | `18` | *"lấy từ hằng `LOCAL_USER_ID` … Chưa có đăng nhập"* |
| `docs/overview/01-architecture.md` | `83` | Dòng bảng *"**Không có đăng nhập**"* |
| `docs/overview/01-architecture.md` | `82` | *"Không chạy được nhiều tiến trình ghi đồng thời — không thành vấn đề với 1 người dùng"* → xem §9.1 |
| `docs/overview/01-architecture.md` | `29` | Chú thích cây thư mục `constants.ts # LOCAL_USER_ID` |
| `docs/overview/02-data-model.md` | `11, 15` | *"dù bản này chưa có đăng nhập"*, *"không kéo theo auth"* |
| `CLAUDE.md` | `60` | *"Chưa có đăng nhập; dùng hằng `LOCAL_USER_ID`"* |
| `AGENTS.md` | `18, 34` | Cùng nội dung |
| `README.md` | `166` | *"có middleware xác thực, mọi bản ghi mang một `LOCAL_USER_ID` cố định"* |
| `server/src/shared/constants.ts` | `1-9` | Toàn bộ khối chú thích |
| `.claude/commands/impl-feature.md` · `impl-files.md` · `.claude/skills/implement-feature/SKILL.md` | — | Hướng dẫn agent *"mọi truy vấn mang `userId` lấy từ `LOCAL_USER_ID`"* — sẽ dạy sai cho agent viết feature mới |

Ngoài ra, một mâu thuẫn **nội tại** đã tồn tại sẵn, không do feature này gây ra: lời hứa
"thay hằng là xong" ở `02-data-model.md:13` không đúng với ba feature nhét hằng vào tầng
repository — §6.2.
