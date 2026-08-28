# Feature `body-logs` — Đặc tả theo code thật

> Tài liệu này mô tả **hành vi đang chạy**, đọc ngược từ code và 44 test đang pass.
> Khi code và `docs/archive/2026-08-06-original-design.md` §5 nói khác nhau, chỗ lệch được ghi rõ ở §8.

## 1. Feature làm gì

`body-logs` là lớp lưu trữ **số đo cơ thể theo ngày**: cân nặng (`weightKg`), bốn vòng
— bụng (`waistCm`), ngực (`chestCm`), vai (`shoulderCm`), bắp tay (`armCm`) — và một ghi
chú tự do (`note`). Mỗi ngày lịch có tối đa **một** bản ghi.

Đây là nguồn dữ liệu gốc cho phần xu hướng của app: `summary` đọc bảng `BodyLog` để tính
MA7, tốc độ thay đổi và tiến độ mục tiêu. Bản thân feature này **không tính toán gì** —
không MA7, không trung bình, không tiến độ. Nó chỉ ghi và trả về dữ liệu thô.

Router được cắm ở prefix `/api/body-logs` (`server/src/app.ts:22`), export tên
`bodyLogsRouter` (`server/src/features/bodyLogs/index.ts:6`).

### Kiến trúc 4 lớp

| Lớp | File | Trách nhiệm |
|---|---|---|
| DTO | `dtos/bodyLogs.request.ts`, `dtos/bodyLogs.response.ts` | Schema Zod cho input, interface cho output |
| Controller | `controllers/bodyLogs.controller.ts` | Validate → gọi service → chọn status. Không try/catch |
| Service | `services/bodyLogs.service.ts` | Cắt `userId`, đổi `Date` sang ISO, ném `AppError.notFound` |
| Repository | `repositories/bodyLogs.repository.ts` | **Lớp duy nhất** chạm `prisma`, mọi truy vấn mang `userId` (tham số đầu tiên của cả năm hàm) |

Không lớp nào nhảy cóc: controller không biết Prisma, repository không biết HTTP.

## 2. Bảng endpoint

Mọi path dưới đây là tương đối với `/api/body-logs`.

| Method | Path | Request | Response 2xx | Lỗi |
|---|---|---|---|---|
| `GET` | `/?from=&to=` | Query `from`, `to` (bắt buộc, `YYYY-MM-DD`) | `200` — **mảng** `BodyLogResponse[]`, tăng dần theo `date`, rỗng nếu không có dữ liệu | `400` query sai |
| `GET` | `/:date` | — | `200` — một `BodyLogResponse` | `400` date sai · `404` ngày chưa ghi |
| `PUT` | `/:date` | JSON body `{ weightKg?, waistCm?, chestCm?, shoulderCm?, armCm?, note? }`, mỗi trường nhận số/chuỗi hoặc `null` | `200` — `BodyLogResponse` sau khi ghi (cả khi tạo mới) | `400` date hoặc body sai |
| `DELETE` | `/:date` | — | `204`, **body rỗng** | `400` date sai · `404` ngày chưa ghi |

Nguồn: `controllers/bodyLogs.controller.ts:23-42`.

### `BodyLogResponse`

```jsonc
{
  "date": "2026-08-06",        // chuỗi "YYYY-MM-DD", không phải Date
  "weightKg": 72.4,            // number | null
  "waistCm": 88,               // number | null
  "chestCm": 96,                // number | null
  "shoulderCm": 44,             // number | null
  "armCm": 28.5,                // number | null
  "note": "ổn",                // string | null
  "createdAt": "2026-08-06T01:12:33.041Z",  // ISO 8601 — dấu thời gian THẬT
  "updatedAt": "2026-08-06T01:12:33.041Z"
}
```

`userId` **cố ý không có mặt** — xem §5. Định nghĩa: `dtos/bodyLogs.response.ts:7-15`;
phép chiếu từ hàng DB: `services/bodyLogs.service.ts:9-18`. Test canh giữ điều này:
`bodyLogs.controller.test.ts:48-56`.

