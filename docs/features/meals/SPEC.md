# Feature `meals` — Ghi bữa ăn

Tài liệu này mô tả **hành vi thật của code đang chạy**, không phải ý định ban đầu. Nguồn chân lý là `server/src/features/meals/` và 38 test ở `server/test/features/meals/meals.controller.test.ts`. Chỗ nào code lệch với spec gốc (`docs/archive/2026-08-06-original-design.md` §5) đều được nêu rõ ở §5.

Liên quan: [`PLAN.md`](PLAN.md) (trạng thái triển khai, nợ kỹ thuật).

---

## 1. Phạm vi

Feature này lo **một nửa dữ liệu vào của app**: các bữa ăn người dùng tự gõ tay (tên món + calo), phân theo buổi, nhiều bữa mỗi ngày. Nửa còn lại là `body-logs` (cân nặng, vòng bụng — 1 bản ghi/ngày).

Khác biệt cấu trúc quan trọng so với `body-logs`, và nó chi phối gần như mọi quyết định thiết kế bên dưới:

| | `body-logs` | `meals` |
|---|---|---|
| Khóa định danh | `date` (1 bản ghi/ngày) | `id` (cuid, nhiều bản ghi/ngày) |
| Ghi dữ liệu | `PUT` upsert theo ngày | `POST` tạo mới, `PATCH`/`DELETE` theo `id` |
| Rủi ro bảo mật | thấp — `date` luôn đi kèm `userId` | **cao** — `id` là cuid toàn cục, xem §6 |

`meals` **không** tính toán gì. Tổng calo theo ngày, trung bình calo tuần, `mealCount` đều thuộc feature `summary`; feature này chỉ CRUD. Ranh giới đó là cố ý: `stats` phải test được mà không đụng DB.

Router được cắm ở `server/src/app.ts:22` với prefix `/api/meals`; đường dẫn khai báo trong controller là tương đối (`server/src/features/meals/index.ts:5-7`).

## 2. Bảng endpoint

Mọi response lỗi theo hình dạng chung của `server/src/shared/errors/errorHandler.ts`:

```jsonc
// 400
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ",
             "fields": [{ "path": "calories", "message": "..." }] } }
// 404
{ "error": { "code": "NOT_FOUND", "message": "Không tìm thấy bữa ăn có id ..." } }
```

| Method | Path | Request | Thành công | Lỗi |
|---|---|---|---|---|
| `GET` | `/api/meals?date=` | query `date` (bắt buộc) | `200` + `MealResponse[]` | `400` thiếu/sai `date` |
| `POST` | `/api/meals` | body `{ date, slot, name, calories, note? }` | `201` + `MealResponse` | `400` |
| `PATCH` | `/api/meals/:id` | body partial `{ date?, slot?, name?, calories?, note? }` | `200` + `MealResponse` | `400` body sai · `404` id không thuộc user |
| `DELETE` | `/api/meals/:id` | — | `204`, body rỗng | `404` id không thuộc user |

### `MealResponse`

Định nghĩa tại `server/src/features/meals/dtos/meals.response.ts:4-14`, dựng bởi `toMealResponse` (dòng `23-34`).

```jsonc
{
  "id": "clx…",              // cuid
  "date": "2026-08-01",      // "YYYY-MM-DD", KHÔNG phải DateTime
  "slot": "breakfast",       // breakfast | lunch | dinner | snack
  "name": "Phở",
  "calories": 450,
  "note": null,              // string | null
  "createdAt": "2026-08-01T02:11:43.512Z",   // ISO 8601
  "updatedAt": "2026-08-01T02:11:43.512Z"
}
```

**`userId` không bao giờ xuất hiện trong response** — xem §4 và §6.

### Hành vi từng endpoint

**`GET /api/meals?date=`** (`controllers/meals.controller.ts:25-28`)

- Trả mảng các bữa ăn của người đang gọi trong đúng ngày đó, sắp xếp `createdAt` tăng dần (`repositories/meals.repository.ts:37`).
- Ngày chưa ghi bữa nào → `200 []`, **không phải `404`**. Đây là danh sách, danh sách rỗng là trạng thái hợp lệ.
- Bữa ăn của `userId` khác → không lọt vào kết quả (`repositories/meals.repository.ts:35`), test dòng `90-97`.
- Nhiều bữa cùng ngày cùng `slot` đều tồn tại song song, không đè lên nhau — không có ràng buộc unique nào trên `(userId, date, slot)` trong `prisma/schema.prisma:37-49`.

