# Feature `web-charts` — Trang "Biểu đồ"

Trang 2 của web (`web/src/features/charts/`). Chỉ đọc, không có form, không gửi `POST`/`PUT`/`DELETE` nào. Nhiệm vụ duy nhất: biến một lần gọi `GET /api/summary` thành ba biểu đồ và một thẻ tiến độ, sao cho người dùng nhìn ra **xu hướng** chứ không nhìn ra **nhiễu**.

**Trạng thái: CHƯA CÓ CODE.** File này là định hướng cho người implement, không mô tả code có thật — khác với SPEC của các feature backend. Trạng thái thi công và thứ tự làm: [`PLAN.md`](PLAN.md).

Công thức thống kê **không nằm ở đây**. Nguồn chân lý duy nhất là [`docs/overview/03-stats.md`](../../overview/03-stats.md); hợp đồng API là [`docs/features/summary/SPEC.md`](../summary/SPEC.md) — backend đã xong, 208 test pass. Trang này không tính lại bất cứ thứ gì backend đã tính.

---

## 1. Trang này để làm gì

Trả lời bốn câu hỏi, theo đúng thứ tự ưu tiên:

1. **Cân nặng tôi đang đi hướng nào?** — không phải "hôm nay tôi nặng bao nhiêu" (đó là việc của trang Hôm nay).
2. **Vòng bụng có đi cùng hướng với cân nặng không?**
3. **Tôi ăn bao nhiêu calo mỗi ngày, so với mục tiêu?**
4. **Với tốc độ hiện tại, tôi có kịp mục tiêu không?**

