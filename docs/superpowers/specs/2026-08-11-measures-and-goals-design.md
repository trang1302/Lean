# Đợt `measures-and-goals` — 3 số đo mới + mở rộng mục tiêu

> **Loại tài liệu:** spec thay đổi, không phải spec feature.
> Nó mô tả thứ **chưa tồn tại**. `docs/features/<tên>/SPEC.md` theo quy ước của
> `docs/README.md` phải mô tả **hành vi thật của code**, nên đợt này không tạo
> thư mục feature mới — xem §9 để biết SPEC nào phải cập nhật khi code xong.

**Ngày chốt:** 2026-08-11
**Trạng thái:** đã duyệt thiết kế, chưa có kế hoạch triển khai, chưa có code.

---

## 1. Đợt này nằm ở đâu trong bức tranh lớn

Yêu cầu gốc gồm ba thứ: dùng MUI cho toàn bộ giao diện, thêm ba số đo cơ thể, và
làm lại trang Biểu đồ (mỗi số đo một biểu đồ + mục tiêu + một tờ lịch tổng quan).
Gộp một lượt thì không review được, nên **tách ba đợt**:

| # | Tên | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | `ui-mui` | Cài MUI, ThemeProvider, viết lại 6 component sau barrel `components/ui` giữ nguyên chữ ký props. Không đổi hành vi. | không |
| **2** | **`measures-and-goals`** | **Đợt này.** 3 số đo mới + 6 trường `Goal`. Schema → API → form. | không |
| 3 | `charts-mui` | Thay Recharts bằng `@mui/x-charts`; 5 biểu đồ mỗi số đo một cái + đường mục tiêu riêng + tờ lịch tháng. | cần 1 và 2 |

Đợt 1 và 2 độc lập nhau. Đợt 3 phải sau cùng.

### 1.1 Đợt này CỐ Ý không làm

- **Không đụng biểu đồ.** Không thêm `ChestChart`, không sửa `ChartsPage`.
- **Không đụng MUI.** Form mới viết bằng UI kit hiện có; đợt 1 sẽ thay ruột sau,
  và vì barrel `components/ui/index.ts` giữ nguyên chữ ký nên không phải sửa lại.
- **Không tính % tiến độ.** Đợt này chỉ *lưu* `startWeightKg`/`startDate`.
  Công thức thuộc đợt 3 và khi làm phải nằm trong `server/src/shared/stats/`
  dạng hàm thuần, không nằm trong service.
- **Không sửa `server/src/shared/stats/`.** Xem §8.4.

---

## 2. Mô hình dữ liệu

### 2.1 `BodyLog` — thêm 3 cột

```prisma
model BodyLog {
  userId     String
  date       String
  weightKg   Float?
  waistCm    Float?
  chestCm    Float?     // vòng ngực
  shoulderCm Float?     // vòng vai
  armCm      Float?     // vòng bắp tay
  note       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@id([userId, date])
}
```

### 2.2 `Goal` — thêm 6 cột

```prisma
model Goal {
  userId             String   @id
  startWeightKg      Float?   // mẫu số của % tiến độ (đợt 3 dùng)
  startDate          String?  // "YYYY-MM-DD" — mốc 0%
  targetWeightKg     Float?
  targetWaistCm      Float?
  targetChestCm      Float?
  targetShoulderCm   Float?
  targetArmCm        Float?
  targetDate         String?
  dailyCalorieTarget Int?
  updatedAt          DateTime @updatedAt
}
```

### 2.3 Migration

Mọi cột mới đều nullable → `prisma db push` chỉ thêm cột trống. Không mất dữ
liệu, không cần backfill, không cần script chuyển đổi.

> **⚠️ Ranh giới thao tác.** `npx prisma db push` ghi vào `server/data.db` — dữ
> liệu sức khoẻ thật, mà `CLAUDE.local.md` cấm agent đụng vào. Thêm cột nullable
> là thao tác không phá dữ liệu, nhưng vẫn là ghi vào file đó. **Agent dừng ở
> bước này và để chủ dự án tự chạy**, trừ khi được cho phép rõ ràng.
> Test không vướng: `server/test/globalSetup.ts` chạy trên `test.db` và đã có
> chốt chặn từ chối chạy nếu `DATABASE_URL` trỏ vào `data.db`.

---

