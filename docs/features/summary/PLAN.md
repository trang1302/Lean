# Feature `summary` — trạng thái thi công

**Trạng thái: ĐÃ XONG.** 20 test pass (`server/test/features/summary/summary.controller.test.ts`), typecheck sạch.

Mô tả hành vi đầy đủ: [`SPEC.md`](SPEC.md).

---

## 1. File đã tạo

Bốn lớp, mỗi lớp một trách nhiệm. Không lớp nào nhảy cóc qua lớp khác.

| File | Lớp | Vai trò |
|---|---|---|
| `server/src/features/summary/index.ts` | router | Khai báo `summaryRouter`, cắm `GET /` vào controller. `app.ts:24` gắn nó ở prefix `/api/summary` — **tên export phải giữ nguyên** |
| `server/src/features/summary/dtos/summary.request.ts` | DTO | Query schema. Chỉ 11 dòng: dùng thẳng `dateRangeSchema` dùng chung, không định nghĩa lại ràng buộc |
| `server/src/features/summary/dtos/summary.response.ts` | DTO | Hợp đồng với web: `SummaryDay`, `SummaryWeek`, `SummaryGoal`, `SummaryResponse`. Không logic, chỉ kiểu |
| `server/src/features/summary/controllers/summary.controller.ts` | controller | `parse` query → gọi service → `res.json`. 14 dòng, không `try/catch` (Express 5 tự đẩy lỗi async sang `errorHandler`) |
| `server/src/features/summary/services/summary.service.ts` | service | Nơi duy nhất có độ phức tạp: tính khoảng dữ liệu thô cần lấy, nối vào `shared/stats`, xếp lại response. **Không chứa công thức nào** |
| `server/src/features/summary/repositories/summary.repository.ts` | repository | File duy nhất của feature import `prisma`. Ba hàm: `findBodyLogsBetween`, `findDailyMealTotals` (gộp bằng `groupBy`), `findGoal` |
| `server/test/features/summary/summary.controller.test.ts` | test | 20 integration test qua supertest, chạm DB thật (`test.db`) |

Không tạo file nào trong `shared/stats` — feature này chỉ *dùng* các hàm đã có ở đó.

Về index DB: không có việc phải làm. `BodyLog` có khóa chính ghép `@@id([userId, date])` và `Meal` có `@@index([userId, date])` (`server/prisma/schema.prisma:34,48`), phục vụ đúng dạng truy vấn khoảng của feature này.

---

## 2. Phân bố 20 test

| Nhóm | Số test | Dòng | Canh điều gì |
|---|---|---|---|
| hình dạng response | 3 | `summary.controller.test.ts:48-101` | Đủ ba khối; `days[i]` đúng 7 trường; `goal` đúng 8 trường |
| `days` | 6 | `:103-186` | Một phần tử/ngày kể cả ngày trống · số đo thô · MA7 `null` khi <2 giá trị · **MA7 của ngày `from` phải dùng dữ liệu trước `from`** · cộng calo theo ngày · ngày không bữa → 0 |
| `weeks` | 2 | `:188-217` | Tuần bắt đầu thứ Hai, `avgCalories` bỏ qua ngày không ghi bữa · tuần rỗng vẫn xuất hiện với `avg` `null` |
| `goal` | 4 | `:219-302` | Toàn `null` khi chưa có gì · các trường phụ thuộc mục tiêu `null` khi chưa đặt mục tiêu dù có số đo · **neo vào hôm nay + lấy dữ liệu tới `today-20`** · **khoảng truy vấn hoàn toàn trong quá khứ** |
| validate | 5 | `:304-347` | `from > to` · vượt 730 ngày · thiếu `from` · thiếu `to` · ngày không có thật (`2026-02-30`) |

Ba test in đậm là ba vế của công thức khoảng ngày ở [`SPEC.md`](SPEC.md) §3 — mỗi vế một test riêng.

