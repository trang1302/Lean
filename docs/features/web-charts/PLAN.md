# Feature `web-charts` — trạng thái thi công

**Trạng thái: CHƯA BẮT ĐẦU.** Không có file nào tồn tại. Thư mục `web/` chưa có trên đĩa.

Mô tả hành vi mong muốn: [`SPEC.md`](SPEC.md). File này chỉ nói **thứ tự làm** và **cách kiểm tra từng bước**.

---

## 1. Phụ thuộc — hiện đang CHẶN

| Thứ cần có | Trạng thái | Ai làm |
|---|---|---|
| `GET /api/summary` | **XONG**, 20 test pass ([`summary/PLAN.md`](../summary/PLAN.md)) | — |
| `web/` scaffold — `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` | **CHƯA CÓ** | task scaffold web, ngoài phạm vi feature này |
| `web/src/lib/apiClient.ts` | **CHƯA CÓ** | task scaffold web |
| `web/src/router/routes.tsx` — để cắm route `/charts` | **CHƯA CÓ** | task scaffold web |
| Recharts 3 trong `web/package.json` | **CHƯA CÀI** | bước 0 dưới đây |

**Không bắt đầu bước 1 khi hai dòng "CHƯA CÓ" đầu tiên chưa xong.** Cụ thể:

- **`web/src/lib/apiClient.ts` là chặn cứng.** Feature này **không** được tự `fetch()` trong `charts.api.ts`. Base URL, xử lý lỗi `400`/`404`/`500` theo hình dạng lỗi chung ([`04-conventions.md`](../../overview/04-conventions.md)) là việc của `apiClient`, dùng chung với `web-today` và `web-settings`. Viết `fetch` riêng ở đây là tạo ra ba cách xử lý lỗi khác nhau trong cùng một app.
- **Đừng scaffold `web/` từ trong task này.** `web-today` và `web-settings` cũng đang chờ cùng một scaffold; ba feature cùng tạo `package.json` là chắc chắn giẫm chân nhau.

Việc **làm được ngay khi bị chặn**: chốt bốn câu hỏi mở ở [`SPEC.md`](SPEC.md) §7 (đặc biệt §7.5 — tuần cắt cụt), vì chúng quyết định hình dạng của bước 4 và bước 6.

---

## 2. File dự kiến

Theo cấu trúc `web/src/features/<tên>/` của [`01-architecture.md`](../../overview/01-architecture.md).

```
web/src/features/charts/
├── api/charts.api.ts              # getSummary(from, to) — gọi qua lib/apiClient, KHÔNG fetch trực tiếp
├── hooks/useCharts.ts             # state: range → from/to → gọi api → { data, isLoading, error }
├── components/
│   ├── ChartsPage.tsx             # lắp trang: RangePicker + 3 chart + GoalCard
│   ├── RangePicker.tsx            # 30 / 90 / 365 / tùy chọn (SPEC §7.2)
│   ├── WeightChart.tsx            # điểm thô mờ + MA7 đậm + ReferenceLine mục tiêu
│   ├── WaistChart.tsx             # như trên, KHÔNG có đường mục tiêu (SPEC §3.3)
│   ├── CaloriesChart.tsx          # cột ngày + ReferenceLine mục tiêu ngày + đường TB tuần
│   ├── GoalProgressCard.tsx       # remainingKg / currentRate / requiredRate / onTrack
│   └── ChartEmptyState.tsx        # "Cần ít nhất 2 ngày dữ liệu để vẽ xu hướng"
├── types.ts                       # SummaryResponse, SummaryDay, SummaryWeek, SummaryGoal
├── utils/chartData.ts             # hàm thuần: đếm điểm có thật, ghép weeks vào days, lọc tuần cắt cụt
└── index.ts                       # export ChartsPage
```

Ghi chú về `types.ts`: soi gương `server/src/features/summary/dtos/summary.response.ts`. Chép tay là chấp nhận được ở bản này (không có bước sinh type tự động), nhưng **đổi response ở backend là phải sửa file này cùng lúc** — ràng buộc đã ghi ở [`summary/PLAN.md`](../summary/PLAN.md) §5. Nếu sau này ba feature web đều cần, chuyển lên `web/src/types/api.ts`.

Ghi chú về `utils/chartData.ts`: đây **không phải** chỗ tính lại thống kê. Mọi con số đã do backend tính. File này chỉ làm ba việc thuần túy hình dạng dữ liệu — đếm, ghép mảng, lọc — và tách ra để test được mà không cần render.

