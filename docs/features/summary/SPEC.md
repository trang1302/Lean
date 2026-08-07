# Feature `summary`

Một endpoint đọc duy nhất — `GET /api/summary?from=&to=` — gom cả ba bảng (`BodyLog`, `Meal`, `Goal`) và trả về toàn bộ dữ liệu mà dashboard cần trong một lần gọi. Không ghi, không sửa, không xóa.

Đây là feature phức tạp nhất của backend, nhưng độ phức tạp **không nằm ở công thức** (công thức ở [`docs/overview/03-stats.md`](../../overview/03-stats.md)) mà nằm ở chỗ **phải query một khoảng ngày rộng hơn khoảng người dùng xin** — xem §3, mục quan trọng nhất của file này.

Router cắm ở `server/src/app.ts:24`, khai báo ở `server/src/features/summary/index.ts:5-7`.

---

## 1. Đầu vào

`server/src/features/summary/dtos/summary.request.ts:9` dùng thẳng `dateRangeSchema` dùng chung (`server/src/shared/validation/commonSchemas.ts:34-43`), không định nghĩa lại:

| Trường | Ràng buộc | Vi phạm → |
|---|---|---|
| `from` | Chuỗi `"YYYY-MM-DD"`, là ngày có thật | `400 VALIDATION_ERROR` |
| `to` | Như trên | `400` |
| `from`, `to` | `from <= to` (lỗi gắn vào `path: ['from']`) | `400`, trường `from` |
| `from`, `to` | Độ dài khoảng `< MAX_RANGE_DAYS` = 730 (`commonSchemas.ts:5`) | `400`, trường `to` |

Controller (`controllers/summary.controller.ts:11-14`) không có `try/catch`: Express 5 tự đẩy lỗi async sang `errorHandler`, nơi `ZodError` được dịch thành `400` kèm `error.fields`. Xác nhận ở 5 test `summary.controller.test.ts:305-346`.

**`from`/`to` KHÔNG bị cấm nằm ở tương lai.** `dateRangeSchema` dùng `dateString`, không dùng `pastOrTodayDateString` (`commonSchemas.ts:16`). Đây là chủ ý của schema dùng chung — xem [`PLAN.md`](PLAN.md) §4.

---

## 2. Hình dạng response

`dtos/summary.response.ts` là hợp đồng với web. Ba khối `days` / `weeks` / `goal`, xác nhận bằng test `summary.controller.test.ts:49-101`.

### `days: SummaryDay[]` — `summary.response.ts:6-18`

**Đúng một phần tử cho mỗi ngày lịch trong `[from, to]`**, tăng dần, kể cả ngày không có dữ liệu gì (`services/summary.service.ts:81` gọi `enumerateDates`). Test `summary.controller.test.ts:104-117`.

| Trường | Kiểu | `null` / 0 khi nào |
|---|---|---|
| `date` | `string` | không bao giờ — `"YYYY-MM-DD"` |
| `weightKg` | `number \| null` | `null` khi ngày đó không có `BodyLog` hoặc có nhưng `weightKg` rỗng |
| `weightMa7` | `number \| null` | `null` khi cửa sổ MA7 có dưới 2 giá trị |
| `waistCm` | `number \| null` | như `weightKg` |
| `waistMa7` | `number \| null` | như `weightMa7` |
| `totalCalories` | `number` | **không bao giờ `null`** — ngày không ghi bữa nào là `0` |
| `mealCount` | `number` | `0` khi không ghi bữa nào |

`totalCalories`/`mealCount` mặc định 0 tại `summary.service.ts:90-91`; test `summary.controller.test.ts:176-185`.

### `weeks: SummaryWeek[]` — `summary.response.ts:20-25`

| Trường | Kiểu | `null` khi nào |
|---|---|---|
| `weekStart` | `string` | không bao giờ — thứ Hai của tuần |
| `avgCalories` | `number \| null` | `null` khi cả tuần không ghi bữa nào |
| `avgWeightKg` | `number \| null` | `null` khi cả tuần không có số đo cân nặng nào |

Do `weeklySummaries` sinh ra (`shared/stats/weekly.ts:41-92`), gọi ở `summary.service.ts:95-101`. **Mọi tuần chạm vào khoảng đều xuất hiện**, kể cả tuần rỗng — test `summary.controller.test.ts:208-216`. Chi tiết các hệ quả ở [`PLAN.md`](PLAN.md) §4.

### `goal: SummaryGoal` — `summary.response.ts:32-43`

Là **object**, không phải mảng, và không bao giờ `null` — chưa đặt mục tiêu thì mọi trường phụ thuộc mục tiêu là `null` (test `summary.controller.test.ts:220-237`).