**`POST /api/meals`** (`controllers/meals.controller.ts:30-33`)

- Tạo bản ghi mới, `id` do Prisma sinh (`cuid()`), trả `201`.
- `userId` luôn được server gán từ phiên (`req.user!.id`, truyền xuống service làm tham số đầu tiên); trường `userId` client gửi lên bị Zod loại bỏ (schema không `.strict()` nên khóa lạ bị *strip*, không báo lỗi) — test dòng `260-274`.
- `note` vắng mặt → lưu `null` (`repositories/meals.repository.ts:53`).

**`PATCH /api/meals/:id`** (`controllers/meals.controller.ts:35-41`)

- Partial thật: trường vắng mặt là **không đổi**, Prisma bỏ qua `undefined` (`repositories/meals.repository.ts:75-81`).
- Chỉ `note` nhận `null` (= xóa ghi chú). `name: null`, `slot: null`, `date: null`, `calories: null` đều `400` vì cột DB là `NOT NULL` (`dtos/meals.request.ts:44-50`, test dòng `387-394`).
- **Body được validate trước `:id`** (`controllers/meals.controller.ts:38-39`). Id sai + body sai → `400`, không phải `404`: người dùng cần biết dữ liệu mình gõ sai trước đã. Test dòng `407-412` khóa hành vi này.
- Không tìm thấy hoặc thuộc user khác → `404`, và bản ghi **không bị đụng tới** (test dòng `322-335`).

**`DELETE /api/meals/:id`** (`controllers/meals.controller.ts:43-47`)

- Thành công → `204` không body (`res.status(204).end()`).
- **Không idempotent**: xóa lần hai → `404` (test dòng `437-442`). Chọn `404` thay vì `204` để phân biệt "vừa xóa xong" với "id này chưa từng thuộc về bạn" — thông tin đó có ích cho UI khi hai tab cùng mở.

## 3. Ràng buộc validate đang chạy

Đọc từ `server/src/features/meals/dtos/meals.request.ts` và `server/src/shared/validation/commonSchemas.ts`.

| Trường | Schema | Ràng buộc | Nguồn |
|---|---|---|---|
| `date` (query GET) | `dateString` | `YYYY-MM-DD` **và** là ngày có thật (loại `2026-02-30`). **Không** chặn tương lai | `commonSchemas.ts:8-10`, dùng ở `meals.request.ts:25` |
| `date` (body POST/PATCH) | `pastOrTodayDateString` | như trên **+ `<= todayIso()`** theo `Asia/Ho_Chi_Minh` | `commonSchemas.ts:16-18` |
| `slot` | `slotSchema` | enum `breakfast \| lunch \| dinner \| snack` | `commonSchemas.ts:25` |
| `name` | `mealNameSchema` | `.trim()` rồi `min(1).max(200)` — trim chạy **trước** khi kiểm, nên `"  Bún bò  "` được lưu thành `"Bún bò"`, còn `"   "` bị từ chối | `commonSchemas.ts:24` |
| `calories` | `caloriesSchema` | số **nguyên**, `0 <= x <= 20000`. Biên đóng cả hai đầu: `0` và `20000` đều hợp lệ | `commonSchemas.ts:23` |
| `note` | `noteSchema` | `z.string().trim().nullable()`, **không giới hạn độ dài**. Optional ở cả POST và PATCH | `meals.request.ts:14` |
| `:id` | `mealIdParamSchema` | chuỗi không rỗng. Không kiểm định dạng cuid | `meals.request.ts:53-55` |

Điểm dễ hiểu nhầm:

- Kiểu dữ liệu là **strict**: `calories: "450"` (chuỗi) bị từ chối, Zod không ép kiểu.
- Nhiều trường sai cùng lúc → `fields` liệt kê **đủ tất cả**, không dừng ở lỗi đầu tiên (test dòng `251-258`). Zod thu toàn bộ `issues`, `errorHandler.ts:5-10` map từng cái thành `{ path, message }`.
- `path` trong `fields` là chuỗi đã join bằng `.` (`errorHandler.ts:7`) — với `meals` luôn phẳng nên chỉ là tên trường.
- Validate thất bại thì **không có gì chạm DB** (test dòng `190`, `229`, `347-356`) — parse xảy ra trước mọi lời gọi service.

## 4. Quyết định vượt spec

Spec gốc §5 chỉ có 4 dòng bảng cho `meals`. Những gì dưới đây là quyết định của code, không có trong spec. Mỗi mục ghi rõ **quyết định gì** và **vì sao**.