Nguồn: [`2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md) §7, mục "Trang 2 — Biểu đồ".

Ngoài phạm vi: sửa/thêm dữ liệu (trang Hôm nay), đặt mục tiêu và nhắc nhở (trang Cài đặt), xuất file, so sánh nhiều khoảng cạnh nhau.

---

## 2. Dữ liệu: đúng một lời gọi `GET /api/summary?from=&to=`

Cả trang sống bằng **một** request. Không gọi `GET /api/body-logs`, không gọi `GET /api/meals`, không gọi `GET /api/goal` — mọi thứ trang cần đã nằm trong response của `summary`, và gọi thêm chỉ tạo ra hai nguồn sự thật lệch nhau.

### 2.1 Query

| Tham số | Kiểu | Ràng buộc (backend, `commonSchemas.ts`) |
|---|---|---|
| `from` | `"YYYY-MM-DD"` | ngày có thật |
| `to` | `"YYYY-MM-DD"` | ngày có thật, `from <= to`, độ dài khoảng `< 730` ngày |

Vi phạm → `400` với hình dạng lỗi chung ([`04-conventions.md`](../../overview/04-conventions.md) §"Hình dạng lỗi"). **`from`/`to` không bị cấm nằm ở tương lai** — xem §7.3.

Backend tự động query một khoảng dữ liệu **rộng hơn** `[from, to]` để MA7 ở ngày đầu khoảng và khối `goal` (neo vào hôm nay) đều đúng ([`summary/SPEC.md`](../summary/SPEC.md) §3). Web **không cần** và **không được** tự nới `from` ra để bù — làm vậy sẽ vẽ thừa ngày mà người dùng không xin.

### 2.2 `days: SummaryDay[]` — trục ngày của cả ba biểu đồ

**Đúng một phần tử cho mỗi ngày lịch trong `[from, to]`, tăng dần, kể cả ngày không có dữ liệu.** Đây là hợp đồng đã chốt ([`summary/PLAN.md`](../summary/PLAN.md) §4.4): mảng không bao giờ rỗng, không bao giờ thiếu ngày. Web **không tự sinh danh sách ngày** rồi ghép — cứ `days` mà vẽ.

| Trường | Kiểu | Trang này dùng để vẽ gì |
|---|---|---|
| `date` | `string` | trục X của cả ba biểu đồ |
| `weightKg` | `number \| null` | điểm thô, biểu đồ cân nặng — **mờ, phụ** |
| `weightMa7` | `number \| null` | đường MA7, biểu đồ cân nặng — **đậm, chính** |
| `waistCm` | `number \| null` | điểm thô, biểu đồ vòng bụng |
| `waistMa7` | `number \| null` | đường MA7, biểu đồ vòng bụng |
| `totalCalories` | `number` | chiều cao cột, biểu đồ calo. **Không bao giờ `null`** — ngày không ghi bữa là `0` |
| `mealCount` | `number` | không vẽ; dùng trong tooltip và để phân biệt "0 calo vì nhịn" với "0 vì quên ghi" (`mealCount === 0`) |

### 2.3 `weeks: SummaryWeek[]` — lớp trung bình tuần

**Mọi tuần chạm vào khoảng đều xuất hiện**, kể cả tuần rỗng, tăng dần theo `weekStart`.

| Trường | Kiểu | Trang này dùng để vẽ gì |
|---|---|---|
| `weekStart` | `string` | thứ Hai của tuần — mốc trên trục X |
| `avgCalories` | `number \| null` | đường "trung bình tuần" chồng lên biểu đồ calo. `null` = **cả tuần không ghi bữa nào**, xem §4.3 |
| `avgWeightKg` | `number \| null` | trung bình cân nặng **thô** trong tuần (không phải MA7). §7.4 hỏi có nên vẽ không |

Cạm bẫy tuần cắt cụt: §4.4.

### 2.4 `goal: SummaryGoal` — thẻ tiến độ + hai đường ngang

**Là object, không bao giờ `null`.** Chưa đặt mục tiêu thì các trường phụ thuộc mục tiêu là `null`, nhưng `currentMa7WeightKg` và `currentRateKgPerWeek` **vẫn có số** nếu đủ dữ liệu cân nặng ([`summary/SPEC.md`](../summary/SPEC.md) §6.1) — trang phải hiển thị được "bạn đang 73 kg, tuần này giảm 0.4 kg" ngay cả khi người dùng chưa chịu đặt mục tiêu.

| Trường | Kiểu | Trang này dùng để vẽ gì |
|---|---|---|
| `targetWeightKg` | `number \| null` | `ReferenceLine` ngang trên biểu đồ cân nặng |
| `targetDate` | `string \| null` | hiển thị trong thẻ tiến độ (không vẽ đường dọc — có thể nằm ngoài khoảng) |
| `dailyCalorieTarget` | `number \| null` | `ReferenceLine` ngang trên biểu đồ calo |
| `currentMa7WeightKg` | `number \| null` | thẻ tiến độ: "hiện tại" |
| `remainingKg` | `number \| null` | thẻ tiến độ: "còn lại". **Luôn dương** — hướng đọc từ dấu của `requiredRateKgPerWeek`, đừng suy ra từ trường này |
| `currentRateKgPerWeek` | `number \| null` | thẻ tiến độ: "tốc độ hiện tại". Âm = đang giảm |
| `requiredRateKgPerWeek` | `number \| null` | thẻ tiến độ: "tốc độ cần thiết" |
| `onTrack` | `boolean \| null` | thẻ tiến độ: badge. **Ba trạng thái, không phải hai** — `null` = chưa đủ dữ liệu để kết luận, phải hiện khác hẳn `false` |

**Cả khối `goal` neo vào HÔM NAY, không neo vào `to`.** Mở biểu đồ của tháng trước thì các biểu đồ nói về tháng trước, còn thẻ tiến độ vẫn nói về hôm nay ([`summary/SPEC.md`](../summary/SPEC.md) §2). Nhãn trên thẻ phải ghi rõ điều đó, nếu không người dùng sẽ đọc nó như số liệu của khoảng đang xem.

Mỗi trường `null` là một trạng thái phải có cách hiển thị riêng (`—`, không phải `0`, không phải chuỗi rỗng, không phải `NaN`).

---

## 3. Các biểu đồ cần có

Theo [`2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md) §7. Thư viện đã chốt: **Recharts 3** ([`01-architecture.md`](../../overview/01-architecture.md), bảng lựa chọn kỹ thuật) — không đề xuất thư viện khác.