| Trường | Kiểu | `null` khi nào |
|---|---|---|
| `targetWeightKg` | `number \| null` | chưa đặt mục tiêu, hoặc đặt mà bỏ trống trường này |
| `targetDate` | `string \| null` | như trên |
| `dailyCalorieTarget` | `number \| null` | như trên |
| `currentMa7WeightKg` | `number \| null` | MA7 cân nặng **tại hôm nay** có dưới 2 giá trị trong `[today-6, today]` |
| `remainingKg` | `number \| null` | thiếu `currentMa7WeightKg` **hoặc** thiếu `targetWeightKg`. Luôn dương |
| `currentRateKgPerWeek` | `number \| null` | thiếu MA7 ở một trong hai đầu (`today`, `today-14`). Âm = đang giảm |
| `requiredRateKgPerWeek` | `number \| null` | thiếu MA7 hôm nay / `targetWeightKg` / `targetDate`, hoặc `targetDate` đã qua hoặc rơi đúng hôm nay |
| `onTrack` | `boolean \| null` | thiếu một trong hai tốc độ để so |

**Cả khối `goal` neo vào HÔM NAY, không neo vào `to`** (`summary.response.ts:27-31`, `summary.service.ts:43`). Người dùng mở biểu đồ tháng trước vẫn cần biết mình đang đứng ở đâu *hôm nay*. Hệ quả trực tiếp lên khoảng query — §3 vế thứ ba. Test `summary.controller.test.ts:287-301`.

---

## 3. Khoảng ngày phải query rộng hơn khoảng người dùng xin

**Đây là bug dễ lọt nhất của feature này.** Query đúng `[from, to]` cho `BodyLog` sẽ chạy, trả 200, không báo lỗi gì — chỉ là vài trường ra `null` oan và không ai nhận ra cho tới khi biểu đồ trông kỳ lạ. Ba test riêng canh ba vế bên dưới.

Công thức thật, `services/summary.service.ts:50-54`:

```
MA7_LOOKBACK_DAYS   = 6      // service.ts:25
TREND_LOOKBACK_DAYS = 14     // service.ts:28
trendFrom = today - 14

dataFrom = min( from - 6 , trendFrom - 6 )   =  min( from - 6 , today - 20 )
dataTo   = max( to , today )
```

`min`/`max` là hai helper so sánh chuỗi `earlier`/`later` (`summary.service.ts:30-36`) — so sánh chuỗi `"YYYY-MM-DD"` chính là so sánh thứ tự thời gian, không cần parse.

`BodyLog` được query trên `[dataFrom, dataTo]` (`summary.service.ts:57`).

### Vế 1 — lùi 6 ngày trước `from`

Cửa sổ MA7 của một ngày `d` là **`[d-6, d]`**, tính theo ngày lịch. Muốn `days[0].weightMa7` (tức MA7 của chính ngày `from`) đúng thì phải có dữ liệu từ `from - 6`.

Thiếu vế này: 6 ngày đầu của mọi khoảng truy vấn ra `weightMa7 = null` (hoặc tệ hơn — ra một số tính trên cửa sổ bị cắt cụt, thấp/cao sai lệch). Người dùng chọn "30 ngày gần nhất" sẽ thấy đường MA7 cụt mất đầu mỗi lần.

Test canh: `summary.controller.test.ts:145-161` — seed 3 điểm ở `today-62/-61/-60`, hỏi khoảng đúng một ngày `[today-60, today-60]`, kỳ vọng `weightMa7 ≈ 72` (trung bình cả ba), **không phải `null` và không phải `74`** (giá trị của riêng ngày đó).

### Vế 2 — lùi trước hôm nay đủ xa (`today - 20`)

`currentRateKgPerWeek` so MA7 hôm nay với MA7 tại `today - 14`. Nhưng mốc `today - 14` **cũng là một MA7**, nên cửa sổ của nó còn lùi thêm 6 ngày nữa → cần dữ liệu tới `today - 20`. Đó là `trendFrom - 6` trong công thức.

Thiếu vế này (ví dụ chỉ lấy `from - 6`): khi người dùng xem một khoảng ngắn gần đây — `[today-2, today]` chẳng hạn — thì `from - 6 = today - 8`, các điểm ở `today-14`/`today-15` bị bỏ sót, `currentRateKgPerWeek` ra `null`, kéo theo `onTrack` cũng `null`. Thẻ tiến độ trên trang Biểu đồ trống trơn dù DB đầy dữ liệu.

Test canh: `summary.controller.test.ts:254-285` — khoảng truy vấn `[today-2, today]`, seed thêm hai điểm ở `today-15`/`today-14`, kỳ vọng `currentRateKgPerWeek ≈ -0.5`.