## 3. Validation — `server/src/shared/validation/commonSchemas.ts`

Hiện có `waistCmSchema = z.number().positive().lt(300)`.

**Đổi tên thành `circumferenceCmSchema`, bốn vòng dùng chung.** Không đẻ ra bốn
schema y hệt nhau. Bắp tay ~30cm nằm thoải mái trong `lt(300)`; siết trần riêng
cho từng vòng là phức tạp không mua được gì — người dùng gõ nhầm 300 thành 3000
vẫn bị chặn, gõ nhầm 30 thành 80 thì không schema nào cứu được.

`startDate` dùng `pastOrTodayDateString` đã có: đúng định dạng, là ngày có thật,
và không ở tương lai.

---

## 4. API

### 4.1 `PUT /api/body-logs/:date` — upsert 3 trạng thái, 6 khoá

Ngữ nghĩa **giữ nguyên từng chữ**: khoá vắng mặt = giữ nguyên, khoá có mặt với
giá trị `null` = xoá, khoá có mặt có giá trị = đặt mới. Chỉ mở rộng từ 3 khoá
lên 6 (`weightKg`, `waistCm`, `chestCm`, `shoulderCm`, `armCm`, `note`).

`upsertBodyLogSchema` vẫn là `strictObject().partial()` — gõ sai tên khoá vẫn
báo 400 chứ không lặng lẽ không làm gì.

**Dọn `parseUpsertBodyLog`.** Hiện viết tay từng khoá:

```ts
if ('weightKg' in raw) patch.weightKg = parsed.weightKg ?? null;
if ('waistCm' in raw)  patch.waistCm  = parsed.waistCm  ?? null;
if ('note' in raw)     patch.note     = parsed.note     ?? null;
```

Sáu khoá thì thành sáu dòng giống hệt nhau, và **quên một dòng là bug im lặng**
— đúng loại lỗi mà comment trong file đó đang cảnh báo. Chuyển sang lặp qua một
danh sách khoá. Không đổi hành vi.

Phải giữ nguyên lý do kỹ thuật đã ghi trong file: kiểm `key in rawBody` chứ
**không** kiểm `parsed[key] !== undefined` — sau `.partial()` cả "vắng mặt" và
"gửi `undefined`" đều ra `undefined`, kiểm theo giá trị sẽ biến ca "gửi `null`
để xoá" thành ca "giữ nguyên".

### 4.2 `GET /api/summary` — `SummaryDay` mang 5 cặp số đo

Từ 2 cặp (thô + MA7) lên 5 cặp, tức 10 trường số đo. Cộng `date`,
`totalCalories`, `mealCount` thì cả interface đi từ 7 lên 13 trường.

```ts
interface SummaryDay {
  date: string;
  weightKg: number | null;   weightMa7: number | null;
  waistCm: number | null;    waistMa7: number | null;
  chestCm: number | null;    chestMa7: number | null;
  shoulderCm: number | null; shoulderMa7: number | null;
  armCm: number | null;      armMa7: number | null;
  totalCalories: number;     mealCount: number;
}
```

`summary.service.ts` hiện dựng tay `weightPoints`/`waistPoints` rồi gọi
`movingAverage7` hai lần. Năm số đo thì chuyển sang **bảng khai báo rồi lặp**:

```ts
const MEASURES = [
  { raw: 'weightKg',   ma7: 'weightMa7' },
  { raw: 'waistCm',    ma7: 'waistMa7' },
  { raw: 'chestCm',    ma7: 'chestMa7' },
  { raw: 'shoulderCm', ma7: 'shoulderMa7' },
  { raw: 'armCm',      ma7: 'armMa7' },
] as const;
```

Phần `goal` của response, `weeks`, và toàn bộ logic `currentRate`/`onTrack`
**không đổi** — chúng chỉ liên quan tới cân nặng.

`SummaryGoal` trả thêm `startWeightKg` và `startDate` (đọc thẳng từ bảng, không
tính toán gì).

### 4.3 `GET` / `PUT /api/goal` — 6 trường mới

Đọc/ghi thẳng. `PUT` giữ ngữ nghĩa hiện có của feature `goal`.

---

## 5. Web

### 5.1 `web/src/constants/measures.ts` — nguồn sự thật duy nhất