### Hình dạng lỗi

Do `shared/errors/errorHandler.ts` sinh ra, không phải feature này:

```jsonc
// 400 — ZodError
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ",
             "fields": [{ "path": "weightKg", "message": "..." }] } }

// 404 — AppError.notFound
{ "error": { "code": "NOT_FOUND", "message": "Chưa có số đo cho ngày 2026-08-05" } }
```

`path` trong `fields` là `issue.path.join('.')` (`errorHandler.ts:5-10`), nên lỗi ở
`:date` cho `path: "date"`, lỗi ở body cho `path: "weightKg"` / `"waistCm"` / `"chestCm"` /
`"shoulderCm"` / `"armCm"` / `"note"`.

## 3. Ràng buộc validate đang chạy

### `:date` — mọi route có tham số ngày

`bodyLogDateParamSchema` = `pastOrTodayDateString` (`dtos/bodyLogs.request.ts:14`):

1. Khớp `^\d{4}-\d{2}-\d{2}$`
2. Là ngày **có thật** — `2026-02-30` bị loại (`lib/time.ts:13-20`, so lại qua `toISOString`)
3. **Không ở tương lai** — so với `todayIso()` tính theo `Asia/Ho_Chi_Minh`, không dùng
   `new Date()` trần (`shared/validation/commonSchemas.ts:16-18`)

Ràng buộc 3 áp cho **cả `PUT`**: không ghi trước cho ngày mai
(`bodyLogs.controller.test.ts:228-234`, kèm assert `count === 0` — request bị chặn trước
khi chạm DB).

### Body của `PUT`

`upsertBodyLogSchema` (`dtos/bodyLogs.request.ts:24-33`):

| Trường | Ràng buộc | Nguồn |
|---|---|---|
| `weightKg` | `number`, `> 0`, `< 500`, hoặc `null` | `commonSchemas.ts:21` (`weightKgSchema`) |
| `waistCm` | `number`, `> 0`, `< 300`, hoặc `null` | `commonSchemas.ts:30` (`circumferenceCmSchema`) |
| `chestCm` | như `waistCm` | `commonSchemas.ts:30` |
| `shoulderCm` | như `waistCm` | `commonSchemas.ts:30` |
| `armCm` | như `waistCm` | `commonSchemas.ts:30` |
| `note` | `string`, **trim**, tối đa **1000** ký tự, hoặc `null` | `dtos/bodyLogs.request.ts:10-11` |
| trường lạ | **400** — `strictObject` | `dtos/bodyLogs.request.ts:25` |

Bốn vòng dùng **chung đúng một schema** (`circumferenceCmSchema`, `commonSchemas.ts:22-30`)
thay vì bốn schema gần-giống-nhau — có chủ ý: bốn schema riêng là bốn chỗ để lệch nhau về
sau, và trần chung `< 300` đã đủ chặn ca gõ nhầm điển hình (`30` thành `3000`) mà không cần
biết trước "vòng bắp tay tối đa hợp lý là bao nhiêu cm". Cái schema chung **không** chặn
được ca gõ nhầm `30` thành `80` — không schema nào chặn được ca đó.

Toàn bộ object là `.partial()` → mọi trường được phép vắng mặt, `{}` là body hợp lệ.

Biên là **chặt hai đầu**: `weightKg: 500` bị từ chối (`lt(500)`, không phải `lte`) —
test `bodyLogs.controller.test.ts:204-209`; `waistCm: 300` bị từ chối — test `:211-219`.
Kiểu cũng chặt: `weightKg: "72.4"` (chuỗi) là 400, Zod không ép kiểu (test `:221-226`).

### Query của `GET /`

`dateRangeSchema` (`commonSchemas.ts:34-43`):

