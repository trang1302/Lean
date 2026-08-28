# Feature `body-logs` — Trạng thái triển khai

## 1. Trạng thái: ĐÃ XONG

| | |
|---|---|
| Trạng thái | **Hoàn thành** |
| Ngày hoàn thành | 2026-08-07 |
| Test | **31/31 pass** — `server/test/features/bodyLogs/bodyLogs.controller.test.ts` |
| Typecheck | sạch (`tsc --noEmit`) |
| Code | 227 dòng src + 385 dòng test |

Phân bố 31 test theo endpoint:

| Nhóm | Số test | Dòng |
|---|---|---|
| `GET /:date` | 7 | `bodyLogs.controller.test.ts:31-101` |
| `PUT /:date` | 13 | `:103-244` |
| `DELETE /:date` | 4 | `:246-282` |
| `GET /?from=&to=` | 7 | `:284-385` |

Mọi mệnh đề hành vi trong `SPEC.md` đều truy được về một test trong danh sách này, trừ
những chỗ ghi rõ là chưa có test ở §4 dưới đây.

## 2. File đã tạo

### Lớp DTO — hình dạng vào/ra

| File | Dòng | Vai trò |
|---|---|---|
| `server/src/features/bodyLogs/dtos/bodyLogs.request.ts` | 66 | `bodyLogDateParamSchema` cho `:date`; `bodyLogRangeQuerySchema` cho `?from=&to=`; `upsertBodyLogSchema` (`strictObject().partial()`) và **`parseUpsertBodyLog()`** — hàm giữ ngữ nghĩa 3 trạng thái bằng cách soi `key in rawBody`. Cũng chốt `MAX_NOTE_LENGTH = 1000`. |
| `server/src/features/bodyLogs/dtos/bodyLogs.response.ts` | 15 | `BodyLogResponse` — hợp đồng ra. Không có `userId`, `createdAt`/`updatedAt` khai kiểu `string`. |

### Lớp Controller — HTTP

| File | Dòng | Vai trò |
|---|---|---|
| `server/src/features/bodyLogs/controllers/bodyLogs.controller.ts` | 43 | `registerBodyLogsRoutes(router)` gắn 4 route. Chỉ validate → gọi service → chọn status. Không `try/catch` (Express 5 tự đẩy lỗi). Chọn `204` cho `DELETE`. |
| `server/src/features/bodyLogs/index.ts` | 8 | Tạo `Router`, gọi `registerBodyLogsRoutes`, export `bodyLogsRouter`. `app.ts` mount ở `/api/body-logs`. Tên export theo khuôn chung của 5 feature — đổi là phải sửa `app.ts`. |

### Lớp Service — nghiệp vụ

| File | Dòng | Vai trò |
|---|---|---|
| `server/src/features/bodyLogs/services/bodyLogs.service.ts` | 42 | `toResponse()` cắt `userId` và đổi `Date` sang ISO. `getByDate` / `removeByDate` ném `AppError.notFound`. `listInRange`, `upsertByDate` chuyển tiếp. Không chạm `prisma`. |

### Lớp Repository — dữ liệu

| File | Dòng | Vai trò |
|---|---|---|
| `server/src/features/bodyLogs/repositories/bodyLogs.repository.ts` | 53 | Lớp **duy nhất** import `prisma`. `whereKey()` gói `userId_date`. `findByDate`, `findInRange` (inclusive, `orderBy date asc`), `upsertByDate`, `deleteByDate` (dùng `deleteMany`, trả `boolean`). Mọi truy vấn mang `userId` — tham số đầu tiên. |

### Test

| File | Dòng | Vai trò |
|---|---|---|
| `server/test/features/bodyLogs/bodyLogs.controller.test.ts` | 385 | 31 test đi qua supertest → toàn bộ 4 lớp → DB test thật. Ngày neo theo `todayIso()` chứ không hardcode (`:12-18`) vì `pastOrTodayDateString` từ chối ngày tương lai — chuỗi cố định sẽ hỏng khi lịch chạy qua nó. |

### File dùng chung feature này dựa vào (KHÔNG do feature tạo)