### 4.1 `GET /?date=` dùng `dateString`, không dùng `pastOrTodayDateString`

Bảng "Quy tắc validate" của spec §5 nói `date` "không được ở tương lai" mà không phân biệt ngữ cảnh. Code cố ý áp ràng buộc đó **chỉ cho ngày được GHI vào bản ghi** — tức body của `POST` và `PATCH` — chứ không cho bộ lọc đọc.

Hỏi `GET /api/meals?date=2030-01-01` trả `200 []`, không phải `400` (`dtos/meals.request.ts:19-26`).

**Vì sao:** ràng buộc "không ở tương lai" tồn tại để chặn dữ liệu vô nghĩa lọt vào DB — không ai ăn bữa của ngày mai. Một thao tác chỉ-đọc thì không tạo ra dữ liệu vô nghĩa nào; câu trả lời đúng cho "ngày mai tôi ăn gì" là "chưa có gì". Trả `400` ở đây buộc frontend phải tự chặn nút "ngày sau" bằng logic riêng thay vì cứ hiển thị danh sách rỗng. Đây là lệch có chủ đích so với spec, ghi lại ở §5.

### 4.2 `POST` trả `201`, `DELETE` trả `204`

Spec không nêu mã trạng thái thành công. Code chọn `201 Created` cho POST kèm bản ghi vừa tạo (`controllers/meals.controller.ts:32`), `204 No Content` cho DELETE với body rỗng (dòng `46`).

**Vì sao:** `201` kèm body cho phép client biết `id` vừa sinh mà không phải `GET` lại — bắt buộc, vì `id` do server sinh và UI cần nó ngay để render nút sửa/xóa. `204` cho DELETE vì không còn gì có nghĩa để trả; trả `200 {}` chỉ tạo cảm giác có dữ liệu. Test dòng `422-423` khóa cả status lẫn body rỗng.

### 4.3 Response map từng trường, không spread

`toMealResponse` liệt kê tay 8 trường thay vì `return { ...meal }` (`dtos/meals.response.ts:23-34`).

**Vì sao:** hai lý do, lý do thứ hai quan trọng hơn.

1. `userId` phải bị loại — nó là chi tiết nội bộ của tầng lưu trữ, client không cần và không được đặt nó.
2. **Cột thêm vào schema sau này không tự rò ra API.** Nếu spread, ngày ai đó thêm `Meal.internalNote` hay `Meal.importSource` vào `prisma/schema.prisma` thì trường đó lập tức xuất hiện trong mọi response mà không ai review nhận ra. Map tay biến "lộ trường mới" thành một hành động phải cố ý làm.

`createdAt`/`updatedAt` được chuyển `Date` → ISO 8601 ngay tại đây (dòng `31-32`) để JSON không phụ thuộc vào cách `res.json()` serialize `Date`. Lưu ý sự bất đối xứng có chủ đích: `date` là chuỗi lịch `"YYYY-MM-DD"` (theo quy ước ngày tháng của `CLAUDE.md`), còn `createdAt`/`updatedAt` là **thời điểm** thật nên đúng là ISO datetime UTC.

### 4.4 `note` không giới hạn độ dài

`name` có `max(200)`, `note` thì không (`dtos/meals.request.ts:14`).

**Vì sao:** `name` hiển thị trong danh sách và trên tooltip biểu đồ — dài quá sẽ vỡ layout, nên giới hạn là ràng buộc trình bày. `note` là chỗ người dùng tự viết cho mình, không có chỗ nào render nó theo cách bị vỡ. Đây là app localhost một người dùng, không có bề mặt tấn công để phải chặn payload lớn. Nếu sau này mở ra mạng thì **đây là một trong những chỗ phải siết lại** cùng lúc với việc thêm auth.

### 4.5 `note` được `.trim()`, và hệ quả

`noteSchema` trim trước khi validate. Nhưng khác `name`, không có `.min(1)` sau đó — nên `note: "   "` **không bị từ chối**, nó trở thành chuỗi rỗng `""` và được lưu.

Đây là hệ quả không được test bao phủ. Xem `PLAN.md` §4 — ghi nhận là thiếu sót nhỏ, không phải lựa chọn.

### 4.6 `PATCH` với body rỗng được chấp nhận

`updateMealSchema` để mọi trường optional, nên `{}` parse thành công và đi thẳng xuống `updateMany` với `data` toàn `undefined` (`dtos/meals.request.ts:44-50`, `repositories/meals.repository.ts:73-82`). Kết quả: `200` kèm bản ghi nguyên vẹn.

