# Trang `web-today` — "Hôm nay"

> **Trạng thái: chưa có code.** Tài liệu này là *đặc tả định hướng* cho người implement,
> không phải mô tả hành vi đang chạy. Khác hẳn `docs/features/{body-logs,meals,summary}/SPEC.md`
> — những file đó đọc ngược từ code thật và là **ràng buộc cứng** với trang này.

Liên quan: [`PLAN.md`](PLAN.md) (kế hoạch thi công) ·
[`docs/archive/2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md) §7 (nguồn của bố cục) ·
[`docs/overview/01-architecture.md`](../../overview/01-architecture.md) (chỗ đặt file) ·
[`docs/overview/04-conventions.md`](../../overview/04-conventions.md) (hình dạng lỗi API).

---

## 1. Trang này để làm gì

Trang **mặc định** của app, và là trang duy nhất **ghi** dữ liệu vào hai bảng gốc.
Người dùng mở nó mỗi ngày một hoặc vài lần, mỗi lần vài chục giây:

- buổi sáng, sau khi cân → gõ cân nặng, thỉnh thoảng thêm vòng bụng;
- sau mỗi bữa → gõ tên món + calo;
- tối, nhớ ra hôm qua quên ghi → đổi bộ chọn ngày về hôm qua rồi nhập bù.

Hệ quả thiết kế: **tối ưu cho tốc độ nhập, không tối ưu cho việc xem.** Việc xem xu hướng
thuộc trang Biểu đồ. Thứ duy nhất mang tính "xem" ở đây là thẻ tổng calo hôm nay so với
mục tiêu ngày — nó trả lời câu hỏi *"tôi còn được ăn bao nhiêu nữa"*, tức vẫn là câu hỏi
phục vụ việc nhập.

Trang này **không** tính MA7, không tính tốc độ, không hiển thị tiến độ mục tiêu cân nặng.
Những thứ đó neo vào `shared/stats/` của server và hiển thị ở trang Biểu đồ.

## 2. Hợp đồng API

Backend đã xong (208 test pass). Mọi endpoint dưới đây đều truy được về SPEC của feature tương ứng.
**Không có endpoint nào khác được phép gọi từ trang này, và không được bịa thêm.**

| # | Gọi | Khi nào | Nguồn hợp đồng |
|---|---|---|---|
| 1 | `GET /api/body-logs/:date` | mỗi khi `date` đổi | [`body-logs/SPEC.md`](../body-logs/SPEC.md) §2 |
| 2 | `PUT /api/body-logs/:date` | blur ô cân nặng / vòng bụng | body-logs §2, §4 |
| 3 | `GET /api/meals?date=` | mỗi khi `date` đổi, và sau mỗi lần ghi bữa | [`meals/SPEC.md`](../meals/SPEC.md) §2 |
| 4 | `POST /api/meals` | bấm `[+]` ở form thêm nhanh | meals §2 |
| 5 | `PATCH /api/meals/:id` | sửa một bữa | meals §2 |
| 6 | `DELETE /api/meals/:id` | xóa một bữa | meals §2 |
| 7 | `GET /api/goal` | một lần khi mount | [`goal/SPEC.md`](../goal/SPEC.md) §2 |

Bảy lời gọi, ba trong số đó chạy khi mở trang (1, 3, 7). Ba cái đó độc lập nhau → chạy
song song, không xếp hàng.

### 2.1 `GET /api/body-logs/:date`

`200` → `BodyLogResponse`; **`404` khi ngày đó chưa ghi gì** — xem §6, đây là bẫy chính.

```jsonc
{ "date": "2026-08-06", "weightKg": 72.4, "waistCm": 88, "note": "ổn",
  "createdAt": "2026-08-06T01:12:33.041Z", "updatedAt": "2026-08-06T01:12:33.041Z" }
```

`weightKg`, `waistCm`, `note` đều `number|string | null`. Không có `userId` (body-logs §6.3).

### 2.2 `PUT /api/body-logs/:date`

Body `{ weightKg?, waistCm?, note? }`, mỗi trường nhận giá trị **hoặc `null`**, mọi trường
được phép vắng mặt. Trả `200` + `BodyLogResponse` sau khi ghi — **cả khi tạo mới**, không
`201`. Ngữ nghĩa 3 trạng thái ở §5.1; hình phạt cho trường lạ ở §5.2.

Ràng buộc đang chạy (body-logs §3): `weightKg` ∈ (0, 500) **mở hai đầu** · `waistCm` ∈ (0, 300)
mở hai đầu · `note` trim, ≤ 1000 ký tự · `:date` phải là ngày có thật và **không ở tương lai**
(so theo `Asia/Ho_Chi_Minh`). Kiểu **strict**: `weightKg: "72.4"` là `400`, Zod không ép kiểu.

### 2.3 `GET /api/meals?date=`

`200` + `MealResponse[]`, **rỗng là `200 []` chứ không phải `404`** (meals §2). Sắp theo
`createdAt` tăng dần — xem §5.3.

```jsonc
{ "id": "clx…", "date": "2026-08-01", "slot": "breakfast", "name": "Phở",
  "calories": 450, "note": null,
  "createdAt": "2026-08-01T02:11:43.512Z", "updatedAt": "2026-08-01T02:11:43.512Z" }
```

Query `date` ở đây dùng `dateString`, **không chặn tương lai** (meals §4.1) — hỏi ngày mai
trả `200 []`.

### 2.4 `POST /api/meals`

Body `{ date, slot, name, calories, note? }` — bốn trường đầu **bắt buộc**.
Trả **`201`** + `MealResponse` kèm `id` vừa sinh, nên không cần `GET` lại chỉ để biết `id`.

`slot` ∈ `breakfast | lunch | dinner | snack` · `name` trim rồi 1–200 ký tự · `calories`
số **nguyên** 0–20000 (biên **đóng** hai đầu, khác `weightKg`) · `date` **không được ở tương lai**.

### 2.5 `PATCH /api/meals/:id` · `DELETE /api/meals/:id`

`PATCH` body partial `{ date?, slot?, name?, calories?, note? }` → `200` + bản ghi mới.
**Chỉ `note` nhận `null`**; `name: null` / `slot: null` / `calories: null` / `date: null`
đều `400` (meals §2). `{}` hợp lệ, là no-op trả `200`.

`DELETE` → `204` không body. **Không idempotent**: xóa lần hai ra `404` (meals §2).

Cả hai: `id` không tồn tại (hoặc thuộc user khác) → `404`, bản ghi không bị đụng.
Riêng `PATCH`, **body được validate trước `:id`** — id sai + body sai cho `400`, không phải `404`.

### 2.6 `GET /api/goal`

Luôn `200`, không bao giờ `404`. Chưa đặt mục tiêu → mọi trường `null`:

```jsonc
{ "targetWeightKg": 68, "targetDate": "2099-12-31", "dailyCalorieTarget": 1900,
  "updatedAt": "2026-08-07T…Z" }
```

Trang này chỉ dùng `dailyCalorieTarget`. Ba trường còn lại bỏ qua.

### 2.7 Hình dạng lỗi (dùng chung, `04-conventions.md`)

```jsonc
// 400
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ",
             "fields": [{ "path": "weightKg", "message": "…" }] } }
