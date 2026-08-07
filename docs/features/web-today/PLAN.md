# Trang `web-today` — Kế hoạch thi công

Liên quan: [`SPEC.md`](SPEC.md) (hợp đồng API, bố cục, cạm bẫy, câu hỏi mở).

---

## 1. Trạng thái: **CHƯA BẮT ĐẦU**

Chưa có một dòng code nào. Thư mục `web/` **chưa tồn tại** trong repo.

| Hạng mục | Trạng thái |
|---|---|
| `web/` scaffold (Vite 8 + React 19 + TS) | ❌ chưa có — **chặn** |
| `web/src/lib/apiClient.ts` | ❌ chưa có — **chặn** |
| `web/src/router/` + khung tab 3 trang | ❌ chưa có — **chặn** (một phần) |
| `web/src/features/today/**` | ❌ chưa có — việc của kế hoạch này |
| Backend `body-logs`, `meals`, `goal` | ✅ xong, 208 test pass |

## 2. Phụ thuộc chặn

Không bước nào ở §4 khởi động được trước khi ba thứ dưới đây có mặt. Cả ba **nằm ngoài
feature này** — đừng dựng tạm bên trong `features/today/` rồi tính chuyển sau, vì hai trang
còn lại (`charts`, `settings`) sẽ dùng lại đúng những thứ đó.

### B1 — `web/` scaffold *(chặn cứng)*

Vite 8 + React 19 + TypeScript 7, khớp [`04-conventions.md`](../../overview/04-conventions.md)
mục "Phiên bản". Tối thiểu: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`,
`src/main.tsx`, `src/App.tsx`. Cần thêm hạ tầng test component (Vitest 4 + jsdom +
`@testing-library/react`) — không có nó thì §4 không có bước nào verify được.

Proxy `/api` → `http://localhost:3000` trong `vite.config.ts`, để dev server 5173 gọi được
backend mà không dính CORS và không phải cấu hình base URL tuyệt đối.

### B2 — `web/src/lib/apiClient.ts` *(chặn cứng)*

Vị trí đã chốt ở [`01-architecture.md`](../../overview/01-architecture.md). Hợp đồng tối
thiểu mà trang này cần:

- ném một **error object có cấu trúc**, giữ nguyên `status` và `error.fields[]` từ response
  (`{ code, message, fields? }` — [`SPEC.md`](SPEC.md) §2.7). Nếu `apiClient` bẹp lỗi thành
  `new Error(message)` thì §5.2 của SPEC **không thực hiện được** và cả trang phải viết lại;
- phân biệt được **`404` là dữ liệu** (`GET /body-logs/:date`) với `404` là lỗi thật —
  hoặc cho gọi bắt được `status`, hoặc có biến thể trả `null` khi 404;
- xử lý `204` không body (`DELETE /meals/:id`) mà không vỡ khi parse JSON.

**Không** dùng thư viện data-fetching. Spec chốt React 19 + Vite 8 + Recharts 3;
`fetch` + `useState`/`useEffect` là đủ và là lựa chọn có chủ đích
([`01-architecture.md`](../../overview/01-architecture.md): không bê TanStack/Jotai/shadcn của `upip`).

### B3 — khung điều hướng *(chặn một phần)*

`web/src/router/routes.tsx` + tab 3 trang. Bước 1–6 ở §4 làm được mà không cần nó (test
component render thẳng); riêng bước 7 (smoke test thật trên trình duyệt) thì cần.

### Quyết định phải chốt trước khi code

Ba câu hỏi mở của SPEC ảnh hưởng trực tiếp tới cấu trúc file, chốt trước sẽ rẻ hơn sửa sau:

- **§7 câu hỏi 1** — tổng calo cộng ở client hay lấy từ `GET /summary`. Ảnh hưởng: có hay
  không một lời gọi API thứ tư.
- **§5.3** — sắp thứ tự buổi ở client (A) hay đề nghị backend đổi (B). Ảnh hưởng: bước 5.
- **§7 câu hỏi 4** — "hôm nay" tính theo timezone máy hay cứng `Asia/Ho_Chi_Minh`. Ảnh
  hưởng: `todayIso()` nằm ở `lib/` (dùng chung 3 trang) chứ không nằm trong `features/today/`.