`server/src/shared/validation/commonSchemas.ts` · `server/src/shared/errors/AppError.ts` ·
`server/src/shared/errors/errorHandler.ts` · `server/src/shared/rbac/permissionRegistry.ts` ·
`server/src/lib/time.ts` · `server/src/lib/db.ts` · `server/prisma/schema.prisma` (model
`BodyLog`) · `server/src/app.ts` (mount router).

## 3. Lệnh verify

Chạy từ `server/`.

```bash
# Chỉ suite body-logs, DB riêng để không giẫm lên suite khác
DATABASE_URL=file:./test-bodylogs.db npx vitest run test/features/bodyLogs

# Toàn bộ test server (fileParallelism đã tắt trong vitest.config.ts)
npm test

# Typecheck, không sinh file
npm run typecheck        # = tsc --noEmit
```

Trên PowerShell:

```powershell
$env:DATABASE_URL = 'file:./test-bodylogs.db'; npx vitest run test/features/bodyLogs
```

Kỳ vọng: `Test Files 1 passed (1)` · `Tests 31 passed (31)`.

Lưu ý: `vitest.config.ts` mặc định `DATABASE_URL=file:./test.db` và `globalSetup` đẩy
schema vào đó. **Không** trỏ vào `data.db` — các test gọi `deleteMany()` ở `beforeEach`
và sẽ xóa sạch dữ liệu sức khỏe thật.

## 4. Việc còn treo / nợ kỹ thuật

### 4.1 `GET /?to=` chấp nhận ngày ở tương lai — **lựa chọn**

`dateRangeSchema` dựng trên `dateString` chứ không `pastOrTodayDateString`
(`shared/validation/commonSchemas.ts:35`), trong khi `:date` dùng bản chặn tương lai
(`dtos/bodyLogs.request.ts:14`). Nên `GET /api/body-logs?from=2026-01-01&to=2099-12-31`
trả `200` với mảng dữ liệu tới hiện tại.

Đây là **lựa chọn**, không phải thiếu sót: một khoảng đọc kéo dài sang tương lai chỉ đơn
giản không có dữ liệu ở phần đuôi, không gây hại gì. Chặn nó sẽ buộc client phải tự kẹp
`to` về hôm nay trước mỗi lần gọi. Ràng buộc thực sự bảo vệ hệ thống là trần 730 ngày,
và nó vẫn áp dụng.

Rủi ro còn lại: một bug ở client gửi `to` sai (ví dụ `+1 năm` do lỗi múi giờ) sẽ không bị
phát hiện. Chấp nhận được ở bối cảnh một máy, một người dùng.

### 4.2 Lỗi `:date` và lỗi body không gộp chung — **lựa chọn có giá**

Controller validate `:date` trước rồi mới tới body (`controllers/bodyLogs.controller.ts:34-35`).
`PUT /api/body-logs/2099-01-01` với body `{ weightKg: -5 }` trả `400` **chỉ nêu lỗi
`date`**; sửa xong ngày rồi gọi lại mới thấy lỗi `weightKg`.

Đây là **lựa chọn có chủ ý** (comment tại `:33`): ngày tương lai phải bị chặn kể cả khi
body hỏng, và nếu validate body trước thì lỗi nghiêm trọng hơn sẽ bị lỗi nhẹ hơn che mất.

Giá phải trả: form trên web có thể phải qua hai vòng để thấy hết lỗi. Nếu sau này thấy khó
chịu, cách sửa là gộp `params` và `body` vào **một** schema rồi `.parse()` một lần — Zod
sẽ trả cả hai nhóm `issue`. Chưa làm vì hiện chỉ có một màn hình nhập và nó đã kẹp ngày ở
UI.

### 4.3 `note: ""` được chấp nhận và lưu như chuỗi rỗng — **thiếu sót nhỏ**

`noteSchema = z.string().trim().max(1000)` (`dtos/bodyLogs.request.ts:11`) — **không có**
`.min(1)`. Nên `{ "note": "" }` và `{ "note": "   " }` (trim thành `""`) đều hợp lệ và ghi
chuỗi rỗng vào DB, khác với `null`.

