# Design — Đăng ký tài khoản + 3 vai trò (`USER` / `ADMIN` / `SYSTEM_ADMIN`)

> **Đây là tài liệu delta, không phải spec thay thế.** Nguồn chính vẫn là
> [`../../features/auth/SPEC.md`](../../features/auth/SPEC.md) (720 dòng) và
> [`../../features/rbac/SPEC.md`](../../features/rbac/SPEC.md) (717 dòng). File này ghi
> **đúng những chỗ đổi** so với hai spec đó, cộng phần chưa spec nào mô tả.
>
> Ngày chốt: **2026-08-10**. Trạng thái: đã duyệt design, **chưa có dòng code nào**.

Mọi tham chiếu `đường-dẫn:dòng` trỏ tới nội dung tại thời điểm 2026-08-10.

---

## 1. Yêu cầu gốc

Nguyên văn của chủ dự án:

> *"tôi muốn bổ xung chỗ đăng kí tài khoản, cấp cho tôi 1 tài khoản role admin, 1 tài khoản
> user, systemAdmin, tất cả đều mật khẩu 123456, user thì thực hiện dc hết các chức năng như
> hiện tại, admin thì xem dc listuser, thêm sửa xóa dc tất cả thông tin user, systemadmin thì
> có quyển ẩn bất kì chức năng nào"*

Bốn phần: **đăng ký**, **ba vai trò seed sẵn**, **`ADMIN` quản lý tài khoản**, **`SYSTEM_ADMIN`
ẩn được chức năng**.

## 2. Sáu quyết định đã chốt

Mỗi dòng dưới đây trả lời một câu hỏi mở hoặc đảo một quyết định đã ghi trong spec. Ghi lại vì
lý do quan trọng hơn kết luận.

| # | Quyết định | Đảo/trả lời gì | Vì sao |
|---|---|---|---|
| 1 | **Làm đủ theo spec**, không làm bản tối thiểu | — | Argon2id, `express-session` + store tự viết trên Prisma, CSRF, helmet, chống brute-force, xoay session id đều thuộc phạm vi. Gồm cả việc sửa 3 repository hardcode `LOCAL_USER_ID` (`auth/SPEC.md:445-447`) và viết lại scheduler đa người dùng (`auth/SPEC.md:468`) |
| 2 | **`ADMIN` chỉ quản lý thông tin tài khoản**, không đọc/sửa dữ liệu sức khỏe của người khác | Giữ nguyên `rbac/SPEC.md:192-205` — không đảo gì | "Thông tin user" = email, `displayName`, trạng thái khóa/mở, vai trò, mật khẩu (reset). `BodyLog`/`Meal`/`Goal` của người khác vẫn bất khả xâm phạm. Xóa tài khoản thì dữ liệu đi theo qua `onDelete: Cascade` — đó là đường duy nhất `ADMIN` tác động tới dữ liệu sức khỏe, và nó không cho **đọc** |
| 3 | **`SYSTEM_ADMIN` ẩn chức năng bằng cách sửa ma trận `Role × Permission`** | Thêm vai trò thứ 3, đảo `rbac/SPEC.md:38-40` | Spec viết vai trò `SYSTEM_ADMIN` của upip *"vô nghĩa với một app sức khỏe cá nhân và **không được bê sang**"*. Đảo có chủ đích: chủ dự án muốn một cấp trên `ADMIN`. **Không thêm bảng, không thêm cơ chế** — dùng đúng `PUT /api/roles/:id/permissions` đã thiết kế ở `rbac/SPEC.md:601`. Hai phương án khác (feature flag toàn hệ thống; override quyền theo từng user) đều bị loại vì cần cơ chế mới, mà cơ chế sẵn có đã đủ diễn đạt "ẩn bất kỳ chức năng nào khỏi bất kỳ vai trò nào" |
| 4 | **Ràng buộc độ dài mật khẩu chuyển khỏi đường đăng nhập** | Sửa `auth/SPEC.md:268` (`password` 8…200) | `POST /api/auth/login` validate **1…200** ký tự; trần 200 giữ nguyên để chặn DoS Argon2 (`auth/SPEC.md:275`). Min 8 chỉ áp lúc **đặt** mật khẩu (đăng ký, reset). Lý do không phải để lách `123456`: **policy độ dài thuộc lúc tạo, không thuộc lúc xác thực**. Min ở đường login còn khóa ngoài chính chủ khi policy siết lên sau này, và làm form đăng nhập tiết lộ policy. Hệ quả: seed `123456` đăng nhập được; đăng ký mới vẫn phải ≥ 8. Trả lời một phần câu hỏi mở `auth/SPEC.md:685` |
| 5 | **Đăng ký mở công khai, vai trò `USER` gán cứng phía server** | Đảo `auth/SPEC.md:662`, trả lời `auth/SPEC.md:688` + `rbac/SPEC.md:703` | Vai trò **không** đọc từ request body — nếu không thì ai cũng tự đăng ký làm `SYSTEM_ADMIN`. Bỏ xác thực email và chống spam vì còn localhost; ghi thành nợ ở §7 |
| 6 | **Dữ liệu hiện tại: không có gì để migrate** | Vô hiệu hóa `auth/PLAN.md` §Bước 3 và câu hỏi mở `auth/SPEC.md:693` | Đã kiểm DB `server/data.db` ngày 2026-08-10: `BodyLog=0 Meal=0 Goal=0 Reminder=0`. Không cần email thật của chủ dữ liệu, không cần backfill `userId='local'`. Cảnh báo `auth/SPEC.md:420` (thêm quan hệ bắt buộc lên bảng đã có dữ liệu) **không áp dụng** |

