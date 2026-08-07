# Feature `rbac` — Phân quyền

Tài liệu này mô tả **thiết kế dự kiến**, chưa có code. Trạng thái triển khai ở [`PLAN.md`](PLAN.md).

Khuôn mẫu: `C:\Project\WorkSpace\upip\docs\specs\business\auth\SPEC-BIZ-18-rbac-permissions.md`
(chỉ có trên máy dev, không thuộc repo này). Mô hình và bốn nguyên tắc của upip được giữ
nguyên; cơ chế Spring được thay bằng tương đương Node — mọi chỗ thay đều ghi rõ ở §6.

Liên quan: [`../../overview/01-architecture.md`](../../overview/01-architecture.md) (4 lớp,
vị trí file) · [`../../overview/02-data-model.md`](../../overview/02-data-model.md) (vì sao
mọi bảng đã có `userId`) · [`../../overview/04-conventions.md`](../../overview/04-conventions.md)
(hình dạng lỗi) · [`../meals/SPEC.md`](../meals/SPEC.md) §6 (cách ly `userId` — **đọc trước
khi đọc §5 ở đây**).

---

## 1. Tóm tắt 30 giây

Mô hình **RBAC: User → Role → Permission**, bám upip.

- Mỗi **User** gắn **đúng 1 Role** (cột `User.roleId`); Role có nhiều **Permission**.
- **2 vai trò**: `USER`, `ADMIN`. **10 quyền** dạng `resource:action`.
- Enforcement **100% ở một middleware duy nhất** `permissionGuard`, cắm một lần trong
  `app.ts`. **Không** có `if (user.role === 'ADMIN')` nào trong controller/service.
- Endpoint → quyền khai tập trung ở `permissionRegistry`, khớp **dòng đầu tiên thắng**.
  Thêm route mới mà quên khai vào đó thì route đó **bị chặn** (mặc định từ chối — §6.4).
- Thiếu quyền → `403` `{ error: { code: 'FORBIDDEN', message } }` — theo hình dạng lỗi của
  Lean, **không** dùng `{ success: false, ... }` của upip.
- Quyền của user **cache trong bộ nhớ tiến trình**; đổi vai trò → evict chủ động → **hiệu
  lực ngay**, không chờ TTL, không phải đăng nhập lại.
- **RBAC gác chức năng, ownership gác hàng dữ liệu. Hai thứ trực giao, cần cả hai.**
  `ADMIN` **không** vì thế mà đọc được nhật ký cân nặng của người khác — §5.

---

## 2. Hai vai trò

Cố tình tối thiểu. upip có 4 vai trò vì nó là hệ thống nhiều cơ quan hành chính
(`SYSTEM_ADMIN`, `DHUP`, `DPWT`, `OPWT`); những vai trò đó vô nghĩa với một app sức khỏe cá
nhân và **không được bê sang**.

| Role code | Là ai | Vì sao vai trò này tồn tại |
|---|---|---|
| `USER` | Người dùng thường | Vai trò mặc định của mọi tài khoản. Ghi và đọc **dữ liệu của chính mình**: nhật ký cơ thể, bữa ăn, mục tiêu, nhắc nhở. Không thấy màn quản trị. Đây là vai trò mà 100% người dùng thật sẽ mang. |
| `ADMIN` | Quản trị hệ thống | Tồn tại vì có đúng một nhóm việc mà `USER` không làm được: **quản lý tài khoản và phân quyền** — tạo/khóa tài khoản, gán vai trò, sửa ma trận quyền. Không có vai trò này thì việc gán vai trò cho người đầu tiên phải làm bằng tay trong DB. |

Quy ước code: **không có tiền tố `ROLE_`** (giống upip). Role code là chuỗi trần, viết
`UPPER_SNAKE_CASE`.

`ADMIN` là **siêu tập** của `USER` về mặt quyền: nó vẫn ghi nhật ký của chính nó như người
thường. Khác biệt duy nhất là 4 quyền quản trị ở §4.

### Vai trò KHÔNG có trong bản này

| Vai trò bị loại | Vì sao chưa làm |
|---|---|
| `COACH` (huấn luyện viên xem dữ liệu học viên) | **Không phải chỉ thêm một role.** Xem dữ liệu sức khỏe của người khác đòi hỏi một cơ chế **đồng ý của chủ dữ liệu**: bảng cấp quyền theo cặp (chủ dữ liệu, người xem), phạm vi (chỉ cân nặng? cả bữa ăn?), thời hạn, thu hồi bất cứ lúc nào, và log truy cập. RBAC theo vai trò không diễn đạt được "A đồng ý cho B xem" — nó chỉ diễn đạt được "B thuộc nhóm nào". Ghi vào §12 (mở rộng tương lai). |
| `READONLY` / `VIEWER` | Chưa có ca dùng. Thêm khi có người thật cần nó. |
| Phân tách theo tổ chức (kiểu `DPWT`/`OPWT` của upip) | Lean không có cơ quan, không có vùng địa lý. |

---

## 3. Mười quyền

Mã quyền dạng **`resource:action`** — nguyên tắc 3 của upip, giữ nguyên.

**6 quyền dữ liệu cá nhân** (luôn bị ownership giới hạn về dữ liệu của chính mình — §5):

| Quyền | Ý nghĩa | Feature |
|---|---|---|
| `log:view` | Đọc nhật ký cơ thể, bữa ăn, và bản tổng hợp | [`body-logs`](../body-logs/SPEC.md), [`meals`](../meals/SPEC.md), [`summary`](../summary/SPEC.md) |
| `log:manage` | Ghi/sửa/xóa nhật ký cơ thể và bữa ăn | [`body-logs`](../body-logs/SPEC.md), [`meals`](../meals/SPEC.md) |
| `goal:view` | Đọc mục tiêu | [`goal`](../goal/SPEC.md) |
| `goal:manage` | Đặt/sửa mục tiêu | [`goal`](../goal/SPEC.md) |
| `reminder:view` | Đọc cấu hình nhắc nhở | [`reminders`](../reminders/SPEC.md) |
| `reminder:manage` | Bật/tắt, đổi giờ, đổi topic ntfy | [`reminders`](../reminders/SPEC.md) |

**4 quyền quản trị:**