Đặt cạnh `constants/meals.ts` đã có, theo đúng quán lệ đó.

```ts
export const MEASURES = [
  { field: 'weightKg',   label: 'Cân nặng',     unit: 'kg', step: '0.1' },
  { field: 'waistCm',    label: 'Vòng bụng',    unit: 'cm', step: '0.1' },
  { field: 'chestCm',    label: 'Vòng ngực',    unit: 'cm', step: '0.1' },
  { field: 'shoulderCm', label: 'Vòng vai',     unit: 'cm', step: '0.1' },
  { field: 'armCm',      label: 'Vòng bắp tay', unit: 'cm', step: '0.1' },
] as const;

export type MeasureField = (typeof MEASURES)[number]['field'];
```

Điều khiển: danh sách ô của form Hôm nay, nhãn hiển thị, và tới đợt 3 là danh
sách 5 biểu đồ. Thêm số đo thứ sáu = thêm một dòng ở đây.

### 5.2 `useBodyLogForm` — chỗ rủi ro nhất của đợt này

Hook hiện giữ ba mảnh state cho **mỗi** ô, viết tay từng cái: `weightValue`/
`waistValue`, `loadedWeight`/`loadedWaist`, `touchedWeight`/`touchedWaist`, rồi
`onWeightChange`/`onWaistChange`, `onWeightBlur`/`onWaistBlur`. Năm ô mà giữ
kiểu này là **25 khai báo song song**, trong một file mà docstring đã ghi: *"gửi
sai một khoá là XOÁ MẤT dữ liệu người dùng không đụng tới"*.

Chuyển sang bản đồ theo khoá:

```ts
export interface UseBodyLogFormResult {
  values: Record<MeasureField, string>;
  onChange: (field: MeasureField, value: string) => void;
  onBlur: (field: MeasureField) => void;
  savedField: MeasureField | null;
  attemptTick: number;
  fieldErrors: UseFieldErrorsResult;
}
```

`loaded` và `touched` thành `useRef<Record<MeasureField, ...>>`.

**Bốn luật gửi khi blur giữ nguyên từng chữ:**

1. chưa từng động vào ô → **không** gửi, bất kể giá trị;
2. giá trị không đổi so với lúc nạp, **so numeric** (`"72.40"` = `"72.4"`) →
   **không** gửi (không phải vì hiệu năng: `PUT` với patch không đổi vẫn bump
   `updatedAt` và có thể tạo bản ghi rỗng cho ngày chưa có gì);
3. ô vừa bị xoá trắng, trước đó có giá trị → gửi `{ [field]: null }`;
4. ô có giá trị mới không `NaN` → gửi `{ [field]: Number(raw) }`.

Đổi **cách lưu state**, không đổi **luật**. Đây là ranh giới của đợt này.

Cơ chế đồng bộ lại cả ba mảnh khi `date` hoặc `bodyLog` đổi giữ nguyên, gồm cả
lý do đã ghi: `useApiResource` cố ý giữ `data` cũ để tránh nhấp nháy, nên trang
gọi **phải** disable các ô lúc `isLoading` — nếu không sẽ có người blur vào giá
trị của ngày cũ rồi bị gán cho ngày mới.

Cái giá: `useBodyLogForm.test.ts` gọi `onWeightBlur()` nên **phải viết lại theo
API mới**. Giữ nguyên từng tình huống đang test, chỉ đổi cách gọi.

### 5.3 `BodyLogForm` — 2 ô thành 5

Render từ `MEASURES.map()`. Bố cục: cân nặng một hàng riêng (đơn vị khác, là số
quan trọng nhất), bốn vòng xếp lưới bên dưới. Cơ chế đưa focus về ô lỗi đầu tiên
sau mỗi lần blur hỏng, và `aria-live` "Đã lưu ✓", giữ nguyên.

### 5.4 `GoalSettingsSection` — 3 ô thành 9

Sáu ô số (`targetWeightKg`, `startWeightKg`, 4 target vòng) render từ bảng; hai
ô ngày (`targetDate`, `startDate`) giữ viết tay vì `<input type="date">` là loại
control khác. Chia **hai nhóm có tiêu đề**:

- **Điểm xuất phát** — `startWeightKg`, `startDate`
- **Đích đến** — `targetWeightKg`, 4 target vòng, `targetDate`, `dailyCalorieTarget`

