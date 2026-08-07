# Logic thống kê

File này trả lời: **MA7, tốc độ thay đổi, `onTrack`, `remainingKg` và tổng hợp tuần được định nghĩa chính xác như thế nào.** Đây là **nguồn chân lý về công thức** — không suy diễn lại, không nhân bản công thức sang chỗ khác.

Liên quan: [`01-architecture.md`](01-architecture.md) (vì sao `shared/stats/` nằm ngoài `features/`) · [`02-data-model.md`](02-data-model.md) (dữ liệu đầu vào) · [`04-conventions.md`](04-conventions.md) (ràng buộc chung).

---

## 6. Logic thống kê (`server/src/shared/stats/`)

> Đường dẫn cập nhật theo `CLAUDE.md`: `server/src/shared/stats/` (spec gốc ghi `src/shared/stats/`, cùng một chỗ).

Tất cả là hàm thuần, nhận mảng dữ liệu và trả kết quả — không đọc DB, không biết gì về HTTP.

Chia file theo miền: `movingAverage.ts` (MA7) · `rate.ts` (tốc độ, `onTrack`, `remainingKg`) · `weekly.ts` (tổng hợp tuần). Nằm ở `shared/` chứ không trong `features/` vì MA7 được dùng bởi cả `summary` lẫn `goal` — nhân bản công thức ra hai chỗ là cách chắc chắn nhất để hai chỗ lệch nhau.

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