| Quyền | Ý nghĩa |
|---|---|
| `user:view` | Xem danh sách tài khoản (email, trạng thái, vai trò) — **không** gồm dữ liệu sức khỏe |
| `user:manage` | Tạo, khóa, mở khóa, xóa tài khoản |
| `rbac:view` | Mở màn Phân quyền ở chế độ chỉ-đọc: xem danh mục quyền, ma trận Role×Permission |
| `rbac:manage` | Gán vai trò cho user, sửa ma trận quyền của vai trò |

**API mở (không cần đăng nhập, không cần quyền):** `GET /api/health` (`server/src/app.ts:17-19`)
và toàn bộ `/api/auth/**` (đăng nhập/đăng xuất — do [`../auth/SPEC.md`](../auth/SPEC.md) định nghĩa).

### Vì sao `log:*` gộp `body-logs` + `meals` + `summary` làm một

Ba feature, một quyền. Không tách vì:

- Chúng luôn được cấp/thu cùng nhau — không có ca dùng nào cho "xem được cân nặng nhưng
  không xem được bữa ăn". Quyền tách ra mà không bao giờ khác nhau là quyền thừa.
- `GET /api/summary` đọc **cả ba** bảng `BodyLog`, `Meal`, `Goal`
  ([`../summary/SPEC.md`](../summary/SPEC.md) §1). Nếu `body-logs` và `meals` là hai quyền
  riêng thì `/summary` phải yêu cầu **cả hai** — mà registry chỉ khớp một dòng và trả về
  **một** mã quyền. Sẽ phải đổi kiểu trả về thành mảng chỉ để phục vụ một endpoint duy nhất.

`goal` và `reminders` **tách riêng** vì chúng là hai màn hình khác (trang Cài đặt) và có
tính chất khác: `reminders` gửi thông báo ra ngoài qua ntfy — hoàn toàn hợp lý khi sau này
có ca "cho ghi nhật ký nhưng không cho tự cấu hình nhắc nhở".

---

## 4. Bảng Quyền × Role — câu trả lời chính

Ký hiệu: **Ⓞ** = có quyền, **nhưng chỉ trên dữ liệu của chính mình** (ownership vẫn chặn —
§5) · **✅** = có quyền, phạm vi toàn hệ thống · **❌** = không có.

| Permission | `USER` | `ADMIN` |
| :--------------- | :----: | :-----: |
| `log:view`       |   Ⓞ    |    Ⓞ    |
| `log:manage`     |   Ⓞ    |    Ⓞ    |
| `goal:view`      |   Ⓞ    |    Ⓞ    |
| `goal:manage`    |   Ⓞ    |    Ⓞ    |
| `reminder:view`  |   Ⓞ    |    Ⓞ    |
| `reminder:manage`|   Ⓞ    |    Ⓞ    |
| `user:view`      |   ❌   |   ✅    |
| `user:manage`    |   ❌   |   ✅    |
| `rbac:view`      |   ❌   |   ✅    |
| `rbac:manage`    |   ❌   |   ✅    |

**Số quyền:** `USER` 6 · `ADMIN` 10.

Đọc bảng này cho đúng:

- **`ADMIN` = `USER` + 4 quyền quản trị.** Không có quyền nào `USER` có mà `ADMIN` không có.
- **Sáu dòng đầu là Ⓞ ở cả hai cột — đây là điểm quan trọng nhất của cả tài liệu.**
  `ADMIN` có `log:view` **không** có nghĩa là đọc được nhật ký của người khác. Nó chỉ có
  nghĩa là `ADMIN` được vào chức năng "xem nhật ký"; hàng nào hiện ra vẫn do ownership quyết
  định, và ownership luôn trả về dữ liệu của chính người đang gọi. Xem §5.
- **Không có ✅ nào ở sáu dòng đầu, ở bất kỳ vai trò nào.** Nếu một ngày có, đó phải là một
  quyền **mới** (`log:view-any`) kèm log truy cập — không phải nâng Ⓞ thành ✅ tại chỗ.
- **`ADMIN` không bao giờ bị `403`** ở mọi route trong §7, vì mọi mã quyền mà registry yêu
  cầu đều nằm trong danh mục 10 mã và `ADMIN` có đủ 10. Đây là bất biến phải giữ khi thêm
  route: mã quyền mới phải được cấp cho `ADMIN` trong cùng lần sửa.

---

## 5. RBAC vs Ownership — mục quan trọng nhất

### Vì sao Lean khác upip ở đây

upip là hệ thống nghiệp vụ nhiều cơ quan. Quyền của nó trả lời câu hỏi **"chức năng nào được
dùng"**: ai được duyệt quy hoạch, ai được tạo thông báo. Dữ liệu trong đó là dữ liệu công vụ
— nhiều cán bộ cùng nhìn một hồ sơ cấp phép là chuyện bình thường, thậm chí là mục đích của
hệ thống. Lọc theo hàng (`provCd`/`distCd`) ở upip là **pha sau, hiện chưa bật**
(upip §4, dòng cuối).

Lean là dữ liệu sức khỏe cá nhân. Mối lo áp đảo không phải "ai được bấm nút nào" mà
**"hàng nào được đụng"**. Một lỗi phân quyền ở upip làm sai quy trình hành chính; một lỗi
cách ly hàng ở Lean làm lộ cân nặng, vòng bụng và thói quen ăn uống của một người cho một
người khác. Đó là lý do thứ tự ưu tiên đảo ngược so với upip: **ownership là lớp bảo vệ
chính, RBAC là lớp phụ.**

### Hai lớp trực giao, cần cả hai

| | **RBAC** | **Ownership** |
|---|---|---|
| Trả lời câu hỏi | *Chức năng* nào được dùng? | *Hàng* nào được đụng? |
| Sống ở đâu | Một middleware `permissionGuard` (§6) | Mệnh đề `where` trong **mọi** truy vấn của `repositories/` |
| Dữ liệu quyết định | `User.roleId` → danh sách mã quyền | Cột `userId` trên mọi bảng |
| Sai thì hậu quả | Người dùng thường vào được màn quản trị | **Người dùng đọc/sửa được dữ liệu sức khỏe của người khác** |
| Trạng thái | Chưa có — tài liệu này | **Đã có sẵn trong code** |
| Mã lỗi khi chặn | `403 FORBIDDEN` | `404 NOT_FOUND` (không xác nhận hàng đó tồn tại) |

Trực giao nghĩa là: **qua được lớp này không nói gì về lớp kia.** Một request `PATCH
/api/meals/:id` có quyền `log:manage` vẫn phải đi qua `updateMany({ where: { id, userId } })`
và vẫn nhận `404` nếu `id` đó thuộc người khác.