## 3. File dự kiến

Bám đúng `web/src/features/<tên>/{api,components,hooks}` + `index.ts` của
[`01-architecture.md`](../../overview/01-architecture.md). Tên file: `<name>.api.ts` /
`use<Name>.ts` (camelCase + hậu tố chấm), component PascalCase.

```
web/src/features/today/
├── index.ts                                # export TodayPage — điểm vào duy nhất
├── api/
│   └── today.api.ts                        # 7 hàm gọi apiClient, không state, không React
├── hooks/
│   ├── useTodayData.ts                     # nạp bodyLog + meals + goal theo `date`
│   ├── useBodyLogForm.ts                   # state 3 trạng thái của form số đo (§5.1)
│   └── useFieldErrors.ts                   # fields[] → Record<path, message> (§5.2)
└── components/
    ├── TodayPage.tsx                       # lắp ráp, giữ state `date`
    ├── DatePicker.tsx                      # <input type="date"> max = hôm nay
    ├── BodyLogForm.tsx                     # 2 ô, lưu khi blur
    ├── MealList.tsx                        # nhóm theo buổi, nút sửa/xóa
    ├── MealRow.tsx                         # một dòng + chế độ sửa inline
    ├── MealQuickAddForm.tsx                # [buổi ▾][tên][calo][+]
    └── CalorieSummaryCard.tsx              # tổng / mục tiêu + thanh tiến độ
```

Test đặt cạnh file được test (`*.test.tsx`), theo quán lệ của `2026-08-06-original-plan.md` Task 13.

**Dùng chung, không thuộc feature này** — nếu chưa có thì tạo ở đúng chỗ dưới đây, không
tạo bản sao trong `features/today/`:

| File | Nội dung | Vì sao ở ngoài |
|---|---|---|
| `web/src/lib/apiClient.ts` | fetch + bóc lỗi (B2) | cả 3 trang dùng |
| `web/src/lib/format.ts` | `todayIso()`, format số | `charts` cũng cần ngày |
| `web/src/constants/meals.ts` | `MEAL_SLOTS` (thứ tự tường minh) + `SLOT_LABEL` | dropdown và thứ tự nhóm phải là **một** nguồn (SPEC §5.3) |
| `web/src/types/api.ts` | `BodyLog`, `Meal`, `MealSlot`, `Goal`, `ApiError` | `charts`/`settings` dùng lại |

`MEAL_SLOTS` phải giữ đúng thứ tự `['breakfast','lunch','dinner','snack']` và **khớp giá trị**
với `slotSchema` của server (`server/src/shared/validation/commonSchemas.ts:25`). Hai bản
riêng biệt có chủ đích — server không chia sẻ type với web — nên giá trị lệch là lỗi câm.

## 4. Các bước

Mỗi bước có deliverable **chạy test được ngay**, không phụ thuộc bước sau. Thứ tự chọn để
hai bước rủi ro nhất (§5.1 và §5.2 của SPEC) nằm sớm.

### Bước 0 — Dựng nền *(chỉ khi B1/B2 chưa xong)*

Không thuộc feature này. Nếu phải tự làm thì làm **hết** B1 + B2 rồi mới sang bước 1;
không dựng nửa vời.

*Deliverable:* `npm run dev` ở `web/` mở được trang trắng; `npm test` chạy được một test giả.

### Bước 1 — `api/today.api.ts`

Bảy hàm mỏng, mỗi hàm ánh xạ đúng một endpoint ở [`SPEC.md`](SPEC.md) §2. Không state,
không React, không try/catch nuốt lỗi.

```
getBodyLog(date)            → BodyLog | null      // 404 ⇒ null, KHÔNG ném
putBodyLog(date, patch)     → BodyLog             // patch chỉ chứa khóa cần ghi
getMeals(date)              → Meal[]
createMeal(input)           → Meal                // 201
updateMeal(id, patch)       → Meal
deleteMeal(id)              → void                // 204
getGoal()                   → Goal
```