`WaistChart` gần như trùng `WeightChart`. Chấp nhận trùng lặp ở bước đầu; chỉ trừu tượng hóa thành một component chung sau khi cả hai đã chạy đúng và thấy rõ chỗ khác nhau (chỉ có đường mục tiêu và đơn vị).

---

## 3. Các bước

Mỗi bước có deliverable **nhìn thấy được hoặc test được**. Không gộp bước.

### Bước 0 — cài Recharts (chỉ khi scaffold `web/` đã xong)

```bash
cd web && npm install recharts
```

Deliverable: `recharts` phiên bản `3.x` trong `web/package.json`. **Recharts 3 đã chốt** ([`01-architecture.md`](../../overview/01-architecture.md)) — không đánh giá lại thư viện khác.

### Bước 1 — `types.ts` + `api/charts.api.ts`

Chép hình dạng ba khối `days`/`weeks`/`goal` từ `summary.response.ts`. `getSummary(from, to)` gọi qua `apiClient`.

Deliverable: `npx tsc --noEmit` sạch; gọi thử `getSummary` từ console trả về object có đủ ba khối.

### Bước 2 — `hooks/useCharts.ts` + trang rỗng

Hook giữ state khoảng (mặc định 30 ngày, xem [`SPEC.md`](SPEC.md) §7.1), tính `from`/`to`, gọi API, trả `{ data, isLoading, error }`. `ChartsPage` mới chỉ đổ JSON ra màn hình.

Deliverable: mở `/charts` thấy JSON thật từ server. **Ba trạng thái loading / lỗi / có dữ liệu đều nhìn thấy được** (thử trạng thái lỗi bằng cách tắt server).

### Bước 3 — `WeightChart`

Cạm bẫy §4.1 và §4.2 của [`SPEC.md`](SPEC.md) đều rơi vào bước này. Ghi `connectNulls={false}` tường minh, kèm comment trỏ về SPEC §4.2.

Deliverable, kiểm bằng mắt trên dữ liệu thật:
- Đường MA7 rõ ràng nổi hơn điểm thô (đưa cho người khác xem, hỏi "đường nào là xu hướng?" — trả lời sai là chưa đạt);
- Ngày có `weightMa7 === null` để lại **lỗ hổng**, không có đoạn nối thẳng qua;
- `ReferenceLine` mục tiêu hiện khi đã đặt mục tiêu, **không** vỡ khi `targetWeightKg === null`;
- Trục Y không bắt đầu từ 0 ([`SPEC.md`](SPEC.md) §5.1).

Cách dựng dữ liệu thử: ghi vài `BodyLog` rồi **cố ý bỏ trống 4–5 ngày liên tiếp** ở giữa để ép ra `null`.

### Bước 4 — `utils/chartData.ts` + test thuần

Ba hàm, không import React, không import Recharts:

| Hàm | Trả về |
|---|---|
| `countRealPoints(days, key)` | số ngày có giá trị `!== null` — dùng cho trạng thái rỗng |
| `mergeWeeklyAvg(days, weeks)` | `days` kèm `weekAvgCalories`, giữ `null` nguyên vẹn ([`SPEC.md`](SPEC.md) §5.2) |
| `dropTruncatedWeeks(weeks, from, to)` | lọc tuần cắt cụt — **chỉ viết nếu §7.5 chốt phương án A** |

Deliverable: unit test cho từng hàm, **bắt buộc có ca `null`**: tuần `avgCalories === null` sau `mergeWeeklyAvg` vẫn phải là `null`, không được thành `0`. Đây là test duy nhất bảo vệ cạm bẫy §4.3 khỏi một lần "sửa cho gọn" sau này.

### Bước 5 — `WaistChart`

Sao chép `WeightChart`, đổi `dataKey`, bỏ `ReferenceLine`, đổi đơn vị sang `cm`.

Deliverable: hai biểu đồ trông cùng một hệ; vòng bụng **không** có đường ngang bịa ra.

### Bước 6 — `CaloriesChart`

Cột `totalCalories` + `ReferenceLine` `dailyCalorieTarget` + đường `weekAvgCalories` từ bước 4.

Deliverable:
- Tuần không ghi bữa nào → đường trung bình **ngắt đoạn**, không có điểm 0 nào;
- Ngày không ghi bữa → cột 0, và tooltip nói rõ "chưa ghi bữa nào" khi `mealCount === 0`, không nói "0 kcal";
- Trục Y **bắt đầu từ 0** (ngược với hai biểu đồ trên).