### 3.1 Bộ chọn khoảng

30 ngày / 90 ngày / 1 năm / tùy chọn. Đổi lựa chọn → tính lại `from`/`to` → gọi lại `/api/summary`. Mặc định khi mở trang: §7.1.

### 3.2 Biểu đồ cân nặng

`ComposedChart` trên `days`:

- **Đường MA7** từ `weightMa7` — nét liền, đậm, là thứ đập vào mắt trước.
- **Điểm thô** từ `weightKg` — mờ, nhỏ, không cạnh tranh với MA7. Xem §4.1, đây là cạm bẫy số một của cả trang.
- **`ReferenceLine`** ngang tại `goal.targetWeightKg` (bỏ qua nếu `null`).

### 3.3 Biểu đồ vòng bụng

Cùng cách trình bày, đọc `waistCm` / `waistMa7`. **Không có đường mục tiêu** — model `Goal` không có trường vòng bụng ([`02-data-model.md`](../../overview/02-data-model.md)). Đừng bịa ra một đường ngang cho nó.

### 3.4 Biểu đồ calo

`ComposedChart` trộn cột và đường:

- **Cột theo ngày** từ `days[].totalCalories`.
- **`ReferenceLine`** ngang tại `goal.dailyCalorieTarget` (bỏ qua nếu `null`).
- **Đường trung bình tuần** từ `weeks[].avgCalories`. Hai mảng khác độ dài — cách ghép: §5.2. Cạm bẫy `null`: §4.3.

### 3.5 Thẻ tiến độ mục tiêu

Bốn số từ khối `goal`: `remainingKg`, `currentRateKgPerWeek`, `requiredRateKgPerWeek`, `onTrack`. Không phải biểu đồ, nhưng là thứ người dùng nhìn lâu nhất. Nhớ ba trạng thái của `onTrack` và chuyện `goal` neo vào hôm nay (§2.4).

---

## 4. Bốn cạm bẫy bắt buộc

**Đây là phần quan trọng nhất của tài liệu này.** Bốn mục dưới đây đều là những lỗi *chạy được, không báo lỗi, trông như đúng* — và đều nói dối người dùng. Ba trong bốn đã nằm sẵn ở mục "Cạm bẫy đã biết" của [`CLAUDE.md`](../../../CLAUDE.md).

### 4.1 MA7 phải nổi bật hơn điểm thô

**Cân nặng dao động 1–2 kg/ngày là bình thường** — nước, muối, thời điểm cân, ruột đầy hay rỗng. Nếu điểm thô được vẽ đậm hơn hoặc ngang bằng đường MA7, người dùng sẽ đọc cái nhiễu đó thành xu hướng: hôm nay tăng 1.2 kg sau ba ngày ăn kiêng nghiêm túc → nản → bỏ. Đây không phải vấn đề thẩm mỹ, nó là lý do tồn tại của biểu đồ này.

Quy tắc: **đường MA7 là nhân vật chính, điểm thô là bằng chứng phụ.**

Đề xuất cụ thể (implement có thể chỉnh sắc độ, nhưng không được đảo thứ bậc):

| Lớp | Đề xuất |
|---|---|
| MA7 (`weightMa7`) | `<Line type="monotone" strokeWidth={2.5} dot={false} />`, màu đậm, **vẽ sau** để nằm trên |
| Điểm thô (`weightKg`) | `strokeOpacity` thấp (~0.25–0.35) hoặc `stroke="none"`, `strokeDasharray="3 3"` nếu vẫn muốn có nét nối, `dot={{ r: 2 }}` — chấm nhỏ, mờ |