### Ownership đã có sẵn — RBAC không được thay thế nó

Cơ chế cách ly hàng đã được cài đặt và có test, mô tả đầy đủ ở
[`../meals/SPEC.md`](../meals/SPEC.md) §6. Tóm tắt phần bắt buộc phải nhớ:

- Mọi bảng có cột `userId` từ đầu, dù chưa có auth
  ([`../../overview/02-data-model.md`](../../overview/02-data-model.md) §4).
- Hai hàm ghi của `meals` dùng **`updateMany`/`deleteMany` với `where: { id, userId }`** cho
  một thao tác trên đúng một bản ghi — **không** phải `findFirst` rồi `update`. Lý do:
  `update({ where: { id } })` là một câu lệnh ghi **không mang điều kiện sở hữu**; ai
  refactor sau này cũng có thể làm mất lớp bảo vệ mà mọi test vẫn xanh, vì test hiện chạy
  trên một người dùng duy nhất.
- Truy cập bản ghi của người khác trả **`404`, không phải `403`** — `403` xác nhận "id này
  có tồn tại, chỉ là không phải của bạn", một rò rỉ thông tin nhỏ.

**RBAC không thay đổi một dòng nào trong `repositories/`.** Nếu trong lúc làm RBAC bạn thấy
mình đang gỡ `userId` khỏi một mệnh đề `where` với lý do "middleware chặn rồi", bạn đang phá
đúng lớp bảo vệ quan trọng hơn.

### `ADMIN` KHÔNG đọc được dữ liệu sức khỏe của người khác

Nói thẳng, vì đây là chỗ dễ suy diễn sai nhất:

> Một `ADMIN` có `user:manage` **vẫn KHÔNG** được đọc `BodyLog`, `Meal`, `Goal` của người
> khác. Đó là dữ liệu sức khỏe.

Cụ thể `ADMIN` **được** làm gì với tài khoản người khác: xem email, trạng thái khóa/mở, vai
trò đang gán; khóa hoặc xóa tài khoản; đổi vai trò. Cụ thể `ADMIN` **không** được: mở
`GET /api/body-logs`, `/api/meals`, `/api/summary`, `/api/goal` của user khác — không có
tham số `userId` nào trong các API đó, và repository luôn dùng `userId` của người đang gọi.

Điều này **không phải hệ quả tự nhiên** của thiết kế; nó là quyết định phải giữ chủ động.
Cách hiện thực rẻ và sai mà ai cũng nghĩ ra đầu tiên là thêm `?userId=` cho admin. Đừng.

Nếu một ngày thật sự cần (ví dụ hỗ trợ kỹ thuật), nó phải là **quyết định sản phẩm tường
minh**, không phải hệ quả phụ của việc lên quyền admin, và tối thiểu phải có:

1. Một quyền **riêng**, `log:view-any`, **không** cấp mặc định cho `ADMIN` — phải gán tay.
2. **Log truy cập**: ai, xem của ai, lúc nào, endpoint nào. Bảng riêng, không xóa được từ UI.
3. Một tham số tường minh (`?userId=`) chỉ được chấp nhận khi request có `log:view-any`;
   thiếu quyền thì tham số bị **bỏ qua**, không phải `403` — để không lộ sự tồn tại của tính năng.
4. Thông báo cho chủ dữ liệu, hoặc ít nhất một màn "ai đã xem dữ liệu của tôi".

Ba trong bốn thứ đó nằm ngoài phạm vi RBAC. Đó chính là lý do nó không thuộc bản này.

### Hệ quả: `403` và `404` không thay thế nhau

| Tình huống | Mã | Ai quyết định |
|---|---|---|
| Chưa đăng nhập | `401 UNAUTHORIZED` | middleware auth ([`../auth/SPEC.md`](../auth/SPEC.md)) |
| Đã đăng nhập, vai trò không có quyền cho endpoint này | `403 FORBIDDEN` | `permissionGuard` (§6) |
| Có quyền, nhưng hàng đó thuộc người khác | `404 NOT_FOUND` | repository, qua `where: { id, userId }` |
| Có quyền, hàng của mình nhưng chưa tồn tại | `404 NOT_FOUND` | repository |

Hai dòng cuối cố tình **không phân biệt được** với nhau từ bên ngoài. Đó là mục đích.

---

## 6. Kiến trúc enforcement

**Nguyên tắc (nguyên tắc 1 của upip, giữ nguyên): enforcement 100% ở tầng middleware.**

upip nói thẳng: không service nào bật `@EnableMethodSecurity`, không có `@PreAuthorize` nào
trong code. Bản Lean của cùng câu đó:

> **Không có `if (user.role === 'ADMIN')` hay `if (perms.includes(...))` trong bất kỳ
> controller hay service nào.** Toàn bộ quyết định cho/chặn nằm ở đúng một file:
> `server/src/shared/rbac/permissionGuard.ts`.

Vì sao ràng buộc này đáng giá: quyền rải rác trong service thì không ai trả lời được câu hỏi
"ai được gọi endpoint X" mà không đọc hết code. Tập trung một chỗ thì câu trả lời là một
bảng — chính là §7 — và bảng đó **là** code.

### 6.1 Luồng một request

```
Request  ─►  express.json()
         ─►  requireAuth        (auth feature — gắn req.user = { id, roleId })
         ─►  permissionGuard    (RBAC — feature này)
         ─►  router của feature ─► controller ─► service ─► repository (ownership: where userId)
         ─►  errorHandler
```

`permissionGuard` cắm **một lần** trong `server/src/app.ts`, sau `requireAuth` và **trước**
mọi `app.use('/api/...', router)`. Không feature nào tự cắm guard riêng.

### 6.2 `permissionRegistry` — nguyên tắc 2 của upip

Map endpoint → quyền khai tập trung ở `server/src/shared/rbac/permissionRegistry.ts`, một
mảng luật, khớp **dòng đầu tiên thắng**. upip gọi nó là `PermissionRegistry`; tên giữ nguyên.

```ts
// Hình dạng dự kiến — chi tiết chốt lúc code
type Rule = {
  methods: readonly HttpMethod[] | 'ANY';
  path: string;              // pattern dưới /api, hỗ trợ '*' (một đoạn) và '**' (nhiều đoạn)
  permission: string | null; // null = mở, không cần đăng nhập
};

export const PERMISSION_RULES: readonly Rule[] = [ /* bảng §7, đúng thứ tự */ ];

export function resolvePermission(method: string, path: string): Resolution;
```