// 404
{ "error": { "code": "NOT_FOUND", "message": "Chưa có số đo cho ngày 2026-08-05" } }
```

`path` là `issue.path.join('.')`. Với cả hai feature, payload đều phẳng nên `path` luôn là
đúng một tên trường: `date` · `weightKg` · `waistCm` · `note` · `slot` · `name` · `calories`.
Cách dùng bắt buộc ở §5.2.

## 3. Chỗ §7 mô tả một thứ mà API hiện tại KHÔNG cung cấp

Liệt kê đầy đủ. **Không cái nào được "sửa" bằng cách bịa endpoint mới** — mỗi cái kèm cách
xử lý đề nghị, và cái nào cần chốt với backend thì ghi rõ.

| # | §7 nói | API thật | Xử lý |
|---|---|---|---|
| 1 | "Danh sách bữa ăn **nhóm theo buổi**" | `GET /meals` sắp theo `createdAt`, không nhóm, không có khái niệm thứ tự buổi | Nhóm + sắp ở client. Xem §5.3 — **điểm cần chốt** |
| 2 | "tổng calo hôm nay" | Không endpoint nào trả tổng calo của một ngày ở dạng lẻ. `GET /summary?from=D&to=D` có `days[0].totalCalories`, nhưng kéo theo cả `weeks` và `goal` | Cộng ở client từ mảng `meals` — xem §7 câu hỏi 1 |
| 3 | "mục tiêu ngày" | `GET /goal` → `dailyCalorieTarget`, có thể `null` | Gọi `GET /api/goal`. `null` → không vẽ thanh tiến độ (§6) |
| 4 | "bộ chọn ngày để nhập bù" | Không có endpoint nào nói **hôm nay là ngày nào theo `Asia/Ho_Chi_Minh`**. Server chặn ngày tương lai bằng đồng hồ *của nó* | Client tự tính `todayIso()` từ đồng hồ máy. **Rủi ro thật**: máy đặt timezone lệch → client tưởng là hôm nay, server trả `400 date`. Xem §7 câu hỏi 4 |
| 5 | "Lưu tự động khi rời khỏi ô (blur)" | Không có gì để lo về concurrency — nhưng `PUT` trả `200` cho **cả** tạo mới lẫn cập nhật, client không biết được nó vừa tạo hay vừa sửa | Không cần biết. Chỉ hiển thị "Đã lưu" |
| 6 | "mỗi dòng có nút **sửa**/xóa" | `PATCH /meals/:id` có đủ — **không thiếu**. Nhưng §7 không tả UX sửa (inline hay modal) | §7 câu hỏi 2 |
| 7 | §7 không nhắc `note` | Cả `BodyLog` lẫn `Meal` đều **có** `note` trong hợp đồng | API rộng hơn §7. §7 câu hỏi 3 |
| 8 | "Xử lý trạng thái rỗng" | Mục này của §7 **chỉ nói về biểu đồ** ("Cần ít nhất 2 ngày dữ liệu…"), không nói gì về trang Hôm nay | Trang Hôm nay phải tự chốt — §6 |

Không có mục nào cần backend thêm endpoint mới. Mục 1 **có thể** cần backend đổi `orderBy`;
mục 4 **có thể** cần một endpoint trả `todayIso()` của server. Cả hai đều là câu hỏi mở, không
phải quyết định của tài liệu này.

## 4. Bố cục

Từ §7, từ trên xuống. Mỗi khối là một component riêng (xem `PLAN.md` §3).

```
┌──────────────────────────────────────────────┐
│ Ngày:  [ 2026-08-06 ▾ ]   (max = hôm nay)    │  ← DatePicker
├──────────────────────────────────────────────┤
│ Số đo                                        │  ← BodyLogForm
│  Cân nặng (kg) [ 72.4 ]  Vòng bụng (cm) [ 88 ]│
│  Để trống rồi rời ô để xóa giá trị.  Đã lưu ✓ │
├──────────────────────────────────────────────┤
│ Bữa ăn                                       │  ← MealList
│  Sáng   Phở bò            450   [sửa] [xóa]  │
│  Trưa   Cơm gà            620   [sửa] [xóa]  │
│  Tối    —                                     │
│  [Buổi ▾] [Tên món      ] [Calo] [ + ]       │  ← MealQuickAddForm
├──────────────────────────────────────────────┤
│ Tổng calo                                    │  ← CalorieSummaryCard
│  1070 / 1900                                 │
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░  56%                    │
└──────────────────────────────────────────────┘
```

Ràng buộc từng khối:

- **DatePicker** — `<input type="date">`, `max` = hôm nay tính ở client. Mặc định hôm nay.
  Đổi ngày → nạp lại (1) và (3); **không** nạp lại (7), mục tiêu không phụ thuộc ngày.
- **BodyLogForm** — hai ô số, `step="0.1"`. Ghi bằng `PUT` khi **blur**, không có nút Lưu.
  Mỗi ô ghi độc lập, mỗi lần blur là một request mang **đúng một khóa** (§5.1).
- **MealList** — nhóm theo buổi. Buổi rỗng: xem §6. Mỗi dòng có `sửa` và `xóa`.
- **MealQuickAddForm** — `[buổi ▾][tên món][calo][+]`. Sau khi `201`, xóa trắng `tên món`
  và `calo`, **giữ nguyên `buổi`** (người dùng thường nhập liền hai món cùng buổi), focus
  trả về ô `tên món`.
- **CalorieSummaryCard** — `tổng / mục tiêu` + thanh tiến độ. Vượt mục tiêu → đổi màu cảnh
  báo, **không** cắt thanh ở 100% một cách im lặng.

Không có tab điều hướng trong feature này — nó thuộc `web/src/router/` (chưa có).

## 5. Cạm bẫy bắt buộc xử lý

### 5.1 `PUT /body-logs/:date` là upsert **3 trạng thái** — gửi sai là mất dữ liệu

Hợp đồng (body-logs §4):

| Client gửi | Ý nghĩa | Kết quả trong DB |
|---|---|---|
| khóa **vắng mặt** | "tôi không nói gì về trường này" | giữ nguyên |
| khóa có mặt, `null` | "xóa giá trị này" | ghi `null` |
| khóa có mặt, có giá trị | "đặt giá trị này" | ghi giá trị |

Server phân biệt ba ca bằng toán tử `in` trên raw body, **không** bằng so sánh giá trị
(body-logs §4, `dtos/bodyLogs.request.ts:62-64`). Nghĩa là hợp đồng này thật và chặt — và
chính vì thế client sai là mất dữ liệu ngay.

**Cách sai, kinh điển:** gom cả form rồi gửi một cục.

```ts
// ❌ TUYỆT ĐỐI KHÔNG
await putBodyLog(date, {
  weightKg: weight === '' ? null : Number(weight),
  waistCm:  waist  === '' ? null : Number(waist),
});
```

Kịch bản hỏng: ngày 05 đã có `waistCm = 88`. Người dùng mở trang, chỉ sửa cân nặng rồi
blur. Ô vòng bụng **hiển thị 88** nhưng nếu state khởi tạo lỗi (hoặc `GET` trả `404` nên
form để rỗng — xem §6) thì `waist === ''` → gửi `waistCm: null` → **88 bị xóa**. Người
dùng không chạm vào ô đó và cũng không được cảnh báo.

**Cách đúng:** *một lần blur = một request mang đúng khóa của ô vừa blur.*

```ts
// ✔ ô nào blur thì chỉ gửi khóa của ô đó
async function saveField(field: 'weightKg' | 'waistCm', raw: string) {
  const value = raw.trim() === '' ? null : Number(raw);
  await putBodyLog(date, { [field]: value });   // đúng MỘT khóa trong body
}
```

Kèm hai quy tắc phụ:

1. **Không gửi khi giá trị không đổi so với lúc nạp.** Blur qua một ô mà không sửa gì
   không được sinh request. Giữ giá trị đã nạp trong một ref/state riêng (`loadedWeight`)
   và so trước khi gửi. Lý do không phải hiệu năng: `PUT` với `{}` hoặc với giá trị y hệt
   vẫn **tạo bản ghi rỗng cho ngày chưa có gì** (repository dùng `upsert`,
   `create: { userId, date, ...patch }`) và vẫn bump `updatedAt`.
2. **Ô rỗng ngay từ đầu và người dùng không gõ gì → không gửi.** "Rỗng vì chưa từng có"
   khác "rỗng vì vừa bị xóa trắng". Chỉ ca thứ hai mới được gửi `null`.

Nói cách khác: state của form phải mang thêm khái niệm **"ô này đã bị người dùng động
vào chưa"**. Đây là điểm khác biệt duy nhất giữa một form đúng và một form ăn mất dữ liệu.

### 5.2 `400` kèm `fields[]` — gắn lỗi vào đúng ô, không đổ toast chung

Server trả **đủ tất cả** lỗi trong một response, không dừng ở lỗi đầu (meals §3). Đổ nguyên
`message` ra một toast là vứt đi phần thông tin đắt nhất.

Bắt buộc:

- Dựng `Record<string, string>` từ `error.fields` theo `path`, render `message` **ngay dưới
  ô tương ứng**, kèm `aria-invalid` trên `<input>`.
- `path` có thể là `"date"` — đây là lỗi **không thuộc ô nhập nào của form đó** (nó thuộc
  DatePicker hoặc thuộc `date` trong body của `POST /meals`). Phải có một chỗ hiển thị lỗi
  cấp form cho các `path` không map được vào ô nào; **không nuốt im lặng**.
- Xóa toàn bộ lỗi cũ trước mỗi lần gửi. Lỗi tồn đọng của lần trước trên một ô đã sửa đúng
  là bug hay gặp.
- `path` không nằm trong danh sách biết trước → rơi về chỗ hiển thị cấp form.

Hai điều dễ nhầm về **thứ tự** validate, khác nhau giữa hai feature:

| | Validate trước | Hệ quả cho UI |
|---|---|---|
| `PUT /body-logs/:date` | `:date` **trước** body (body-logs §6.7) | Lỗi `date` và lỗi `weightKg` **không bao giờ cùng xuất hiện**. Ngày tương lai → chỉ thấy lỗi `date`, ô cân nặng sai vẫn im |
| `PATCH /meals/:id` | body **trước** `:id` (meals §2) | Id chết + body sai → `400` chứ không `404` |

### 5.3 `GET /meals?date=` sắp theo `createdAt`, KHÔNG theo thứ tự buổi — **điểm cần chốt**

Hợp đồng đang chạy: `orderBy: { createdAt: 'asc' }` (meals §2, `repositories/meals.repository.ts:37`)
— tức **thứ tự người dùng đã gõ vào**, không phải sáng → trưa → tối → phụ.

Ai ghi bù bữa sáng vào lúc 9 giờ tối sẽ thấy "Sáng: Phở" nằm **cuối** danh sách. §7 nói
danh sách "nhóm theo buổi", nên hai thứ này lệch nhau và **phải chốt trước khi code
`MealList`**. Hai lựa chọn, ghi sẵn ở [`meals/PLAN.md`](../meals/PLAN.md) §4.2:

- **(A) Sắp ở client.** Server giữ nguyên hợp đồng, không phá 38 test của `meals`.
  Trang này nhóm mảng trả về theo `slot` dùng một mảng thứ tự tường minh, trong mỗi nhóm
  giữ nguyên thứ tự `createdAt` mà server đã trả.
- **(B) Đề nghị backend đổi `orderBy`.** Phải là sắp **trong bộ nhớ** theo mảng thứ tự
  tường minh — `orderBy: { slot: 'asc' }` cho ra thứ tự bảng chữ cái
  `breakfast, dinner, lunch, snack`, tức **sai**, vì `slot` là `String` trong SQLite
  (`prisma/schema.prisma:41`).

**Đề nghị: (A)**, vì thứ tự hiển thị là quyết định trình bày và trang Biểu đồ không cần nó.
Nhưng đây là **quyết định phải được ghi nhận, không phải mặc định im lặng** — hiện *không
có test nào khóa thứ tự này ở server* (test `meals` `.sort()` trước khi so sánh), nên hợp
đồng "sắp theo `createdAt`" chưa được bảo vệ và có thể lặng lẽ đổi. Nếu chọn (A), trang này
**phải có test riêng** khẳng định thứ tự hiển thị, để nó không phụ thuộc vào thứ tự server trả.

Hằng thứ tự đặt ở `web/src/features/today/constants` hoặc `web/src/constants/` — **một chỗ
duy nhất**, dùng chung cho cả dropdown `[buổi ▾]` và thứ tự nhóm của `MealList`.

### 5.4 Bẫy phụ, ngắn hơn nhưng vẫn ăn được người

- **`GET /body-logs/:date` trả `404` cho ngày trắng.** Đây là **trạng thái bình thường**,
  không phải lỗi. Không được hiển thị "Có lỗi xảy ra". Xem §6.
- **Kiểu strict.** `<input>` luôn cho ra `string`. `calories: "450"` → `400`.
  Phải `Number()` trước khi gửi, và chặn `NaN` ở client.
- **Biên số khác nhau giữa hai feature**: `weightKg`/`waistCm` là khoảng **mở** (`500`, `300`
  bị từ chối); `calories` là khoảng **đóng** (`0` và `20000` đều hợp lệ). Đừng dùng chung
  một hàm kiểm biên.
- **Trường lạ trong body `PUT /body-logs` → `400`** (`strictObject`, body-logs §6.1). Gõ nhầm
  `weight` thay `weightKg` không im lặng thành no-op — nhưng cũng nghĩa là **không được
  gửi kèm** `createdAt`/`updatedAt` khi echo lại object vừa `GET` về. `POST /meals` thì
  ngược lại: khóa lạ bị **strip im lặng** (meals §2). Đừng dựa vào một trong hai hành vi.
- **`DELETE /meals/:id` không idempotent.** Bấm "xóa" hai lần nhanh → lần hai `404`. Vô hiệu
  hóa nút ngay khi bấm; nếu vẫn nhận `404` thì coi như đã xóa xong và refetch, không báo lỗi đỏ.
- **`PATCH` với `{}` trả `200` nhưng vẫn bump `updatedAt`** (meals §4.6). Nếu UI có hiển thị
  "sửa lần cuối", con số sẽ nhảy dù người dùng không đổi gì. Chỉ gửi các trường thực sự đổi.
- **`POST /meals` chặn ngày tương lai, `GET /meals?date=` thì không.** Chọn ngày mai (nếu
  DatePicker để lọt) sẽ thấy danh sách rỗng bình thường rồi **`400` khi bấm `+`**. Đó là lý
  do `max` của DatePicker là bắt buộc, không phải trang trí.

## 6. Trạng thái rỗng

§7 có mục "Xử lý trạng thái rỗng" nhưng **chỉ nói về biểu đồ**. Nguyên tắc rút ra được và áp
dụng cho trang này: *khi chưa có dữ liệu thì nói cho người dùng biết phải làm gì, đừng hiển
thị số 0 hay khung trống.* Cụ thể hóa:

| Tình huống | Nguồn | Hiển thị |
|---|---|---|
| Ngày chưa có `BodyLog` | `GET /body-logs/:date` → **`404`** | Form hiện **hai ô rỗng**, không báo lỗi. Coi `404` như "chưa ghi", bắt riêng khỏi nhánh lỗi mạng |
| Có `BodyLog` nhưng `weightKg = null` | `200`, trường `null` | Ô cân nặng rỗng, ô vòng bụng có số. Cùng cách xử lý như trên |
| Ngày chưa có bữa nào | `GET /meals?date=` → **`200 []`** | "Chưa ghi bữa nào cho ngày này." Form thêm nhanh vẫn hiện, focus sẵn ở ô tên món |
| Một buổi rỗng, buổi khác có bữa | mảng thiếu `slot` đó | **Câu hỏi mở** — xem §7 câu hỏi 5 |
| Chưa đặt mục tiêu calo | `GET /goal` → `dailyCalorieTarget: null` | Vẫn hiện **tổng calo hôm nay** (nó là sự thật, không phụ thuộc mục tiêu). **Không** vẽ thanh tiến độ, thay bằng "Đặt mục tiêu calo ở tab Cài đặt để thấy tiến độ." |
| Chưa đặt mục tiêu **và** chưa ghi bữa | cả hai trên | Không hiện "0 / —". Hiện đúng một dòng hướng dẫn nhập bữa đầu tiên |
| Ngày trắng hoàn toàn (mới cài app) | `404` + `200 []` + goal toàn `null` | Ba khối đều ở trạng thái rỗng của riêng nó. **Không** dựng một màn hình "onboarding" riêng — nó nằm ngoài §7 |

Ba nguyên tắc không được vi phạm:

1. **`404` của `GET /body-logs/:date` không bao giờ là thông báo lỗi.** Chỉ lỗi mạng, `400`,
   và `500` mới được hiện đỏ.
2. **Không hiển thị `0 kg` hay `0 cm`.** Ô rỗng là ô rỗng; `0` là một số đo, và là một số
   đo sai.
3. **Tổng calo `0` thì được phép hiện `0`** — nhưng chỉ khi người dùng đã ghi ít nhất một
   thứ trong ngày. Ngày trắng thì hiện lời mời nhập, không hiện `0`.

## 7. Câu hỏi mở

Những thứ §7 không nói và người implement **phải quyết** — quyết xong thì cập nhật lại file
này, đừng để mặc định trôi vào code.

1. **Tổng calo tính ở client hay lấy từ `GET /summary?from=D&to=D`?**
   Client cộng mảng `meals` thì luôn khớp với danh sách ngay bên trên và **không tốn request
   thứ tư**; nhưng thành ra có hai chỗ trong app tính cùng một con số, và trang Biểu đồ lấy
   từ `days[].totalCalories` của server. Chúng có thể lệch nhau nếu định nghĩa đổi. Ngược
   lại, gọi `summary` cho một ngày là kéo về cả `weeks` và `goal` chỉ để lấy một số nguyên,
   và `goal` trong đó **neo vào hôm nay chứ không neo vào `D`** (summary §2) — dễ hiểu nhầm
   khi người dùng đang xem ngày cũ. *Nghiêng về: cộng ở client.*

2. **Sửa bữa: inline hay modal?** §7 chỉ nói "mỗi dòng có nút sửa/xóa". `PATCH /meals/:id`
   nhận cả `date`, nên "sửa" **có thể chuyển bữa sang ngày khác** — nếu cho phép, bữa đó
   biến mất khỏi danh sách đang xem, cần nói rõ. *Đề nghị: inline, chỉ cho sửa `slot`,
   `name`, `calories`; không cho đổi `date` ở bản này.*

3. **Có hiển thị `note` không?** Hợp đồng có `note` cho cả `BodyLog` (≤1000 ký tự) và `Meal`
   (không giới hạn độ dài). §7 không vẽ ô nào cho chúng. Bỏ hẳn thì hai cột DB không bao giờ
   được ghi từ UI; thêm vào thì §7 bị mở rộng. *Đề nghị: bản đầu bỏ, ghi lại thành nợ.*

4. **"Hôm nay" tính ở đâu?** Client tính từ đồng hồ máy, server chặn theo `Asia/Ho_Chi_Minh`.
   Máy dev đặt timezone khác (hoặc người dùng đi công tác) → client cho phép chọn một ngày mà
   server coi là tương lai → `400` ở `path: "date"` ngay lần đầu bấm lưu. Ba hướng: (a) chấp
   nhận, hiển thị lỗi `date` cho tử tế; (b) client tính "hôm nay" **cứng theo `Asia/Ho_Chi_Minh`**
   bằng `Intl.DateTimeFormat` thay vì theo timezone máy; (c) đề nghị backend thêm một endpoint
   trả `todayIso()`. *Nghiêng về (b) — không cần đổi backend, và nó khớp đúng định nghĩa
   server đang dùng.*

5. **Buổi rỗng có hiện tiêu đề không?** Nếu nhóm theo buổi (§5.3 lựa chọn A), một ngày chỉ
   ghi bữa sáng sẽ ra ba tiêu đề rỗng. Hiện đủ 4 buổi thì bố cục ổn định và nhắc người dùng
   còn thiếu; ẩn buổi rỗng thì danh sách gọn. *Đề nghị: hiện đủ 4, buổi rỗng để một dòng mờ.*

6. **Blur có debounce không?** Tab qua 2 ô liên tiếp sinh 2 request. Với localhost thì không
   đáng lo, nhưng nếu ô đang có lỗi `400` mà người dùng tab đi tab lại thì lỗi nhấp nháy.
   *Đề nghị: không debounce; thay vào đó giữ lỗi trên ô cho tới lần gửi thành công kế tiếp.*

7. **`PUT` có tạo bản ghi rỗng cho ngày trắng không?** Repository dùng `upsert` với
   `create: { userId, date, ...patch }` (body-logs §4), nên `PUT` mang một patch rỗng **có
   vẻ** sẽ tạo một hàng toàn `null`, biến `GET /body-logs/:date` từ `404` thành `200` với mọi
   trường `null`. body-logs §4 chỉ khẳng định `{}` là no-op **trên bản ghi đã tồn tại**.
   Cần một test xác nhận trước khi dựa vào; §5.1 quy tắc 1 đã chặn ca này ở phía client, nhưng
   nên biết chắc.

8. **Đổi ngày rồi quay lại: có cache không?** Không có thư viện cache (spec chốt React 19 +
   Vite + Recharts, **không** TanStack Query). Nạp lại mỗi lần đổi ngày là đơn giản nhất và
   luôn đúng. *Đề nghị: không cache; chỉ cần chống race — request của ngày cũ về sau request
   của ngày mới thì phải bị bỏ (cờ `cancelled` trong cleanup của `useEffect`).*

## 8. Tham chiếu

- Hợp đồng API: [`body-logs/SPEC.md`](../body-logs/SPEC.md) · [`meals/SPEC.md`](../meals/SPEC.md)
  · [`goal/SPEC.md`](../goal/SPEC.md) · [`summary/SPEC.md`](../summary/SPEC.md)
- Nguồn bố cục: [`docs/archive/2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md) §7
- Chỗ đặt file: [`docs/overview/01-architecture.md`](../../overview/01-architecture.md)
- Quy ước + hình dạng lỗi: [`docs/overview/04-conventions.md`](../../overview/04-conventions.md)
- Kế hoạch thi công: [`PLAN.md`](PLAN.md)
