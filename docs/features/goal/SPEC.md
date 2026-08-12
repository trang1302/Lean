# Feature `goal` — Mục tiêu sức khỏe

Tài liệu này mô tả **hành vi thật của code đã chạy**, không phải ý định trong spec gốc.
Mọi khẳng định đều dẫn `đường-dẫn:dòng`. Nguồn chân lý là `server/src/features/goal/`
và `server/test/features/goal/goal.controller.test.ts` (25 test, đang pass).

## 1. Feature này làm gì

Lưu và đọc **một mục tiêu duy nhất** của người dùng cục bộ, gồm chín trường tùy chọn —
ba của bản đầu cộng sáu trường thêm ở đợt `measures-and-goals` (điểm xuất phát và bốn
đích vòng cơ thể):

| Trường | Kiểu | Ràng buộc | Nguồn |
|---|---|---|---|
| `startWeightKg` | `Float?` | `> 0` và `< 500` (khoảng mở hai đầu) | `commonSchemas.ts:21` (`weightKgSchema`) |
| `startDate` | `String?` | `"YYYY-MM-DD"`, là ngày có thật, **không được ở tương lai** | `commonSchemas.ts:16-18` (`pastOrTodayDateString`) |
| `targetWeightKg` | `Float?` | `> 0` và `< 500` (khoảng mở hai đầu) | `commonSchemas.ts:21` |
| `targetWaistCm` | `Float?` | `> 0` và `< 300` (khoảng mở hai đầu) | `commonSchemas.ts:30` (`circumferenceCmSchema`) |
| `targetChestCm` | `Float?` | như `targetWaistCm` | `commonSchemas.ts:30` |
| `targetShoulderCm` | `Float?` | như `targetWaistCm` | `commonSchemas.ts:30` |
| `targetArmCm` | `Float?` | như `targetWaistCm` | `commonSchemas.ts:30` |
| `targetDate` | `String?` | `"YYYY-MM-DD"` và là ngày có thật; **cho phép tương lai** | `commonSchemas.ts:8-10` (`dateString`) |
| `dailyCalorieTarget` | `Int?` | số nguyên, `0 … 20 000` | `commonSchemas.ts:23` |

`startDate` và `targetDate` validate **ngược hướng nhau có chủ đích** — xem §5, phần đã
mở rộng cho trường mới.

Feature chỉ làm CRUD. **Không tính toán thống kê, không tính % tiến độ.** `startWeightKg`/
`startDate` chỉ được lưu và trả ra nguyên trạng — công thức % thuộc đợt `charts-mui`, xem §7.

Router cắm tại prefix `/api/goal` (`server/src/app.ts:23`), path bên trong là tương đối
(`server/src/features/goal/index.ts:5-7`).

Bốn lớp, ranh giới giữ nghiêm:

- `controllers/goal.controller.ts` — HTTP, parse Zod, không biết Prisma
- `services/goal.service.ts` — gắn `LOCAL_USER_ID`, map sang response DTO
- `repositories/goal.repository.ts` — **chỗ duy nhất** của feature import `prisma`
  (`server/src/features/goal/repositories/goal.repository.ts:1,5-6`)
- `dtos/` — schema request + hàm map response

## 2. Bảng endpoint

| Method | Path | Request | Response 200 | Lỗi |
|---|---|---|---|---|
| `GET` | `/api/goal` | không có tham số | `GoalResponse` | không có — luôn 200 |
| `PUT` | `/api/goal` | body JSON, cả chín trường optional + nullable | `GoalResponse` (trạng thái sau khi ghi) | `400` khi Zod fail |

### `GoalResponse`

`server/src/features/goal/dtos/goal.response.ts:15-27`

```jsonc
{
  "startWeightKg": 78,          // number | null
  "startDate": "2026-06-01",    // string | null
  "targetWeightKg": 68,         // number | null
  "targetWaistCm": 78,          // number | null
  "targetChestCm": 96,          // number | null
  "targetShoulderCm": 44,       // number | null
  "targetArmCm": 28,            // number | null
  "targetDate": "2099-12-31",   // string | null
  "dailyCalorieTarget": 1900,   // number | null
  "updatedAt": "2026-08-07T…Z"  // string | null  ← xem §5.1
}
```

### `PUT` request body