**Ai thêm route mới phải khai vào đây.** Không có ngoại lệ, và §6.4 làm cho việc quên trở
thành lỗi ồn ào thay vì lỗ hổng im lặng.

Thứ tự các dòng là **một phần của đặc tả**, không phải chuyện thẩm mỹ: dòng hẹp phải đứng
trước dòng rộng. Ví dụ trong §7, `/users/*/role` (quyền `rbac:*`) **phải** đứng trước
`/users/**` (quyền `user:*`); đảo lại thì đổi vai trò chỉ cần `user:manage`.

### 6.3 Middleware `permissionGuard`

Trách nhiệm, đúng bốn việc:

1. Gọi `resolvePermission(req.method, req.path)`.
2. Luật `permission === null` → `next()` ngay, không đụng cache, không cần `req.user`.
3. Lấy tập quyền của `req.user.id` từ cache (§8). Cache miss → đọc DB qua repository → lưu.
4. Có mã quyền → `next()`. Không có → `next(AppError.forbidden(...))`.

Không log dữ liệu người dùng, không đọc body, không biết feature nào đang được gọi.

### 6.4 Mặc định TỪ CHỐI — chỗ cố ý lệch khỏi upip

upip: path không khớp luật nào mà đã đăng nhập thì **cho qua** (`anyRequest().authenticated()`,
dòng cuối bảng §9 của upip).

Lean: path `/api/**` không khớp luật nào → **`403`**.

Vì sao lệch: upip có hàng trăm endpoint qua nhiều service, mặc định-từ-chối ở đó sẽ làm sập
những thứ chưa kịp khai. Lean có **12 endpoint** (§7) và một người viết. Với bề mặt nhỏ như
vậy, "quên khai vào registry" là kịch bản thực tế duy nhất, và hậu quả của nó ở hai chiều
rất khác nhau:

- Mặc định-cho-qua: route mới về dữ liệu sức khỏe **im lặng không được bảo vệ**. Không ai
  phát hiện cho tới khi có sự cố.
- Mặc định-từ-chối: route mới trả `403` ngay lần test đầu tiên. Lập tức thấy, sửa mất 30 giây.

Đổi lấy: chi phí "thêm một dòng registry mỗi khi thêm route". Chấp nhận.

### 6.5 Hình dạng lỗi — chỗ cố ý lệch khỏi upip

upip trả `{ success: false, error: { code: "FORBIDDEN" } }`. **Lean không dùng dạng đó.**
Lean đã chốt hình dạng lỗi ở
[`../../overview/04-conventions.md`](../../overview/04-conventions.md) và cả 5 feature đang
chạy đều theo nó. Thêm một dạng thứ hai chỉ cho RBAC là buộc mọi client phải xử lý hai kiểu.

```jsonc
// 403 — đã đăng nhập, vai trò không có quyền
{ "error": { "code": "FORBIDDEN", "message": "Vai trò hiện tại không có quyền log:manage" } }

// 401 — chưa đăng nhập (do feature auth trả, ghi ở đây để đối chiếu)
{ "error": { "code": "UNAUTHORIZED", "message": "Cần đăng nhập" } }
```

`message` **được phép** nêu tên mã quyền còn thiếu — nó giúp gỡ lỗi và không lộ gì về dữ liệu
người khác. Nó **không được** nêu vai trò nào có quyền đó, cũng không nêu tài nguyên có tồn
tại hay không (chuyện đó thuộc ownership → `404`).

Kéo theo: `AppErrorCode` ở `server/src/shared/errors/AppError.ts:1` hiện chỉ có
`VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR`, phải thêm `FORBIDDEN` (và `UNAUTHORIZED`
nếu feature auth chưa thêm) — xem [`PLAN.md`](PLAN.md) bước 4.

### 6.6 Bảng đối chiếu cơ chế upip → Lean

| upip (Spring) | Lean (Express + TypeScript) | Ghi chú |
|---|---|---|
| `PermissionFilter` (`OncePerRequestFilter`) | middleware `permissionGuard`, cắm trong `app.ts` | Tương đương 1-1 |
| `PermissionRegistry` (Java) | `shared/rbac/permissionRegistry.ts` | Cùng tên, cùng luật dòng-đầu-thắng |
| `RbacAdminAuthzFilter` (filter riêng ở auth-server) | **không có** — gộp vào chính `permissionRegistry` (§7 dòng 12–15) | Lean là một tiến trình, một app; hai filter cho hai nhóm route chỉ tạo thêm chỗ để lệch nhau |
| HTTP matcher theo role ở file/notification/resident-service | **không có** | Lean không có microservice. **Mọi** chốt chặn đi qua registry theo mã quyền, không có route nào gate theo role code |
| `@PreAuthorize` / `@EnableMethodSecurity` | **cấm** | Nguyên tắc 1 |
| JWT claim `authorities` = role code | `req.user` do `requireAuth` gắn, chỉ mang `id` + `roleId` | **Quyền không nằm trong token/session** — §8 giải thích vì sao |
| Redis `biz:perm:{userId}`, TTL 30 ngày | `Map` trong bộ nhớ tiến trình, TTL 30 phút | §8, kèm điều kiện phải chuyển sang Redis |
| `PermissionCacheEvictor` | `permissionCache.evictUser` / `evictRole` | Nguyên tắc 4 |
| `GET /users/{id}/permissions` (service gọi chéo) | đọc thẳng DB qua `rbac.repository` | Một tiến trình, không cần HTTP client |
| Liquibase changelog `018-*.yaml` | `prisma db push` + seed script idempotent | §9 |
| 2 realm (business / resident) | **không có** | Một app, một tập user |

---

## 7. Map endpoint → quyền

Toàn bộ API hiện có. Nguồn của từng dòng là `SPEC.md` của feature tương ứng — mọi route dưới
đây truy được về đó. Path viết tương đối với prefix `/api`.

**Khớp dòng đầu tiên thắng.** Thứ tự trong bảng = thứ tự trong `PERMISSION_RULES`.