Chín ô phẳng trên một lưới thì không đọc được.

**Tự điền "cân đầu":** khi `startWeightKg` còn trống, form điền sẵn MA7 hôm nay
để chỉ việc bấm Lưu. Lấy bằng cách **gọi `GET /api/summary` sẵn có**
(`goal.currentMa7WeightKg`), không thêm trường vào `/api/goal` — xem §8.3.
Giá trị điền sẵn là **bản nháp trong ô**, chưa lưu; sửa được, không bấm Lưu thì
DB không đổi. MA7 chưa đủ dữ liệu (`null`) thì để ô trống.

---

## 6. Test

### 6.1 Server

| File | Thêm gì |
|---|---|
| `bodyLogs.controller.test.ts` | **Quan trọng nhất:** bảng chạy qua 5 số đo — ghi đủ 5 trường, `PUT` đúng **một** trường, khẳng định 4 trường kia **giữ nguyên**. Thêm: gửi `null` xoá đúng một trường; gõ sai tên khoá → 400. |
| `summary.controller.test.ts` | `SummaryDay` trả đủ 10 trường số đo. Giữ cạm bẫy đã biết: cửa sổ dưới 2 giá trị thì `*Ma7` phải `null` — **cho cả 5 số đo**, không riêng cân nặng. |
| `goal.controller.test.ts` | 6 trường mới lưu/đọc đúng; `startDate` sai định dạng → 400; `startDate` ở tương lai → 400. |
| `shared/stats/*` | **Không đổi dòng nào.** |

### 6.2 Web

| File | Thêm gì |
|---|---|
| `useBodyLogForm.test.ts` | Viết lại theo API mới. Giữ 4 luật gửi, mỗi luật chạy qua bảng 5 số đo. Thêm test then chốt: **blur ô vòng ngực chỉ gửi `{ chestCm }`, payload không chứa khoá nào khác.** |
| `BodyLogForm.test.tsx` | 5 ô render đúng nhãn; lỗi 400 của `chestCm` gắn vào đúng ô ngực. |
| `GoalSettingsSection.test.tsx` | **File mới** — component này hiện chưa có test nào, mà sắp nâng từ 3 lên 9 ô. Test chính: bấm Lưu gửi đúng 9 khoá với đúng giá trị. |

### 6.3 Vì sao những test đó, không phải test khác

Test đắt nhất ở đây là §6.2 dòng đầu và §6.1 dòng đầu. Cả hai mã hoá **cùng một
lý do tồn tại**: upsert 3 trạng thái có mặt là để ghi một ô không xoá ô khác.
Một test chỉ khẳng định "PUT trả 200" sẽ vẫn xanh khi bug đó xảy ra — tức là
một test sai.

---

## 7. Tiêu chí xong

Đợt này xong khi **tất cả** đúng, kèm output lệnh thật:

1. `cd server && npm test` xanh
2. `cd web && npm test` xanh
3. `npx tsc --noEmit` xanh ở cả `server/` và `web/`
4. Chạy thật: mở `/`, ghi đủ 5 số đo cho một ngày, tải lại thấy còn nguyên; mở
   `/settings`, đặt cả 9 trường, tải lại thấy còn nguyên; `GET /api/summary`
   trả đủ 10 trường số đo

Bước 4 chạy trên **DB tạm** (`DATABASE_URL=file:./scratch.db`), không phải
`data.db`.

---

## 8. Quyết định vượt spec

> Mục quan trọng nhất của tài liệu này (`docs/README.md`). Những quyết định dưới
> đây **không đọc ra được từ code** — chỉ thấy kết quả, không thấy lý do.

### 8.1 `armCm`, không `upperArmCm`

Yêu cầu nói "vòng bắp tay", chỗ đo đã rõ. Thêm `upper` không làm rõ thêm gì.

### 8.2 Bốn vòng dùng chung một Zod schema

Xem §3. Đánh đổi: mất khả năng chặn "bắp tay 150cm". Chấp nhận — app một người
dùng tự ghi tay, giá trị vô lý sẽ tự thấy trên biểu đồ.

### 8.3 "Cân đầu" tự điền qua `/api/summary`, không thêm trường vào `/api/goal`

