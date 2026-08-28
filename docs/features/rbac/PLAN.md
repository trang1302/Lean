# Feature `rbac` — Kế hoạch & trạng thái

## 1. Trạng thái: **XONG** (2026-08-28)

Giai đoạn B (registry, guard, cache, seed) và C (API quản trị `users` + `rbac`) đã có code và
test. Giai đoạn D (FE) cũng xong: `hasPermission`, khối **Tài khoản** và **Phân quyền** trong
trang Cài đặt.

Ba vai trò chứ không phải hai — xem banner đầu [`SPEC.md`](SPEC.md).

Verify: `cd server && npm test` (25 file, 434 test) · `cd web && npm test` (45 file, 301 test).

### Trạng thái cũ (giữ để đối chiếu)

Chưa có dòng code nào. [`SPEC.md`](SPEC.md) là tài liệu định hướng, không mô tả code đang
chạy — khác với `SPEC.md` của 5 feature đã xong (`body-logs`, `meals`, `goal`, `summary`,
`reminders`).

Khi bắt đầu code: mọi chỗ lệch khỏi SPEC phải được ghi ngược lại vào SPEC ngay trong cùng
commit. Quy ước tài liệu của dự án là **code đúng, SPEC phải theo code**
(`docs/README.md`, mục "Quy ước tài liệu").

---

## 2. Phụ thuộc — `docs/features/auth/` phải xong trước

*(Mục này mô tả trạng thái lúc viết kế hoạch, trước khi `auth` xong — giữ lại vì nó giải
thích LÝ DO của thứ tự `auth` → `rbac`.)*

**RBAC không khởi động được nếu chưa có auth.** Lý do hiển nhiên nhưng phải nói rõ: RBAC trả
lời "người này có quyền gì", mà chưa có auth thì không có "người này". Lúc đó mọi request
chạy dưới hằng `LOCAL_USER_ID = 'local'` (`server/src/shared/constants.ts:9`, đã xóa khi
auth xong) — không có gì để phân quyền.

Bốn thứ **bắt buộc** phải có từ feature `auth` trước khi bước 5 của §3 bắt đầu:

| Cần | Dùng vào việc gì | Chặn bước nào |
|---|---|---|
| Bảng `User` trong `prisma/schema.prisma`, có hàng `id = 'local'` | Cột `User.roleId` gắn vào đâu; backfill vai trò | 1, 3 |
| Middleware `requireAuth` gắn `req.user = { id, roleId }` | `permissionGuard` chạy **sau** nó và đọc `req.user.id` | 8 |
| Kiểu `Express.Request['user']` khai bằng module augmentation | `permissionGuard` truy cập `req.user` mà không `as any` | 8 |
| `401 UNAUTHORIZED` đã có trong `AppErrorCode` + `errorHandler` | Phân biệt "chưa đăng nhập" (`401`) với "thiếu quyền" (`403`) — SPEC §5 | 4 |

Thứ tự cắm middleware trong `app.ts` là bắt buộc và do RBAC sửa (bước 8):

```
express.json()  →  requireAuth  →  permissionGuard  →  các router feature  →  notFound  →  errorHandler
```

**Phối hợp:** cả hai feature cùng sửa `server/prisma/schema.prisma` và `server/src/app.ts`.
Auth đi trước và xong hẳn; RBAC thêm vào sau. Đừng sửa song song hai file này.

Ba việc RBAC **có thể** làm trước khi auth xong, vì chúng không đụng `User`:

- Bước 2 (bảng `Permission`, `Role`, `RolePermission` — chưa thêm `User.roleId`)
- Bước 6 (`permissionRegistry` — hàm thuần, chỉ ăn method + path)
- Bước 7 (`permissionCache` — chỉ cần một hàm nạp truyền vào)

---

## 3. Các bước

Cấu trúc bám 4 lớp của [`../../overview/01-architecture.md`](../../overview/01-architecture.md):
`features/rbac/{controllers,services,repositories,dtos}` cho API quản trị, `shared/rbac/`
cho phần enforcement (guard + registry + cache) vì nó phục vụ **mọi** feature chứ không
riêng `rbac` — cùng lý do `shared/stats/` nằm ngoài `features/`.

Mỗi bước là một commit.

### Bước 1 — Schema Prisma

`server/prisma/schema.prisma`: thêm `Role`, `Permission`, `RolePermission` đúng như
[`SPEC.md`](SPEC.md) §9; thêm `roleId String?` + quan hệ `role` vào `User` (bảng do auth tạo).

```bash
cd server && npx prisma db push
```