Hệ quả: client phải xử lý cả `null` lẫn `""` khi hiển thị, và "xóa ghi chú" có hai cách
làm ra hai giá trị khác nhau. Nên chuẩn hóa: hoặc `.min(1)` để từ chối, hoặc transform
`"" → null` trong `parseUpsertBodyLog`. Chưa có test bao phủ ca này.

### 4.4 Thiếu test cho vài ranh giới — **thiếu sót**

Đang thiếu:

- Ranh giới `MAX_NOTE_LENGTH`: 1000 ký tự pass / 1001 ký tự trả 400 (`dtos/bodyLogs.request.ts:10-11`)
- `.trim()` của `note` thực sự cắt khoảng trắng trước khi lưu
- `createdAt`/`updatedAt` có mặt và đúng dạng ISO 8601 trong response
- `updatedAt` **thay đổi** còn `createdAt` **giữ nguyên** sau lần `PUT` thứ hai — đây là
  mệnh đề duy nhất chứng minh cột `@updatedAt` của Prisma hoạt động
- Ranh giới `MAX_RANGE_DAYS`: chênh lệch 729 ngày pass / 730 ngày trả 400. Test hiện tại
  dùng `-800` nên không chạm biên (`bodyLogs.controller.test.ts:374-384`)
- `PUT` **không kèm body** (không `Content-Type: application/json`). Express 5 để
  `req.body` là `undefined`, `strictObject.parse(undefined)` sẽ ném `ZodError` → `400`.
  Suy ra từ code, **chưa xác minh bằng test** — cần chạy thật để chốt.

Không cái nào là bug đã biết; đều là mệnh đề đúng nhưng chưa có ai canh giữ.

### 4.5 Bất đối xứng strict giữa body và query — **lựa chọn**

`upsertBodyLogSchema` dùng `strictObject` (trường lạ → 400), `dateRangeSchema` dùng
`z.object` (query thừa bị bỏ qua). Lý do ở `SPEC.md` §6.1: đầu vào **ghi** thì nghiêm vì
gõ sai làm mất dữ liệu âm thầm; đầu vào **đọc** thì rộng vì query thừa không gây hại.

Nếu sau này thấy `?form=…` (gõ sai `from`) khó debug thì đổi `dateRangeSchema` sang
`strictObject` — nhưng lưu ý schema này **dùng chung** với `summary`, đổi là ảnh hưởng cả
hai feature.

### 4.6 `asRecord()` có nhánh gần như chết — **dọn dẹp, độ ưu tiên thấp**

`asRecord` (`dtos/bodyLogs.request.ts:44-48`) trả `{}` cho input không phải object thuần.
Nhưng nó chỉ được gọi **sau** `upsertBodyLogSchema.parse(rawBody)` đã thành công, mà phép
parse đó đã loại mọi thứ không phải object. Nhánh phòng thủ này không bao giờ chạy trong
luồng hiện tại. Vô hại — giữ lại thì `parseUpsertBodyLog` an toàn nếu ai đó đảo thứ tự hai
dòng; xóa đi thì bớt một hàm. Không gấp.

### 4.7 `deleteMany` không dùng khóa chính như `delete` — **đánh đổi đã cân nhắc**

`repositories/bodyLogs.repository.ts:49-51` dùng `deleteMany` với `where` phẳng thay vì
`delete` với khóa hợp thành, đổi hiệu năng lấy việc không phải bắt `P2025`. Với bảng cỡ
vài nghìn dòng trên SQLite localhost, chênh lệch không đo được. Không cần làm gì.

## 5. Ràng buộc khi sửa feature này

- **Không** đưa `prisma` ra ngoài `repositories/`.
- **Không** đổi `parseUpsertBodyLog` sang kiểm tra `!== undefined` — sẽ phá ca 2 của upsert
  (gửi `null` để xóa). Xem `SPEC.md` §4.
- **Không** bỏ `userId` khỏi bất kỳ `where` nào, kể cả khi thấy thừa. Bốn test cách ly user
  sẽ đỏ, và đó là điều đúng.
- Mọi phép tính thống kê thuộc `shared/stats/`, không thuộc feature này.
- Ngày tháng luôn là chuỗi `"YYYY-MM-DD"`; mọi thao tác đi qua `lib/time.ts`.