`goal.service` hiện chỉ đọc bảng `Goal`. Bắt nó tính MA7 là kéo dữ liệu
`BodyLog` xuyên qua ranh giới feature, chỉ để tiện điền một ô nháp. Đổi lại
trang Cài đặt tốn thêm một `GET /api/summary`.

**Đã cân nhắc và bác:** thêm `currentMa7WeightKg` vào response của `/api/goal`.
Tiết kiệm một request nhưng làm `goal` phụ thuộc `bodyLog` vĩnh viễn.

### 8.4 `shared/stats/` không sửa một dòng nào

`movingAverage7` là hàm thuần nhận `DatedValue[]`; năm số đo chỉ là gọi nó năm
lần với năm mảng khác nhau. **Nếu lúc code thấy mình đang mở file trong
`server/src/shared/stats/` thì đã làm sai chỗ** — dấu hiệu công thức đang bị kéo
vào chỗ không thuộc về nó. Ranh giới này là thứ làm phần khó nhất của app test
được (`CLAUDE.md`).

### 8.5 `startDate` là `String "YYYY-MM-DD"`, không phải `DateTime`

Cùng quy ước với `date` và `targetDate` đã có. Một ngày trên lịch, không phải
một thời điểm. Dùng `DateTime` sẽ sinh lỗi lệch múi giờ.

### 8.6 Form mới viết bằng UI kit hiện tại, không chờ MUI

Đợt 1 thay ruột 6 component **sau barrel `components/ui/index.ts` và giữ nguyên
chữ ký props**, nên form viết hôm nay không phải sửa lại. Chờ MUI xong mới làm
đợt này là tự tạo phụ thuộc không cần thiết giữa hai việc độc lập.

### 8.7 Mọi cột mới đều nullable

Không có giá trị mặc định, không backfill. Người dùng đã có dữ liệu cũ chỉ ghi
cân nặng và vòng bụng; ép giá trị mặc định cho ba vòng mới là **bịa ra số đo
chưa từng đo**. `null` là câu trả lời đúng cho "chưa đo".

---

## 9. Tài liệu phải cập nhật khi code xong

Đợt này cắt ngang 5 feature đã có. Khi code xong, các file sau đang **nói sai**
và phải sửa cho khớp code:

| File | Sửa gì |
|---|---|
| `docs/overview/02-data-model.md` | Cột mới của `BodyLog` và `Goal` |
| `docs/features/body-logs/SPEC.md` | Upsert 6 khoá thay vì 3 |
| `docs/features/goal/SPEC.md` | 6 trường mới |
| `docs/features/summary/SPEC.md` | `SummaryDay` 12 trường; `SummaryGoal` thêm 2 trường |
| `docs/features/web-today/SPEC.md` | Form 5 ô; API mới của `useBodyLogForm` |
| `docs/features/web-settings/SPEC.md` | Form 9 ô, hai nhóm; nguồn của giá trị điền sẵn |

Chưa làm việc này thì đợt này **chưa xong** — `docs/README.md` quy định
`features/*/SPEC.md` mô tả hành vi thật của code, để tài liệu nói dối là hỏng
đúng thứ mà quy ước đó tồn tại để bảo vệ.

---

## 10. Rủi ro đã biết

**`useBodyLogForm` là nơi duy nhất có thể mất dữ liệu.** Viết lại state của nó
trong khi phải giữ nguyên 4 luật gửi là phần dễ sai nhất. Giảm rủi ro bằng cách
viết test theo API mới **trước**, chạy đỏ, rồi mới sửa hook.

**Chín ô của form mục tiêu ánh xạ lệch một dòng** là bug không phát hiện được
bằng mắt — đó là lý do §6.2 bắt buộc có `GoalSettingsSection.test.tsx`.

**Người dùng phải tự chạy `prisma db push`** (§2.3). Quên bước này thì mọi thứ
biên dịch được nhưng runtime báo cột không tồn tại.

---

## 11. Tham chiếu

- `CLAUDE.md` — quy ước ngày tháng, ranh giới `shared/stats`, 4 lớp
- `CLAUDE.local.md` — cấm đụng `server/data.db`
- `docs/overview/03-stats.md` — định nghĩa chính xác MA7
- `docs/features/web-today/SPEC.md` §5.1 — nguồn gốc 4 luật gửi khi blur
- `server/test/globalSetup.ts` — chốt chặn không cho test chạy vào `data.db`
