# Health Tracker — Thiết kế

**Ngày:** 2026-08-06
**Trạng thái:** Chờ duyệt

---

## 1. Mục tiêu

App theo dõi sức khỏe cá nhân chạy trên máy tính, ghi lại hàng ngày:

- Cân nặng và số đo vòng bụng
- Các bữa ăn (tên món + calo, nhập tay)

Và cho biết: xu hướng cân nặng/vòng bụng theo thời gian, lượng calo nạp vào so với mục tiêu, tiến độ so với cân nặng mục tiêu.

**Giá trị cốt lõi không phải là con số chính xác, mà là xu hướng.** Cân nặng dao động 1–2 kg mỗi ngày do lượng nước và thức ăn trong đường tiêu hóa; con số của một ngày riêng lẻ gần như vô nghĩa. Vì vậy mọi biểu đồ cân nặng đều hiển thị kèm trung bình trượt 7 ngày, và đó mới là đường người dùng nên nhìn.

## 2. Phạm vi

### Có trong bản này

| Tính năng | Mô tả |
|---|---|
| Ghi số đo cơ thể | Cân nặng, vòng bụng, ghi chú — 1 bản ghi/ngày |
| Ghi bữa ăn | Tên món + calo tự gõ, phân theo buổi, nhiều bữa/ngày |
| Biểu đồ xu hướng | Cân nặng + vòng bụng theo thời gian, kèm trung bình trượt 7 ngày |
| Thống kê calo | Tổng calo theo ngày, trung bình tuần, so với mục tiêu |
| Mục tiêu cân nặng | Cân nặng đích + hạn, hiển thị tiến độ và tốc độ hiện tại |
| Nhắc nhở | Nhắc cân buổi sáng / ghi bữa ăn, gửi qua ntfy |

### Không có trong bản này

- **AI phân tích ảnh bữa ăn** — đã cân nhắc và loại bỏ để giữ chi phí bằng 0. Kiến trúc chừa chỗ để gắn vào sau (xem §10).
- **Lưu ảnh bữa ăn** — không lưu file, không upload.
- **Database món ăn dựng sẵn** — người dùng tự gõ calo mỗi bữa.
- **Đăng nhập / nhiều người dùng** — chạy localhost, một người.
- **Ứng dụng di động / truy cập từ điện thoại** — chỉ dùng trên máy tính chạy server.

## 3. Kiến trúc

Tái dùng stack và cấu trúc của dự án `Todo/` trong cùng workspace, cắt bỏ những phần không cần cho bối cảnh một máy — một người.

```
LEAN/
├── server/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── server.ts          # entry point
│   │   ├── app.ts             # express app, middleware, error handler
│   │   ├── env.ts             # đọc + validate biến môi trường
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── time.ts            # xử lý ngày theo timezone local
│   │   ├── stats.ts           # hàm thuần: MA7, tổng calo, tiến độ
│   │   ├── ntfy.ts            # gửi thông báo  (port từ Todo/)
│   │   ├── scheduler.ts       # cron nhắc nhở   (port từ Todo/)
│   │   └── routes/
│   │       ├── bodyLogs.ts
│   │       ├── meals.ts
│   │       ├── summary.ts
│   │       ├── goal.ts
│   │       └── reminders.ts
│   └── test/
└── web/
    └── src/
        ├── api.ts
        ├── pages/{Today,Charts,Settings}.tsx
        └── components/
```

### Lựa chọn kỹ thuật và lý do

| Quyết định | Lý do | Đánh đổi |
|---|---|---|
| **SQLite** thay vì Postgres | Một file `data.db`, không cần cài dịch vụ, backup = copy file | Không chạy được nhiều tiến trình ghi đồng thời — không thành vấn đề với 1 người dùng |
| **Không có đăng nhập** | Localhost, một người. Auth chỉ thêm một màn hình phải bấm qua mỗi ngày mà không bảo vệ thêm điều gì | Nếu sau này mở ra mạng LAN hoặc cloud thì **bắt buộc** phải thêm auth trước |
| Express + Prisma + TypeScript | Giống `Todo/` — tái dùng được `ntfy.ts`, `scheduler.ts`, `time.ts`, cấu trúc route, cấu hình test | — |
| React + Vite + TypeScript | Giống `Todo/web` | — |
| Recharts cho biểu đồ | Nhẹ, khai báo, hợp với React | — |
| Logic thống kê tách vào `stats.ts` | Hàm thuần, không đụng DB hay HTTP → test được độc lập, dễ suy luận | — |

Cả hai quyết định đầu đều là thay đổi cục bộ nếu sau này cần đảo ngược: đổi `provider` trong `schema.prisma` để sang Postgres; thêm middleware auth vào `app.ts`.

## 4. Mô hình dữ liệu

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")   // "file:./data.db"
}