| # | Method | Path (dưới `/api`) | Quyền | Nguồn |
|---|---|---|---|---|
| 1 | ANY | `/health` | *(mở)* | `server/src/app.ts:17-19` |
| 2 | ANY | `/auth/**` | *(mở)* | [`../auth/SPEC.md`](../auth/SPEC.md) |
| 3 | GET | `/body-logs`, `/body-logs/*` | `log:view` | [`../body-logs/SPEC.md`](../body-logs/SPEC.md) §2 — `GET /?from=&to=`, `GET /:date` |
| 4 | PUT, DELETE | `/body-logs/*` | `log:manage` | [`../body-logs/SPEC.md`](../body-logs/SPEC.md) §2 — `PUT /:date`, `DELETE /:date` |
| 5 | GET | `/meals` | `log:view` | [`../meals/SPEC.md`](../meals/SPEC.md) §2 — `GET /?date=` |
| 6 | POST | `/meals` | `log:manage` | [`../meals/SPEC.md`](../meals/SPEC.md) §2 — `POST /` |
| 7 | PATCH, DELETE | `/meals/*` | `log:manage` | [`../meals/SPEC.md`](../meals/SPEC.md) §2 — `PATCH /:id`, `DELETE /:id` |
| 8 | GET | `/summary` | `log:view` | [`../summary/SPEC.md`](../summary/SPEC.md) §1 — `GET /?from=&to=` |
| 9 | GET | `/goal` | `goal:view` | [`../goal/SPEC.md`](../goal/SPEC.md) §2 |
| 10 | PUT | `/goal` | `goal:manage` | [`../goal/SPEC.md`](../goal/SPEC.md) §2 |
| 11 | GET | `/reminders` | `reminder:view` | [`../reminders/SPEC.md`](../reminders/SPEC.md) §3 |
| 12 | PUT | `/reminders/*` | `reminder:manage` | [`../reminders/SPEC.md`](../reminders/SPEC.md) §3 — `PUT /:kind` |
| 13 | GET | `/permissions`, `/roles`, `/roles/*/permissions` | `rbac:view` | §10 (feature này) |
| 14 | PUT | `/roles/*/permissions`, `/users/*/role` | `rbac:manage` | §10 (feature này) |
| 15 | GET | `/users`, `/users/*` | `user:view` | [`../auth/SPEC.md`](../auth/SPEC.md) — API quản trị tài khoản |
| 16 | POST, PUT, PATCH, DELETE | `/users`, `/users/*` | `user:manage` | [`../auth/SPEC.md`](../auth/SPEC.md) |
| — | * | **mọi path khác dưới `/api`** | **`403` (mặc định từ chối)** | §6.4 |

### Ràng buộc thứ tự — bắt buộc

1. **Dòng 14 phải đứng trước dòng 16.** `PUT /users/:id/role` khớp cả hai; đứng sau thì đổi
   vai trò chỉ cần `user:manage` thay vì `rbac:manage`, tức là ai quản lý được tài khoản thì
   tự nâng mình lên `ADMIN` được.
2. **Dòng 1–2 phải đứng đầu.** Chúng là hai luật `null` duy nhất; nếu bị một luật rộng khớp
   trước thì `/api/auth/login` yêu cầu đăng nhập để đăng nhập.
3. **Dòng 5–6 (`/meals` không có `*`) phải đứng trước dòng 7.** `POST /meals` và
   `PATCH /meals/:id` khác cả method lẫn độ sâu path; giữ hai dòng riêng cho rõ.

### Ghi chú

- **Dòng 15–16 mô tả route chưa tồn tại.** API quản trị tài khoản thuộc feature `auth`. Khai
  sẵn trong registry là an toàn: luật cho một path không tồn tại thì không bao giờ khớp, và
  ngày route ra đời nó được bảo vệ ngay từ commit đầu.
- **Không route nào gate theo role code.** upip có cả một mục (§11) cho các chức năng gate
  theo `ADMIN_ROLES` vì chúng nằm ở service khác, ngoài catalog quyền. Lean là một tiến
  trình, mọi thứ đi qua registry — không có mục tương đương, và không được tạo ra.
- **`403` không phụ thuộc dữ liệu.** Guard chỉ nhìn method + path + tập quyền. Nó không đọc
  DB nghiệp vụ, không biết `:id` là của ai. Việc đó là của ownership.

---

## 8. Cache quyền

### Cơ chế

`server/src/shared/rbac/permissionCache.ts` — `Map<userId, { codes: Set<string>; expiresAt: number }>`.

| Thuộc tính | Giá trị | Lý do |
|---|---|---|
| Khóa | `userId` | Giống upip (`biz:perm:{userId}`), bỏ tiền tố vì không dùng chung không gian khóa với ai |
| Giá trị | `Set<string>` các mã quyền | `Set.has()` là thao tác duy nhất guard cần |
| Nguồn khi miss | `rbac.repository.findPermissionCodesByUserId()` | Một tiến trình, đọc thẳng DB — không cần HTTP client như `AuthServerClient` của upip |
| TTL | **30 phút** | Xem "Vì sao TTL ngắn hơn upip" bên dưới |
| Evict | **chủ động**, xem bảng dưới | Nguyên tắc 4 của upip |

### Quyền KHÔNG nằm trong session/token

upip nhét role code vào claim `authorities` của JWT, và phải ghi chú *"đổi role → phải đăng
nhập lại vì authorities đóng băng trong token lúc phát hành"* (upip §7).

Lean **không** làm vậy. Session chỉ mang `userId` (+ `roleId` để tiện). Tập quyền luôn tra
qua cache. Hệ quả: **đổi vai trò có hiệu lực ngay ở request kế tiếp, không phải đăng xuất.**
Chi phí là một truy vấn DB sau mỗi lần evict — với SQLite cục bộ, không đáng kể.

### Evict chủ động — nguyên tắc 4

Bốn chỗ **bắt buộc** gọi evict, ngay trong cùng service thực hiện thay đổi:

| Hành động | Evict | Vì sao không thể chỉ chờ TTL |
|---|---|---|
| Gán vai trò khác cho user (`PUT /api/users/:id/role`) | `evictUser(userId)` | Hạ một user khỏi `ADMIN` mà chờ 30 phút là 30 phút người đó vẫn vào được màn quản trị |
| Sửa ma trận quyền của một vai trò (`PUT /api/roles/:id/permissions`) | `evictRole(roleId)` → **mọi user mang vai trò đó** | Đây là chỗ dễ quên nhất: thay đổi ở bảng `Role` nhưng cache khóa theo `userId`. Phải tra ngược ra danh sách user rồi evict từng người |
| Khóa/xóa tài khoản | `evictUser(userId)` | Tránh giữ tập quyền của một tài khoản đã chết |
| Chạy seed hoặc migration RBAC | `clear()` | Seed sửa DB ngoài luồng service |