## 3. Ba vai trò và ma trận quyền

**Danh mục vẫn đúng 10 quyền** của `rbac/SPEC.md` §3 — không thêm mã nào. Ba yêu cầu của chủ
dự án khớp sẵn vào danh mục có: CRUD tài khoản = `user:view` + `user:manage`, ẩn chức năng =
`rbac:manage`, đăng ký = route mở.

Ký hiệu giữ nguyên `rbac/SPEC.md:109`: **Ⓞ** = có quyền nhưng chỉ trên dữ liệu của chính mình
(ownership vẫn chặn) · **✅** = phạm vi toàn hệ thống · **❌** = không có.

| Permission | `USER` | `ADMIN` | `SYSTEM_ADMIN` |
| :--- | :---: | :---: | :---: |
| `log:view` | Ⓞ | Ⓞ | Ⓞ |
| `log:manage` | Ⓞ | Ⓞ | Ⓞ |
| `goal:view` | Ⓞ | Ⓞ | Ⓞ |
| `goal:manage` | Ⓞ | Ⓞ | Ⓞ |
| `reminder:view` | Ⓞ | Ⓞ | Ⓞ |
| `reminder:manage` | Ⓞ | Ⓞ | Ⓞ |
| `user:view` | ❌ | ✅ | ✅ |
| `user:manage` | ❌ | ✅ | ✅ |
| `rbac:view` | ❌ | ❌ | ✅ |
| `rbac:manage` | ❌ | ❌ | ✅ |

**Số quyền:** `USER` 6 · `ADMIN` 8 · `SYSTEM_ADMIN` 10.

Cách đọc bảng, ba điều bắt buộc nhớ:

- **Sáu dòng đầu là Ⓞ ở cả ba cột.** `ADMIN` và `SYSTEM_ADMIN` có `log:view` **không** có nghĩa
  đọc được nhật ký của người khác — nó chỉ có nghĩa được vào chức năng "xem nhật ký", còn hàng
  nào hiện ra do ownership quyết định. Đây là điểm quan trọng nhất, `rbac/SPEC.md` §5 dành cả
  một mục cho nó.
- **Bất biến "vai trò cao nhất không bao giờ bị `403`" chuyển từ `ADMIN` sang `SYSTEM_ADMIN`.**
  `rbac/SPEC.md:136` phát biểu bất biến này cho `ADMIN` khi chỉ có 2 vai trò. Với 3 vai trò, chủ
  thể là `SYSTEM_ADMIN`: mọi mã quyền mà `permissionRegistry` yêu cầu phải nằm trong 10 mã, và
  `SYSTEM_ADMIN` có đủ 10. Thêm route mới thì mã quyền mới phải được cấp cho `SYSTEM_ADMIN`
  trong cùng lần sửa.