- `from` và `to` **bắt buộc**, mỗi cái là `dateString` (định dạng + ngày có thật)
- `daysBetween(from, to) >= 0` → `from <= to`, lỗi gắn `path: 'from'`
- `daysBetween(from, to) < 730` → lỗi gắn `path: 'to'`

Lưu ý con số: điều kiện là **`< MAX_RANGE_DAYS`** chứ không phải `<=`, nên khoảng cách
lớn nhất được chấp nhận là **729 ngày**, tức 730 ngày lịch tính cả hai đầu mút. Cách đọc
này khớp với "khoảng tối đa 730 ngày" ở spec khi đếm bao gồm hai đầu.

`dateRangeSchema` dùng `z.object` chứ không `strictObject` → query thừa (ví dụ
`?from=…&to=…&limit=10`) bị **bỏ qua im lặng**, không 400. Đây là điểm bất đối xứng có
chủ ý so với body của `PUT`; xem §7.

## 4. Ngữ nghĩa upsert 3 trạng thái của `PUT /:date`, sáu khóa

Đây là phần khó nhất của feature, và là chỗ dễ regress nhất.

| Client gửi | Ý nghĩa | Kết quả |
|---|---|---|
| khóa **vắng mặt** | "tôi không nói gì về trường này" | giữ nguyên giá trị đang có trong DB |
| khóa có mặt, giá trị `null` | "xóa giá trị này" | ghi `null` |
| khóa có mặt, có giá trị | "đặt giá trị này" | ghi giá trị mới |

Test tương ứng: ca 1 `bodyLogs.controller.test.ts:127-138`, ca 2 `:140-153`,
ca 3 `:155-167`. Hệ quả: body `{}` là no-op, không xóa gì (`:169-178`).

### Vì sao `.partial()` một mình không đủ

Sau `.partial()`, Zod trả về một object mà **cả hai ca "vắng mặt" và "gửi `null` rồi bị
`.optional()` nuốt"** đều không phân biệt được nếu ta kiểm tra theo giá trị. Cụ thể, nếu
code viết `if (parsed.weightKg !== undefined)`, thì:

- vắng mặt → `parsed.weightKg === undefined` → bỏ qua ✔
- gửi `null` → `parsed.weightKg === null` → lọt qua ✔

Nhưng phép so sánh theo giá trị không nói được điều gì về **sự có mặt của khóa** — nó suy
đoán sự có mặt từ giá trị. Code chọn không suy đoán: nó soi trực tiếp raw body bằng
`in`:

```ts
// dtos/bodyLogs.request.ts:56, 71-84
const PATCH_KEYS = ['weightKg', 'waistCm', 'chestCm', 'shoulderCm', 'armCm', 'note'] as const;

for (const key of PATCH_KEYS) {
  if (!(key in raw)) continue;
  patch[key] = parsed[key] ?? null;
}
```

Comment tại `dtos/bodyLogs.request.ts:50-56` nêu rõ lý do: sau `.partial()` cả "vắng mặt"
và "gửi `undefined`" đều ra `undefined`, nên **kiểm tra theo giá trị sẽ biến ca 2 thành
ca 1** — người dùng bấm "xóa vòng bụng" và không có gì xảy ra.

`PATCH_KEYS` là **nguồn sự thật duy nhất** cho danh sách khóa (`dtos/bodyLogs.request.ts:56`):
trước khi có bốn vòng, mỗi khóa là một dòng `if` viết tay; với sáu khóa thì viết tay là sáu
cơ hội quên một dòng, mà quên một dòng ở đây nghĩa là trường đó **không bao giờ lưu được**
và không có lỗi nào báo. Thêm số đo mới = thêm vào mảng này, vào `upsertBodyLogSchema`
(§3), và vào `BodyLogUpsertPatch`.

Giá trị lấy từ `parsed` (đã qua trim với `note`), sự-có-mặt lấy từ `raw`. Hai nguồn khác
nhau, cố ý.