`putBodyLog` nhận `Partial<Record<'weightKg'|'waistCm'|'note', number|string|null>>` và
**gửi nguyên object đó**, không tự bù trường thiếu, không tự lọc `null`. Chính chỗ này là
nơi hợp đồng 3 trạng thái sống hoặc chết.

*Deliverable:* test với `fetch` bị mock — khẳng định (a) `putBodyLog(d, { weightKg: 1 })` gửi
body **đúng một khóa**; (b) `putBodyLog(d, { waistCm: null })` gửi `null` chứ không bỏ khóa;
(c) `getBodyLog` trả `null` khi server `404`; (d) `deleteMeal` không vỡ khi `204` không body.

### Bước 2 — `hooks/useFieldErrors.ts`

Biến `error.fields[]` thành `Record<path, message>` + một danh sách "lỗi không map được vào
ô nào" (SPEC §5.2). Hàm thuần hoặc hook mỏng — **không** gọi API.

*Deliverable:* unit test — nhiều lỗi cùng lúc ra đủ nhiều entry; `path: "date"` rơi vào
nhóm lỗi cấp form; lỗi bị xóa sạch khi gọi `reset()`.

### Bước 3 — `hooks/useBodyLogForm.ts` + `components/BodyLogForm.tsx` *(bước rủi ro nhất)*

Hiện thực đúng SPEC §5.1. Hook giữ, cho mỗi ô: giá trị đang gõ, giá trị **đã nạp từ server**,
và cờ "người dùng đã động vào chưa".

Luật gửi khi blur:
- giá trị không đổi so với lúc nạp → **không gửi request**;
- ô rỗng và trước đó cũng rỗng → **không gửi**;
- ô rỗng và trước đó có giá trị → gửi `{ [field]: null }`;
- ô có giá trị mới → gửi `{ [field]: Number(raw) }`, chặn `NaN` ở client trước khi gửi.

*Deliverable:* test component (SPEC §5.1 là hợp đồng, đây là bằng chứng):
1. sửa cân nặng rồi blur → `putBodyLog` được gọi với **đúng `{ weightKg: … }`**, body
   **không chứa** khóa `waistCm`;
2. ngày đã có `waistCm = 88`, chỉ sửa cân nặng → sau request, `waistCm` vẫn 88 (không có
   khóa `waistCm` nào được gửi) — **test canh mất-dữ-liệu, bắt buộc có**;
3. xóa trắng ô đang có giá trị rồi blur → gửi `{ waistCm: null }`;
4. blur qua ô không sửa gì → **không có request nào**;
5. server trả `400` với `fields: [{ path: 'weightKg', … }]` → thông báo hiện **dưới ô cân
   nặng**, không phải toast, và ô có `aria-invalid`;
6. `GET` trả `404` → hai ô rỗng, **không có thông báo lỗi nào** (SPEC §6).

### Bước 4 — `hooks/useTodayData.ts`

Nạp song song `getBodyLog` + `getMeals` + `getGoal` theo `date`; expose `reload()` để các
thao tác ghi gọi lại. Đổi `date` phải hủy kết quả của request cũ (cờ `cancelled` trong
cleanup của `useEffect`) — SPEC §7 câu hỏi 8.

*Deliverable:* test — đổi `date` hai lần liên tiếp, response của ngày cũ về **sau** nhưng
state phải mang dữ liệu của ngày mới. `getGoal` **không** được gọi lại khi chỉ đổi `date`.

### Bước 5 — `components/MealList.tsx` + `MealRow.tsx`

Nhóm theo `MEAL_SLOTS` (quyết định §5.3 — nếu chọn (A) thì sắp ở đây). Mỗi dòng có nút
sửa/xóa. Xóa: vô hiệu hóa nút ngay khi bấm; nhận `404` thì coi như đã xóa, refetch, không
báo đỏ (SPEC §5.4).

*Deliverable:* test —
1. mảng trả về theo thứ tự `createdAt` là `[dinner, breakfast]` → render ra **sáng trước,
   tối sau** (đây là test khóa hợp đồng hiển thị mà server không đảm bảo);