Lưu ý `dataFrom` lấy **`min`** chứ không phải `from - 6`: khi `from` đã cũ hơn `today - 20` thì `from - 6` tự khắc bao trùm; khi `from` gần hôm nay thì `today - 20` mới là biên thật.

### Vế 3 — kéo tới hôm nay (`max(to, today)`)

Khối `goal` neo vào hôm nay (§2). Nếu `to` nằm trong quá khứ mà chỉ query tới `to` thì không có số đo nào của hôm nay → `currentMa7WeightKg = null` → `remainingKg`, `currentRateKgPerWeek`, `requiredRateKgPerWeek`, `onTrack` đổ `null` theo dây chuyền.

Thiếu vế này: mở biểu đồ của tháng trước là mất sạch thẻ tiến độ.

Test canh: `summary.controller.test.ts:287-301` — seed số đo ở `today-1`/`today`, hỏi khoảng `[today-60, today-58]`, kỳ vọng `currentMa7WeightKg ≈ 70` và `remainingKg ≈ 0`.

### Dữ liệu thừa không rò ra ngoài

`bodyLogs` rộng hơn `[from, to]` nhưng chỉ được dùng qua `Map` tra cứu; `days` vẫn chỉ liệt kê `enumerateDates(range.from, range.to)` (`summary.service.ts:81`). `weeklySummaries` cũng tự lọc lại khoảng bằng `inRange` (`shared/stats/weekly.ts:49`) — comment ở `summary.service.ts:97` nói rõ điều này.

---

## 4. `Meal` chỉ query đúng `[from, to]`

`summary.service.ts:59` truyền `range.from, range.to` — **không** phải `dataFrom, dataTo`.

Vì **calo không đi vào bất kỳ phép trung bình trượt nào.** `totalCalories`/`mealCount` là con số của riêng một ngày; `avgCalories` là trung bình trong phạm vi một tuần, không có cửa sổ nào tràn ra ngoài khoảng. Không có gì ở ngày `from - 1` ảnh hưởng tới bất kỳ trường calo nào bên trong `[from, to]`.

Khác hẳn `BodyLog`, nơi mỗi giá trị đều bị đọc lại bởi tới 7 cửa sổ MA7 khác nhau, và khối `goal` còn cần các cửa sổ neo ở hôm nay.

Hệ quả cần biết: khi `to` ở quá khứ, `bodyLogs` chạy tới hôm nay nhưng `mealTotals` thì không — đúng chủ ý, vì `goal` không có trường calo nào neo vào hôm nay.

---

## 5. Ranh giới: feature này KHÔNG chứa công thức nào

Ghi thẳng ở đầu service (`summary.service.ts:15-18`). Service chỉ làm ba việc: lấy dữ liệu → nối vào hàm thuần ở `shared/stats` → xếp lại hình dạng response.

Toàn bộ phép tính nằm ở `shared/stats` và có unit test riêng: `movingAverage7`, `currentRateKgPerWeek`, `requiredRateKgPerWeek`, `isOnTrack`, `remainingKg`, `weeklySummaries` (import ở `summary.service.ts:2-9`). Định nghĩa chính xác từng hàm: [`docs/overview/03-stats.md`](../../overview/03-stats.md). **Không chép lại vào đây, và không suy diễn lại từ đây.**

> Nếu bạn thấy mình đang viết `/ 7`, `reduce(...)` để cộng trung bình, hay `.filter()` rồi chia độ dài trong bất kỳ file nào của `features/summary/` — bạn đang viết công thức sai chỗ. Nó thuộc `shared/stats/`.

Những phép tính duy nhất được phép ở đây là số học ngày tháng của chính khoảng query (`addDays` ở `summary.service.ts:44,51,52`) — nó là logic *lấy dữ liệu*, không phải logic *thống kê*.

Ranh giới thứ hai, ở tầng repository: **`summary` không gọi sang repository của `bodyLogs` / `meals` / `goal`** (`repositories/summary.repository.ts:4-12`). Nó là feature chỉ-đọc; phụ thuộc vào ba feature khác là cách chắc chắn nhất để một thay đổi nhỏ bên đó làm vỡ dashboard. `summary.repository.ts` là file duy nhất của feature import `prisma`.

---

## 6. Quyết định vượt spec

### 6.1 `currentMa7WeightKg` và `currentRateKgPerWeek` vẫn trả số khi CHƯA đặt mục tiêu