Trong Recharts, thứ tự khai báo con quyết định thứ tự vẽ: khai báo `Line` của điểm thô **trước**, `Line` của MA7 **sau**, để MA7 nằm trên khi hai đường chạm nhau.

Legend phải gọi tên rõ: "Trung bình 7 ngày" và "Số đo từng ngày" — không phải "weightMa7" / "weightKg".

Áp dụng y nguyên cho biểu đồ vòng bụng.

### 4.2 `weightMa7 === null` — ngắt đoạn, không nội suy

MA7 trả `null` khi **cửa sổ 7 ngày lịch `[d-6, d]` có dưới 2 giá trị** (định nghĩa chính xác: [`03-stats.md`](../../overview/03-stats.md), mục "Trung bình trượt 7 ngày"). Một điểm đơn lẻ không phải là trung bình; vẽ nó như thể là trung bình chính là điều `null` được sinh ra để ngăn.

Hai cách làm hỏng chuyện này:

1. **`weightMa7 ?? weightKg`** hoặc `?? 0` hoặc `?? giá trị trước đó` khi map dữ liệu cho chart. Tuyệt đối không. `null` là một câu trả lời có nghĩa ("chưa đủ dữ liệu"), không phải dữ liệu thiếu cần vá.
2. **`connectNulls={true}`** trên `<Line>`. Recharts sẽ nối thẳng qua lỗ hổng, vẽ ra một đoạn xu hướng mượt mà hoàn toàn không tồn tại — nguy hiểm nhất đúng ở đoạn người dùng nghỉ cân vài ngày.

Trong Recharts 3, mặc định của `connectNulls` là **`false`** (`LineDrawShape.tsx`: `connectNulls ?? false`) — tức hành vi mặc định đã đúng. Cạm bẫy là ai đó *bật nó lên* cho "đẹp". **Vẫn ghi `connectNulls={false}` tường minh** trên cả bốn đường MA7/điểm thô, kèm comment trỏ về mục này, để lần sau có người định sửa thì họ phải đọc lý do trước.

Điều kiện để mặc định đó hoạt động: giá trị phải thật sự là `null`/`undefined` trong mảng data. Đi thẳng từ `days` sang `data` của chart là đạt yêu cầu — miễn là không có bước "làm sạch" nào ở giữa.

### 4.3 `avgCalories === null` khác hoàn toàn `0`

`avgCalories` của một tuần là `null` khi **cả tuần không ghi bữa nào**. Và ngay cả trong tuần có ghi, trung bình chỉ tính trên **các ngày có ít nhất một bữa** — ngày quên ghi bị bỏ qua chứ không tính là 0 ([`03-stats.md`](../../overview/03-stats.md), mục "Tuần"). Backend cố ý **không** bù 0 cho khối `weeks` ([`summary/SPEC.md`](../summary/SPEC.md) §6.2).

Vẽ `null` thành cột/điểm 0 là **nói với người dùng rằng họ nhịn ăn cả tuần**. Đó là một lời nói dối, và nếu họ tin thì nó còn là một lời nói dối về sức khỏe.

Quy tắc:

- **Không `?? 0`** ở bất kỳ đâu trên đường dẫn từ `weeks[].avgCalories` tới chart.
- Đường trung bình tuần: `connectNulls={false}` — tuần `null` là một lỗ hổng thật, nối qua nó vẽ ra một xu hướng ăn uống không có thật ([`summary/PLAN.md`](../summary/PLAN.md) §4.1 để ngỏ chính câu hỏi này; chốt ở đây là **ngắt đoạn**).
- Tooltip cho tuần `null`: "Không ghi bữa nào" — **không phải** "0 kcal".