`roleId` nullable → chạy được trên DB đã có dữ liệu, không cần giá trị mặc định.

Verify: `npx prisma studio` thấy 3 bảng mới; `npx tsc --noEmit` xanh.
Commit: `feat(rbac): add Role, Permission, RolePermission models`

### Bước 2 — Hằng danh mục quyền

`server/src/shared/rbac/permissions.ts`: hằng `PERMISSION_CODES` (10 mã của SPEC §3) và
`ROLE_CODES` (`USER`, `ADMIN`), kèm `resource`/`action`/`sequence`/tên hiển thị.

Đây là **nguồn duy nhất** cho cả seed (bước 3) lẫn registry (bước 6) — hai chỗ đó import từ
đây, không gõ lại chuỗi.

Commit: `feat(rbac): add permission and role code catalog`

### Bước 3 — Seed vai trò và quyền

`server/prisma/seed/rbac.seed.ts`, **idempotent** (`upsert` theo `code`):

1. Upsert 10 `Permission` từ `PERMISSION_CODES`.
2. Upsert 2 `Role`.
3. Đặt lại `RolePermission` đúng ma trận SPEC §4: `USER` ← 6 quyền cá nhân, `ADMIN` ← cả 10.

Không tạo user, không gán vai trò cho ai — đó là bước 4.

```bash
cd server && npx tsx prisma/seed/rbac.seed.ts
```

Verify: chạy **hai lần liên tiếp**, `SELECT count(*)` trên `RolePermission` phải giữ nguyên 16.
Commit: `feat(rbac): seed roles and permissions`

### Bước 4 — Gán vai trò cho user hiện có

`server/prisma/seed/assignRoles.seed.ts`: backfill idempotent

- User `id = 'local'` → `ADMIN` (chủ máy; và phải có ít nhất một `ADMIN` để gán vai trò cho
  người sau — SPEC §9).
- Mọi user khác đang `roleId IS NULL` → `USER`.

Chỉ chạm hàng `roleId IS NULL`, chạy lại vô hại — không ghi đè vai trò ai đó đã đổi bằng tay.

Verify: `SELECT id, roleId FROM User` không còn `NULL`.
Commit: `feat(rbac): backfill role assignment for existing users`

### Bước 5 — Thêm mã lỗi `FORBIDDEN`

`server/src/shared/errors/AppError.ts:1` hiện là
`VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR`. Thêm `FORBIDDEN` vào `AppErrorCode`, thêm
factory `AppError.forbidden(message)` trả status `403`, và nhánh tương ứng trong
`errorHandler`.

`UNAUTHORIZED` thuộc feature auth — **kiểm tra trước khi thêm**, đừng thêm trùng.

Hình dạng giữ đúng quy ước chung: `{ error: { code: 'FORBIDDEN', message } }`, **không** dùng
`{ success: false, ... }` của upip (SPEC §6.5).

Commit: `feat(rbac): add FORBIDDEN error code`

### Bước 6 — `permissionRegistry` (hàm thuần)

`server/src/shared/rbac/permissionRegistry.ts`:

- `PERMISSION_RULES` — **16 dòng của SPEC §7, đúng thứ tự**. Thứ tự là một phần đặc tả:
  dòng `/users/*/role` (`rbac:manage`) phải trước `/users/**` (`user:manage`).
- `resolvePermission(method, path)` — khớp **dòng đầu tiên thắng**, trả `'open'`, mã quyền,
  hoặc `'deny'` cho path không khớp (**mặc định từ chối**, SPEC §6.4).
- Matcher path tự viết, hỗ trợ `*` (một đoạn) và `**` (nhiều đoạn). Không kéo thêm thư viện.

Hàm thuần: không import `prisma`, không import express, không đọc `req`. Test được độc lập,
cùng tinh thần `shared/stats/`.

Commit: `feat(rbac): add endpoint-to-permission registry`

### Bước 7 — `permissionCache`

`server/src/shared/rbac/permissionCache.ts`: `Map<userId, { codes: Set<string>; expiresAt }>`,
TTL 30 phút (SPEC §8).

API: `getPermissions(userId)` · `evictUser(userId)` · `evictRole(roleId)` · `clear()`.

Hàm nạp khi miss được **tiêm vào** (nhận callback), không import repository trực tiếp — để
test cache không cần DB.

`evictRole` là chỗ dễ sai nhất: cache khóa theo `userId` nhưng thay đổi xảy ra ở `Role`, nên
phải **tra ngược ra danh sách user mang vai trò đó rồi evict từng người**.