**Vì sao:** PATCH rỗng đúng nghĩa là "không đổi gì" — đó là một yêu cầu hợp lệ, không phải lỗi client. Bắt nó `400` sẽ buộc frontend phải so sánh form với giá trị gốc trước khi gửi, tức là đẩy logic của server sang client mà chẳng bảo vệ được gì.

Có một tác dụng phụ: `updatedAt` vẫn bị `@updatedAt` của Prisma bump. Xem `PLAN.md` §4.

### 4.7 `createdAt`/`updatedAt` xuất hiện trong response

Spec không nhắc tới. Code trả ra vì UI cần thứ tự nhập trong ngày (`orderBy: createdAt`) và có thể muốn hiển thị "sửa lần cuối". Đi kèm cảnh báo ở `PLAN.md` §4 về độ tin cậy của `updatedAt`.

### 4.8 `MealRecord` khai lại tay thay vì import type của Prisma

`repositories/meals.repository.ts:11-21` định nghĩa lại hình dạng một hàng `Meal`.

**Vì sao:** type máy sinh nằm trong `src/generated/prisma` — thư mục gitignore, sinh lại mỗi lần `prisma generate`. Kết quả Prisma trả về vẫn khớp theo cấu trúc (structural typing), nên tầng service/dtos có type đầy đủ mà không phụ thuộc vào artifact build. Đổi lại: đổi schema mà quên sửa interface này thì TypeScript sẽ báo ở chỗ gán, không im lặng.

### 4.9 Không bọc `try/catch` trong controller

Express 5 tự chuyển lỗi từ handler async sang `errorHandler` (`controllers/meals.controller.ts:10-17`). `schema.parse()` ném `ZodError`, `errorHandler.ts:32` bắt và dịch thành `400`; service ném `AppError.notFound`, dòng `43` dịch thành `404`.

**Vì sao:** bọc `try/catch` chỉ để gọi `next(err)` là code thừa và là chỗ dễ vô tình nuốt lỗi. Không có `express-async-errors` trong `package.json` vì Express 5 không cần.

## 5. Chỗ code lệch spec gốc §5

| Spec §5 | Code | Đánh giá |
|---|---|---|
| Bảng validate: `date` "không được ở tương lai" (không phân biệt ngữ cảnh) | `GET /?date=` **không** chặn tương lai, chỉ POST/PATCH chặn | **Lệch có chủ đích**, lý do ở §4.1 |
| `GET /meals?date=` — "Bữa ăn của một ngày", không nói thứ tự | Sắp theo `createdAt` tăng dần | Bổ sung; xem `PLAN.md` §4 về việc đây có phải thứ tự đúng cho trang Hôm nay không |
| Không nêu mã trạng thái thành công | `201` cho POST, `204` cho DELETE | Bổ sung, §4.2 |
| Không mô tả hình dạng response của `meals` | Có `createdAt`/`updatedAt`, không có `userId` | Bổ sung, §4.3 và §4.7 |
| Bảng validate không có dòng nào cho `note` | `note` trim, nullable, không giới hạn độ dài | Bổ sung, §4.4 |
| Không nói `PATCH` xử lý `null` thế nào | Chỉ `note` nhận `null`; các trường khác `null` → `400` | Làm rõ. Khác `PUT /body-logs/:date` nơi `null` = xóa giá trị — ở đó các cột là nullable, ở đây thì không |

Không có chỗ nào code **mâu thuẫn** với spec; mọi khác biệt đều là làm rõ hoặc mở rộng có lý do.

## 6. Cách ly `userId` — phần quan trọng nhất

`userId` đến từ phiên đăng nhập, controller truyền xuống service làm tham số đầu tiên. **Mọi
truy vấn trong repository đều mang `userId`** — kể cả khi tra theo `id` vốn đã là khóa chính.
`Meal.id` là cuid toàn cục nên `where: { id }` trần chạm được bản ghi của người khác.

### Vì sao điều này bắt buộc với `meals` mà không bắt buộc với `body-logs`

`body-logs` định danh bằng `date`, và `date` một mình đã vô nghĩa nếu thiếu `userId` — không ai viết được câu truy vấn `where: { date }` mà tưởng nó an toàn. `Meal.id` thì khác: nó là **cuid toàn cục**, `where: { id }` trần *chạy được*, *trả đúng một bản ghi*, và *trông hoàn toàn hợp lý* — chỉ là nó có thể là bản ghi của người khác.