**Test bắt buộc cho `evictRole`**: gán `USER` cho một user → gọi API để user đó đọc được
`log:view` → bỏ `log:view` khỏi vai trò `USER` → request kế tiếp phải `403` **ngay**, không
chờ TTL.

### Vì sao TTL 30 phút thay vì 30 ngày như upip

upip chọn TTL rất dài (43200 phút) và ghi rõ *"dài an toàn vì có evict chủ động"*. Với Redis
thì hợp lý: cache sống qua restart, dựng lại tốn một chuyến HTTP sang auth-server.

Cache của Lean nằm trong bộ nhớ tiến trình nên **mất sạch mỗi lần restart server** — TTL dài
không mua thêm được gì. Ngược lại, TTL ngắn là **lưới an toàn cho đúng một kịch bản**: ai đó
thêm một đường sửa vai trò mới mà quên gọi evict. Với TTL 30 ngày, lỗi đó là vĩnh viễn trên
thực tế; với 30 phút, nó tự lành. Chi phí là một truy vấn `SELECT` mỗi 30 phút mỗi user trên
SQLite cục bộ.

TTL **không phải** cơ chế chính. Nếu bạn thấy mình dựa vào TTL để một thay đổi quyền có hiệu
lực, bạn đang thiếu một lời gọi evict.

### Khi nào bắt buộc chuyển sang Redis

Cache trong bộ nhớ đúng **chỉ khi có đúng một tiến trình server**. Ngay khi chạy nhiều
instance (scale ngang, PM2 cluster, nhiều container sau load balancer), nó **sai**, và sai
theo kiểu im lặng:

> Instance A nhận `PUT /users/42/role` hạ user 42 khỏi `ADMIN`. A evict cache của mình và
> trả `200`. **B và C không biết gì** — mỗi tiến trình có `Map` riêng, không có kênh nào để
> A báo cho chúng. User 42 gọi tiếp; load balancer đưa sang B; B đọc cache cũ và vẫn cho
> quyền `ADMIN`. Kéo dài tới hết TTL của B, tối đa 30 phút.
>
> Tệ hơn cả việc bị chậm: kết quả **không xác định**. Cùng một request, tùy rơi vào instance
> nào mà được hay bị chặn.

Điều kiện chuyển đổi và cách làm: cache dùng chung Redis, key `lean:perm:{userId}` (đúng
khuôn upip), evict = `DEL` trên Redis nên **mọi instance thấy cùng lúc**. Nếu vẫn giữ thêm
một lớp trong bộ nhớ trước Redis thì phải có kênh phát tán evict (Redis pub/sub) — nếu không
thì vẫn đúng bài toán trên, chỉ chậm hơn một nhịp.

Ghi vào [`PLAN.md`](PLAN.md) như một điều kiện chặn: **không triển khai nhiều instance trước
khi đổi cache.**

---

## 9. Data model

### Bảng mới

Ba bảng, cộng một cột trên bảng `User` (bảng `User` thuộc feature `auth`, không thuộc feature này).

```prisma
model Role {
  id          String   @id @default(cuid())
  code        String   @unique          // "USER" | "ADMIN" — không có tiền tố ROLE_
  name        String                    // tên hiển thị tiếng Việt
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  permissions RolePermission[]
  users       User[]
}

model Permission {
  id       String @id @default(cuid())
  code     String @unique               // "log:view" — dạng resource:action
  name     String
  resource String                       // "log" | "goal" | "reminder" | "user" | "rbac"
  action   String                       // "view" | "manage"
  sequence Int                          // thứ tự hiển thị trên màn Phân quyền

  roles RolePermission[]

  @@unique([resource, action])
}

model RolePermission {
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([permissionId])
}
```

Trên `User` (feature `auth` sở hữu bảng; feature này chỉ thêm cột và quan hệ):

```prisma
  roleId String?
  role   Role?   @relation(fields: [roleId], references: [id], onDelete: SetNull)
```

### Quyết định thiết kế

| Quyết định | Vì sao |
|---|---|
| **`User.roleId` nullable, `onDelete: SetNull`** | Giống upip (`auth_user.role_id` FK, `ON DELETE SET NULL`). Xóa một vai trò không được xóa theo tài khoản. User `roleId = null` có **tập quyền rỗng** → mọi route cần quyền đều `403` (fail closed), vẫn đăng nhập được để thấy màn "tài khoản chưa được cấp quyền" |
| **Một user đúng một vai trò** | upip cũng vậy (một cột FK, không phải bảng nối). Nhiều vai trò cộng dồn tạo câu hỏi "quyền là hợp hay giao" mà chưa ai cần trả lời. Đổi sau = thêm bảng nối, chỉ đụng repository |
| **`RolePermission` khóa chính kép, không có cột `id`** | Giống `BodyLog` dùng `@@id([userId, date])` ([`../../overview/02-data-model.md`](../../overview/02-data-model.md) §4). Ràng buộc "một cặp một lần" do DB cưỡng chế |
| **`Permission` có `resource` + `action` tách rời dù `code` đã chứa cả hai** | Giống upip (`auth_permission` có cả `permission_code`, `resource`, `action`). Màn Phân quyền nhóm theo `resource`; parse chuỗi `code` mỗi lần render là chỗ để sinh lỗi |
| **`@@unique([resource, action])`** | Chặn hai hàng cùng `(log, view)` mà `code` gõ khác nhau (`log:view` vs `logs:view`) |
| **Không có Group** | upip đã **gỡ bỏ** tầng Group (banner cập nhật 2026-07-15 trong tài liệu gốc), còn lại `User → Role → Permission`. Lean bắt đầu từ mô hình đã gọn đó, không đi lại đường vòng |
| **Danh mục quyền nằm trong DB, không hardcode** | `rbac:view` cần liệt kê quyền cho màn Phân quyền. Nguồn duy nhất là bảng `Permission`; hằng trong code chỉ dùng cho registry §7 và **phải khớp** — có test canh (§11) |

### Migration

Dự án dùng `npx prisma db push` với SQLite
([`../../overview/04-conventions.md`](../../overview/04-conventions.md)), không có file
migration đánh số như Liquibase của upip. Thứ tự:

1. Feature `auth` tạo bảng `User` **trước**.
2. Thêm ba model trên + cột `User.roleId` vào `server/prisma/schema.prisma`.
3. `npx prisma db push` → sinh bảng + client.
4. Chạy seed (dưới).
5. Backfill vai trò cho user hiện có (dưới).

Cột `roleId` nullable nên `db push` **không** cần dữ liệu mặc định, chạy được trên DB đã có
dữ liệu mà không mất gì.

### Seed

Script `server/prisma/seed/rbac.seed.ts`, **idempotent** — chạy lại nhiều lần cho cùng kết
quả (upip đạt điều này bằng `NOT EXISTS`; Prisma dùng `upsert` theo `code`).

Nội dung:

1. **10 quyền** của §3, kèm `resource`, `action`, `sequence`.
2. **2 vai trò**: `USER` ("Người dùng"), `ADMIN` ("Quản trị hệ thống").
3. **Ma trận §4**: `USER` ← 6 quyền dữ liệu cá nhân; `ADMIN` ← cả 10.
4. `permissionCache.clear()` không cần — seed chạy ở tiến trình riêng, ngoài server.

Seed **chỉ đụng ba bảng RBAC**, không tạo user, không gán vai trò cho ai. Việc gán là bước riêng.

### Gán vai trò cho user hiện có

Hiện DB chỉ có dữ liệu của một người dùng cục bộ, `LOCAL_USER_ID = 'local'`
(`server/src/shared/constants.ts:9`). Sau khi feature `auth` tạo bảng `User`, phải có đúng
một hàng `User` mang `id = 'local'` — nếu không, toàn bộ `BodyLog`/`Meal`/`Goal`/`Reminder`
hiện có sẽ mồ côi.

Backfill: **user `local` nhận vai trò `ADMIN`.** Vì nó là chủ máy, và vì phải có ít nhất một
`ADMIN` để gán vai trò cho những người sau — nếu không thì thao tác đầu tiên bắt buộc phải
làm bằng tay trong DB.

Lưu ý đúng theo §5: `local` là `ADMIN` **không** làm nó đọc được dữ liệu sức khỏe của ai
khác nếu sau này có người dùng thứ hai. Ownership vẫn chặn.

Backfill là câu lệnh idempotent: `UPDATE User SET roleId = <id của ADMIN> WHERE roleId IS NULL`
— chỉ chạm những user chưa có vai trò, chạy lại vô hại. Từ người dùng thứ hai trở đi, mặc
định là `USER`, do luồng đăng ký của feature `auth` gán.

---

## 10. API quản trị phân quyền

Tương ứng §6 của upip (`RbacAdminController`), thu nhỏ về đúng những gì hai vai trò cần.

| Method | Path | Quyền | Trả về |
|---|---|---|---|
| `GET` | `/api/permissions` | `rbac:view` | Danh mục 10 quyền, sắp theo `sequence`, nhóm được theo `resource` |
| `GET` | `/api/roles` | `rbac:view` | Danh sách vai trò + số user đang mang |
| `GET` | `/api/roles/:roleId/permissions` | `rbac:view` | Mã quyền của một vai trò |
| `PUT` | `/api/roles/:roleId/permissions` | `rbac:manage` | Đặt lại toàn bộ tập quyền của vai trò (thay thế, không cộng dồn) → **evict `roleId`** |
| `PUT` | `/api/users/:userId/role` | `rbac:manage` | Gán vai trò cho user, body `{ roleId }` → **evict `userId`** |

**Cố tình KHÔNG có:** tạo vai trò, xóa vai trò, tạo quyền. Hai vai trò và mười quyền là danh
mục đóng, sửa bằng seed + review code, không sửa qua UI. upip cần `POST /roles/provision` vì
nó phục vụ nhiều cơ quan với nhu cầu phát sinh vai trò mới; Lean không có nhu cầu đó, và một
UI tạo vai trò là một UI để vô tình tạo ra một vai trò có `rbac:manage`.

### Bất biến bắt buộc

1. **Không được để hệ thống còn 0 `ADMIN`.** `PUT /users/:id/role` hạ `ADMIN` cuối cùng
   xuống `USER` → `400`, `code: 'VALIDATION_ERROR'`. Không có `ADMIN` nào thì không ai gán
   được vai trò nữa, phải sửa DB bằng tay.
2. **`ADMIN` không tự hạ vai trò của chính mình.** `req.user.id === :userId` và vai trò mới
   khác `ADMIN` → `400`. Là ca riêng của (1) nhưng thông báo lỗi cần khác để người dùng hiểu.
3. **`PUT /roles/:id/permissions` không được gỡ `rbac:manage` khỏi `ADMIN`.** Gỡ xong thì
   chính API này bị khóa vĩnh viễn.
4. **Mọi mã quyền mà `permissionRegistry` yêu cầu phải tồn tại trong bảng `Permission`.**
   upip ghi cùng bất biến này (§9, ghi chú cuối). Sai là một endpoint không vai trò nào vào
   được. Có test canh (§11).

---

## 11. Kế hoạch test

| Nhóm | Kiểm gì |
|---|---|
| `permissionRegistry` — hàm thuần | Từng dòng §7 khớp đúng luật mong đợi; `/users/:id/role` khớp **dòng 14** chứ không phải 16; path lạ trả "từ chối"; `/api/health` và `/api/auth/login` trả "mở" |
| Bất biến registry ↔ DB | Mọi mã quyền dùng trong `PERMISSION_RULES` đều có trong seed; `ADMIN` có đủ 10 mã → không endpoint nào `403` với `ADMIN` |
| `permissionCache` | Miss → đọc DB một lần, hit thứ hai không đọc lại; `evictUser` xóa đúng một user; `evictRole` xóa **mọi** user mang vai trò đó; TTL hết hạn thì đọc lại |
| `permissionGuard` — integration (supertest) | `USER` gọi `GET /api/roles` → `403` đúng hình dạng `{ error: { code: 'FORBIDDEN' } }`; `ADMIN` → `200`; chưa đăng nhập → `401` (không phải `403`); route mở không cần đăng nhập |
| **RBAC ≠ ownership** | `ADMIN` gọi `PATCH /api/meals/:id` với `id` của user khác → **`404`**, và bản ghi **không bị đụng**. Đây là test quan trọng nhất của cả feature |
| Đổi quyền hiệu lực ngay | Hạ user khỏi `ADMIN` → request kế tiếp `403`, không chờ TTL |
| Bất biến §10 | Hạ `ADMIN` cuối cùng → `400`; tự hạ mình → `400`; gỡ `rbac:manage` khỏi `ADMIN` → `400` |