Ghi comment ngay đầu file: cache này chỉ đúng với **một tiến trình**; nhiều instance thì mỗi
tiến trình có `Map` riêng, evict ở A không tới B → quyền lệch nhau tới hết TTL, kết quả phụ
thuộc load balancer đưa request vào đâu. Điều kiện chuyển sang Redis ở SPEC §8.

Commit: `feat(rbac): add in-memory permission cache with active eviction`

### Bước 8 — `permissionGuard` (middleware duy nhất)

`server/src/shared/rbac/permissionGuard.ts` + cắm vào `server/src/app.ts` sau `requireAuth`,
trước mọi router feature.

Bốn việc, không hơn (SPEC §6.3): resolve → luật mở thì `next()` → lấy tập quyền từ cache →
có thì `next()`, không thì `next(AppError.forbidden(...))`.

**Ràng buộc cứng của cả feature:** đây là **file duy nhất** trong dự án được quyết định
cho/chặn theo quyền. Không `if (user.role === 'ADMIN')` ở bất kỳ controller hay service nào
(nguyên tắc 1 của upip, SPEC §6). Ngoại lệ duy nhất là ba bất biến của bước 9 — chúng là
**quy tắc nghiệp vụ** ("không được còn 0 admin"), không phải kiểm tra quyền.

Commit: `feat(rbac): enforce permissions in a single middleware`

### Bước 9 — Feature `rbac`, 4 lớp

`server/src/features/rbac/` — 5 endpoint của SPEC §10.

| File | Vai trò |
|---|---|
| `index.ts` | Export `rbacRouter`; `app.ts` cắm ở `/api` (router phục vụ cả `/roles`, `/permissions`, `/users/:id/role`) |
| `controllers/rbac.controller.ts` | Parse Zod, gọi service. Không try/catch (Express 5), **không** kiểm quyền — guard làm rồi |
| `services/rbac.service.ts` | Ba bất biến SPEC §10 (không còn 0 `ADMIN`; không tự hạ mình; không gỡ `rbac:manage` khỏi `ADMIN`) + **gọi evict** sau mỗi lần ghi |
| `repositories/rbac.repository.ts` | **Chỗ duy nhất** của feature import `prisma`: `findPermissionCodesByUserId`, `findUserIdsByRoleId`, `listRoles`, `listPermissions`, `setRolePermissions`, `setUserRole` |
| `dtos/rbac.request.ts` | Zod cho `{ roleId }` và `{ permissionCodes: string[] }` |
| `dtos/rbac.response.ts` | Map tay từng trường, **không spread** — cùng lý do `toMealResponse` (`../meals/SPEC.md` §4.3) |

Nhớ khai `/api/roles`, `/api/permissions`, `/api/users/*/role` vào registry (bước 6) — mặc
định từ chối nghĩa là quên khai thì chính API này `403`.

Commit: `feat(rbac): add RBAC admin API`

### Bước 10 — Test

`server/test/shared/rbac/{permissionRegistry,permissionCache}.test.ts` (unit) và
`server/test/features/rbac/rbac.controller.test.ts` (integration, supertest), theo kế hoạch
SPEC §11.

Hai test **không được thiếu**:

1. **`ADMIN` gọi `PATCH /api/meals/:id` với `id` của user khác → `404`, bản ghi không bị
   đụng.** Đây là bằng chứng RBAC không phá ownership — mệnh đề quan trọng nhất của cả
   feature (SPEC §5).
2. **Đổi ma trận quyền của vai trò → request kế tiếp đổi kết quả ngay**, không chờ TTL
   (`evictRole`).

Cộng một test canh bất biến: mọi mã quyền trong `PERMISSION_RULES` đều có trong seed, và
`ADMIN` có đủ 10 mã → không endpoint nào `403` với `ADMIN`.

Commit: `test(rbac): cover registry, cache eviction and ownership isolation`

### Bước 11 — FE

`web/src/features/auth/permissions.ts` (đặt ở `auth/` chứ không `rbac/` — mọi feature dùng
chung, SPEC §12): `hasPermission(code)`, `hasAnyPermission(...codes)`, đọc `permissions` mà
**`GET /api/auth/session`** trả về — bước này phải mở rộng `SessionResponse` của `auth`
thêm trường `permissions: string[]`. (Bản trước ghi `/api/auth/me`; endpoint đó không tồn
tại, đã sửa 2026-08-07 — xem `SPEC.md` §12.)

Gate UI theo bảng SPEC §12. Thiếu quyền thì **ẩn hẳn**, không hiện nút xám.

Nhắc lại nguyên tắc để không ai cắt bước: **ẩn nút là trải nghiệm, không phải bảo mật.**
Không được vì đã ẩn ở FE mà bỏ dòng tương ứng trong registry.