Giờ đã có nhiều người dùng qua auth: mỗi chỗ dùng `where: { id }` trần sẽ là **lỗ hổng cho phép sửa hoặc xóa bữa ăn của người dùng khác** chỉ bằng cách đoán hoặc lộ một `id`. Đó chính là lý do cột `userId` tồn tại từ đầu — trước cả khi có auth — và giờ là lớp cách ly bắt buộc, không phải tùy chọn.

### Cách code thực hiện: điều kiện nằm trong câu lệnh ghi

`repositories/meals.repository.ts` là **nơi duy nhất** trong feature được đụng `prisma` (dòng `23-31` ghi rõ điều này). Bốn hàm, bốn lần `userId`:

| Hàm | Truy vấn | Dòng |
|---|---|---|
| `findMealsByDate` | `findMany({ where: { userId, date } })` | `34-38` |
| `findMealById` | `findFirst({ where: { id, userId } })` | `42` |
| `updateMealById` | **`updateMany({ where: { id, userId } })`** | `73-82` |
| `deleteMealById` | **`deleteMany({ where: { id, userId } })`** | `90` |

Hai hàm ghi dùng `updateMany`/`deleteMany` — dạng số nhiều — **cho một thao tác trên đúng một bản ghi**. Đó không phải nhầm lẫn, đó là điểm mấu chốt.

Cách viết hiển nhiên hơn sẽ là kiểm rồi ghi:

```ts
// KHÔNG dùng cách này
const meal = await prisma.meal.findFirst({ where: { id, userId } });
if (!meal) return null;
return prisma.meal.update({ where: { id }, data });   // ← `userId` biến mất ở đây
```

Vấn đề: **câu lệnh ghi không mang điều kiện sở hữu.** Quyền sở hữu được kiểm ở câu lệnh trước đó, rồi lệnh ghi tin vào kết quả đã kiểm. Có một khe giữa lúc kiểm và lúc ghi — và quan trọng hơn cả khe thời gian, có một khe **trong mã nguồn**: dòng `update` tự nó không nói gì về `userId`, nên bất cứ ai refactor sau này (tách hàm, thêm một nhánh sớm `return`, di chuyển lệnh kiểm ra chỗ khác) đều có thể làm mất lớp bảo vệ mà không thấy mình đang làm gì sai. Đoạn `update` còn lại vẫn compile, vẫn chạy, vẫn qua mọi test hiện có — vì test hiện có chạy trên một người dùng duy nhất.

`updateMany`/`deleteMany` bỏ hẳn khe đó: điều kiện `{ id, userId }` là **một phần của chính câu lệnh ghi**, không thể tách rời nó. Không có bản ghi nào thuộc `userId` mang `id` đó thì `count === 0`, không dòng nào bị chạm.

Cái giá phải trả: `updateMany` chỉ trả về số dòng, nên phải đọc lại bản ghi sau đó (`repositories/meals.repository.ts:83-85`). Một truy vấn thêm để đổi lấy một bất biến không thể vô tình phá vỡ — đáng.

### Kết quả quan sát được từ ngoài

Truy cập bản ghi của user khác luôn là `404`, không phải `403`, và bản ghi **không hề bị đụng tới**:

- `services/meals.service.ts:27` — `updateMealById` trả `null` → `AppError.notFound`
- `services/meals.service.ts:34` — `deleteMealById` trả `false` → `AppError.notFound`
- Test dòng `322-335` (PATCH) và `444-452` (DELETE) kiểm tra cả status **lẫn** việc bản ghi trong DB vẫn nguyên vẹn.

`404` thay vì `403` là cố ý: `403` xác nhận "id này có tồn tại, chỉ là không phải của bạn" — một rò rỉ thông tin nhỏ. `404` không phân biệt "không tồn tại" với "không phải của bạn", và đó đúng là điều client cần biết.

### Auth đã thêm — thay đổi so với trước

**Đã làm (giai đoạn A).** Hàm `currentUserId()` bị xóa; bốn hàm service nhận `userId` làm tham
số đầu tiên. **Repository không phải sửa một dòng nào** — mọi hàm của nó đã nhận `userId` từ
đầu. Đó chính là khoản lãi của việc thêm cột `userId` ngay từ ngày đầu.

**Quy tắc bất di bất dịch cho feature này:** không bao giờ thêm một truy vấn `prisma.meal.*` nào mà `where` thiếu `userId`, và không bao giờ chuyển `updateMany`/`deleteMany` ở đây về `update`/`delete` "cho gọn".