- **`ADMIN` không gán được vai trò.** `PUT /api/users/:id/role` cần `rbac:manage`
  (`rbac/SPEC.md:376`) mà `ADMIN` không có. Nên tài khoản do `ADMIN` tạo luôn là `USER`; chỉ
  `SYSTEM_ADMIN` nâng được vai trò. Cấp `rbac:manage` cho `ADMIN` là cho `ADMIN` tự nâng mình
  lên `SYSTEM_ADMIN` — đúng lỗ mà `rbac/SPEC.md:383-385` đã cảnh báo.

## 4. Bốn chỗ yêu cầu gốc không tự nhất quán

Ghi riêng vì đây là phần **không** suy ra được từ yêu cầu, mà phải quyết. §4.1–4.2 là hai chỗ
yêu cầu tự mâu thuẫn; §4.3–4.4 là hai đường leo thang quyền mà yêu cầu không nhắc tới nhưng sẽ
mở ra nếu hiện thực theo đúng nghĩa chữ.

### 4.1 "Ẩn bất kỳ chức năng nào" có đúng một ngoại lệ

`SYSTEM_ADMIN` **không được gỡ `rbac:manage` khỏi chính vai trò `SYSTEM_ADMIN`** → `400`
`VALIDATION_ERROR`.

Gỡ xong thì chính cái API vừa dùng bị khóa vĩnh viễn, không ai sửa lại được trừ khi vào DB bằng
tay. `rbac/SPEC.md:616` đã ghi bất biến này cho `ADMIN`; ở đây chuyển chủ thể sang
`SYSTEM_ADMIN`. Mọi quyền khác ẩn được tự do — kể cả gỡ `log:view` khỏi `USER`, kể cả gỡ
`user:manage` khỏi `ADMIN`.

### 4.2 "Sửa xóa được tất cả thông tin user" mở một đường leo thang quyền

**`ADMIN` không thao tác được trên tài khoản mang vai trò `SYSTEM_ADMIN`** — sửa, khóa, xóa,
reset mật khẩu đều `403`.

Nếu `user:manage` phủ **mọi** tài khoản thì `ADMIN` xóa được tài khoản `SYSTEM_ADMIN`, hoặc khóa
nó, hoặc reset mật khẩu nó rồi đăng nhập vào — `ADMIN` chiếm được hệ thống mà không cần
`rbac:manage`, và cấp bậc ở §3 chỉ còn trên danh nghĩa.

**Chốt này KHÔNG đặt trong `permissionGuard`.** `rbac/SPEC.md:399` ràng buộc guard chỉ nhìn
method + path + tập quyền, không đọc DB nghiệp vụ, không biết `:id` là của ai. Đây là bất biến
trên **hàng đích**, nên nó sống ở `features/users/services/users.service.ts`, cạnh các bất biến
của `rbac/SPEC.md` §10 vốn đã ở tầng service. Đây không phải `if (user.role === 'ADMIN')` bị cấm
bởi `rbac/SPEC.md:238` — nó không quyết định *chức năng nào được dùng*, nó quyết định *hàng nào
được đụng*, cùng loại với ownership.

**Vì sao `403` mà không phải `404`.** `rbac/SPEC.md:186` chọn `404` cho vi phạm ownership để
không xác nhận "hàng này tồn tại, chỉ không phải của bạn". Ở đây lý do đó không áp: `ADMIN` có
`user:view` nên **đã** thấy tài khoản `SYSTEM_ADMIN` trong danh sách. Trả `404` cho một hàng vừa
hiện ra ở màn trước là tự mâu thuẫn, và không che được gì.

### 4.3 Vai trò không bao giờ đi qua thân request, trừ đúng một endpoint

`POST /api/users` và `PATCH /api/users/:id` **không nhận `roleId`** — trường này bị Zod loại
khỏi schema, không phải bị bỏ qua im lặng. Tài khoản do `ADMIN` tạo **luôn** là `USER`.

Không có chốt này thì `ADMIN` (chỉ có `user:manage`) tạo một tài khoản với
`roleId = <id của SYSTEM_ADMIN>` rồi đăng nhập vào đó — leo thang quyền hoàn chỉnh, đi vòng qua
đúng cái ràng buộc thứ tự registry ở §6.2 điểm 2 vốn được đặt ra để chặn nó.

Đổi vai trò chỉ qua **`PUT /api/users/:id/role`**, endpoint duy nhất mang quyền `rbac:manage`.
Một đường vào, một quyền, một chỗ kiểm bất biến.