---

## 12. Áp quyền trên FE

### Nguyên tắc — đọc trước khi code

> **FE ẩn nút chỉ là trải nghiệm, không phải bảo mật. Server vẫn phải chặn.**

Người dùng gọi thẳng API bằng `curl`, DevTools, hoặc sửa JS trong trình duyệt. Mọi thứ FE
làm chỉ để **không bày ra những nút bấm sẽ trả `403`**. Nếu một chốt chặn chỉ tồn tại ở FE,
nó không tồn tại.

Hệ quả cụ thể: **không được** vì đã ẩn nút mà bỏ dòng tương ứng trong `permissionRegistry`.
Kiểm chứng bằng test integration ở §11, không bằng việc bấm thử trên UI.

### Cách làm

FE **không đoán quyền theo role code** (upip §10 cũng ràng buộc như vậy). Nó nhận danh sách
mã quyền từ server và hỏi `hasPermission(code)`.

- Nguồn: endpoint phiên của feature `auth` — **`GET /api/auth/session`**, trả `SessionResponse`.
  Khi làm RBAC, **mở rộng** `SessionResponse` thêm trường `permissions: string[]`. Một chuyến
  gọi lúc bootstrap, không thêm request riêng cho RBAC.

  > **Đã sửa 2026-08-07.** Bản trước của mục này gọi `GET /api/auth/me` — endpoint đó
  > **không tồn tại**; `auth/SPEC.md` chỉ khai `/api/auth/{csrf,login,logout,session}`.
  > Hai tài liệu được viết song song nên lệch nhau. Chốt lấy `/api/auth/session` vì nó
  > nằm trong bảng endpoint của `auth`, là feature sở hữu. Xem `auth/SPEC.md` mục
  > `SessionResponse`.
- Lưu ở `web/src/features/auth/` (không phải `features/rbac/`) vì `hasPermission` là thứ mọi
  feature dùng, giống `apiClient`.
- API: `hasPermission(code: string): boolean`, `hasAnyPermission(...codes): boolean`.
- **Không** cache lâu ở FE. `403` từ server → coi là quyền đã đổi → nạp lại `me`.

### Bảng gate UI

| Chỗ trên UI | Điều kiện | Ai thấy |
|---|---|---|
| Menu "Hôm nay", form ghi cân nặng / bữa ăn | `log:manage` | `USER`, `ADMIN` |
| Trang "Biểu đồ" | `log:view` | `USER`, `ADMIN` |
| Cài đặt → khối Mục tiêu (ô nhập) | `goal:manage` | `USER`, `ADMIN` |
| Cài đặt → khối Nhắc nhở (bật/tắt, đổi giờ) | `reminder:manage` | `USER`, `ADMIN` |
| Cài đặt → mục **Tài khoản** | `user:view` | `ADMIN` |
| Cài đặt → mục **Phân quyền** (mở chỉ-đọc) | `rbac:view` | `ADMIN` |
| Phân quyền → các nút ghi (gán vai trò, sửa ma trận) | `rbac:manage` | `ADMIN` |

Bốn dòng đầu hôm nay luôn đúng với mọi vai trò — chúng vẫn được viết bằng `hasPermission`
chứ không hardcode `true`, để ngày thêm vai trò `READONLY` thì không phải đi tìm.

Thiếu quyền thì **ẩn hẳn**, không hiện nút xám. Nút xám nói cho người dùng biết có một chức
năng họ không được dùng, mà chẳng giúp gì.

Trang riêng cho `403` (kiểu `/access-denied` của upip): **chưa cần**. Với hai vai trò và
menu đã ẩn theo quyền, `403` chỉ xảy ra khi quyền vừa bị đổi giữa chừng — hiện thông báo lỗi
tại chỗ rồi nạp lại `me` là đủ.

---

## 13. Câu hỏi mở

1. **`ADMIN` có bao giờ được đọc dữ liệu sức khỏe của người khác không?** Bản này chốt là
   **KHÔNG**. Nếu chủ dự án muốn có (hỗ trợ kỹ thuật, gỡ lỗi), cần chốt trước bốn thứ ở §5:
   quyền riêng `log:view-any`, log truy cập, tham số tường minh, và cách thông báo cho chủ
   dữ liệu. **Không được** hiện thực bằng cách thêm `?userId=` cho `ADMIN`.
2. **Vai trò `COACH` — có làm không, và bao giờ?** Nó cần cơ chế **đồng ý của chủ dữ liệu**
   (bảng cấp quyền theo cặp, phạm vi, thời hạn, thu hồi, log). Đó là một feature riêng, không
   phải một dòng seed. Chưa lên lịch.
3. **Ai được đăng ký tài khoản?** Nếu mở đăng ký thì mọi người mới mặc định là `USER` — cần
   feature `auth` chốt. Nếu chỉ `ADMIN` tạo tài khoản thì `POST /api/users` cần `user:manage`
   và luồng đăng ký công khai không tồn tại. Ảnh hưởng trực tiếp tới dòng 16 của §7.
4. **`GET /api/health` để mở hay bắt đăng nhập?** Bản này để mở (khớp code hiện tại). Nếu
   sau này server ra khỏi localhost thì nó lộ sự tồn tại của dịch vụ — cân nhắc lại cùng lúc
   với việc mở mạng.
5. **Có cần audit log cho chính thao tác RBAC không?** Ai gán vai trò cho ai, lúc nào. upip
   không có (chỉ có `GET /users/{id}/activity`). Với một máy một người thì thừa; với nhiều
   người dùng thì đây là thứ đầu tiên bị hỏi khi có sự cố.
6. **Quyền có nên vào session cookie để bỏ hẳn cache không?** Sẽ nhanh hơn, nhưng đánh mất
   "đổi vai trò hiệu lực ngay" — đúng cái bẫy mà upip phải ghi chú ở §7 (*"đổi role → phải
   đăng nhập lại"*). Bản này chọn cache. Chỉ xem lại nếu đo được rằng truy vấn quyền là nút
   thắt, điều rất khó xảy ra với SQLite cục bộ.
7. **Bao giờ chuyển cache sang Redis?** Điều kiện đã rõ ở §8 (nhiều hơn một tiến trình), câu
   hỏi còn lại là ai chịu trách nhiệm kiểm tra điều kiện đó trước khi ai đó bật cluster mode.