`?? null` chuẩn hóa `undefined` về `null` để `BodyLogUpsertPatch` chỉ còn hai trạng thái
khi tới repository: khóa có mặt (giá trị hoặc `null`) hoặc khóa không có mặt.

### Repository khai thác điều đó thế nào

```ts
// repositories/bodyLogs.repository.ts:38-42
prisma.bodyLog.upsert({
  where:  { userId_date: { userId, date } },
  create: { userId, date, ...patch },
  update: patch,
});
```

`patch` chỉ chứa khóa người gửi thực sự gửi lên, nên `update: patch` **tự nhiên** bỏ qua
trường vắng mặt — đó chính là ngữ nghĩa "giữ nguyên", không cần đọc-rồi-ghi. Ở nhánh
`create`, trường vắng mặt rơi về `null` theo schema Prisma (`weightKg Float?`), khớp với
test `bodyLogs.controller.test.ts:104-116` (`note: null` khi tạo mới mà không gửi `note`).

`PUT` trả `200` cho **cả** tạo mới lẫn cập nhật — không `201`. Controller không phân biệt
hai nhánh vì `prisma.upsert` không nói nó đã làm nhánh nào.

## 5. Cách ly `userId`

Khóa chính của `BodyLog` là **`@@id([userId, date])`** (`server/prisma/schema.prisma:33`),
không phải `date` một mình. `userId` là **tham số đầu tiên** của cả năm hàm repository:

- `findByDate(userId, date)` / `upsertByDate(userId, date, patch)` → `where: { userId_date: { userId, date } }`
- `findInRange(userId, from, to)` → `where: { userId, date: { gte, lte } }`
- `deleteByDate(userId, date)` → `where: { userId, date }`

Giá trị `userId` đến từ `req.user!.id`, do `requireAuth` gắn. `deleteMany` thay cho `delete` ở
hàm cuối vừa tránh phải bắt `P2025`, vừa **là lớp cách ly hàng**: `delete({ where: { date } })`
sẽ xóa bản ghi cùng ngày của người khác.

Bốn test canh giữ ranh giới này bằng cách chèn bản ghi của `'someone-else'` cùng ngày:
`GET /:date` trả 404 (`test:65-73`), `PUT` không đụng vào nó và tạo bản ghi thứ hai
(`test:180-192`), `DELETE` trả 404 và không xóa (`test:265-274`), `GET /` bỏ qua
(`test:327-341`). Chúng không phải test cho tính năng multi-user — chúng từng là bẫy chống
regression cho ngày thêm auth (auth nay đã xong).

## 6. Quyết định vượt spec

Spec §5 chỉ cho 4 dòng bảng và một bảng validate. Code phải chốt thêm những thứ sau.

### 6.1 `z.strictObject().partial()` cho body `PUT`

**Quyết định:** trường lạ trong body → `400`, không bỏ qua im lặng.
`dtos/bodyLogs.request.ts:25`, test `bodyLogs.controller.test.ts:236-243`.

**Vì sao:** comment tại `:20-22` nói thẳng — với ngữ nghĩa "vắng mặt = giữ nguyên", một
lỗi gõ sai tên trường (`{ weight: 72 }` thay vì `{ weightKg: 72 }`) sẽ trở thành một body
hợp lệ **không chứa trường nào**, tức một no-op trả `200`. Người dùng thấy `200`, tin là
đã lưu, và không bao giờ phát hiện ra. Ở một endpoint mà "không có gì" là một câu trả lời
hợp lệ, sự nghiêm ngặt là thứ duy nhất phân biệt được "tôi cố ý không gửi" với "tôi gõ
sai".

Đây là lý do vì sao `PUT` nghiêm ngặt còn `GET /` thì không: query thừa của `GET` không
thể bị hiểu nhầm thành một thao tác ghi.

### 6.2 `DELETE` trả `204` chứ không `200` + body

**Quyết định:** `res.status(204).end()` (`controllers/bodyLogs.controller.ts:41`), test
`bodyLogs.controller.test.ts:247-256`.