Commit: `feat(web): hide UI by permission`

---

## 4. Lệnh verify dự kiến

Chạy từ `C:\Project\WorkSpace\Lean\server`:

```bash
# schema + client
npx prisma db push
npx tsc --noEmit

# seed (idempotent — chạy 2 lần, kết quả phải giống nhau)
npx tsx prisma/seed/rbac.seed.ts
npx tsx prisma/seed/rbac.seed.ts
npx tsx prisma/seed/assignRoles.seed.ts

# test của riêng feature
npx vitest run test/shared/rbac
npx vitest run test/features/rbac

# toàn bộ — 208 test hiện có PHẢI vẫn xanh
npm test
```

`npm test` map sang `vitest run`, `npm run typecheck` map sang `tsc --noEmit`
(`server/package.json:9,11`).

Kiểm bằng tay sau khi server chạy (`npm run dev`), với hai tài khoản `USER` và `ADMIN`:

```bash
# mở, không cần đăng nhập
curl -i http://localhost:3000/api/health                 # 200

# USER: dữ liệu của mình thì được
curl -i -b user.cookie http://localhost:3000/api/summary?from=2026-08-01&to=2026-08-07   # 200
# USER: màn quản trị thì không
curl -i -b user.cookie http://localhost:3000/api/roles    # 403 { error: { code: "FORBIDDEN" } }

# ADMIN: vào được quản trị
curl -i -b admin.cookie http://localhost:3000/api/roles   # 200
# ADMIN: KHÔNG vì thế mà đụng được bữa ăn của người khác
curl -i -b admin.cookie -X DELETE http://localhost:3000/api/meals/<id-cua-user-khac>   # 404

# route chưa khai trong registry → mặc định từ chối
curl -i -b admin.cookie http://localhost:3000/api/khong-ton-tai   # 403
```

Từ `C:\Project\WorkSpace\Lean\web`: `npm run build` và bấm thử — đăng nhập bằng `USER`
không thấy mục Cài đặt → Phân quyền.

---

## 5. Rủi ro và nợ kỹ thuật đã biết

| Rủi ro | Xử lý |
|---|---|
| **Quên khai route mới vào registry** | Mặc định từ chối (SPEC §6.4) biến nó thành `403` ồn ào ngay lần test đầu, thay vì một endpoint không được bảo vệ. Đổi lấy: mỗi route mới tốn một dòng registry |
| **Quên gọi `evictRole` khi sửa ma trận quyền** | TTL 30 phút là lưới an toàn, không phải cơ chế chính. Có test canh (bước 10) |
| **Cache in-memory sai khi chạy nhiều instance** | Điều kiện chặn: **không triển khai nhiều tiến trình trước khi chuyển cache sang Redis** (SPEC §8). Comment cảnh báo ngay đầu `permissionCache.ts` |
| **Ai đó "gọn hóa" ownership vì đã có RBAC** | SPEC §5 nói thẳng là không được. Test "ADMIN vs bữa ăn người khác → 404" là chốt chặn máy móc |
| **`ADMIN` cuối cùng bị hạ vai trò** | Bất biến bước 9; hỏng thì phải sửa `roleId` bằng tay trong SQLite |
| **Trùng đường với feature `auth` ở `schema.prisma` và `app.ts`** | Auth xong trước, RBAC vào sau. Không sửa song song |

Nợ chấp nhận từ đầu, **không** phải việc bỏ sót:

- Không có UI tạo/xóa vai trò — danh mục đóng, sửa bằng seed + review (SPEC §10).
- Không có audit log cho thao tác RBAC (câu hỏi mở SPEC §13.5).
- `ADMIN` không đọc được dữ liệu sức khỏe người khác — **tính năng, không phải thiếu sót**
  (SPEC §5).

---

## 6. Liên quan

- [`SPEC.md`](SPEC.md) — thiết kế đầy đủ
- [`../auth/`](../auth/) — **phụ thuộc chặn**, phải xong trước
- [`../meals/SPEC.md`](../meals/SPEC.md) §6 — cách ly `userId`, lớp bảo vệ mà RBAC **không**
  thay thế
- [`../../overview/01-architecture.md`](../../overview/01-architecture.md) — 4 lớp, vì sao
  `shared/` nằm ngoài `features/`
- [`../../overview/04-conventions.md`](../../overview/04-conventions.md) — hình dạng lỗi
- `C:\Project\WorkSpace\upip\docs\specs\business\auth\SPEC-BIZ-18-rbac-permissions.md` —
  khuôn mẫu (chỉ có trên máy dev)