Mọi fixture neo vào `todayIso()` chứ không dùng ngày cứng (`summary.controller.test.ts:10-15`): khối `goal` neo vào hôm nay nên test dùng ngày cứng sẽ tự hỏng khi lịch trôi. Hai test `weeks` là ngoại lệ có chủ ý — chúng cần một thứ Hai xác định (`2026-03-02`) để kiểm ranh giới tuần.

---

## 3. Lệnh verify

```bash
cd server

# Chỉ suite summary, DB riêng để chạy song song với suite khác mà không giẫm lên nhau
DATABASE_URL=file:./test-summary.db npx vitest run test/features/summary

# Toàn bộ test
npm test

# Typecheck (bắt được TS2345 của groupBy nếu ai đó thêm chú thích kiểu — SPEC §7)
npm run typecheck
```

`npm test` = `vitest run`; `npm run typecheck` = `tsc --noEmit` (`server/package.json:9,10`). Vitest chạy `fileParallelism: false` và dùng DB test riêng — không bao giờ trỏ vào `data.db` thật (`server/vitest.config.ts`).

---

## 4. Việc còn treo

Không có gì chặn feature này khỏi trạng thái "xong". Dưới đây là những hành vi đã chốt trong code nhưng chưa được spec nói tới — tách rõ **lựa chọn đã chốt** và **câu hỏi mở cho web**.

### 4.1 `weeks` trả MỌI tuần chạm khoảng, kể cả tuần rỗng — *lựa chọn đã chốt*

`weeklySummaries` lặp từ `startOfWeekMonday(from)` tới `startOfWeekMonday(to)` và luôn `push` (`shared/stats/weekly.ts:76-91`). Tuần không có dữ liệu vẫn ra một phần tử `{ weekStart, avgCalories: null, avgWeightKg: null }` — có test canh (`summary.controller.test.ts:208-216`).

Chốt như vậy vì mảng liên tục thì web vẽ trục thời gian mà không phải tự bù tuần thiếu. **Câu hỏi mở cho web:** biểu đồ trung bình tuần nên vẽ đứt đoạn tại các tuần `null` hay nối thẳng qua? Nối thẳng sẽ vẽ ra một xu hướng không tồn tại.

### 4.2 Tuần đầu/cuối bị cắt cụt vẫn báo `weekStart` là thứ Hai — *lựa chọn, kèm câu hỏi mở*

Nếu `from` rơi vào thứ Năm, phần tử đầu của `weeks` vẫn có `weekStart` là thứ Hai **trước** `from` — một ngày nằm ngoài khoảng người dùng xin (`weekly.ts:79`). Nhưng trung bình chỉ tính trên các ngày thật sự nằm trong `[from, to]`, do `inRange` lọc ở `weekly.ts:49`.

Nghĩa là tuần đầu và tuần cuối **không so sánh ngang hàng được** với các tuần trọn vẹn ở giữa: một tuần chỉ có 3 ngày trong khoảng vẫn hiện như một điểm bình đẳng trên biểu đồ. **Câu hỏi mở cho web:** có nên đánh dấu/làm mờ hai điểm đầu-cuối, hay bỏ hẳn tuần cắt cụt khi vẽ? Backend không tự quyết vì `weeks` cũng có thể dùng cho bảng số, nơi mọi tuần đều đáng hiện.

Response hiện **không có** trường nào cho biết một tuần bị cắt cụt (`SummaryWeek` chỉ có 3 trường, `dtos/summary.response.ts:20-25`). Nếu web cần, đây là thay đổi hợp đồng và phải sửa `shared/stats/weekly.ts` chứ không sửa trong feature này.

### 4.3 `from`/`to` không bị cấm nằm ở tương lai — *câu hỏi mở*

`dateRangeSchema` dùng `dateString`, không dùng `pastOrTodayDateString` (`shared/validation/commonSchemas.ts:34-43` so với `:16`). Hỏi `to = today + 30` sẽ trả 200 với 30 phần tử `days` toàn `null`/`0` ở đuôi.