**Vì sao:** không còn tài nguyên để trả — bản ghi vừa bị xóa. Trả `200 {}` hoặc
`200 { deleted: true }` là bịa ra một hình dạng response mà client phải parse để biết
điều mà status code đã nói. `204` là mã tiêu chuẩn cho "làm xong, không có gì để gửi".

### 6.3 Response có `createdAt`/`updatedAt`, không có `userId`

**Quyết định:** `dtos/bodyLogs.response.ts:7-15`.

**Vì sao (`userId` bị cắt):** comment tại `:1-6` — `userId` là **chi tiết lưu trữ**, không
phải thứ client cần biết. Trong bản một-người-dùng nó luôn là hằng `'local'`, gửi ra chỉ
làm client sinh thói quen phụ thuộc vào một giá trị sẽ đổi khi có auth.

**Vì sao (`createdAt`/`updatedAt` được giữ):** chúng trả lời một câu hỏi mà `date` không
trả lời được — "tôi cân lúc nào" khác "số đo này thuộc ngày nào". `date` là một ngày trên
lịch, `updatedAt` là một thời điểm thật. Comment tại `:12` gọi ra sự phân biệt này. Với
một app ghi tay, "bản ghi này sửa lần cuối lúc nào" là thông tin có ích khi người dùng
nghi ngờ dữ liệu của chính mình.

Chú ý kiểu: chúng là **chuỗi ISO 8601**, không phải `Date` — service gọi
`.toISOString()` (`services/bodyLogs.service.ts:15-16`) thay vì để `JSON.stringify` tự
làm, để kiểu trong `BodyLogResponse` khai đúng là `string`.

### 6.4 Repository dùng `deleteMany` thay `delete`

**Quyết định:** `repositories/bodyLogs.repository.ts:49-52`, trả `boolean` từ
`result.count > 0`.

**Vì sao:** comment tại `:47-48` — `prisma.delete` **ném `P2025`** khi không có bản ghi.
Dùng nó có nghĩa là phải `try/catch` một lỗi Prisma và soi `error.code` chỉ để phân biệt
"không tìm thấy" khỏi "DB hỏng". `deleteMany` trả `{ count: 0 }` — một giá trị bình
thường cho một tình huống bình thường. Repository trả `boolean`, service dịch `false`
thành `AppError.notFound` (`services/bodyLogs.service.ts:39-42`). Không có mã lỗi của
tầng ORM nào rò rỉ lên trên.

Đánh đổi: `deleteMany` không dùng chỉ mục khóa chính theo cùng cách `delete` dùng. Với
một bảng cỡ vài nghìn dòng trên SQLite localhost, không đáng bận tâm.

### 6.5 Trần 1000 ký tự cho `note`

**Quyết định:** `MAX_NOTE_LENGTH = 1000` (`dtos/bodyLogs.request.ts:10-11`).

**Vì sao:** comment tại `:9` — "spec không chốt giới hạn, đặt trần để không nuốt cả file".
Không có trần thì một `PUT` duy nhất có thể nhét megabyte vào SQLite. 1000 ký tự là trần
"đủ rộng cho mọi ghi chú thật, đủ hẹp để không phải là kênh lưu trữ". Kèm `.trim()`, nên
khoảng trắng thừa không tính vào hạn mức và không vào DB.

Không có test cho ranh giới 1000 ký tự — xem `PLAN.md` §4.

### 6.6 Không `try/catch` trong controller

**Quyết định:** `controllers/bodyLogs.controller.ts:9-15`.

**Vì sao:** Express 5 tự đẩy lỗi từ handler async sang error middleware — không cần
`express-async-errors`. Controller chỉ `.parse()` và để `ZodError` bay lên;
`errorHandler` dịch thành `400` kèm danh sách trường. Bọc `try/catch` ở đây chỉ tạo cơ hội
nuốt lỗi và làm mất `issue.path`.

### 6.7 Validate `:date` trước body

