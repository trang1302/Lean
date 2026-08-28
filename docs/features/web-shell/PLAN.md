# Feature `web-shell` — Kế hoạch & trạng thái

## 1. Trạng thái: **CHƯA BẮT ĐẦU**

Không có file nào. Thư mục `web/` **chưa tồn tại** trong repo (`ls Lean/web` → không có gì).

| Hạng mục | Trạng thái |
|---|---|
| `web/` scaffold (Vite 8 + React 19 + TS 7) | ❌ chưa có |
| Hạ tầng test web (Vitest 4 + jsdom + Testing Library) | ❌ chưa có |
| `web/src/lib/apiClient.ts` | ❌ chưa có |
| `web/src/router/` + layout + 3 tab | ❌ chưa có |
| `web/src/features/auth/` (đăng nhập, guard, `hasPermission`) | ❌ chưa có — **chờ backend `auth`** |
| Backend `body-logs` `meals` `goal` `summary` `reminders` | ✅ xong, 208 test pass |
| Backend `auth` `rbac` | ✅ xong — giai đoạn A→D đã hoàn thành |

Đọc [`SPEC.md`](SPEC.md) trước khi làm bước nào. Hai mục không được đọc lướt: **§4** (luật
`apiClient`) và **§8** (hệ quả của việc không dùng thư viện state).

## 2. Thứ tự bắt buộc

```
web-shell  ──►  web-today
           ──►  web-charts
           ──►  web-settings
```

**`web-shell` phải xong trước cả ba trang.** Lý do không thể đảo: cả ba PLAN đều tự khai bị
chặn cứng bởi `web/` scaffold và `lib/apiClient.ts`, và cả ba đều ghi "việc của task scaffold
web, ngoài phạm vi feature này". [`web-charts/PLAN.md`](../web-charts/PLAN.md) §1 nói thêm lý
do vì sao **không** được để ba trang tự làm: *"`web-today` và `web-settings` cũng đang chờ cùng
một scaffold; ba feature cùng tạo `package.json` là chắc chắn giẫm chân nhau."*

### 2.1 Bước nào gỡ chặn cho trang nào

| Bước của `web-shell` | Gỡ chặn |
|---|---|
| **Bước 1** — scaffold + `package.json` + proxy | today `PLAN` §2 **B1** · charts `PLAN` §1 hàng 2 · settings `PLAN` §2.1 (*toàn bộ feature*) |
| **Bước 2** — hạ tầng test | today `PLAN` Bước 0 (*"`npm test` chạy được một test giả"*) · charts `PLAN` §5.2 (*chặn bước 4 của charts*) |
| **Bước 3** — `types/api.ts` + `apiClient.ts` | today `PLAN` §2 **B2** · charts `PLAN` §1 hàng 3 + Bước 1 · settings `PLAN` §2.2 (**huỷ luật "làm tạm bằng `fetch`"**) |
| **Bước 4** — `constants/` + `lib/format.ts` | today Bước 5 (`MEAL_SLOTS`), Bước 7 (`todayIso` cho `DatePicker.max`) · charts Bước 3, 6 (`format` cho trục X và tooltip, `SPEC` §5.3) |
| **Bước 5** — `components/ui` + `shared` | today Bước 7 (trạng thái rỗng) · charts Bước 8 (`ChartEmptyState` bọc `EmptyState`) · settings Bước 7 |
| **Bước 6** — `useApiResource` + `useFieldErrors` | today Bước 2 (`useFieldErrors`), Bước 4 (chống race) · charts Bước 2 (`useCharts`) · settings Bước 3–4 (map `fields[]` về ô nhập) |
| **Bước 7** — router + layout + 3 tab | today `PLAN` §2 **B3** + Bước 7 · charts Bước 9 (`/charts`) · settings §3 (dòng đăng ký route) |
| Bước 8–11 | *không gỡ chặn trang nào* — thuộc `auth`/`rbac`, xem §3 |

**Bước 1–7 gỡ hết mọi chặn của ba trang.** Sau Bước 7, ba trang chạy song song được, không
phụ thuộc nhau.