### 4.4 Không được tự khóa mình ra khỏi hệ thống

Ba bất biến ở `features/users/services/users.service.ts`, tất cả trả `400 VALIDATION_ERROR`:

1. **Không xóa/khóa tài khoản `SYSTEM_ADMIN` cuối cùng.** Còn 0 `SYSTEM_ADMIN` là không ai gán
   được vai trò và không ai sửa được ma trận quyền nữa — phải vào DB bằng tay. Đây là mở rộng
   của `rbac/SPEC.md:611` từ `ADMIN` sang `SYSTEM_ADMIN`.
2. **Không tự hạ vai trò của chính mình** (`req.user.id === :userId` và vai trò mới khác vai trò
   hiện tại) — ca riêng của (1) nhưng cần thông báo lỗi khác để người dùng hiểu
   (`rbac/SPEC.md:614`).
3. **Không tự xóa tài khoản của chính mình.** `DELETE /api/users/:id` với `:id === req.user.id`
   → `400`. `onDelete: Cascade` nghĩa là tự xóa mình sẽ xóa luôn toàn bộ nhật ký cân nặng, bữa
   ăn, mục tiêu của mình — một cú bấm nhầm không được phép làm việc đó.

## 5. Lược đồ dữ liệu

**7 bảng. Không đổi khóa nào của 4 bảng dữ liệu hiện có.**

Lấy đúng `auth/SPEC.md` §5 (`User`, `Session`, `LoginAttempt`) và `rbac/SPEC.md` §9 (`Role`,
`Permission`, `RolePermission` + cột `User.roleId` nullable, `onDelete: SetNull`). Bốn bảng
`BodyLog`/`Meal`/`Goal`/`Reminder` chỉ thêm một dòng quan hệ:

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

`@@id([userId, date])` của `BodyLog`, `@@unique([userId, kind])` của `Reminder`, `userId` làm
khóa chính của `Goal` — **giữ nguyên toàn bộ**. Đây là khoản đầu tư của
`docs/overview/02-data-model.md:13` được thu hồi.

Delta so với spec:

- **Không thêm cột `role` vào `User`.** Vai trò đi qua `roleId` (`auth/SPEC.md:360` đã chốt).
- **`displayName` nullable** — trả lời câu hỏi mở `auth/SPEC.md:691`.
- **`User.status` chỉ có `"active" | "disabled"`**, không thêm `"pending"` (đăng ký không cần
  duyệt — quyết định 5).

## 6. Bảng endpoint

### 6.1 Endpoint mới

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| `POST` | `/api/auth/register` | *(mở)* | **Delta.** Body `{ email, password, displayName? }`. Vai trò `USER` gán cứng phía server |
| `GET` | `/api/auth/csrf` | *(mở)* | `auth/SPEC.md` §4 |
| `POST` | `/api/auth/login` | *(mở)* | `auth/SPEC.md` §4 |
| `POST` | `/api/auth/logout` | *(mở)* | Idempotent, luôn `204` |
| `GET` | `/api/auth/session` | *(mở, tự kiểm phiên)* | Mở rộng `SessionResponse` thêm `permissions: string[]` + `role` theo `rbac/SPEC.md:656` |
| `GET` | `/api/users` · `/api/users/:id` | `user:view` | |
| `POST` `PATCH` `DELETE` | `/api/users` · `/api/users/:id` | `user:manage` | Chặn tài khoản `SYSTEM_ADMIN` (§4.2) · **không nhận `roleId`** (§4.3) · bất biến tự-khóa (§4.4) |
| `POST` | `/api/users/:id/password` | `user:manage` | Reset mật khẩu → **thu hồi mọi phiên** của user đó (`auth/SPEC.md:634`) |
| `PUT` | `/api/users/:id/role` | `rbac:manage` | Chỉ `SYSTEM_ADMIN` |
| `GET` | `/api/permissions` · `/api/roles` · `/api/roles/:id/permissions` | `rbac:view` | |
| `PUT` | `/api/roles/:id/permissions` | `rbac:manage` | Đây **là** cơ chế "ẩn chức năng" |

`/api/auth/**` là luật mở nên `register` tự động công khai, không cần luật riêng.

### 6.2 Ràng buộc thứ tự trong `permissionRegistry`