`server/src/features/goal/dtos/goal.request.ts:24-36`

```jsonc
{
  "startWeightKg": 78,          // number | null, có thể vắng mặt
  "startDate": "2026-06-01",    // string | null, có thể vắng mặt
  "targetWeightKg": 68,         // number | null, có thể vắng mặt
  "targetWaistCm": 78,          // number | null, có thể vắng mặt
  "targetChestCm": 96,          // number | null, có thể vắng mặt
  "targetShoulderCm": 44,       // number | null, có thể vắng mặt
  "targetArmCm": 28,            // number | null, có thể vắng mặt
  "targetDate": "2099-12-31",   // string | null, có thể vắng mặt
  "dailyCalorieTarget": 1900    // number | null, có thể vắng mặt
}
```

`{}` là body hợp lệ. Body vắng hẳn cũng hợp lệ: controller dùng `req.body ?? {}`
(`server/src/features/goal/controllers/goal.controller.ts:22`).

### Hình dạng lỗi 400

Controller **không bọc try/catch**; Express 5 tự chuyển `ZodError` sang `errorHandler`
(`server/src/features/goal/controllers/goal.controller.ts:18-20`,
`server/src/shared/errors/errorHandler.ts:33-42`):

```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": [{ "path": "targetWeightKg", "message": "…" }] } }
```

Test khẳng định `code` và sự có mặt của `path` trong `fields`
(`server/test/features/goal/goal.controller.test.ts:173-176`).

Request lỗi validate **không ghi gì vào DB** — schema parse trước khi service được gọi
(`server/test/features/goal/goal.controller.test.ts:213-216`).

## 3. Hành vi khác thường #1 — `GET` khi chưa đặt mục tiêu trả **200**, không phải 404

`server/src/features/goal/dtos/goal.response.ts:17-30` ·
`server/src/features/goal/services/goal.service.ts:9-13` ·
test `server/test/features/goal/goal.controller.test.ts:18-30`

Khi bảng `Goal` chưa có hàng nào cho user, repository trả `null`
(`repositories/goal.repository.ts:12`), và `toGoalResponse(null)` trả về:

```json
{ "targetWeightKg": null, "targetDate": null, "dailyCalorieTarget": null, "updatedAt": null }
```

**Đây là ngoại lệ có chủ đích so với `body-logs` và `meals`**, hai feature đó trả `404`
khi không tìm thấy (spec §5). Lý do: mục tiêu là **singleton** — nó luôn tồn tại về mặt
khái niệm, "chưa đặt" là một *trạng thái hợp lệ* của tài nguyên chứ không phải tài nguyên
không tồn tại. Spec §5 ghi thẳng: *"Chưa đặt → trả object với các trường `null`"*
(`docs/archive/2026-08-06-original-design.md:192`).

Hệ quả cho phía web: trang Cài đặt không cần xử lý nhánh 404, chỉ cần render các ô trống.

> **Không "sửa cho nhất quán".** Đổi sang 404 sẽ buộc mọi consumer thêm nhánh lỗi cho một
> tình huống bình thường, và phá vỡ giả định của `GET /summary` (chỗ đó cũng đọc mục tiêu
> và coi `null` là hợp lệ).

## 4. Hành vi khác thường #2 — `Goal` lấy `userId` làm **khóa chính**

`server/prisma/schema.prisma:54-66`

```prisma
model Goal {
  userId             String   @id
  startWeightKg      Float?
  startDate          String?
  targetWeightKg     Float?
  targetWaistCm      Float?
  targetChestCm      Float?
  targetShoulderCm   Float?
  targetArmCm        Float?
  targetDate         String?
  dailyCalorieTarget Int?
  updatedAt          DateTime @updatedAt
}
```

**Không có cột `id` riêng.** Ràng buộc "mỗi user đúng một mục tiêu" do đó được DB cưỡng chế
ở tầng schema, không phải bằng logic ứng dụng. Repository vì thế chỉ cần
`findUnique({ where: { userId } })` và `upsert({ where: { userId } })`
(`server/src/features/goal/repositories/goal.repository.ts:12,24-28`) — không cần
`findFirst`, không cần guard chống bản ghi trùng.