Spec §5 chỉ vẽ hình dạng `goal` cho trường hợp đã có mục tiêu, không nói gì về trường hợp chưa đặt. Quyết định: hai trường này **là sự thật về cân nặng, không phải sự thật về mục tiêu** — chúng tính được từ mỗi `BodyLog`, không cần biết mục tiêu là gì. Ghi ở `summary.service.ts:112-114`.

Cụ thể, khi `Goal` chưa tồn tại (`goal = null`):
- `currentMa7WeightKg`, `currentRateKgPerWeek` → vẫn trả số nếu đủ dữ liệu cân nặng;
- `targetWeightKg`, `targetDate`, `dailyCalorieTarget`, `remainingKg`, `requiredRateKgPerWeek`, `onTrack` → `null`, **không phải nhờ một nhánh `if` nào** mà vì các hàm ở `shared/stats` nhận `targetWeightKg = null` và tự trả `null`.

Lợi ích thực dụng: web hiển thị được "bạn đang 73 kg, tuần này giảm 0.4 kg" ngay từ trước khi người dùng chịu đặt mục tiêu. Test `summary.controller.test.ts:239-252`.

### 6.2 Gộp calo theo ngày bằng Prisma `groupBy` ở tầng DB

`repositories/summary.repository.ts:64-69` dùng `prisma.meal.groupBy({ by: ['date'], _sum, _count })` thay vì `findMany` rồi cộng trong JS.

Vì sao: khoảng truy vấn tối đa là 730 ngày, mỗi ngày có thể 3–6 bữa → vài nghìn dòng kéo về chỉ để cộng lại thành vài trăm con số. `groupBy` trả đúng một dòng mỗi ngày (`DailyMealTotal`, `summary.repository.ts:20-25`), và SQLite làm phép cộng nhanh hơn vòng lặp JS trên mảng vừa deserialize.

Đánh đổi có chủ ý: **ngày không ghi bữa nào KHÔNG có dòng** trong kết quả `groupBy`. Đó là tính năng chứ không phải thiếu sót — nó là điều kiện để `weeklySummaries` phân biệt "ngày nhịn ăn" với "ngày quên ghi" (`summary.repository.ts:50-54`). Service tự bù `0` cho khối `days` (`summary.service.ts:90-91`), còn khối `weeks` thì cố ý **không** bù.

### 6.3 Ba truy vấn chạy song song

`Promise.all` ở `summary.service.ts:56-61`. Ba truy vấn độc lập nhau, không có cái nào cần kết quả của cái kia.

### 6.4 Một lần gọi `movingAverage7` cho cả hai đầu xu hướng

`summary.service.ts:74` gọi `movingAverage7(weightPoints, trendFrom, today)` một lần rồi lấy ra cả `ma7Today` lẫn `ma7TwoWeeksAgo` từ cùng một `Map` (`summary.service.ts:75-76`), thay vì gọi hai lần cho hai ngày lẻ.

---

## 7. Cảnh báo kỹ thuật: đừng chú thích kiểu cho kết quả `groupBy`

Comment gốc ở `repositories/summary.repository.ts:59-63`.

```ts
// ĐÚNG — để suy kiểu tự chạy
const groups = await prisma.meal.groupBy({ ... });

// SAI — TS2345
const groups: MealGroup[] = await prisma.meal.groupBy({ ... });
```

`groupBy` suy generic **ngược từ kiểu trả về**: nó dùng kiểu bạn khai báo cho biến đích để chốt tham số kiểu, rồi đem argument object đi so với `args & MealGroup[]`. Kết quả là `TS2345` với một thông báo lỗi dài và gần như không đọc được, tố cáo đúng cái argument vốn hoàn toàn hợp lệ.

Cần một kiểu có tên để truyền đi tiếp thì **map sang interface của mình sau khi đã nhận kết quả** — đúng như `summary.repository.ts:71-76` đang làm với `DailyMealTotal`. Đừng chú thích ở chỗ nhận.

Cùng lý do đó, `group._sum.calories` vẫn là nullable trong kiểu dù `groupBy` không bao giờ sinh nhóm rỗng — nên có `?? 0` ở `summary.repository.ts:74`.

---

## 8. Tham chiếu

- Công thức thống kê: [`docs/overview/03-stats.md`](../../overview/03-stats.md) — **nguồn chân lý duy nhất cho MA7, `currentRate`, `onTrack`, `remainingKg`**
- Spec gốc: `docs/archive/2026-08-06-original-design.md` §5 (hình dạng `GET /summary`), §6 (logic thống kê)
- Kiến trúc 4 lớp và ranh giới feature: [`docs/overview/01-architecture.md`](../../overview/01-architecture.md)
- Trạng thái thi công, lệnh verify, việc còn treo: [`PLAN.md`](PLAN.md)