Phân biệt tương tự ở cấp ngày: `days[].totalCalories` **không bao giờ `null`**, ngày không ghi bữa nào ra `0` (hợp đồng đã chốt, [`summary/SPEC.md`](../summary/SPEC.md) §2). Nghĩa là biểu đồ cột calo *sẽ* có những cột 0 mà bản chất là "quên ghi". Dùng `mealCount === 0` để nói đúng chuyện đó trong tooltip thay vì để người dùng tự suy. Recharts 3 bỏ qua hẳn giá trị `null` khi dựng `Bar` (`computeBarRectangles` trả `null` rồi `.filter(Boolean)`), nhưng ở đây không dùng được vì backend đã trả `0` — khác biệt phải thể hiện bằng tooltip/màu, không bằng chiều cao cột.

### 4.4 Tuần đầu và tuần cuối có thể bị cắt cụt — hạn chế đã biết

`weekStart` luôn là **thứ Hai**, kể cả khi thứ Hai đó nằm **ngoài** `[from, to]`. Nếu `from` rơi vào thứ Năm, phần tử đầu của `weeks` mang `weekStart` là thứ Hai trước đó, nhưng trung bình **chỉ tính trên phần ngày thật sự nằm trong khoảng** ([`summary/PLAN.md`](../summary/PLAN.md) §4.2).

Hệ quả: một tuần chỉ có 3 ngày trong khoảng vẫn hiện như một điểm **bình đẳng** với các tuần đủ 7 ngày ở giữa. Trung bình của 3 ngày nhiễu hơn nhiều so với trung bình của 7 ngày, và người dùng không có cách nào biết.

**`SummaryWeek` KHÔNG có trường nào đánh dấu tuần cắt cụt** — chỉ có đúng ba trường `weekStart` / `avgCalories` / `avgWeightKg`. Đây là **hạn chế đã biết của hợp đồng**, không phải thiếu sót cần vá vội.

Ba lựa chọn cho web, phải chốt một trước khi code (xem §7.5):

| Lựa chọn | Được | Mất |
|---|---|---|
| **A. Bỏ tuần cắt cụt khi vẽ** — client tự so `weekStart` và `weekStart + 6` với `[from, to]`, tuần nào không lọt trọn thì không vẽ | Mọi điểm trên biểu đồ so sánh ngang hàng được | Mất tới 2 tuần ở hai đầu; khoảng 30 ngày chỉ còn 3 điểm |
| **B. Vẫn vẽ, có chú thích** — làm mờ / đổi dạng chấm / tooltip ghi "tuần chưa trọn (3/7 ngày)" | Không mất dữ liệu | Phải tự tính số ngày trong khoảng ở client |
| **C. Thêm trường vào response** | Sạch nhất về lâu dài | **Đổi hợp đồng API** — phải sửa `shared/stats/weekly.ts`, không sửa trong `features/summary/`. Không làm trong phạm vi trang này |

Cả A và B đều tính được ở client **chỉ từ `from`/`to` và `weekStart`**, không cần gọi thêm API. Nếu chọn C thì phải bàn với feature `summary` trước — backend cố ý không tự quyết vì `weeks` còn có thể dùng cho bảng số, nơi mọi tuần đều đáng hiện.

---

## 5. Ghi chú kỹ thuật Recharts 3

Không phải cạm bẫy chết người như §4, nhưng đều làm biểu đồ đọc sai.

### 5.1 Trục Y của cân nặng không được bắt đầu từ 0

Mặc định `YAxis` của Recharts kéo domain về 0. Với cân nặng quanh 70 kg, một đợt giảm 3 kg trở thành một đường gần như phẳng ở mép trên biểu đồ — đúng về mặt số học, vô dụng về mặt thông tin. Dùng `domain={['dataMin - 1', 'dataMax + 1']}` (hoặc padding tương đương) cho biểu đồ cân nặng và vòng bụng.

Biểu đồ calo thì **ngược lại**: cột phải bắt đầu từ 0, vì chiều cao cột là thứ người ta so sánh.

### 5.2 Ghép `weeks` vào biểu đồ calo

`days` và `weeks` khác độ dài, không đưa thẳng hai mảng vào một `ComposedChart` được. Hai cách, chọn một và ghi rõ trong code:

- **Ghép vào `days`**: mỗi ngày mang thêm trường `weekAvgCalories` = `avgCalories` của tuần chứa ngày đó → đường trung bình tuần thành đường bậc thang, khớp trục X sẵn có. Tuần `null` để nguyên `null` (§4.3) — cả 7 ngày của tuần đó thành lỗ hổng, đúng ý.
- **Chart riêng cho `weeks`**: một biểu đồ cột tuần đặt dưới biểu đồ ngày, trục X là `weekStart`.

Cách thứ nhất bám sát §7 của spec gốc ("cột theo ngày + đường trung bình tuần" trên **cùng một** biểu đồ).

### 5.3 Format và tooltip

- Trục X hiển thị ngày rút gọn (`dd/MM`), nhưng tooltip hiện đủ `YYYY-MM-DD` — biểu đồ 1 năm mà chỉ có `dd/MM` thì mốc tháng 8 năm nào là mơ hồ.
- Tooltip formatter phải xử lý `null` → `—`, **không** để lọt `NaN`, `null`, hay `0` giả.
- Hàm format số dùng chung đặt ở `web/src/lib/format.ts` ([`01-architecture.md`](../../overview/01-architecture.md)), không viết lại trong từng component.
- `date` là **chuỗi**, không phải `Date` ([`04-conventions.md`](../../overview/04-conventions.md)). Đừng `new Date(day.date)` rồi format lại bằng giờ máy — đó là đúng cái lỗi lệch múi giờ mà cả dự án đang tránh. So sánh chuỗi `"YYYY-MM-DD"` chính là so sánh thứ tự thời gian.

---

## 6. Trạng thái rỗng

**DB trắng KHÔNG cho ra mảng rỗng.** `days` vẫn đủ độ dài khoảng đã hỏi, mọi `weightKg`/`weightMa7`/`waistCm`/`waistMa7` là `null`, `totalCalories`/`mealCount` là `0`; `weeks` vẫn liệt kê đủ tuần với `avg*` là `null`; `goal` là object với mọi trường `null` ([`summary/PLAN.md`](../summary/PLAN.md) §4.4, có test canh trên DB rỗng).