model BodyLog {
  id        String   @id @default(cuid())
  date      String   @unique          // "YYYY-MM-DD", ngày theo giờ địa phương
  weightKg  Float?
  waistCm   Float?
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Meal {
  id        String   @id @default(cuid())
  date      String                     // "YYYY-MM-DD"
  slot      String                     // "breakfast" | "lunch" | "dinner" | "snack"
  name      String
  calories  Int
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([date])
}

model Goal {
  id                 String   @id @default("singleton")
  targetWeightKg     Float?
  targetDate         String?           // "YYYY-MM-DD"
  dailyCalorieTarget Int?
  updatedAt          DateTime @updatedAt
}

model Reminder {
  id        String   @id @default(cuid())
  kind      String   @unique           // "weigh_in" | "meal_log"
  timeOfDay String                     // "HH:mm", 24 giờ
  enabled   Boolean  @default(false)
  ntfyTopic String?
  updatedAt DateTime @updatedAt
}
```

### Ghi chú về mô hình

- **`date` lưu dạng chuỗi `"YYYY-MM-DD"`, không dùng `DateTime`.** Đây là lựa chọn có chủ đích: "ngày tôi cân" là một ngày trên lịch, không phải một thời điểm. Lưu `DateTime` sẽ kéo theo lỗi lệch múi giờ (bản ghi lúc 7h sáng giờ Việt Nam bị lưu thành ngày hôm trước theo UTC). Chuỗi ngày loại bỏ hẳn cả nhóm lỗi này.
- **`weightKg` và `waistCm` đều nullable.** Có ngày chỉ cân mà không đo bụng; không nên ép nhập cả hai mới lưu được.
- **`slot` là `String`, ràng buộc bằng Zod ở tầng route**, không dùng Prisma enum (SQLite không hỗ trợ native enum, và `Todo/` đã đi theo hướng này).
- **`Goal` chỉ có đúng một hàng**, id cố định `"singleton"`, thao tác bằng `upsert`.
- **`Reminder` có `kind` là unique** — mỗi loại nhắc nhở chỉ có một cấu hình.

## 5. API

Tất cả dưới prefix `/api`. Body và query validate bằng Zod. Lỗi validate trả `400` với danh sách trường sai; không tìm thấy trả `404`.

| Method | Route | Mô tả |
|---|---|---|
| `GET` | `/body-logs/:date` | Số đo của một ngày. Không có → `404`. |
| `PUT` | `/body-logs/:date` | Upsert. Body: `{ weightKg?, waistCm?, note? }`. Trường vắng mặt = không đổi; gửi `null` = xóa giá trị. |
| `DELETE` | `/body-logs/:date` | Xóa bản ghi ngày đó |
| `GET` | `/body-logs?from=&to=` | Danh sách trong khoảng, sắp xếp tăng dần theo ngày |
| `GET` | `/meals?date=` | Bữa ăn của một ngày |
| `POST` | `/meals` | Thêm bữa. Body: `{ date, slot, name, calories, note? }` |
| `PATCH` | `/meals/:id` | Sửa bữa (partial) |
| `DELETE` | `/meals/:id` | Xóa bữa |
| `GET` | `/summary?from=&to=` | Dữ liệu tổng hợp cho dashboard (xem dưới) |
| `GET` | `/goal` | Mục tiêu hiện tại. Chưa đặt → trả object với các trường `null`. |
| `PUT` | `/goal` | Upsert mục tiêu |
| `GET` | `/reminders` | Danh sách cấu hình nhắc nhở |
| `PUT` | `/reminders/:kind` | Cập nhật một loại nhắc nhở |

### Hình dạng `GET /summary`

```jsonc
{
  "days": [
    {
      "date": "2026-08-06",
      "weightKg": 72.4,
      "weightMa7": 72.9,      // null nếu không đủ dữ liệu
      "waistCm": 88.0,
      "waistMa7": 88.4,
      "totalCalories": 1840,
      "mealCount": 3
    }
  ],
  "weeks": [
    { "weekStart": "2026-08-03", "avgCalories": 1902, "avgWeightKg": 72.8 }
  ],
  "goal": {
    "targetWeightKg": 68,
    "targetDate": "2026-12-31",
    "dailyCalorieTarget": 1900,
    "currentMa7WeightKg": 72.9,
    "remainingKg": 4.9,
    "currentRateKgPerWeek": -0.35,   // âm = đang giảm; null nếu chưa đủ dữ liệu
    "requiredRateKgPerWeek": -0.24,
    "onTrack": true                  // null nếu currentRate là null
  }
}
```

### Quy tắc validate

| Trường | Ràng buộc |
|---|---|
| `date` | Khớp `^\d{4}-\d{2}-\d{2}$`, là ngày hợp lệ, **không được ở tương lai** |
| `weightKg` | `> 0` và `< 500` |
| `waistCm` | `> 0` và `< 300` |
| `calories` | Số nguyên, `>= 0` và `<= 20000` |
| `name` | Không rỗng sau khi trim, tối đa 200 ký tự |
| `slot` | Thuộc `["breakfast","lunch","dinner","snack"]` |
| `timeOfDay` | Khớp `^([01]\d|2[0-3]):[0-5]\d$` |
| `from`/`to` | Ngày hợp lệ, `from <= to`, khoảng tối đa 730 ngày |

## 6. Logic thống kê (`stats.ts`)

Tất cả là hàm thuần, nhận mảng dữ liệu và trả kết quả — không đọc DB, không biết gì về HTTP.

### Trung bình trượt 7 ngày (MA7)

Với mỗi ngày `d` trong khoảng truy vấn, MA7 là **trung bình các giá trị có thật trong cửa sổ 7 ngày lịch `[d-6, d]`** — cửa sổ tính theo ngày lịch, không phải "7 điểm dữ liệu gần nhất". Ngày không có số đo bị bỏ qua, không nội suy.

Nếu cửa sổ có **ít hơn 2 giá trị**, MA7 trả `null` — một điểm đơn lẻ không phải là trung bình và hiển thị nó sẽ gây hiểu nhầm.

### Tốc độ thay đổi hiện tại

```
currentRateKgPerWeek = (MA7[hôm nay] − MA7[14 ngày trước]) / 2
```

Dùng MA7 chứ không dùng số đo thô ở cả hai đầu, vì đây là phép đo xu hướng. Trả `null` nếu một trong hai MA7 là `null`.

### Tốc độ cần thiết

```
requiredRateKgPerWeek = (targetWeightKg − MA7[hôm nay]) / (số tuần còn lại đến targetDate)
```

Trả `null` nếu chưa đặt mục tiêu, hoặc `targetDate` đã qua, hoặc MA7 hiện tại là `null`.

### `onTrack`

`true` khi `currentRate` ít nhất bằng `requiredRate` theo đúng hướng của mục tiêu (giảm cân: `currentRate <= requiredRate`; tăng cân: `currentRate >= requiredRate`). `null` nếu thiếu dữ liệu để kết luận.

### Tuần

Tuần bắt đầu **thứ Hai**. `avgCalories` chỉ tính trên các ngày **có ít nhất một bữa ăn được ghi** — nếu tính cả ngày quên ghi là 0 calo thì trung bình tuần sẽ bị kéo xuống một cách sai lệch. `avgWeightKg` là trung bình các số đo cân nặng **thô** (không phải MA7) có thật trong tuần đó; trả `null` nếu tuần không có số đo nào.

### `remainingKg`

Khoảng cách còn lại tới mục tiêu, tính bằng `|targetWeightKg − MA7[hôm nay]|` — luôn là số dương, biểu thị độ lớn chứ không biểu thị hướng. Hướng (đang cần giảm hay cần tăng) đọc từ dấu của `requiredRateKgPerWeek`. Trả `null` nếu chưa đặt mục tiêu hoặc MA7 hiện tại là `null`.

## 7. Giao diện

Ba trang, điều hướng bằng tab trên cùng.

### Trang 1 — Hôm nay (mặc định)

- Ô nhập **cân nặng** và **vòng bụng**, hiển thị sẵn giá trị đã lưu của hôm nay nếu có. Lưu tự động khi rời khỏi ô (blur).
- Có bộ chọn ngày để nhập bù cho ngày trước đó. Mặc định là hôm nay.
- Danh sách **bữa ăn hôm nay** nhóm theo buổi, mỗi dòng có nút sửa/xóa.
- Form thêm nhanh: `[buổi ▾] [tên món] [calo] [+]`.
- Thẻ tổng kết: tổng calo hôm nay / mục tiêu ngày, kèm thanh tiến độ.

### Trang 2 — Biểu đồ

- Bộ chọn khoảng: 30 ngày / 90 ngày / 1 năm / tùy chọn.
- **Biểu đồ cân nặng**: điểm thô mờ + đường MA7 đậm + đường ngang mục tiêu. MA7 là đường được làm nổi bật.
- **Biểu đồ vòng bụng**: cùng cách trình bày.
- **Biểu đồ calo**: cột theo ngày + đường ngang mục tiêu ngày + đường trung bình tuần.
- Thẻ tiến độ mục tiêu: còn bao nhiêu kg, tốc độ hiện tại (kg/tuần), tốc độ cần thiết, đang đúng tiến độ hay không.

### Trang 3 — Cài đặt

- Mục tiêu: cân nặng đích, ngày đích, calo mục tiêu/ngày.
- Nhắc nhở: bật/tắt + giờ cho từng loại, ô nhập ntfy topic, nút "Gửi thử".
- Ghi rõ ngay trên giao diện: **nhắc nhở chỉ hoạt động khi server đang chạy.**

### Xử lý trạng thái rỗng

Khi chưa có dữ liệu, biểu đồ hiển thị thông báo hướng dẫn ("Cần ít nhất 2 ngày dữ liệu để vẽ xu hướng"), không hiển thị biểu đồ trống hay số 0.

## 8. Nhắc nhở

`node-cron` trong tiến trình server, quét mỗi phút và so với `timeOfDay` của các nhắc nhở đang bật. Gửi qua ntfy bằng `ntfy.ts` port từ `Todo/` (đã xử lý sẵn việc encode tiêu đề UTF-8).

- **`weigh_in`** — gửi nếu hôm nay chưa có `BodyLog` với `weightKg`.
- **`meal_log`** — gửi nếu hôm nay chưa có bản ghi `Meal` nào.

Nhắc nhở có điều kiện: đã ghi rồi thì không làm phiền.

**Hạn chế cần ghi trong README:** máy tính tắt hoặc server không chạy thì không có nhắc nhở, và cũng không có cơ chế gửi bù khi bật lại.

## 9. Kiểm thử

Vitest + supertest, theo đúng cách `Todo/server/test` đang làm.

### `stats.ts` (unit, ưu tiên cao nhất)

- MA7 với dữ liệu liên tục
- MA7 khi có ngày trống ở giữa — cửa sổ vẫn là 7 ngày lịch, không phải 7 điểm
- MA7 trả `null` khi cửa sổ có 0 hoặc 1 giá trị
- Tốc độ hiện tại trả `null` khi thiếu MA7 ở một đầu
- `onTrack` đúng cho cả hai hướng mục tiêu (giảm cân và tăng cân)
- Trung bình calo tuần bỏ qua ngày không có bữa ăn nào
- Ranh giới tuần rơi đúng vào thứ Hai

### API (integration)

- `PUT /body-logs/:date` hai lần cùng ngày → cập nhật, không tạo bản ghi thứ hai
- `PUT` với trường vắng mặt không xóa giá trị cũ; gửi `null` thì xóa
- Từ chối cân nặng âm, calo âm, ngày tương lai, `slot` không hợp lệ, `from > to`
- `GET /summary` trả đúng cấu trúc khi DB rỗng (mảng rỗng, không lỗi)
- `PATCH`/`DELETE` trên id không tồn tại → `404`
- Xóa bữa ăn làm giảm tổng calo của ngày tương ứng

### Nhắc nhở

- Không gửi khi đã có dữ liệu trong ngày
- Không gửi khi `enabled = false`
- Gọi ntfy với đúng topic và nội dung (mock lớp HTTP)

## 10. Chừa chỗ cho AI (không làm trong bản này)

Nếu sau này muốn thêm tính năng chụp ảnh để AI ước tính calo, đường mở rộng đã rõ và không phải viết lại:

1. Thêm cột `photoPath` và `caloriesSource` (`"manual" | "ai"`) vào `Meal`.
2. Thêm route `POST /meals/estimate` nhận ảnh, gọi Claude API với structured output, trả về form đã điền sẵn để người dùng **xác nhận hoặc sửa** trước khi lưu.
3. Giao diện thêm nút chụp ảnh bên cạnh form nhập tay hiện có.

Điểm mấu chốt của thiết kế đó: AI điền sẵn form, người dùng vẫn là người chốt số. Ước tính calo từ ảnh có sai số ±20–40% nên không nên ghi thẳng vào DB mà không qua mắt người.

## 11. Chạy thử

```bash
cd LEAN/server
npm install
npx prisma db push        # tạo data.db
npm run dev               # http://localhost:3000

cd ../web
npm install
npm run dev               # http://localhost:5173
```

Biến môi trường (`LEAN/server/.env`):

```
DATABASE_URL="file:./data.db"
PORT=3000
TZ_NAME="Asia/Ho_Chi_Minh"
NTFY_BASE_URL="https://ntfy.sh"
```

Backup: copy `LEAN/server/prisma/data.db`.

## 12. Điểm cần bạn xác nhận

1. **SQLite + không đăng nhập** — đã chọn theo lý do ở §3. Nếu muốn giữ Postgres + JWT cho giống `Todo/` thì nói trước khi bắt đầu code, vì nó ảnh hưởng tới `schema.prisma`, `app.ts` và toàn bộ tầng test.
2. **Đơn vị đo** — mặc định kg và cm. Đổi được nhưng nên chốt bây giờ.
3. **Bốn buổi ăn** (sáng / trưa / tối / phụ) — đủ chưa?