Test khẳng định: gọi `PUT` hai lần chỉ còn đúng một hàng
(`server/test/features/goal/goal.controller.test.ts:92-99`), và mục tiêu của user khác
không lọt sang (`:61-70`).

**Lệch spec gốc.** `docs/archive/2026-08-06-original-design.md:151-157` (§4, khối schema) vẫn viết
`id String @id @default("singleton")`, và `:174` nhắc lại *"id cố định `singleton`"*.
Nhưng chính spec đó ở `:115` lại nói **`Goal` dùng `userId` làm khóa chính** — spec tự mâu
thuẫn. Code đi theo `:115`, và đó là lựa chọn đúng: khi thêm auth, khóa `singleton` sẽ phải
migrate, còn khóa `userId` thì không.

## 5. Hành vi khác thường #3 — hai trường ngày, **hai schema ngược hướng nhau có chủ ý**

`server/src/features/goal/dtos/goal.request.ts:33` (`targetDate`) và `:27` (`startDate`),
ghi chú tại `:19-22`.

Mọi feature khác (`body-logs`, `meals`) validate `date` bằng `pastOrTodayDateString`, schema
này từ chối ngày tương lai (`server/src/shared/validation/commonSchemas.ts:16-18`).
`targetDate` thì **ngược hoàn toàn**: mục tiêu theo định nghĩa nằm ở tương lai, nên chỉ dùng
`dateString` — kiểm định dạng `YYYY-MM-DD` và ngày có thật, không kiểm mốc thời gian.

`startDate` (thêm ở đợt `measures-and-goals`) đi theo hướng **thứ ba, khác cả hai**: nó
dùng lại `pastOrTodayDateString` — cùng schema với `date` của `body-logs`/`meals`, nhưng vì
lý do khác hẳn. Ba trường ngày, ba lý do:

| Trường | Schema | Vì sao |
|---|---|---|
| `date` (`body-logs`, `meals`) | `pastOrTodayDateString` | ghi lại một việc **đã xảy ra** — "hôm nay tôi cân" không thể ở tương lai |
| `targetDate` | `dateString` | mục tiêu theo định nghĩa nằm ở **tương lai** — chặn tương lai sẽ chặn luôn use case chính |
| `startDate` | `pastOrTodayDateString` | mốc **xuất phát** của % tiến độ (đợt `charts-mui`) — cùng lý do với `date`: nó là một điểm đã xảy ra, không phải một dự định. Một `startDate` ở tương lai sẽ làm mẫu số của % tiến độ ra số vô nghĩa (ghi chú tại `dtos/goal.request.ts:19-22`) |

Tức là `startDate` và `targetDate` **cùng thuộc một feature, cùng kiểu `String?`, nhưng
validate ngược hướng nhau** — không phải sơ suất, mà vì chúng trả lời hai câu hỏi khác
nhau: "tôi bắt đầu từ đâu" (đã xảy ra) so với "tôi muốn tới đâu" (chưa xảy ra).

Test đóng đinh riêng vế `startDate`: `startDate` ở tương lai → **400**
(`goal.controller.test.ts:273-278`) — đối xứng ngược hẳn với test `targetDate` ở tương lai
→ 200 ngay dưới đây.

Test đóng đinh cả hai vế của `targetDate`:

- `'2099-12-31'` → **200** (`server/test/features/goal/goal.controller.test.ts:206-211`)
- `'31/12/2099'` → 400, sai định dạng (`:189-194`)
- `'2099-02-30'` → 400, đúng định dạng nhưng không phải ngày có thật (`:196-199`)

Lưu ý: code **không** chặn `targetDate` trong quá khứ. Một mục tiêu đã quá hạn vẫn lưu được;
`GET /summary` xử lý ca đó bằng cách trả `requiredRate = null`
(`server/src/shared/stats/rate.ts:38-39`).

## 6. Ngữ nghĩa upsert ba trạng thái của `PUT`, chín khóa

| Trong body | Ý nghĩa | Kết quả DB |
|---|---|---|
| trường **vắng mặt** | giữ nguyên giá trị cũ | Prisma nhận `undefined` → không đụng cột |
| trường mang **`null`** | xóa giá trị | ghi `NULL` vào cột |
| trường mang **giá trị** | đặt/ghi đè | ghi giá trị |

### Cách code phân biệt "vắng mặt" với `null`