**Quyết định:** `controllers/bodyLogs.controller.ts:33-35`, comment ghi rõ chủ ý.

**Vì sao:** ngày tương lai phải bị chặn kể cả khi body cũng hỏng. Nếu validate body trước,
`PUT /2099-01-01` với `{ weightKg: -5 }` sẽ báo lỗi `weightKg` và giấu mất lỗi nghiêm
trọng hơn. Hệ quả: lỗi `:date` và lỗi body **không bao giờ gộp chung** trong một response
— xem `PLAN.md` §4.

### 6.8 `GET /` trả mảng trần

**Quyết định:** `res.json(await service.listInRange(range))` → JSON array, không bọc
`{ data: [...] }` (`controllers/bodyLogs.controller.ts:25`), test `:300-304`.

**Vì sao:** không có phân trang, không có metadata để mang theo — khoảng đã bị chặn ở 730
ngày nên response có trần tự nhiên. Một bao bì rỗng chỉ thêm một tầng `.data` cho mọi
người gọi.

## 7. Bất đối xứng có chủ ý giữa các endpoint

| | body `PUT` | query `GET /` |
|---|---|---|
| Trường lạ | `400` | bỏ qua |
| Ngày tương lai | bị chặn (`pastOrTodayDateString`) | **được chấp nhận** (`dateString`) |

Cả hai chênh lệch đều bắt nguồn từ cùng một nguyên tắc: **đầu vào ghi thì nghiêm, đầu vào
đọc thì rộng**. Một `to` ở tương lai chỉ đơn giản trả về ít dữ liệu hơn; một trường lạ ở
body ghi thì âm thầm mất dữ liệu. Chi tiết về `to` tương lai ở `PLAN.md` §4.

## 8. Chỗ code lệch spec §5

| # | Spec §5 nói | Code làm | Đánh giá |
|---|---|---|---|
| 1 | Không nói gì về trường lạ trong body | `400` (`strictObject`) | **Chặt hơn spec.** Có chủ ý, xem §6.1 |
| 2 | Không nói status của `DELETE` | `204` | **Spec im lặng**, code chốt. Xem §6.2 |
| 3 | Không mô tả hình dạng response của `/body-logs` | Có `createdAt`/`updatedAt`, không có `userId` | **Spec im lặng.** Xem §6.3 |
| 4 | Bảng validate không có dòng `note` | Trim + tối đa 1000 ký tự | **Chặt hơn spec.** Xem §6.5 |
| 5 | `date` "không được ở tương lai" | Áp cho `:date`; **không** áp cho `from`/`to` | Đọc sát chữ thì spec tách riêng dòng `from`/`to` (chỉ đòi hợp lệ, `from<=to`, ≤730 ngày) nên **không lệch**. Nhưng đây là chỗ dễ hiểu nhầm — ghi lại ở `PLAN.md` §4 |
| 6 | "khoảng tối đa 730 ngày" | `daysBetween < 730` → chênh lệch tối đa 729 ngày | **Khớp** nếu đếm bao gồm hai đầu mút (730 ngày lịch). Lệch nếu đọc "730" là chênh lệch |
| 7 | Không nói status của `PUT` khi tạo mới | `200` cho cả tạo lẫn sửa, không `201` | **Spec im lặng.** Xem §4 |

Không có mục nào code **lỏng hơn** spec về mặt validate.

## 9. Tham chiếu

- Code: `server/src/features/bodyLogs/`
- Test: `server/test/features/bodyLogs/bodyLogs.controller.test.ts` (44 test)
- Schema chung: `server/src/shared/validation/commonSchemas.ts`
- Lỗi: `server/src/shared/errors/AppError.ts`, `errorHandler.ts`
- Ngày tháng: `server/src/lib/time.ts` — TZ `Asia/Ho_Chi_Minh`
- Spec gốc: `docs/archive/2026-08-06-original-design.md` §5
- Trạng thái & nợ kỹ thuật: `PLAN.md` cùng thư mục