### Bước 7 — `GoalProgressCard`

Bốn số từ khối `goal`. Nhớ: `onTrack` có **ba** trạng thái; `remainingKg` luôn dương; thẻ neo vào **hôm nay** chứ không neo vào khoảng đang xem — ghi nhãn rõ.

Deliverable: thử đủ ba tình huống — chưa đặt mục tiêu, đã đặt nhưng thiếu số đo, đủ dữ liệu. Không tình huống nào ra `NaN`, `null`, `undefined` hay `0` giả trên màn hình.

### Bước 8 — `ChartEmptyState` và ráp trạng thái rỗng

Áp [`SPEC.md`](SPEC.md) §6: xét **từng biểu đồ riêng**, không che cả trang.

Deliverable: chạy trên DB trắng — thấy ba thông điệp mời ghi dữ liệu, **không** thấy biểu đồ trống hay số 0 nào. Rồi ghi đúng một số đo cân nặng: biểu đồ cân nặng vẫn báo chưa đủ (1 điểm chưa đủ để có MA7), hai biểu đồ kia không đổi.

### Bước 9 — cắm route, dọn dẹp

Đăng ký `/charts` trong `router/routes.tsx`, export qua `index.ts`. Kiểm lại toàn trang trên khoảng 30 / 90 / 365 ngày.

Deliverable: `npm run build` sạch; chuyển tab qua lại ba trang không lỗi console.

---

## 4. Lệnh verify dự kiến

Chạy từ `Lean/web` ([`04-conventions.md`](../../overview/04-conventions.md)).

```bash
cd web

npm run dev          # xem bằng mắt tại http://localhost:5173/charts
npx tsc --noEmit     # typecheck
npm run build        # build production
npm test             # unit test cho utils/chartData.ts (bước 4)
```

Cần server chạy song song cho mọi kiểm tra bằng mắt:

```bash
cd server && npm run dev    # http://localhost:3000
```

**Cảnh báo:** `web/package.json` chưa tồn tại, nên `npm test` và `npm run build` là **script dự kiến**, chưa xác nhận. Task scaffold `web/` chốt tên script thật; nếu lệch thì sửa mục này chứ đừng sửa script để khớp tài liệu.

Kiểm nhanh hợp đồng API mà không cần web:

```bash
curl "http://localhost:3000/api/summary?from=2026-07-08&to=2026-08-06"
```

---

## 5. Việc còn treo

### 5.1 Bốn câu hỏi mở chưa chốt

[`SPEC.md`](SPEC.md) §7: khoảng mặc định (§7.1) · phạm vi bộ chọn khoảng (§7.2) · `from`/`to` tương lai (§7.3) · `weeks[].avgWeightKg` có vẽ không (§7.4) · tuần cắt cụt A/B/C (§7.5).

**§7.5 phải chốt trước bước 4** — nó quyết định `dropTruncatedWeeks` có tồn tại hay không.

### 5.2 Chưa có hạ tầng test cho web

Server dùng Vitest 4 + supertest. Web chưa có cấu hình test nào. Bước 4 cần **ít nhất** Vitest chạy được trên `utils/chartData.ts` — hàm thuần, không cần jsdom, không cần Testing Library. Nếu scaffold web chưa dựng Vitest thì đây là việc chặn bước 4, và nên giải quyết ở task scaffold chứ không phải ở đây.

Test render component (Testing Library) là mong muốn nhưng không chặn bản đầu; các cạm bẫy trực quan ở §4 của SPEC được canh bằng mắt ở bước 3, 6, 8.

### 5.3 Ràng buộc khi sửa feature này về sau

- **Đừng tính lại thống kê ở client.** MA7, `currentRate`, `onTrack`, `remainingKg` đều do backend tính, công thức ở [`03-stats.md`](../../overview/03-stats.md). Thấy `/ 7`, `reduce` cộng trung bình, hay `.filter()` rồi chia độ dài trong `web/src/features/charts/` là dấu hiệu công thức đang bị nhân bản sai chỗ.
- **Đừng `?? 0` giá trị `null`** ở bất kỳ đâu trên đường từ API tới chart — [`SPEC.md`](SPEC.md) §4.2 và §4.3.
- **Đừng bật `connectNulls`** — SPEC §4.2.
- **Đừng gọi thêm endpoint khác** để lấy dữ liệu cho trang này — SPEC §2.
- **Đừng nới `from` ở client** để bù cửa sổ MA7; backend đã làm, xem [`summary/SPEC.md`](../summary/SPEC.md) §3.