### 2.2 Ba trang KHÔNG được làm gì

Nhắc lại từ [`SPEC.md`](SPEC.md) §1.1, vì đây là chỗ dễ trôi nhất khi ba agent làm song song:

- Không tạo `web/package.json`, `vite.config.ts`, `tsconfig.json`.
- Không viết `fetch()` — kể cả tạm, kể cả kèm `TODO`.
- Không tạo bản sao của `apiClient`, `format`, `MEAL_SLOTS`, `types/api.ts`, `useFieldErrors`.
- Mỗi trang chạm **đúng một** file ngoài thư mục của nó: một dòng đăng ký route trong
  `web/src/router/routes.tsx`.

## 3. Quan hệ với `auth` — chia đôi kế hoạch

Backend `auth` giờ **đã xong** ([`auth/PLAN.md`](../auth/PLAN.md) §1). Lúc viết kế hoạch này,
`auth` chưa bắt đầu và `web/` cũng chưa tồn tại nên hai bên chặn nhau chéo — cách gỡ khi đó:
**`web-shell` làm phần không cần API trước.**

| Làm được NGAY (không cần backend `auth`) | Phải CHỜ backend `auth` |
|---|---|
| Bước 1 — scaffold, proxy `/api`, script | Bước 8 — CSRF token thật (`GET /api/auth/csrf`) |
| Bước 2 — hạ tầng test | Bước 9 — `LoginPage`, `SessionContext` (`POST /api/auth/login`, endpoint "tôi là ai") |
| Bước 3 — `apiClient` lõi + `types/api.ts` | Bước 10 — guard + `401` đá về `/login` nối vào router |
| Bước 4 — `constants/`, `format.ts` | Bước 11 — `hasPermission` (**chờ cả `rbac`**) |
| Bước 5 — `components/ui`, `shared` | |
| Bước 6 — `useApiResource`, `useFieldErrors` | |
| Bước 7 — router, layout, 3 tab (chưa guard) | |

**Ràng buộc thiết kế quan trọng:** `apiClient` ở Bước 3 phải được viết với **chỗ móc sẵn** cho
CSRF và `401`:

- `credentials: 'include'` bật **ngay từ Bước 3** — vô hại khi server chưa có phiên, và là
  dòng dễ quên nhất ([`auth/PLAN.md`](../auth/PLAN.md) Bước 11: *"thiếu nó thì trình duyệt
  không gửi cookie và mọi request đều `401`"*).
- Một hàm `onUnauthorized` **có thể thay được**, mặc định là no-op. Bước 10 gắn hàm điều hướng
  thật vào. Không phải sửa `apiClient`.
- Một hàm lấy CSRF token **có thể thay được**, mặc định trả `null` → không gắn header. Bước 8
  gắn hàm thật.

Viết `apiClient` không có ba chỗ móc này nghĩa là Bước 8 và 10 phải **viết lại** nó, và ba
trang đã dựng trên bản cũ.

**Không chặn:** `web-shell` **không** chờ `auth` xong mới bắt đầu, và ba trang **không** chờ
`auth` xong mới bắt đầu. Ba trang chỉ cần Bước 1–7.

## 4. Các bước

Mỗi bước có deliverable **chạy test được hoặc nhìn thấy được ngay**, không phụ thuộc bước sau.
Commit sau mỗi bước, format `<type>(<scope>): <subject>`
([`04-conventions.md`](../../overview/04-conventions.md)).

---

### Bước 0 — Chốt trước khi gõ code

Ba câu hỏi ảnh hưởng cấu trúc file, chốt trước rẻ hơn sửa sau:

1. ~~**endpoint "tôi là ai" tên gì, có `permissions` không**~~ — **ĐÃ GIẢI QUYẾT 2026-08-07,
   không còn chặn Bước 9 và 11.**
   Mâu thuẫn là thật: `auth/SPEC.md` §4 khai `GET /api/auth/session` (không có `permissions`),
   `rbac/SPEC.md` §12 gọi `GET /api/auth/me` (có `permissions`) — endpoint sau **không tồn tại**,
   do hai tài liệu viết song song. Đã chốt: **giữ `GET /api/auth/session`**, và feature `rbac`
   mở rộng `SessionResponse` thêm `permissions: string[]` khi làm. `rbac/SPEC.md` §12,
   `rbac/PLAN.md` Bước 11 và `auth/SPEC.md` mục `SessionResponse` đều đã sửa cho khớp.
2. **[`SPEC.md`](SPEC.md) §10 câu 7 — CSS viết thế nào.** Chặn Bước 5. Đề nghị: CSS Modules.
3. **[`SPEC.md`](SPEC.md) §10 câu 3 — nút đăng xuất ở layout hay trang Cài đặt.** Chặn Bước 7
   (một dòng trong `AppLayout`). SPEC đã chốt **layout**; chỉ cần chủ dự án không phản đối.

*Deliverable:* quyết định ghi ngược vào [`SPEC.md`](SPEC.md) §10. Không code gì.

---

### Bước 1 — Scaffold `web/`

Vite 8 + React 19 + TypeScript 7. File tối thiểu: `package.json`, `tsconfig.json`,
`vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`.

Ba thứ **không được bỏ**:

- **Proxy `/api` → `http://localhost:3000`** trong `vite.config.ts`. Bắt buộc, không phải
  tiện nghi — lý do ở [`SPEC.md`](SPEC.md) §3.3 và [`auth/SPEC.md`](../auth/SPEC.md) §3.2.
- **Tên script đúng theo §5 dưới đây.** Ba PLAN kia đang ghi "script dự kiến, chưa xác nhận";
  bước này chốt.
- **`tsconfig.json` bật `strict` và `noUncheckedIndexedAccess`** ([`SPEC.md`](SPEC.md) §3.3).

Cài luôn `recharts@3` ở bước này để `package.json` có **một** chủ —
[`web-charts/PLAN.md`](../web-charts/PLAN.md) Bước 0 chỉ còn là xác nhận.

*Deliverable:*
- `cd web && npm install` sạch;
- `npm run dev` → `http://localhost:7173` mở được một trang trắng có tiêu đề;
- `npm run typecheck` sạch; `npm run build` sạch;
- với `server` đang chạy, mở DevTools gọi `fetch('/api/health')` từ console trang `:7173` →
  `{"ok":true}` (**chứng minh proxy hoạt động**, không phải giả định).

*Commit:* `feat(web): scaffold Vite 8 + React 19 + TypeScript 7`

---

### Bước 2 — Hạ tầng test

Vitest 4 + `jsdom` + `@testing-library/react` + `@testing-library/user-event`, một
`test/setup.ts` toàn cục (dọn DOM sau mỗi test).

Dựng **đủ** ngay từ đầu, không nửa vời: [`web-charts/PLAN.md`](../web-charts/PLAN.md) §5.2 chỉ
cần test hàm thuần, nhưng [`web-today/PLAN.md`](../web-today/PLAN.md) Bước 3 cần test
**component** thật (*"thông báo hiện dưới ô cân nặng, và ô có `aria-invalid`"*). Thiếu jsdom ở
đây thì `web-today` sẽ tự dựng trong `features/today/` — sai chỗ.

*Deliverable:*
- một test hàm thuần và một test render component (`render(<div>hi</div>)` + `screen.getByText`)
  cùng pass;
- `npx vitest run src/lib` chạy được (lọc theo đường dẫn — cú pháp mà cả ba PLAN kia dùng).

*Commit:* `test(web): vitest + jsdom + testing-library setup`

---

### Bước 3 — `types/api.ts` + `lib/apiClient.ts` ⚠️ **bước quan trọng nhất**

Đây là file mà ba trang cùng dựa vào và là chỗ [`SPEC.md`](SPEC.md) §4 sống hoặc chết.

**`types/api.ts`** — chép hình dạng response từ SPEC của feature backend tương ứng:
`BodyLog` ([`body-logs`](../body-logs/SPEC.md)), `Meal` + `MealSlot` ([`meals`](../meals/SPEC.md)),
`Goal` ([`goal`](../goal/SPEC.md)), `SummaryResponse`/`SummaryDay`/`SummaryWeek`/`SummaryGoal`
([`summary`](../summary/SPEC.md)), `ApiError`. Chép tay, không suy diễn — không có bước sinh
type tự động, nên **đổi response ở backend là phải sửa file này cùng lúc**.

**`lib/apiClient.ts`** — hiện thực đủ [`SPEC.md`](SPEC.md) §4.2–§4.6, cộng ba chỗ móc ở §3
của file này (`credentials: 'include'`, `onUnauthorized` thay được, hàm lấy CSRF thay được).

*Deliverable:* test với `fetch` bị mock, **11 ca của [`SPEC.md`](SPEC.md) §4.7**, không bớt
ca nào. Bốn ca không được thiếu vì có trang khác đang phụ thuộc trực tiếp:

1. `400` + `fields: [{path:'weightKg'},{path:'calories'}]` → `ApiError.fields` mang **đủ hai**
   phần tử, đúng thứ tự (nền của today §5.2 và settings §4);
2. `putBodyLog(d, { waistCm: null })` → body gửi đi là `{"waistCm":null}` — **giữ khóa, giữ
   `null`**, không bị `undefined` nuốt (nền của hợp đồng upsert 3 trạng thái, today §5.1);
3. `204` → trả `undefined`, không ném lỗi parse (`DELETE /meals/:id`);
4. `404` → `getOrNull` trả `null`, `get` vẫn ném `ApiError` `status: 404`.

*Commit:* `feat(web): shared apiClient with structured errors`

> **Sau bước này, cập nhật [`web-settings/PLAN.md`](../web-settings/PLAN.md) §2.2 và §6 nếu
> chúng còn nói "làm tạm bằng `fetch`".** Luật ở [`SPEC.md`](SPEC.md) §4.1 thắng; dòng đó chỉ
> đúng khi `apiClient.ts` chưa có chủ.

---

### Bước 4 — `constants/meals.ts` + `lib/format.ts`

Hàm thuần, không React, không API. Chi tiết ở [`SPEC.md`](SPEC.md) §3.4.

`todayIso()` tính **cứng theo `Asia/Ho_Chi_Minh`** bằng `Intl.DateTimeFormat` — chốt cho câu
hỏi mở [`web-today/SPEC.md`](../web-today/SPEC.md) §7 câu 4.

*Deliverable:* unit test —
1. `MEAL_SLOTS` đúng thứ tự `['breakfast','lunch','dinner','snack']` và **khớp giá trị** với
   `slotSchema` của server (`server/src/shared/validation/commonSchemas.ts`) — so bằng danh
   sách chép tay trong test, kèm comment trỏ về file server;
2. `todayIso()` trả `"YYYY-MM-DD"` và **không đổi khi đổi `TZ` của tiến trình test** (chạy
   test với `TZ=UTC` và `TZ=America/New_York` cho cùng kết quả — đây là test khóa quyết định
   trên, không phải test trang trí);
3. `formatDateShort('2026-08-07')` → `'07/08'` **mà không đi qua `new Date()`**;
4. `formatNullable(null, 'kg')` → `'—'`, không phải `'0 kg'`, `'null kg'`, hay `''`.

*Commit:* `feat(web): shared constants and formatters`

---

### Bước 5 — `components/ui/` + `components/shared/`

`ui/`: `Button`, `Input`, `NumberInput`, `Select`, `Switch`, `Card` — mỏng, bọc thẻ HTML, có
`<label>` gắn đúng `id`, hỗ trợ `aria-invalid`.

`shared/`: `LoadingState`, `ErrorState`, `EmptyState`, `FieldError`
([`SPEC.md`](SPEC.md) §7).

`ErrorState` nhận `ApiError`, **không** nhận chuỗi.

*Deliverable:* test component —
1. `ErrorState` với `ApiError` `status: 0` → hiện *"Không kết nối được server — server đã chạy
   chưa?"* và có nút **Thử lại** gọi đúng callback;
2. `ErrorState` với `status: 500` → thông báo chung, **không** lộ `message` thô của server;
3. `EmptyState` render **không** có màu/vai trò lỗi (`role="alert"` là của `ErrorState`) — đây
   là ranh giới *rỗng ≠ lỗi* ở [`SPEC.md`](SPEC.md) §7.1;
4. `Input` + `FieldError` → `<input>` có `aria-invalid="true"` và thông báo nằm **ngay dưới**
   ô, liên kết bằng `aria-describedby`;
5. tab được hết qua mọi control bằng bàn phím (khoản nợ a11y số 6 của
   [`web-today/PLAN.md`](../web-today/PLAN.md) §6 — giải ở đây một lần).

*Commit:* `feat(web): shared UI and state components`

---

### Bước 6 — `hooks/useApiResource.ts` + `hooks/useFieldErrors.ts`

**`useApiResource`** — [`SPEC.md`](SPEC.md) §8.1. Trả `{ data, isLoading, error, reload }`.
Cờ `cancelled` áp cho **cả** nhánh thành công lẫn nhánh lỗi.

**`useFieldErrors`** — [`SPEC.md`](SPEC.md) §7.3. Chuyển lên `web/src/hooks/` thay vì
`features/today/hooks/` như [`web-today/PLAN.md`](../web-today/PLAN.md) §3 dự kiến, vì
`web-settings` cần đúng cùng hành vi.

*Deliverable:* test —
1. **Chống race, ca chính:** đổi tham số hai lần liên tiếp, response của lần **đầu** về
   **sau** → state mang dữ liệu của lần **sau**. Đây là ca mà
   [`web-today/PLAN.md`](../web-today/PLAN.md) Bước 4 yêu cầu, giải ở đây một lần cho cả ba
   trang;
2. **Chống race, nhánh lỗi:** request cũ **hỏng** về sau khi request mới đã thành công →
   `error` vẫn `null`, dữ liệu mới không bị che bởi khối lỗi đỏ;
3. `reload()` gọi lại hàm nạp và cập nhật `data`;
4. unmount giữa chừng → không có `setState` nào chạy (không có cảnh báo React);
5. `useFieldErrors`: nhiều lỗi cùng lúc ra đủ nhiều entry; `path: "date"` khi form không có ô
   `date` rơi vào nhóm **lỗi cấp form**, **không bị nuốt**; `reset()` xóa sạch.

*Commit:* `feat(web): useApiResource race guard and useFieldErrors`

---

### Bước 7 — Router + `AppLayout` + 3 tab

`router/routes.tsx` với bốn route ([`SPEC.md`](SPEC.md) §5.2) + `NotFoundPage`. `AppLayout`
bọc ba route đầu: thanh tab, đánh dấu tab đang mở, chỗ cho danh tính + nút đăng xuất (nút chưa
hoạt động cho tới Bước 9).

Ba trang **chưa tồn tại** → cắm ba component placeholder tối giản (một dòng chữ tên trang).
Chúng bị thay bằng `import { TodayPage } from '@/features/today'` khi trang tương ứng xong.

*Deliverable:*
- `npm run dev` → bấm qua lại ba tab, đường dẫn đổi đúng, tab đang mở được đánh dấu, **không
  lỗi console**;
- F5 ở `/charts` → vẫn ở `/charts` (không văng về `/`);
- đường dẫn lạ (`/khong-co`) → `NotFoundPage`, không phải màn hình trắng;
- test: render router ở `/settings` → thấy nội dung placeholder của Cài đặt, **không** thấy
  của Hôm nay.

*Commit:* `feat(web): router, app layout and tab navigation`

> **Đây là mốc gỡ chặn.** Sau bước này, [`web-today/PLAN.md`](../web-today/PLAN.md) Bước 1,
> [`web-charts/PLAN.md`](../web-charts/PLAN.md) Bước 1 và
> [`web-settings/PLAN.md`](../web-settings/PLAN.md) Bước 1 đều khởi động được, **song song**.

---

### ───── Ranh giới `auth`: các bước dưới đây CHỜ backend `auth` ─────

Bốn bước còn lại cần endpoint của [`auth/SPEC.md`](../auth/SPEC.md) §4 và
[`rbac/SPEC.md`](../rbac/SPEC.md) §10 — **chưa tồn tại**. Chúng **không** chặn ba trang.

---

### Bước 8 — CSRF *(cần `GET /api/auth/csrf`)*

Gắn hàm lấy token thật vào chỗ móc đã chừa ở Bước 3: gọi `GET /api/auth/csrf` khi khởi động,
giữ trong biến module, gắn header `x-csrf-token` cho `POST`/`PUT`/`PATCH`/`DELETE`. Nhận
`403 CSRF_ERROR` → lấy token mới, thử lại **đúng một lần**.

**Không lưu token trong `localStorage`** ([`SPEC.md`](SPEC.md) §4.2).

*Deliverable:* test — `GET` không có header; `PUT` có header; `403 CSRF_ERROR` một lần → thử
lại thành công, `fetch` được gọi **hai** lần; `403 CSRF_ERROR` hai lần liên tiếp → ném lên,
**không** lặp vô hạn.

*Commit:* `feat(web): CSRF token handling in apiClient`

---

### Bước 9 — `features/auth/`: `SessionContext` + `LoginPage` + đăng xuất

*(cần `POST /api/auth/login`, `POST /api/auth/logout`, và endpoint "tôi là ai" — **Bước 0 câu 1
phải chốt xong**)*

`SessionContext` giữ `user`, `permissions`, `hasPermission`, `hasAnyPermission`,
`reloadSession`, `logout`. Nạp **một lần** lúc bootstrap.

`LoginPage`: form email + mật khẩu. Xử `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`,
`429 TOO_MANY_ATTEMPTS`, `400 VALIDATION_ERROR` + `fields[]` — bốn mã, bốn câu khác nhau
([`auth/SPEC.md`](../auth/SPEC.md) §4).

**Không lưu gì về đăng nhập trong `localStorage`** — không token, không cờ "đã đăng nhập rồi".
Nguồn sự thật duy nhất là endpoint "tôi là ai" ([`auth/SPEC.md`](../auth/SPEC.md) §3.1).

*Deliverable:* test —
1. login sai mật khẩu → lỗi hiện **trên form**, **không** điều hướng đi đâu (ca `401
   INVALID_CREDENTIALS` phải được loại trừ khỏi luật đá-về-login, [`SPEC.md`](SPEC.md) §4.6);
2. `403 ACCOUNT_DISABLED` → câu thông báo **khác** ca sai mật khẩu;
3. login thành công → `SessionContext` có `user`, và điều hướng về đường dẫn trong `?next=`;
4. đăng xuất → `SessionContext` rỗng, về `/login`; gọi đăng xuất lần hai vẫn không lỗi
   (`logout` idempotent, trả `204`, [`auth/SPEC.md`](../auth/SPEC.md) §4);
5. `grep -r "localStorage" web/src` → **không kết quả nào** liên quan tới phiên.

*Commit:* `feat(web): session context, login page and logout`

---

### Bước 10 — Route guard + `401` toàn cục

`RequireSession` bọc ba route đầu ([`SPEC.md`](SPEC.md) §5.3). Gắn hàm `onUnauthorized` thật
vào chỗ móc của `apiClient`: xóa state phiên → điều hướng `/login?next=…`.

*Deliverable:* test —
1. chưa có phiên, vào `/charts` → chuyển hướng `/login?next=/charts`; đăng nhập xong → về
   `/charts`;
2. đang ở `/` với phiên hợp lệ, một request bất kỳ trả `401 UNAUTHORIZED` → đá về `/login`,
   **không** hiện màn hình lỗi đỏ;
3. `403 FORBIDDEN` → **KHÔNG** đá về `/login`; lỗi nổi lên cho caller (ca hồi quy quan trọng
   nhất của bước này — gộp 403 vào 401 tạo vòng lặp đăng nhập không thoát được,
   [`SPEC.md`](SPEC.md) §4.6);
4. trong lúc chờ endpoint "tôi là ai" → hiện trạng thái đang tải, **không** nhấp nháy
   `/login`;
5. đã có phiên mà vào `/login` → đá về `/`.

*Commit:* `feat(web): route guard and global 401 handling`

---

### Bước 11 — `hasPermission` + gate thanh tab *(cần `rbac`)*

Hiện thực [`SPEC.md`](SPEC.md) §6. Chỉ làm được khi endpoint "tôi là ai" thật sự trả
`permissions: string[]` (Bước 0 câu 1).

Phần `web-shell` gate: tab **Hôm nay** (`log:manage`), tab **Biểu đồ** (`log:view`). Phần bên
trong mỗi trang do trang đó tự gate bằng `hasPermission`.

Viết bằng `hasPermission` kể cả khi hôm nay cả `USER` lẫn `ADMIN` đều có
([`rbac/SPEC.md`](../rbac/SPEC.md) §12) — **không hardcode `true`**.

*Deliverable:* test —
1. `permissions` thiếu `log:view` → tab **Biểu đồ** **ẩn hẳn**, không phải nút xám
   ([`rbac/SPEC.md`](../rbac/SPEC.md) §12);
2. `permissions` đủ → cả ba tab hiện;
3. nhận `403` từ một request → `reloadSession()` được gọi đúng một lần.

*Commit:* `feat(web): permission-based UI gating`

---

### Bước 12 — Dọn dẹp và bàn giao

Chỉ chạy **sau khi cả ba trang xong**.

- Thay ba placeholder ở Bước 7 bằng `TodayPage` / `ChartsPage` / `SettingsPage` thật.
- Cập nhật [`docs/overview/01-architecture.md`](../../overview/01-architecture.md): cây
  `web/src/` thêm `features/auth/`, `types/`, `router/AppLayout.tsx`. **Chỉ làm ở bước này** —
  tài liệu `overview/` mô tả hành vi thật, không mô tả ý định
  ([`SPEC.md`](SPEC.md) §10 câu 5).
- Cập nhật `README.md` mục "Trạng thái" và `docs/README.md` bảng trạng thái.

*Deliverable:* `npm run build` sạch; bấm hết ba tab trên dữ liệu thật không lỗi console.

*Commit:* `docs(web): update architecture and status after web shell lands`

## 5. Tên script trong `web/package.json` — CHỐT

Ba PLAN kia đang ghi *"script dự kiến, chưa xác nhận"*
([`web-charts/PLAN.md`](../web-charts/PLAN.md) §4). **Đây là chỗ chốt.** Tên khớp
`server/package.json` để đi qua lại hai thư mục không phải nhớ hai bộ tên.

| Script | Lệnh | Ghi chú |
|---|---|---|
| `dev` | `vite` | `http://localhost:7173`, proxy `/api` → `:3000` |
| `build` | `npm run typecheck && vite build` | **Cố ý gộp typecheck.** Cả ba PLAN dùng *"`npm run build` sạch"* làm cổng nghiệm thu; nếu `build` không kiểm kiểu thì câu đó yếu hơn người viết tưởng |
| `preview` | `vite preview` | Xem bản build tĩnh |
| `test` | `vitest run` | Giống `server/package.json` |
| `test:watch` | `vitest` | |
| `typecheck` | `tsc --noEmit` | Giống `server/package.json` |

**Ba lệnh mà ba PLAN kia đang dùng đều chạy được dưới bộ tên này**, không cần sửa file nào:

- today: `npm test`, `npx vitest run src/features/today`, `npm run typecheck`, `npm run build` ✅
- charts: `npm run dev`, `npx tsc --noEmit`, `npm run build`, `npm test` ✅
- settings: `npm run dev`, `npm run build`, `npx tsc --noEmit` ✅

**Không** thêm `lint`/`format` ở bản này — chưa có ESLint/Prettier trong `server/`, thêm ở
`web/` tạo bất đối xứng mà không ai yêu cầu.

## 6. Lệnh verify

Chạy từ `C:\Project\WorkSpace\Lean\web` (quy ước
[`04-conventions.md`](../../overview/04-conventions.md): *"Chạy mọi lệnh `npm` của server từ
`Lean/server`, của web từ `Lean/web`"*). **Chưa lệnh nào chạy được cho tới khi Bước 1 xong.**

```bash
cd web

npm install
npm run dev            # http://localhost:7173, proxy /api → :3000

npm test                                # toàn bộ test của web
npx vitest run src/lib                  # chỉ apiClient + format (Bước 3, 4)
npx vitest run src/hooks                # chỉ hook dùng chung (Bước 6)
npx vitest run src/router               # chỉ router + guard (Bước 7, 10)

npm run typecheck      # tsc --noEmit
npm run build          # typecheck + vite build
```

Mọi kiểm tra bằng mắt cần **cả hai** tiến trình:

```bash
# cửa sổ 1
cd server && npm run dev          # http://localhost:3000

# cửa sổ 2
cd web && npm run dev             # http://localhost:7173
```

PowerShell: dùng hai cửa sổ, không nối bằng `&&`.

Kiểm proxy không cần mở web (từ cửa sổ có `server` đang chạy):

```bash
curl http://localhost:3000/api/health     # {"ok":true}
```

**Không lệnh nào của kế hoạch này chạm vào `server/`.** Bước 8–11 cần backend `auth` đã chạy,
nhưng việc thi công `auth` là [`auth/PLAN.md`](../auth/PLAN.md), không phải kế hoạch này.

## 7. Nợ và rủi ro đã biết

| # | Việc | Ghi chú |
|---|---|---|
| 1 | **9 câu hỏi mở** ở [`SPEC.md`](SPEC.md) §10 chưa ai chốt | Câu 1 **chặn** Bước 9 và 11; câu 7 chặn Bước 5 |
| 2 | ~~Mâu thuẫn `/api/auth/session` vs `/api/auth/me`~~ **ĐÃ GIẢI QUYẾT 2026-08-07** | Chốt giữ `GET /api/auth/session`; `rbac` mở rộng `SessionResponse` thêm `permissions`. Ba file đã sửa khớp |
| 3 | Màn "Tài khoản" / "Phân quyền" (rbac §12, rbac §10) **chưa ai sở hữu** | Không thuộc `web-shell`, không thuộc `web-settings`. Đề nghị feature riêng — [`SPEC.md`](SPEC.md) §10 câu 4 |
| 4 | Chưa có test e2e (Playwright) | Luồng đáng nhất là *đăng nhập → hết phiên → bị đá về `/login`*, và nó thuộc `web-shell`. Đề nghị: không làm ở bản đầu — [`SPEC.md`](SPEC.md) §10 câu 8 |
| 5 | Kiểu trong `types/api.ts` chép tay, không sinh tự động | Đổi response ở backend mà quên sửa đây → lỗi câm ở runtime, `tsc` không bắt được |
| 6 | `apiClient` không có timeout | Vô hại trên localhost; xét lại cùng lúc với [`SPEC.md`](SPEC.md) §10 câu 6 (deploy tách) |
| 7 | Bước 8–11 từng chặn bởi backend `auth` lúc `auth` **chưa bắt đầu** ([`auth/PLAN.md`](../auth/PLAN.md) §4); giờ `auth` đã xong nên hết chặn | `web-shell` Bước 1–7 và cả ba trang không phải chờ. Kịch bản đã xảy ra đúng như dự kiến: cả bốn feature web chạy xong trước, rồi Bước 8–11 khoác auth lên sau. Ba chỗ móc ở §3 đã được chừa từ Bước 3 |
| 8 | Chưa chốt CSS | Bước 5 là chỗ đầu tiên phải viết. [`SPEC.md`](SPEC.md) §10 câu 7 |