Đây là chỗ dễ sai nhất của feature. `goalUpsertSchema` khai cả chín trường là
`.nullable()` rồi bọc `.partial()` (`dtos/goal.request.ts:24-36`). Sau khi Zod parse,
`{ "targetDate": null }` và `{}` **cùng cho ra `parsed.targetDate === undefined`** — hai ý
nghĩa trái ngược bị gộp làm một.

Nên việc phân biệt phải làm trên **body thô**, trước khi nhìn kết quả parse
(`dtos/goal.request.ts:61-71, 80-91`):

```ts
const GOAL_PATCH_KEYS = [
  'startWeightKg', 'startDate', 'targetWeightKg', 'targetWaistCm',
  'targetChestCm', 'targetShoulderCm', 'targetArmCm', 'targetDate', 'dailyCalorieTarget',
] as const;

for (const key of GOAL_PATCH_KEYS) {
  if (!(key in body)) continue;
  patch[key] = parsed[key] ?? null;
}
```

`key in rawBody` mới trả lời được câu hỏi "client có gửi trường này không". Trường không có
trong `body` thì cũng không có trong `patch`, tức là `undefined`, mà **Prisma diễn giải
`undefined` là 'bỏ qua cột này'** — trùng khớp chính xác với ngữ nghĩa "giữ nguyên"
(`repositories/goal.repository.ts:17-21`).

`GOAL_PATCH_KEYS` (`dtos/goal.request.ts:61-71`) là **nguồn sự thật duy nhất** cho danh
sách khóa — quan trọng hơn bình thường ở đây vì `goalUpsertSchema` **không** `.strict()`
(§8.2): khóa lạ bị strip im lặng, không có 400 nào. Quên một khóa trong mảng này = trường
đó không bao giờ lưu được và không ai biết.

Controller vì thế phải truyền **cả hai** thứ vào `toGoalPatch`: body thô để biết key nào có
mặt, và kết quả parse để lấy giá trị đã validate
(`controllers/goal.controller.ts:22-24`).

Ở nhánh `create` của upsert, trường vắng mặt để cột ở mặc định `null`
(`repositories/goal.repository.ts:26`).

Bốn test phủ đủ bốn ca trên ba trường gốc — mẫu đại diện, không lặp lại cho cả chín trường:
vắng mặt giữ nguyên (`test:126-133`), `null` xóa — kiểm cả response lẫn hàng trong DB
(`test:135-149`), giá trị ghi đè (`test:151-164`), `{}` không đổi gì (`test:166-175`).

## 7. Vì sao feature này **không** tính `remainingKg` và `onTrack`

Cả hai thuộc `GET /summary`, tính bằng hàm thuần trong `server/src/shared/stats/rate.ts`:

- `remainingKg(ma7Today, targetWeightKg)` — `rate.ts:70-76`
- `isOnTrack(currentRate, requiredRate)` — `rate.ts:55-62`
- gọi tại `server/src/features/summary/services/summary.service.ts:116,119`

`summary` tự đọc hàng `Goal` qua repository riêng của nó
(`server/src/features/summary/repositories/summary.repository.ts:80`).

**Lý do không đưa vào đây:** cả hai công thức cần **MA7 của hôm nay**, thứ chỉ tính được từ
chuỗi `BodyLog` — dữ liệu mà feature `goal` không sở hữu và không nên đi lấy. Tính ở đây
đồng nghĩa với việc nhân bản công thức MA7 và công thức tiến độ ra hai chỗ.

`CLAUDE.md` cấm điều đó: *"Mọi phép tính … nằm trong `stats` dưới dạng hàm thuần"*, và spec
nói thẳng lý do — *"nhân bản công thức ra hai chỗ là cách chắc chắn nhất để hai chỗ lệch
nhau"* (`docs/archive/2026-08-06-original-design.md:245`).

> **Không "bổ sung cho tiện".** Nếu web cần tiến độ mục tiêu, gọi `GET /summary`, không mở
> rộng `GET /goal`.

## 8. Quyết định vượt spec

Ba chỗ code quyết định thay cho spec vì spec không nói tới.

### 8.1 Response có thêm `updatedAt`