Khớp **dòng đầu tiên thắng**. Thứ tự là một phần của đặc tả, không phải thẩm mỹ:

1. `/health` và `/auth/**` phải đứng **đầu** — nếu bị luật rộng khớp trước thì `/api/auth/login`
   yêu cầu đăng nhập để đăng nhập (`rbac/SPEC.md:386`).
2. `/users/*/role` (`rbac:manage`) phải đứng **trước** `/users/*` (`user:manage`) — đảo lại thì
   đổi vai trò chỉ cần `user:manage`, tức ai quản lý tài khoản tự nâng mình lên
   (`rbac/SPEC.md:383`).
3. Path dưới `/api` không khớp luật nào → **`403`**, mặc định từ chối (`rbac/SPEC.md:300`).

Không có ràng buộc thứ tự giữa dòng `GET /roles/*/permissions` (`rbac:view`) và dòng
`PUT /roles/*/permissions` (`rbac:manage`): hai dòng khác method nên không bao giờ cùng khớp một
request. Giữ đúng thứ tự của `rbac/SPEC.md:375-376` (`rbac:view` trước) cho dễ đối chiếu.

### 6.3 Ba quyết định nhỏ

**Đăng ký xong không tự đăng nhập** — trả `201`, FE chuyển sang trang đăng nhập. Đường
`register` vì thế không phải gọi `req.session.regenerate`, tránh đúng cái callback dễ tạo race ở
`auth/SPEC.md:190`. Đổi lại người dùng bấm thêm một lần.

**Email trùng trả `400 VALIDATION_ERROR`** với `fields: [{ path: 'email', message: … }]`, không
thêm mã `CONFLICT` vào `AppErrorCode`. Giữ union nhỏ và giữ đúng hình dạng lỗi mà 5 feature đang
chạy dùng (`docs/overview/04-conventions.md`).

**Email chuẩn hóa `trim().toLowerCase()` tại đúng một chỗ** — `dtos/auth.request.ts` qua
`.transform()` của Zod (`auth/SPEC.md:353`). `@unique` của SQLite phân biệt hoa thường, thiếu
bước này thì `Toi@vidu.com` và `toi@vidu.com` là hai tài khoản.

## 7. Nợ bảo mật — ghi tường minh, không phải bỏ sót

**Đăng ký mở mà không xác thực email thì form đăng ký *là* công cụ liệt kê tài khoản.** Nhập một
email, thấy "đã được dùng" là biết email đó có tài khoản. Điều này phá đúng mục tiêu của
`auth/SPEC.md` §7.3, mục vốn bỏ công bịt cả kênh thời gian phản hồi (chạy Argon2 với hash giả
khi không tìm thấy user) để không lộ email nào tồn tại.

Không có cách bịt nào rẻ khi đăng ký mở và chưa có hạ tầng email. Với localhost một người thì
chấp nhận được. **Trước khi mở ra LAN hoặc cloud phải xử lý** — cùng lúc với `CLAUDE.md` mục
"Cạm bẫy đã biết".

Hai nợ khác, nhỏ hơn: chưa chống spam đăng ký (một IP tạo được N tài khoản), và chưa có luồng
quên mật khẩu (`auth/SPEC.md:661` — cần hạ tầng email). Reset mật khẩu chỉ đi qua `ADMIN`.

## 8. Enforcement

### 8.1 Thứ tự middleware trong `app.ts`

`auth/SPEC.md:198` nói thẳng: sai thứ tự là sai bảo mật, không phải sai thẩm mỹ.

```
helmet()                       → security headers, sớm nhất
express.json()                 → có sẵn, app.ts:15
session(PrismaSessionStore)    → trước mọi thứ đọc req.session
csrf protection                → sau session (token gắn với phiên)
/api/health                    → mở, app.ts:17-19
/api/auth/*                    → mở; GET /session tự kiểm phiên, trả 401 nếu không có
requireAuth                    → gắn req.user = { id, roleId }; chốt chặn cho phần còn lại
permissionGuard                → cắm MỘT lần, không feature nào tự cắm
5 router dữ liệu + /users + /roles + /permissions
notFoundHandler                → app.ts:28
errorHandler                   → app.ts:29, luôn cuối cùng
```

`requireAuth` mắc một lần cho tất cả, không rải vào từng feature: mặc định là **đóng**, chỉ mở
bằng whitelist tường minh (`auth/SPEC.md:217`).