Nghĩa là: **`days.length > 0` không có nghĩa là có dữ liệu.** Kiểm tra `days.length` để quyết định vẽ hay không là sai, và kết quả là một biểu đồ trống trơn với trục đầy đủ — cái mà [`2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md) §7 "Xử lý trạng thái rỗng" cấm thẳng.

Quy tắc:

- Điều kiện "có xu hướng để vẽ" của biểu đồ cân nặng: **đếm số ngày có `weightMa7 !== null`** (hoặc tối thiểu, số ngày có `weightKg !== null` ≥ 2). Tương tự cho vòng bụng với `waistMa7`, và cho calo với `totalCalories > 0` / `mealCount > 0`.
- Chưa đủ → thay biểu đồ bằng thông điệp mời ghi dữ liệu, đúng tinh thần spec gốc: **"Cần ít nhất 2 ngày dữ liệu để vẽ xu hướng"**. Không vẽ biểu đồ trống, không vẽ số 0.
- **Xét từng biểu đồ riêng.** Người mới dùng thường ghi cân nặng vài ngày trước khi chịu ghi bữa ăn — che cả trang vì chưa có calo là sai.
- Thẻ tiến độ có trạng thái rỗng riêng: chưa đặt mục tiêu (`targetWeightKg === null`) → mời sang trang Cài đặt; đã đặt nhưng `currentMa7WeightKg === null` → "chưa đủ số đo trong 7 ngày gần nhất".
- Trạng thái đang tải và trạng thái lỗi mạng/`400` là hai thứ khác, không được gộp vào trạng thái rỗng.

---

## 7. Câu hỏi mở

Chưa ai chốt. Người implement phải chốt (hoặc hỏi) trước khi code, và ghi kết quả ngược lại vào file này.

### 7.1 Khoảng mặc định khi mở trang

30 ngày là ứng viên hiển nhiên: đủ để MA7 chạy hết, đủ ngắn để thấy chuyển động. Nhưng người dùng mới chỉ có 5 ngày dữ liệu sẽ thấy 25 ngày trống ở đầu biểu đồ. Cân nhắc: cố định 30 ngày, hay co theo dữ liệu thực có?

Ghi chú: co theo dữ liệu thực **cần biết ngày ghi đầu tiên**, mà `/api/summary` không trả trường đó — sẽ phải gọi thêm API hoặc thêm trường. Đó là lý do 30 ngày cố định có lẽ là câu trả lời đúng cho bản này.

### 7.2 Bộ chọn khoảng: mức độ

Spec gốc ghi "30 ngày / 90 ngày / 1 năm / tùy chọn". "Tùy chọn" cần hai ô date — có làm ngay trong bản đầu không, hay ba nút cố định là đủ? Ba nút cố định thì không bao giờ chạm biên 730 ngày, không bao giờ sinh `from > to`, và không cần xử lý `400` từ backend.

### 7.3 `from`/`to` hiện KHÔNG bị cấm nằm ở tương lai

`dateRangeSchema` dùng `dateString` chứ không dùng `pastOrTodayDateString` ([`summary/PLAN.md`](../summary/PLAN.md) §4.3). Hỏi `to = today + 30` trả `200` với 30 phần tử `days` toàn `null`/`0` ở đuôi — tức **một khoảng trống dài ở cuối mọi biểu đồ**, trông y hệt "bạn đã bỏ ghi cả tháng".

Đây **không phải bug** (khớp bảng validate của spec gốc: quy tắc "không được ở tương lai" chỉ gắn cho `date` của bản ghi, không gắn cho `from`/`to`), nhưng cũng chưa ai quyết là muốn thế.

Ba nút cố định (§7.2) không bao giờ sinh `to` tương lai. Câu hỏi chỉ phát sinh nếu làm "tùy chọn": kẹp `to` về hôm nay ở client là đủ và rẻ nhất. **Sửa `dateRangeSchema` ở backend là lựa chọn đắt** — nó dùng chung với `GET /api/body-logs?from=&to=`, phải bàn với feature đó trước.

### 7.4 `weeks[].avgWeightKg` có được vẽ không?

§7 của spec gốc không nhắc tới nó. Nó là trung bình cân nặng **thô** theo tuần — về mặt thông tin gần trùng với đường MA7 đã có, và vẽ cả hai lên một biểu đồ là quay lại đúng vấn đề §4.1 (thêm nhiễu cạnh tranh với nhân vật chính). Đề xuất mặc định: **không vẽ**, giữ trường này cho một bảng số về sau.

### 7.5 Tuần cắt cụt: chọn A hay B?

Ba lựa chọn ở §4.4. Chưa chốt. Ảnh hưởng trực tiếp tới việc đường trung bình tuần có bao nhiêu điểm ở khoảng 30 ngày.

---

## 8. Tham chiếu

- Công thức: [`docs/overview/03-stats.md`](../../overview/03-stats.md) — **nguồn chân lý duy nhất**, không chép lại vào đây
- Hợp đồng API: [`docs/features/summary/SPEC.md`](../summary/SPEC.md) và [`PLAN.md`](../summary/PLAN.md) §4 (các câu hỏi để ngỏ cho web)
- Cấu trúc `web/src/features/<tên>/`: [`docs/overview/01-architecture.md`](../../overview/01-architecture.md)
- Quy ước chung, hình dạng lỗi, phiên bản thư viện: [`docs/overview/04-conventions.md`](../../overview/04-conventions.md)
- Mô tả giao diện gốc: [`docs/archive/2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md) §7
- Cạm bẫy toàn dự án: [`CLAUDE.md`](../../../CLAUDE.md), mục "Cạm bẫy đã biết"
- Trạng thái thi công, thứ tự bước, lệnh verify: [`PLAN.md`](PLAN.md)