Spec §5 chỉ liệt kê ba trường mục tiêu gốc (chín trường sau đợt `measures-and-goals`).
Code trả thêm `updatedAt` dạng **ISO string**, và là **`null` khi chưa từng đặt mục tiêu**
(`dtos/goal.response.ts:26,47-52`).

**Vì sao:** cột `updatedAt` đã có sẵn trong schema (`schema.prisma:65`), và nó là thứ duy
nhất phân biệt được *"chưa từng đặt mục tiêu"* với *"đã đặt rồi nhưng xóa hết chín trường"*
— hai trạng thái mà nếu chỉ nhìn chín trường kia thì trông y hệt nhau (đều `null`). Trạng
thái thứ hai là có thật và tạo được: xem §8.3.

Chuyển `Date` → ISO string ở tầng DTO chứ không để JSON.stringify tự lo, để hợp đồng API là
tường minh. Test chỉ khẳng định `typeof === 'string'` khi có hàng (`test:48`) và `null` khi
không có hàng (`test:28`).

### 8.2 Zod object **không** `.strict()` — khóa lạ bị strip, không bị từ chối

`goalUpsertSchema` là `z.object({…}).partial()`, không có `.strict()`
(`dtos/goal.request.ts:24-36`). Zod mặc định **loại bỏ im lặng** khóa không khai báo.

**Vì sao:** khóa lạ không thể lọt xuống DB — `toGoalPatch` chỉ copy đúng những khóa nó biết
tên, lặp qua `GOAL_PATCH_KEYS` (`dtos/goal.request.ts:61-71, 85-88`, xem §6). Bề mặt tấn
công đã đóng ở đó, nên `.strict()` chỉ thêm một nguồn 400 cho những request vô hại (ví dụ
web gửi ngược nguyên object nhận từ `GET`, kèm cả `updatedAt`). Đây chính là ca thực tế:
`GET` trả mười trường (chín trường mục tiêu + `updatedAt`), `PUT` chỉ nhận chín.

**Đánh đổi đã chấp nhận:** gõ sai tên trường (`targetWeight` thay vì `targetWeightKg`) sẽ
trả 200 mà không ghi gì. Không có test phủ ca này.

### 8.3 `PUT {}` trên DB trắng vẫn **tạo** một hàng toàn `null`, trả 200

`server/test/features/goal/goal.controller.test.ts:101-111` — sau request, `prisma.goal.count()`
bằng 1.

Đây là hệ quả trực tiếp của việc `patch` rỗng đi vào `prisma.goal.upsert`: nhánh `create` vẫn
chạy với `{ userId }` và chín cột để mặc định `null`
(`repositories/goal.repository.ts:24-28`).

**Vì sao chấp nhận thay vì chặn:** `PUT` là **idempotent** — kết quả sau lệnh phải giống nhau
bất kể trước đó có hàng hay không. Chặn ca này đồng nghĩa với việc `PUT {}` cư xử khác nhau
tùy trạng thái DB (400 khi trắng, 200 khi đã có), phá tính idempotent và thêm một nhánh lỗi
cho một request không gây hại. Hàng toàn `null` đọc ra qua `GET` cho kết quả **giống hệt**
trường hợp chưa có hàng ở chín trường mục tiêu — khác duy nhất ở `updatedAt` (§8.1).

## 9. Tổng hợp chỗ lệch spec gốc

| Chỗ | Spec gốc | Code | Ghi chú |
|---|---|---|---|
| Khóa chính `Goal` | `id @default("singleton")` (`2026-08-06-original-design.md:151,174`) | `userId @id` (`schema.prisma:55`) | Spec tự mâu thuẫn — `:115` đã nói `userId`. Code theo `:115`. |
| Trường `updatedAt` trong response | không nhắc | có, ISO string / `null` | §8.1 |
| Body `PUT /goal` | không định nghĩa (3 trường gốc) | chín trường optional + nullable, thêm ở đợt `measures-and-goals` | §6 |
| `startWeightKg`/`startDate` | không nhắc | lưu và trả nguyên trạng, không tính % tiến độ | §1, §7 |
| Trần `dailyCalorieTarget` | §5 định nghĩa `caloriesSchema` cho calo **một bữa** | dùng lại nguyên schema đó cho **cả ngày** | Câu hỏi mở — xem `PLAN.md` §4 |