Khớp với bảng validate của spec (`2026-08-06-original-design.md` §5: hàng `from`/`to` chỉ đòi ngày hợp lệ, `from <= to`, ≤730 ngày — quy tắc "không được ở tương lai" chỉ gắn cho `date` của bản ghi). Nên đây **không phải bug**, nhưng cũng chưa ai quyết là muốn thế.

**Câu hỏi mở:** bộ chọn khoảng ở trang Biểu đồ có bao giờ sinh ra `to` tương lai không? Nếu không thì chặn ở web là đủ. Nếu muốn chặn ở backend thì phải sửa `dateRangeSchema` dùng chung — ảnh hưởng cả `GET /body-logs?from=&to=`, phải bàn với feature đó trước.

### 4.4 `days` không bao giờ là mảng rỗng — *lệch spec gốc, có chủ ý*

Kế hoạch test trong spec (`2026-08-06-original-design.md` §9) viết: *"`GET /summary` trả đúng cấu trúc khi DB rỗng (mảng rỗng, không lỗi)"*.

Code không làm vậy. Vì `from <= to` đã được validate nên `enumerateDates` luôn sinh ít nhất một ngày → `days` luôn có ít nhất 1 phần tử, và `weeks` luôn có ít nhất 1 phần tử. DB rỗng cho ra mảng **đầy đủ độ dài với các trường `null`/`0`**, không phải mảng rỗng.

Chủ ý: web vẽ trục thời gian trực tiếp từ `days` mà không phải tự sinh danh sách ngày rồi ghép. Ý "không lỗi" của spec vẫn được giữ. Test `summary.controller.test.ts:49-60` chạy trên DB rỗng và kỳ vọng đúng hành vi này.

### 4.5 Biên đúng 730 ngày chưa có test — *khe hở nhỏ*

Ràng buộc thật là `daysBetween(from, to) < 730` (`commonSchemas.ts:40`), tức khoảng dài nhất được chấp nhận là 730 ngày lịch (`daysBetween = 729`). Test hiện chỉ thử 800 ngày (`summary.controller.test.ts:315-323`) — trượt xa khỏi biên. Nếu ai đó đổi `<` thành `<=` thì không test nào bắt được.

Ràng buộc thuộc `shared/validation`, nên test biên nên nằm ở suite của `shared` chứ không phải ở đây.

### 4.6 `note` không xuất hiện trong `summary` — *lựa chọn đã chốt*

`BodyLog.note` và `Meal.note` có trong schema (`server/prisma/schema.prisma:30,44`) nhưng không nằm trong `select` của `findBodyLogsBetween` (`repositories/summary.repository.ts:45`), không nằm trong `groupBy` của `findDailyMealTotals`, và không có trong `SummaryDay`. Dashboard hiển thị xu hướng, không hiển thị ghi chú; web cần note thì gọi `GET /body-logs` hoặc `GET /meals?date=`.

---

## 5. Ràng buộc khi sửa feature này về sau

- **Đổi `dtos/summary.response.ts` là đổi hợp đồng với web** — client chưa tồn tại tại thời điểm viết file này, nhưng khi có thì `web/src/api.ts` phải sửa cùng lúc.
- **Đừng thêm công thức vào `services/`** — nó thuộc `shared/stats/`, xem [`SPEC.md`](SPEC.md) §5.
- **Đừng chú thích kiểu cho biến nhận `prisma.meal.groupBy(...)`** — `TS2345`, xem [`SPEC.md`](SPEC.md) §7.
- **Đừng thu hẹp khoảng query của `BodyLog` về `[from, to]`** — ba test sẽ đỏ, và lý do ở [`SPEC.md`](SPEC.md) §3.
- **Đừng gọi repository của feature khác từ đây** (`repositories/summary.repository.ts:4-12`).