### 8.2 Mã lỗi phải thêm

`AppErrorCode` (`server/src/shared/errors/AppError.ts:1`) hiện là union đóng ba giá trị. Thêm
sáu mã: `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `CSRF_ERROR`,
`TOO_MANY_ATTEMPTS`, kèm factory bên cạnh `AppError.notFound` / `AppError.validation`.
TypeScript chặn ngay nếu quên — đó là điểm cộng của union đóng.

`errorHandler` (`errorHandler.ts:43-52`) đã dịch `AppError` đúng hình dạng, **không sửa**. Nhưng
phải thêm một nhánh nhận diện lỗi CSRF: `csrf-csrf` ném ra thứ không phải `AppError`, nếu không
nhận diện thì nó rơi vào nhánh `500 INTERNAL_ERROR` ở `:54-58` (`auth/SPEC.md:320`).

### 8.3 Biến môi trường

`SESSION_SECRET` thêm vào `server/src/config/env.ts`: **bắt buộc, tối thiểu 32 ký tự, không có
giá trị mặc định** (`auth/SPEC.md:641`). Thiếu thì tiến trình phải chết lúc khởi động, không
cảnh báo rồi chạy tiếp. Khác `DATABASE_URL` vốn có fallback vô hại — fallback cho secret nghĩa
là mọi bản triển khai dùng chung một khóa ký.

Cập nhật `server/.env.example` cùng lúc.

### 8.4 Cache quyền

Theo `rbac/SPEC.md` §8, không đổi: `Map<userId, { codes: Set<string>; expiresAt }>` trong bộ nhớ
tiến trình, TTL 30 phút, **evict chủ động** ở bốn chỗ. Quyền **không** nằm trong session — nên
đổi vai trò có hiệu lực ở request kế tiếp, không phải đăng nhập lại.

Chỗ dễ quên nhất: `evictRole` phải tra ngược ra **mọi** user mang vai trò đó rồi evict từng
người, vì cache khóa theo `userId` mà thay đổi xảy ra ở bảng `Role` (`rbac/SPEC.md:434`).

**Điều kiện chặn:** không triển khai nhiều instance trước khi đổi cache sang Redis
(`rbac/SPEC.md:456-476`) — cache trong bộ nhớ với nhiều tiến trình sai theo kiểu im lặng và cho
kết quả không xác định.

## 9. Seed

Hai script idempotent, tách vai. `rbac.seed.ts` chỉ đụng ba bảng RBAC, `users.seed.ts` chỉ tạo
tài khoản — `rbac/SPEC.md:570` chốt việc gán là bước riêng.

**`server/prisma/seed/rbac.seed.ts`** — upsert theo `code`:

1. 10 quyền của `rbac/SPEC.md` §3, kèm `resource`, `action`, `sequence`.
2. 3 vai trò: `USER` ("Người dùng"), `ADMIN` ("Quản trị tài khoản"),
   `SYSTEM_ADMIN` ("Quản trị hệ thống").
3. Ma trận §3: `USER` ← 6 quyền dữ liệu · `ADMIN` ← 8 · `SYSTEM_ADMIN` ← cả 10.

**`server/prisma/seed/users.seed.ts`** — upsert theo `email`, mật khẩu `123456` hash bằng
Argon2id:

| Email | Vai trò | Quyền |
|---|---|---|
| `user@lean.local` | `USER` | 6 |
| `admin@lean.local` | `ADMIN` | 8 |
| `system@lean.local` | `SYSTEM_ADMIN` | 10 |

Tên miền `.local` để không trùng địa chỉ thật nào. Mật khẩu `123456` chỉ đăng nhập được nhờ
quyết định 4; đăng ký mới vẫn phải ≥ 8 ký tự.

## 10. Thi công — 4 giai đoạn

Mỗi giai đoạn có plan riêng và checkpoint. Không gộp.

### Giai đoạn A — `auth` backend

1. Schema: `User`, `Session`, `LoginAttempt` + quan hệ trên 4 bảng · `prisma db push`.
2. `env.ts`: `SESSION_SECRET` · `AppErrorCode` thêm 6 mã · nhánh CSRF trong `errorHandler`.
3. `shared/auth/password.ts` — Argon2id hash/verify.
4. `shared/auth/prismaSessionStore.ts` — `get`/`set`/`destroy`/`touch`; **`userId` nhấc ra cột
   riêng**, bỏ qua hàng quá hạn khi đọc, có tác vụ dọn hàng chết.
5. `loginAttempt.repository.ts` + chống brute-force — **kiểm ngưỡng TRƯỚC khi gọi Argon2**
   (`auth/SPEC.md:526`), đếm theo cả `emailKey` và `ip`.
6. Feature `auth` 4 lớp: `register`, `login`, `logout`, `session`.
7. `requireAuth` + mắc middleware theo §8.1 + `helmet` + `csrf-csrf`.
8. Thay `LOCAL_USER_ID`: `goal` và `meals` chỉ sửa service; `bodyLogs`, `summary`, `reminders`
   phải **đổi chữ ký hàm ở tầng repository** rồi sửa mọi lời gọi (`auth/SPEC.md:445-447`).
9. Scheduler đa người dùng (`auth/SPEC.md:468`) — một truy vấn lấy mọi `Reminder` đến giờ của
   mọi user, **không** vòng lặp N+1; `ReminderView` thêm `userId`.
10. Sửa 208 test hiện có: user thật trong `beforeEach` + helper đăng nhập cho supertest.

### Giai đoạn B — `rbac` backend

`Role`, `Permission`, `RolePermission` + `User.roleId` · `permissionRegistry` (hàm thuần) ·
`permissionGuard` · `permissionCache` · hai script seed §9.

### Giai đoạn C — API quản trị

Feature `users` (CRUD + reset mật khẩu + gán vai trò) và feature `rbac` (danh mục quyền + ma
trận), kèm toàn bộ bất biến §4 và `rbac/SPEC.md` §10.

### Giai đoạn D — Frontend

`web/src/features/auth/`: `LoginPage`, `RegisterPage`, `useSession`, `hasPermission(code)`.
`apiClient.ts` gắn `x-csrf-token` cho mọi `POST/PUT/PATCH/DELETE` và bắt `401` → về `/login`.
Header hiện in chữ "chưa đăng nhập" → thay bằng email + nút Đăng xuất. Cài đặt thêm mục **Tài
khoản** (`user:view`) và **Phân quyền** (`rbac:view`).

FE gate bằng `hasPermission`, **không** bằng role code. Thiếu quyền thì **ẩn hẳn, không nút
xám** (`rbac/SPEC.md:685`). Và ẩn nút không phải bảo mật — server vẫn phải chặn
(`rbac/SPEC.md:642`).

## 11. Kế hoạch test

Xếp theo mức quan trọng, không theo thứ tự thi công.

| # | Kiểm gì | Vì sao quan trọng |
|---|---|---|
| 1 | `ADMIN` gọi `PATCH /api/meals/:id` với `id` của user khác → **`404`**, bản ghi **không bị đụng** | `rbac/SPEC.md:632` gọi đây là test quan trọng nhất của cả feature: nó chứng minh RBAC không thay thế ownership |
| 2 | Scheduler với **2 user**: nhắc của A không gửi tới topic ntfy của B | Làm ẩu ở `runDueReminders` là rò dữ liệu sức khỏe (`auth/SPEC.md:499`) |
| 3 | Phân biệt `401` / `403` / `404`: chưa đăng nhập → `401`; `USER` gọi `/api/users` → `403`; có quyền nhưng hàng của người khác → `404` | Ba lớp khác nhau, ba chủ thể quyết định khác nhau (`rbac/SPEC.md:220-227`) |
| 4 | `ADMIN` sửa/khóa/xóa/reset mật khẩu tài khoản `SYSTEM_ADMIN` → `403`. `ADMIN` gọi `PUT /users/:id/role` → `403` | Bất biến §4.2 — thiếu là leo thang quyền |
| 5 | `ADMIN` gửi `POST /api/users` kèm `roleId` của `SYSTEM_ADMIN` → tài khoản tạo ra vẫn là `USER` (hoặc `400`), **không** bao giờ là `SYSTEM_ADMIN` | Bất biến §4.3 — thiếu là leo thang quyền đi vòng qua registry |
| 6 | Hạ/xóa/khóa `SYSTEM_ADMIN` cuối cùng → `400`; tự hạ mình → `400`; tự xóa mình → `400`; gỡ `rbac:manage` khỏi `SYSTEM_ADMIN` → `400` | Bất biến §4.1 + §4.4 + `rbac/SPEC.md` §10 |
| 6 | `evictRole`: bỏ `log:view` khỏi `USER` → request kế tiếp `403` **ngay**, không chờ TTL | `rbac/SPEC.md:438` — nếu phải chờ TTL thì đang thiếu một lời gọi evict |
| 7 | `permissionRegistry` hàm thuần: từng dòng khớp đúng luật; `/users/:id/role` khớp dòng `rbac:manage` chứ không phải `user:manage`; path lạ → từ chối; `/health` và `/auth/login` → mở | Bảng §6.2 **là** code, test canh đúng thứ tự |
| 8 | Bất biến registry ↔ DB: mọi mã quyền trong `PERMISSION_RULES` đều có trong seed; `SYSTEM_ADMIN` có đủ 10 | Sai là một endpoint không vai trò nào vào được |
| 9 | Mật khẩu: `123456` đăng nhập **được**; đăng ký bằng `123456` → `400` | Quyết định 4 |
| 10 | Đăng nhập sai → không phân biệt được "email không tồn tại" và "sai mật khẩu", cả mã lỗi lẫn thời gian phản hồi | `auth/SPEC.md` §7.3 |
| 11 | Xoay session id: id trước và sau đăng nhập **khác nhau** | Chống session fixation (`auth/SPEC.md:583`) |
| 12 | 208 test hiện có xanh lại sau khi đổi chữ ký 3 repository | Không được đánh đổi hồi quy cho feature mới |

## 12. Tài liệu phải cập nhật sau khi có code

`auth/SPEC.md` §10 liệt kê 11 chỗ trong repo sẽ sai khi auth chạy, kèm ràng buộc:
*"**Không sửa file nào trong danh sách này khi chưa có code chạy** — tài liệu Lean mô tả hành vi
thật, không mô tả ý định."* Ràng buộc đó giữ nguyên; danh sách đó là việc của cuối giai đoạn A–D,
không phải bây giờ.

Bổ sung vào danh sách của `auth/SPEC.md` §10, do design này sinh ra:

| File | Khẳng định sẽ sai |
|---|---|
| `docs/features/rbac/SPEC.md` | §2 *"2 vai trò"* và §4 ma trận 2 cột → 3 vai trò, 3 cột (quyết định 3) |
| `docs/features/rbac/SPEC.md:38-40` | *"`SYSTEM_ADMIN` … không được bê sang"* → đã bê sang, có lý do |
| `docs/features/auth/SPEC.md:268` | `password` 8…200 ở login → 1…200 (quyết định 4) |
| `docs/features/auth/SPEC.md:662` | Đăng ký ngoài phạm vi giai đoạn 1 → đã trong phạm vi (quyết định 5) |
| `docs/features/auth/PLAN.md` §Bước 3 | Backfill dữ liệu `userId='local'` → không còn cần (quyết định 6) |

## 13. Câu hỏi mở còn lại

Chưa cần trả lời để bắt đầu giai đoạn A, nhưng sẽ chặn ở đâu đó về sau.

1. **SQLite có còn đúng không?** `auth/SPEC.md:672` xếp đây là câu hỏi lớn nhất và nó vượt khỏi
   phạm vi `auth`: mỗi lần đăng nhập ghi ít nhất hai hàng (`Session` + `LoginAttempt`) mà SQLite
   chỉ cho một writer tại một thời điểm. Đổi sang Postgres **trước** khi có dữ liệu thật thì rẻ
   hơn nhiều lần.
2. **Chính sách phiên đồng thời** (`auth/SPEC.md:679`): một phiên duy nhất, hay cho phép N thiết
   bị? Ảnh hưởng trực tiếp tới bước đăng nhập ở giai đoạn A.
3. **Ngưỡng khóa brute-force**: 5 lần / 15 phút / khóa 15 phút — chốt hay đổi?
4. **Thời hạn phiên**: 7 ngày + rolling.
5. **Audit log cho thao tác RBAC** (`rbac/SPEC.md:709`): ai gán vai trò cho ai, lúc nào. Với
   nhiều người dùng thì đây là thứ đầu tiên bị hỏi khi có sự cố.