2. mảng rỗng → hiện "Chưa ghi bữa nào cho ngày này.", không render bảng trống;
3. bấm xóa hai lần nhanh → `deleteMeal` gọi **một** lần.

### Bước 6 — `components/MealQuickAddForm.tsx`

`[buổi ▾][tên món][calo][+]`. `calories` phải `Number()` trước khi gửi (SPEC §5.4). Sau
`201`: xóa trắng tên + calo, **giữ nguyên buổi**, focus trả về ô tên món.

*Deliverable:* test — gửi được bữa hợp lệ với payload đúng kiểu (`calories` là `number`);
tên rỗng thì chặn tại client, **không** gọi API; `400` từ server gắn `message` vào đúng ô
theo `path`; sau khi thêm thành công, ô buổi giữ nguyên giá trị vừa chọn.

### Bước 7 — `CalorieSummaryCard.tsx` + `DatePicker.tsx` + `TodayPage.tsx` + `index.ts`

Lắp ráp. `TodayPage` giữ state `date`, truyền xuống. `DatePicker` có `max` = hôm nay
(SPEC §5.4 — bắt buộc, không phải trang trí).

*Deliverable:* test —
1. `dailyCalorieTarget = null` → hiện tổng calo, **không** có thanh tiến độ, có dòng mời
   đặt mục tiêu ở tab Cài đặt;
2. tổng vượt mục tiêu → thanh đổi màu cảnh báo, con số không bị cắt ở 100%;
3. ngày trắng hoàn toàn (404 + `[]` + goal `null`) → không hiện `0 kg`, không hiện `0 / —`;
4. smoke test thủ công: chạy server + web thật, nhập một bữa và một số đo, tải lại trang,
   dữ liệu còn đó.

## 5. Lệnh verify

Chạy từ `Lean/web` (quy ước `04-conventions.md`). **Chưa lệnh nào chạy được cho tới khi B1
xong** — đây là lệnh *dự kiến*.

```bash
cd web

npm install
npm run dev            # http://localhost:5173, proxy /api → :3000

npm test                                   # toàn bộ test của web
npx vitest run src/features/today          # chỉ trang này
npx vitest run src/features/today/components/BodyLogForm.test.tsx   # bước 3

npm run typecheck      # tsc --noEmit
npm run build          # vite build
```

Chạy end-to-end thủ công thì cần **cả hai** tiến trình:

```bash
# terminal 1
cd server && npm run dev          # http://localhost:3000

# terminal 2
cd web && npm run dev             # http://localhost:5173
```

PowerShell: dùng hai cửa sổ, không nối bằng `&&` như trên bash.

Không có lệnh nào của kế hoạch này chạm vào `server/`. Nếu quyết định §5.3 rơi vào phương án
(B) thì phần đổi `orderBy` là **task riêng của feature `meals`**, không làm trong feature này.

## 6. Nợ và rủi ro đã biết

| # | Việc | Ghi chú |
|---|---|---|
| 1 | 8 câu hỏi mở ở [`SPEC.md`](SPEC.md) §7 chưa ai chốt | Ba câu ảnh hưởng cấu trúc file — xem §2 |
| 2 | Thứ tự hiển thị bữa ăn không được test nào ở server bảo vệ | Test bước 5 là chỗ duy nhất khóa nó — [`meals/PLAN.md`](../meals/PLAN.md) §4.2 |
| 3 | `PUT` với patch rỗng có tạo hàng `BodyLog` toàn `null` không — chưa xác nhận | SPEC §7 câu hỏi 7. Luật "không gửi khi không đổi" ở bước 3 đã né được, nhưng nên biết chắc |
| 4 | Chưa có test e2e thật (Playwright) | Bước 7 mục 4 đang là thủ công |
| 5 | `note` của `BodyLog`/`Meal` không có ô nhập nào | SPEC §7 câu hỏi 3 — nếu chốt "bỏ", ghi vào đây thành nợ chính thức |
| 6 | Chưa có gì về a11y ngoài `aria-invalid` và `<label>` | Trang nhập liệu dùng hằng ngày, nên tối thiểu phải tab đi hết được bằng bàn phím |
