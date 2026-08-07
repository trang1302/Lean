# Feature `web-shell` — Tầng nền của ứng dụng web

> **Trạng thái: CHƯA CÓ CODE.** Thư mục `web/` chưa tồn tại trên đĩa. Tài liệu này là
> **hợp đồng định hướng** cho người implement, không mô tả hành vi đang chạy — khác với
> `SPEC.md` của năm feature backend vốn đọc ngược từ code thật.
>
> Trạng thái thi công và thứ tự bước: [`PLAN.md`](PLAN.md).

Liên quan: [`../web-today/SPEC.md`](../web-today/SPEC.md) · [`../web-charts/SPEC.md`](../web-charts/SPEC.md)
· [`../web-settings/SPEC.md`](../web-settings/SPEC.md) (ba trang tiêu thụ tầng này) ·
[`../auth/SPEC.md`](../auth/SPEC.md) (phiên, cookie, CSRF, `401`) ·
[`../rbac/SPEC.md`](../rbac/SPEC.md) §12 (áp quyền trên FE) ·
[`../../overview/01-architecture.md`](../../overview/01-architecture.md) (cây `web/src/`) ·
[`../../overview/04-conventions.md`](../../overview/04-conventions.md) (hình dạng lỗi API).

---

## 1. Feature này để làm gì

Ba trang `web-today`, `web-charts`, `web-settings` đều đã có SPEC + PLAN, và **cả ba đều khai
bị chặn cứng** bởi hai thứ **không feature nào sở hữu**: thư mục `web/` chưa dựng, và
`web/src/lib/apiClient.ts` chưa có. Ba PLAN đó đều ghi "việc của task scaffold web, ngoài phạm
vi feature này" — nhưng task đó chưa tồn tại.

**`web-shell` là task đó.** Nó sở hữu mọi thứ nằm **ngoài** `web/src/features/{today,charts,settings}/`.

### 1.1 Ranh giới — `web-shell` KHÔNG làm ba trang

Đây là ranh giới cứng, đọc trước khi gõ dòng đầu tiên:

| `web-shell` sở hữu | Ba trang sở hữu |
|---|---|
| `web/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | — |
| `web/src/main.tsx`, `App.tsx` | — |
| `web/src/lib/{apiClient,format}.ts` | — |
| `web/src/router/` + layout + thanh điều hướng | — |
| `web/src/components/{ui,shared}/` | `features/<tên>/components/` |
| `web/src/constants/`, `web/src/hooks/`, `web/src/types/` | `features/<tên>/hooks/` (hook riêng của trang) |
| Cấu hình test cho web (Vitest + jsdom + Testing Library) | test của từng trang |
| `web/src/features/auth/` — trang đăng nhập, guard, `hasPermission` | — |
| — | `web/src/features/{today,charts,settings}/**` |

**`web-shell` không render một ô nhập cân nặng, một biểu đồ, hay một công tắc nhắc nhở nào.**
Ba trang có SPEC riêng và chúng là nguồn chân lý cho nội dung của chúng. Nếu trong lúc làm
`web-shell` bạn thấy mình đang viết `MealList` hay `WeightChart`, bạn đã đi lạc.

Chiều ngược lại cũng đúng: ba trang **không** được tạo bản sao của bất cứ thứ gì ở bảng cột
trái. Ba bản `apiClient` là ba cách xử lý lỗi khác nhau trong cùng một app.

Điểm chạm duy nhất: mỗi trang `export` đúng một component qua `features/<tên>/index.ts`, và
`web-shell` cắm nó vào một route. Không có chiều import ngược — `web-shell` **không** import
gì từ `features/{today,charts,settings}/` ngoài ba `index.ts` đó.

## 2. Danh sách đầy đủ thứ ba trang cần mà chưa ai sở hữu

Thu thập từ ba cặp SPEC + PLAN. Cột cuối là chỗ `web-shell` chốt nó.

| # | Thứ cần | Ai đang chờ | Chốt ở |
|---|---|---|---|
| 1 | `web/` scaffold: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `main.tsx`, `App.tsx` | today B1 · charts §1 · settings §2.1 | §3 |
| 2 | Proxy `/api` → `http://localhost:3000` trong `vite.config.ts` | today B1 | §3.2 |
| 3 | **`lib/apiClient.ts`** | today B2 · charts §1 · settings §2.2 | **§4** |
| 4 | Kiểu lỗi giữ nguyên `status` + `error.fields[]` | today B2 · settings §2.2 | §4.3 |
| 5 | `204` không body không làm vỡ parse JSON | today B2 (`DELETE /meals/:id`) | §4.4 |
| 6 | Ca "`404` là dữ liệu" phân biệt với `404` là lỗi | today B2 (`GET /body-logs/:date`) | §4.5 |
| 7 | `router/routes.tsx` + 3 tab | today B3 · charts §1, bước 9 · settings §3 | §5 |
| 8 | `lib/format.ts` — `todayIso()`, format số, format ngày | today §3 · charts §5.3 | §3.4 |
| 9 | `constants/` — `MEAL_SLOTS` + `SLOT_LABEL`, một nguồn duy nhất | today §5.3, §3 | §3.4 |
| 10 | `types/api.ts` — `BodyLog`, `Meal`, `MealSlot`, `Goal`, `Summary*`, `ApiError` | today §3 · charts §2 (ghi chú "nếu ba feature đều cần thì chuyển lên") | §3.4 |
| 11 | Hạ tầng test web: Vitest 4 + jsdom + Testing Library | today B1 · charts §5.2 | §3.3 |
| 12 | **Tên script thật** trong `web/package.json` | cả ba PLAN đều ghi "script dự kiến, chưa xác nhận" | [`PLAN.md`](PLAN.md) §5 |
| 13 | `fields[]` → lỗi hiện dưới **đúng ô nhập** (hook dùng chung) | today §5.2 (`useFieldErrors`) · settings §4 | §4.3, §7.3 |
| 14 | Trạng thái đang tải / lỗi / rỗng dùng chung | today §6 · charts §6 · settings bước 7 | §7 |
| 15 | Chống race khi đổi tham số truy vấn (cờ `cancelled`) | today §7 câu 8 (**để ngỏ**) · charts (đổi khoảng) | §8 |
| 16 | `todayIso()` theo timezone máy hay cứng `Asia/Ho_Chi_Minh` | today §7 câu 4 (**để ngỏ**) | §3.4 |
| 17 | Trang đăng nhập + route guard | [`../auth/PLAN.md`](../auth/PLAN.md) Bước 11 (**đang bị chặn vì `web/` chưa có**) | §5.3 |
| 18 | `credentials: 'include'` trên mọi request | auth PLAN Bước 11 | §4.2 |
| 19 | CSRF token: lấy ở `GET /api/auth/csrf`, gắn header cho mọi request ghi | auth SPEC §7.2 · auth PLAN Bước 11 | §4.2 |
| 20 | Bắt `401` toàn cục → đá về `/login`, **một chỗ duy nhất** | auth PLAN Bước 11 | §4.6 |
| 21 | `hasPermission(code)` / `hasAnyPermission(...)` | [`../rbac/SPEC.md`](../rbac/SPEC.md) §12 | §6 |
| 22 | Nút đăng xuất | auth PLAN Bước 11 ghi "Trang Cài đặt", nhưng `web-settings/SPEC.md` §1 nói trang đó chỉ có hai nhóm và "không có gì khác" | §5.2 + §10 câu 3 |

Bốn dòng in đậm (3, 12, 15, 16) là những chỗ ba PLAN đang **để ngỏ hoặc nói ngược nhau**.
Tài liệu này chốt cả bốn.

## 3. Stack — chốt

### 3.1 Bản dùng

Khớp [`04-conventions.md`](../../overview/04-conventions.md) mục "Phiên bản: luôn dùng bản
mới nhất":

| Thứ | Bản | Ghi chú |
|---|---|---|
| React | **19** | |
| Vite | **8** | dev server `:5173` |
| TypeScript | **7** | cùng bản với `server/` |
| Recharts | **3** | chỉ `web-charts` dùng; cài ở scaffold để `package.json` có một chủ |
| Vitest | **4** | cùng bản với `server/` |
| `react-router` | dòng **7** | §5.1 |
| `jsdom` + `@testing-library/react` + `@testing-library/user-event` | mới nhất | §3.3 |

Tra lại bản mới nhất trước khi cài — ràng buộc `04-conventions.md:13`.

### 3.2 Những thứ CỐ Ý không có

**Lean không bê stack frontend của `upip` sang** ([`01-architecture.md`](../../overview/01-architecture.md):
*"Stack giữ nguyên của Lean (Express + Prisma + React), **không** bê stack frontend của upip
(TanStack, Jotai, shadcn) sang"*). Nói thẳng ra để người sau không "bổ sung cho tiện":

| Không dùng | Vì sao | Thay bằng |
|---|---|---|
| **TanStack Query** | Cache/refetch/dedupe là thứ có giá khi có hàng chục màn và dữ liệu chia sẻ chéo. Lean có 3 trang, mỗi trang 1–7 lời gọi, không trang nào cần dữ liệu của trang khác | `useState` + `useEffect` + `useApiResource` (§8) |
| **TanStack Router** | 4 route, không có route lồng sâu, không có loader | `react-router` (§5.1) |
| **Jotai / Redux / Zustand** | State chia sẻ giữa các trang chỉ có đúng **một** thứ: phiên đăng nhập + tập quyền. Một `Context` là đủ | `SessionContext` (§6) |
| **shadcn / Tailwind / thư viện UI** | Kéo theo build step, theme system, và một tập component lớn hơn toàn bộ app | HTML thuần + CSS (§10 câu 7) |

**Cái giá phải trả là có thật và được ghi ở §8** — bỏ TanStack Query nghĩa là tự chống race.
Chấp nhận có ý thức, không phải bỏ sót.

Nếu ai đó muốn thêm lại một trong bốn dòng trên: đó là quyết định sửa
`01-architecture.md`, không phải quyết định của một PR feature.

### 3.3 Cấu hình gốc

- **`vite.config.ts` — proxy `/api` → `http://localhost:3000` là BẮT BUỘC**, không phải tiện
  nghi. `web` chạy `:5173`, API chạy `:3000` → khác origin. Cookie phiên dùng
  `sameSite: 'lax'` ([`auth/SPEC.md`](../auth/SPEC.md) §3.2), chỉ đúng khi **cùng origin**.
  Gọi thẳng `http://localhost:3000` buộc phải hạ xuống `sameSite: 'none'` + CORS
  `credentials` — tức **tự tháo lớp phòng vệ CSRF cấp cookie chỉ để tiện lúc dev**. Không làm
  thế. Hệ quả kèm theo: `apiClient` dùng base URL **tương đối** `/api`, không bao giờ
  hard-code host (§4.2).
- **Test**: Vitest 4, môi trường `jsdom`, `@testing-library/react` + `user-event`, một
  `setup` file toàn cục (dọn DOM sau mỗi test, khai `expect` mở rộng của jest-dom).
  `charts/PLAN.md` §5.2 ghi *"Bước 4 cần **ít nhất** Vitest chạy được trên `utils/chartData.ts`
  — hàm thuần, không cần jsdom"*; `today/PLAN.md` bước 3 thì cần test **component** thật.
  **Chốt: dựng đủ jsdom + Testing Library ngay từ đầu.** Nửa vời ở đây nghĩa là `web-today`
  phải dựng nốt, và nó sẽ dựng trong `features/today/` — sai chỗ.
- **`tsconfig.json`**: `strict: true`, `noUncheckedIndexedAccess: true`. Lý do cái thứ hai:
  ba trang xử lý mảng có phần tử `null` ở khắp nơi (`days[]`, `weeks[]`, `fields[]`), và
  `?? 0` im lặng là cạm bẫy số một của `web-charts` ([`web-charts/SPEC.md`](../web-charts/SPEC.md)
  §4.2, §4.3). Trình biên dịch nên đứng về phía đó.

### 3.4 Ba module dùng chung nhỏ

**`web/src/types/api.ts`** — kiểu của **mọi** response API, chép tay theo `SPEC.md` của
feature backend tương ứng: `BodyLog`, `Meal`, `MealSlot`, `Goal`, `SummaryResponse`,
`SummaryDay`, `SummaryWeek`, `SummaryGoal`, `SessionUser`, `ApiError`.

Không có bước sinh type tự động, nên **đổi response ở backend là phải sửa file này cùng lúc**.
`charts/PLAN.md` §2 đã lường trước và cho phép chuyển lên đây; `today/PLAN.md` §3 chỉ thẳng
vào đây. Không giữ bản sao trong `features/*/types.ts`.

**`web/src/constants/meals.ts`** — `MEAL_SLOTS` (mảng thứ tự **tường minh**
`['breakfast','lunch','dinner','snack']`) và `SLOT_LABEL` (nhãn tiếng Việt). Một nguồn duy
nhất cho cả dropdown `[buổi ▾]` lẫn thứ tự nhóm của `MealList`
([`web-today/SPEC.md`](../web-today/SPEC.md) §5.3). Giá trị phải **khớp** `slotSchema` của
server (`server/src/shared/validation/commonSchemas.ts`) — hai bản riêng biệt có chủ đích, nên
lệch là lỗi câm.

**`web/src/lib/format.ts`** — hàm thuần, không React, không API:

- `todayIso(): string` — **chốt: tính cứng theo `Asia/Ho_Chi_Minh` bằng `Intl.DateTimeFormat`,
  không theo timezone máy.** Đây là quyết định cho câu hỏi mở
  [`web-today/SPEC.md`](../web-today/SPEC.md) §7 câu 4, phương án (b). Lý do: server chặn ngày
  tương lai theo `Asia/Ho_Chi_Minh` (`server/src/lib/time.ts`); client theo giờ máy sẽ cho
  người dùng chọn một ngày mà server coi là tương lai → `400` ở `path: "date"` ngay lần bấm
  lưu đầu tiên. Phương án (b) khớp đúng định nghĩa server đang dùng và **không cần đổi
  backend** (khỏi phải thêm endpoint trả `todayIso()` như phương án (c)).
- `formatDateShort(iso)` → `dd/MM` cho trục X; `formatDateFull(iso)` → `YYYY-MM-DD` cho tooltip.
- `formatNumber`, `formatNullable(value, unit)` → `—` khi `null`.

> **`date` là chuỗi `"YYYY-MM-DD"`, không phải `Date`** ([`04-conventions.md`](../../overview/04-conventions.md)).
> **Không** `new Date(day.date)` rồi format lại bằng giờ máy — đó đúng là lỗi lệch múi giờ mà
> cả dự án đang tránh. So sánh chuỗi `"YYYY-MM-DD"` **chính là** so sánh thứ tự thời gian.
> `formatDateShort` cắt chuỗi, không đi qua `Date`.

## 4. `apiClient` — luật dùng chung

**Đây là mục quan trọng nhất của tài liệu này.**

### 4.1 Luật

> **Mọi lời gọi HTTP trong `web/` đi qua `web/src/lib/apiClient.ts`.**
> **Không file nào ngoài `apiClient.ts` được gọi `fetch()`.**

Không có ngoại lệ, không có "tạm thời", không có `TODO`.

**Câu trên thắng dòng "làm tạm bằng `fetch`, để `TODO`" ở
[`web-settings/PLAN.md`](../web-settings/PLAN.md) §2.2 và §6.** Dòng đó được viết khi
`apiClient.ts` chưa có chủ và không có lịch; giờ nó có cả hai. `web-settings` **không** viết
`fetch` trong `settings.api.ts` — nó chờ [`PLAN.md`](PLAN.md) Bước 3 của tài liệu này, và Bước
3 nằm trước mọi bước của cả ba trang.

Câu trên **đồng ý** với [`web-charts/PLAN.md`](../web-charts/PLAN.md) §1: *"Feature này không
được tự `fetch()` … Viết `fetch` riêng ở đây là tạo ra ba cách xử lý lỗi khác nhau trong cùng
một app."* Hai PLAN đang nói ngược nhau; luật này chốt theo `web-charts`.

Vì sao luật cứng đến vậy — bốn thứ **không thể** đúng nếu mỗi trang tự `fetch`:

1. **`fields[]` phải tới được từng ô nhập** (§4.3). Một `fetch` viết vội bẹp lỗi thành
   `new Error(res.statusText)` là đủ để giết hợp đồng này ở cả ba trang, và không test nào của
   trang bắt được vì trang test đúng cái `fetch` sai của nó.
2. **`401` chỉ được xử ở một chỗ** (§4.6). Ba chỗ xử `401` là ba hành vi khác nhau khi phiên
   hết hạn — và phiên hết hạn giữa chừng là chuyện **bình thường**, không phải sự cố hiếm.
3. **CSRF token** (§4.2) phải gắn vào **mọi** request ghi. Bỏ sót một chỗ là một nút bấm trả
   `403` mà không ai hiểu vì sao.
4. **`credentials: 'include'`** (§4.2). Thiếu nó thì trình duyệt không gửi cookie phiên và
   **mọi** request trả `401` — một lỗi mà triệu chứng ("app không đăng nhập được") cách xa
   nguyên nhân (một dòng thiếu trong option của `fetch`).

Hệ quả về file: `features/<tên>/api/<tên>.api.ts` là **chỗ duy nhất của mỗi trang biết đường
dẫn URL**, và nó gọi `apiClient`, không gọi `fetch`. Ranh giới này đã có sẵn trong cả ba PLAN.

### 4.2 Trách nhiệm — request

| # | Việc | Chi tiết |
|---|---|---|
| 1 | **Base URL** | Hằng `'/api'`, **tương đối**. Không hard-code `http://localhost:3000` ở bất kỳ đâu trong `web/` — dev đi qua proxy Vite (§3.3), production cùng origin |
| 2 | **`credentials: 'include'`** | Trên **mọi** request, không chỉ request ghi. Nếu không, cookie `lean.sid` không được gửi |
| 3 | **`Content-Type: application/json`** | Chỉ khi có body |
| 4 | **Serialize body** | `JSON.stringify` thẳng object mà caller đưa. **Không tự bù trường thiếu, không tự lọc `null`.** Đây là chỗ hợp đồng upsert 3 trạng thái sống hoặc chết — xem [`web-today/SPEC.md`](../web-today/SPEC.md) §5.1 và [`web-settings/SPEC.md`](../web-settings/SPEC.md) §3: khóa **vắng mặt** = giữ nguyên, khóa mang `null` = **xóa**. `undefined` bị `JSON.stringify` nuốt mất khóa, biến "xóa" thành "giữ nguyên" một cách im lặng |
| 5 | **CSRF token** | Lấy qua `GET /api/auth/csrf` ([`auth/SPEC.md`](../auth/SPEC.md) §4), giữ trong bộ nhớ module, gắn header `x-csrf-token` cho **`POST` · `PUT` · `PATCH` · `DELETE`**. `GET` không cần. Token gắn với phiên → lấy lại sau khi đăng nhập/đăng xuất. Nhận `403 CSRF_ERROR` → lấy token mới và thử lại **đúng một lần**; lần hai vẫn hỏng thì ném lên |
| 6 | **KHÔNG retry** method ghi | Trừ ca `403 CSRF_ERROR` ở dòng trên. `settings/PLAN.md` §2.2 nêu đúng lý do: *"cài đặt là thao tác ghi, retry mù là nguồn ghi đè khó truy"* |

> **Không lưu bất cứ thứ gì về đăng nhập trong `localStorage`/`sessionStorage`** — không
> token, không cờ "đã đăng nhập rồi", không CSRF token. Lý do đầy đủ ở
> [`auth/SPEC.md`](../auth/SPEC.md) §3.1: thứ gì JS đọc được thì XSS cũng đọc được. Nguồn sự
> thật duy nhất về phiên là endpoint "tôi là ai" của server (§6, §10 câu 1). CSRF token sống
> trong biến module, mất khi tải lại trang là đúng — lấy lại một chuyến.

### 4.3 Trách nhiệm — dịch lỗi (chỗ quan trọng nhất)

Hình dạng lỗi chung ([`04-conventions.md`](../../overview/04-conventions.md)):

```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "…",
             "fields": [{ "path": "weightKg", "message": "…" }] } }
```

**Mọi status ≥ 400 → ném một `ApiError` giữ nguyên bốn thứ: `status`, `code`, `message`,
`fields`.**

```ts
// hình dạng — chữ ký chính xác chốt lúc code
class ApiError extends Error {
  status: number;                                   // 400 | 401 | 403 | 404 | 429 | 500 | 0
  code: string;                                     // 'VALIDATION_ERROR' | 'NOT_FOUND' | …
  fields?: { path: string; message: string }[];
}
```

**Cấm bẹp lỗi thành `new Error(message)`.** `today/PLAN.md` §2 nói thẳng hậu quả: *"Nếu
`apiClient` bẹp lỗi thành `new Error(message)` thì §5.2 của SPEC **không thực hiện được** và
cả trang phải viết lại."* `settings/PLAN.md` §2.2 nói cùng điều: *"Client nào nuốt `fields[]`
thì trang này không map được lỗi về đúng ô nhập."*

**`fields[]` phải tới được từng ô nhập.** Đây là lý do kỹ thuật cụ thể nhất khiến mỗi trang
không được tự `fetch`. Đường đi bắt buộc:

```
server: Zod fail
  → { error: { code, message, fields: [{ path, message }] } }
  → apiClient ném ApiError giữ nguyên fields
  → useFieldErrors (hook dùng chung, §7.3)
  → Record<path, message> + danh sách lỗi không map được
  → <input aria-invalid> + <p> ngay dưới đúng ô đó
```

Server trả **đủ tất cả** lỗi trong một response, không dừng ở lỗi đầu
([`web-today/SPEC.md`](../web-today/SPEC.md) §5.2). Đổ nguyên `message` ra một toast là vứt đi
phần thông tin đắt nhất. `message` đã là tiếng Việt sẵn từ server
(`"Topic chỉ gồm chữ, số, gạch ngang và gạch dưới"`) — hiện thẳng được, không cần dịch lại ở
client.

**Lỗi không phải JSON cũng phải ra `ApiError`.** Mất mạng, server chưa bật, proxy trả HTML
502 → `fetch` ném hoặc `res.json()` ném. `apiClient` bắt và ném `ApiError` với `status: 0`,
`code: 'NETWORK_ERROR'`. Lý do: UI chỉ có **một** kiểu để `catch`. Nếu đôi khi là `ApiError`
đôi khi là `TypeError`, mọi chỗ hiển thị lỗi phải mang hai nhánh.

### 4.4 `204` và body rỗng

`DELETE /api/meals/:id` trả **`204` không body** ([`meals/SPEC.md`](../meals/SPEC.md) §2).
`res.json()` trên body rỗng ném lỗi parse. `apiClient` phải kiểm `status === 204` (hoặc
`Content-Length: 0`) trước khi parse và trả `undefined`.

Đây là dòng (d) trong deliverable Bước 1 của [`web-today/PLAN.md`](../web-today/PLAN.md) — có
test canh.

### 4.5 `404`: lỗi hay dữ liệu

Ba ca `404` trong app, **ngữ nghĩa khác hẳn nhau**:

| Ca | Ngữ nghĩa | UI phải làm |
|---|---|---|
| `GET /api/body-logs/:date` | **Ngày đó chưa ghi gì — trạng thái bình thường** ([`web-today/SPEC.md`](../web-today/SPEC.md) §6) | Hai ô rỗng, **không** thông báo lỗi |
| `DELETE /api/meals/:id` lần thứ hai | Đã xóa rồi (không idempotent, meals §2) | Coi như xóa xong, refetch, **không** báo đỏ |
| `PUT /api/reminders/:kind` với `kind` lạ | Lỗi thật — UI không có đường sinh ra ca này | Báo lỗi |

**`apiClient` KHÔNG tự quyết ca nào là ca nào.** Nó ném `ApiError` với `status: 404` và để
tầng `api/<tên>.api.ts` của mỗi trang quyết định. Kèm một helper dùng chung để ca thứ nhất
không phải viết `try/catch` lặp lại:

```ts
// getOrNull: 404 → null; mọi lỗi khác vẫn ném
const bodyLog = await apiClient.getOrNull<BodyLog>(`/body-logs/${date}`);
```

Đây là hợp đồng `getBodyLog(date) → BodyLog | null` mà [`web-today/PLAN.md`](../web-today/PLAN.md)
Bước 1 yêu cầu.

> **`GET /api/goal` không bao giờ `404`** ([`goal/SPEC.md`](../goal/SPEC.md), nhắc lại ở
> [`web-settings/SPEC.md`](../web-settings/SPEC.md) §3: *"Đừng viết `if (res.status === 404)`"*).
> "Chưa đặt mục tiêu" là `200` với mọi trường `null`.

### 4.6 `401` và `403` — KHÔNG được gộp

Hai mã, hai nguyên nhân, hai cách xử lý. Nguồn:
[`auth/SPEC.md`](../auth/SPEC.md) §4 và [`rbac/SPEC.md`](../rbac/SPEC.md) §5.

| Mã | `code` | Nghĩa | Xử ở đâu | Làm gì |
|---|---|---|---|---|
| `401` | `UNAUTHORIZED` | **Chưa/hết phiên** | **Một chỗ duy nhất: `apiClient`** | Xóa state phiên trong bộ nhớ, điều hướng `/login?next=<đường dẫn hiện tại>`. **Không** hiện màn hình lỗi đỏ — phiên hết hạn là chuyện bình thường |
| `401` | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu | **Trang đăng nhập** | Hiện lỗi trên form. **Không** đá đi đâu — đang ở `/login` rồi. `apiClient` phải loại trừ ca này khỏi luật đá-về-login, nếu không đăng nhập sai một lần sẽ tự nạp lại trang |
| `403` | `FORBIDDEN` | Đã đăng nhập, **thiếu quyền** | Caller | Ném lên. Shell hiện thông báo tại chỗ + nạp lại "tôi là ai" (§6) |
| `403` | `ACCOUNT_DISABLED` | Mật khẩu đúng, tài khoản bị khóa | Trang đăng nhập | Hiện lỗi trên form |
| `403` | `CSRF_ERROR` | Token thiếu/sai | `apiClient` | Lấy token mới, thử lại **một** lần (§4.2 dòng 5) |
| `429` | `TOO_MANY_ATTEMPTS` | Quá số lần thử đăng nhập | Trang đăng nhập | Hiện thông báo chờ |

**Gộp `403` vào `401` là bug bảo mật đội lốt tiện nghi:** người dùng thiếu quyền bị đá ra
trang đăng nhập, đăng nhập lại thành công, bấm lại nút cũ, lại bị đá ra — một vòng lặp mà
người dùng không có cách nào thoát và không có manh mối nào về nguyên nhân thật.

Phân biệt bằng **`status`**, không bằng `code` — `code` là chuỗi từ server, `status` là hợp
đồng HTTP. Dùng `code` chỉ để phân nhánh **bên trong** cùng một status (bảng trên).

### 4.7 Bảng tóm tắt — 11 hành vi bắt buộc

Bảng này là danh sách test của `apiClient` ([`PLAN.md`](PLAN.md) Bước 3):

1. `GET` gắn `credentials: 'include'`.
2. `POST`/`PUT`/`PATCH`/`DELETE` gắn header `x-csrf-token`; `GET` **không** gắn.
3. Body được `JSON.stringify` **nguyên vẹn** — `{ waistCm: null }` giữ khóa và giữ `null`.
4. `200` + JSON → trả object đã parse.
5. `201` → trả object (không coi là lỗi).
6. `204` → trả `undefined`, không parse.
7. `400` + `fields[]` → ném `ApiError` mang **đủ** `fields`, đúng thứ tự.
8. `404` → ném `ApiError` `status: 404`; `getOrNull` trả `null`.
9. `401 UNAUTHORIZED` → gọi đúng **một** lần hàm xử-hết-phiên; `401 INVALID_CREDENTIALS` →
   **không** gọi.
10. `403 FORBIDDEN` → ném lên, **không** đá về login.
11. `fetch` ném (mất mạng) → `ApiError` `status: 0`, `code: 'NETWORK_ERROR'`.

## 5. Router, layout, điều hướng, guard

### 5.1 Router

Chốt: gói **`react-router`** dòng 7 (từ v7, gói `react-router` dùng trực tiếp cho web;
`react-router-dom` chỉ còn là lớp tương thích). **Không** TanStack Router (§3.2).

> **Không bịa chữ ký.** Mô tả ở đây là **hành vi**: một bảng route khai báo, một component
> bọc để nhận đường dẫn hiện tại, một cách điều hướng bằng code, và một khái niệm route con
> nằm trong layout chung. Tra README của đúng bản đang cài khi code.

Cách ly rủi ro: **ba trang không import gì từ `react-router`.** Mỗi trang export một component
không tham số qua `features/<tên>/index.ts`; `web-shell` cắm nó vào route. Nếu sau này thay
router (hoặc tự viết một switch trên `location.pathname` — đủ cho 4 route), chỉ `web/src/router/`
đổi, ba trang không đụng một dòng.

### 5.2 Bốn route và layout

Từ §7 của spec gốc ([`docs/archive/2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md)),
cộng trang đăng nhập do `auth`:

| Đường dẫn | Trang | Nguồn | Cần phiên? |
|---|---|---|---|
| `/` | **Hôm nay** (mặc định) | [`web-today`](../web-today/SPEC.md) | có |
| `/charts` | Biểu đồ | [`web-charts`](../web-charts/SPEC.md) — `charts/PLAN.md` bước 9 dùng đúng đường dẫn này | có |
| `/settings` | Cài đặt | [`web-settings`](../web-settings/SPEC.md) | có |
| `/login` | Đăng nhập | [`auth/PLAN.md`](../auth/PLAN.md) Bước 11 | **không** |
| còn lại | 404 trong app | — | — |

`AppLayout` bọc ba route đầu: thanh tab **Hôm nay · Biểu đồ · Cài đặt**, tab đang mở được đánh
dấu, và một chỗ cho danh tính người dùng + **nút đăng xuất**.

> **Nút đăng xuất đặt ở layout, không đặt trong trang Cài đặt.** `auth/PLAN.md` Bước 11 ghi
> "Trang Cài đặt", nhưng [`web-settings/SPEC.md`](../web-settings/SPEC.md) §1 nói trang đó có
> *"một trang, hai nhóm cài đặt, không có gì khác"*. Đặt ở layout giải quyết mâu thuẫn mà
> **không phải sửa `web-settings/SPEC.md`**, và đăng xuất vốn là thao tác cấp ứng dụng chứ
> không phải một mục cài đặt. Ghi lại ở §10 câu 3 để chủ dự án có thể đảo.

`/login` **không** dùng `AppLayout` — không có tab để bấm khi chưa đăng nhập.

### 5.3 Route guard

Ba route đầu yêu cầu phiên. Chưa đăng nhập → chuyển hướng `/login`, kèm đường dẫn đang muốn
vào để đăng nhập xong quay lại đúng chỗ.

Luồng khởi động, đúng thứ tự:

1. App mount → gọi endpoint "tôi là ai" (§10 câu 1) **một lần**.
2. Trong lúc chờ → hiện trạng thái đang tải **cả trang**. **Không** render `/login` trong lúc
   chưa biết — nhấp nháy một màn đăng nhập rồi biến mất là lỗi hay gặp và trông như app hỏng.
3. `200` → lưu `user` + `permissions` vào `SessionContext`, render route đang yêu cầu.
4. `401` → điều hướng `/login`. Đây là ca **duy nhất** `401` không phải "hết phiên giữa
   chừng"; nó vẫn đi qua đúng đường dẫn của §4.6.
5. Đang ở `/login` mà đã có phiên → đá về `/`.

> ### Guard ở client CHỈ là trải nghiệm. Server vẫn phải chặn.
>
> Người dùng sửa JS trong DevTools, gọi thẳng API bằng `curl`, hoặc chỉ cần tắt JavaScript.
> **Guard của `web-shell` không bảo vệ gì cả** — nó chỉ để người chưa đăng nhập không nhìn
> thấy một trang trống rồi ba thông báo lỗi `401`.
>
> Chốt chặn thật là `requireAuth` mắc **một lần** trước năm router dữ liệu trong
> `server/src/app.ts` ([`auth/SPEC.md`](../auth/SPEC.md) §3.4). Nếu một chốt chặn chỉ tồn tại
> ở FE, **nó không tồn tại**.
>
> Hệ quả cụ thể: **không được** vì đã có guard ở client mà bỏ hay nới `requireAuth` ở server.
> Kiểm chứng bằng test integration của `auth` ([`auth/PLAN.md`](../auth/PLAN.md) Bước 8),
> không bằng việc bấm thử trên UI.

## 6. Áp quyền trên FE

Nguồn: [`rbac/SPEC.md`](../rbac/SPEC.md) §12. Tài liệu này không phát minh gì thêm, chỉ chốt
chỗ đặt file.

**Nguyên tắc, chép nguyên:**

> **FE ẩn nút chỉ là trải nghiệm, không phải bảo mật. Server vẫn phải chặn.**

Cùng một câu với §5.3, và cùng một lý do. Mọi thứ FE làm chỉ để **không bày ra những nút bấm
sẽ trả `403`**. **Không được** vì đã ẩn nút mà bỏ dòng tương ứng trong `permissionRegistry`
của server.

Cách làm:

- **FE không đoán quyền theo role code.** Nó nhận **danh sách mã quyền** từ server và hỏi
  `hasPermission(code)`. Lý do: `rbac/SPEC.md` §10 cho phép sửa ma trận Role×Permission qua
  API — role code không còn suy ra được tập quyền.
- Nguồn: response của endpoint "tôi là ai", kèm `permissions: string[]`. **Một** chuyến gọi
  lúc bootstrap (§5.3 bước 1), không thêm request riêng cho RBAC.
- Chỗ đặt: **`web/src/features/auth/`**, không phải `features/rbac/` — `rbac/SPEC.md` §12 chốt
  như vậy vì `hasPermission` là thứ mọi feature dùng, giống `apiClient`. Phơi ra qua
  `SessionContext`: `hasPermission(code)`, `hasAnyPermission(...codes)`.
- **Không cache lâu ở FE.** Nhận `403` từ server → coi là quyền đã đổi → nạp lại "tôi là ai".
  Đây là chỗ nối giữa §4.6 và mục này.
- **Thiếu quyền thì ẩn hẳn, không hiện nút xám.** Nút xám nói cho người dùng biết có một chức
  năng họ không được dùng, mà chẳng giúp gì.
- Trang riêng cho `403` (kiểu `/access-denied`): **chưa cần** (rbac §12). Với hai vai trò và
  menu đã ẩn theo quyền, `403` chỉ xảy ra khi quyền vừa bị đổi giữa chừng.

**Bảng gate UI** đầy đủ ở [`rbac/SPEC.md`](../rbac/SPEC.md) §12 — không chép lại vào đây.
Phần `web-shell` hiện thực: thanh tab (`log:manage` cho **Hôm nay**, `log:view` cho **Biểu
đồ**) và cơ chế `hasPermission`. Phần bên trong mỗi trang do trang đó dùng `hasPermission` mà
tự gate.

Bốn dòng đầu của bảng đó hôm nay **luôn đúng** với cả `USER` lẫn `ADMIN` — vẫn viết bằng
`hasPermission` chứ không hardcode `true`, để ngày thêm vai trò `READONLY` thì không phải đi
tìm.

> Hai dòng cuối bảng đó (**Cài đặt → Tài khoản**, **Cài đặt → Phân quyền**) mô tả **màn quản
> trị chưa ai sở hữu**. Chúng **không** thuộc `web-shell` và cũng không thuộc `web-settings`
> (SPEC của trang đó không biết chúng tồn tại). Xem §10 câu 4.

## 7. Trạng thái dùng chung: đang tải · lỗi · rỗng

Cả ba trang cần cả ba. Đừng để mỗi trang tự chế — ba kiểu spinner và ba câu thông báo lỗi
khác nhau trong một app 3 trang là thứ người dùng nhìn thấy ngay.

Đặt ở `web/src/components/shared/`.

### 7.1 Ba trạng thái là ba thứ khác nhau

`web-charts/SPEC.md` §6 nói thẳng: *"Trạng thái đang tải và trạng thái lỗi mạng/`400` là hai
thứ khác, không được gộp vào trạng thái rỗng."*

| Trạng thái | Nghĩa | Component |
|---|---|---|
| **Đang tải** | Chưa biết | `LoadingState` |
| **Lỗi** | Hỏi rồi, không lấy được | `ErrorState` |
| **Rỗng** | Lấy được rồi, **không có dữ liệu** | `EmptyState` |

**Rỗng KHÔNG phải lỗi, và không được hiện màu đỏ.** Hai ca chuẩn:

- `GET /body-logs/:date` → `404` là **"chưa ghi"**, không phải lỗi
  ([`web-today/SPEC.md`](../web-today/SPEC.md) §6, nguyên tắc 1).
- `GET /summary` trên DB trắng trả `days` **đủ độ dài** với toàn `null` — nên
  `days.length > 0` **không** có nghĩa là có dữ liệu ([`web-charts/SPEC.md`](../web-charts/SPEC.md) §6).

`web-shell` cung cấp **vỏ**; **nội dung câu chữ và điều kiện "khi nào là rỗng" thuộc từng
trang** — chúng khác nhau thật ("Chưa ghi bữa nào cho ngày này." vs "Cần ít nhất 2 ngày dữ
liệu để vẽ xu hướng").

### 7.2 `ErrorState`

Nhận một `ApiError` (§4.3), không nhận chuỗi. Hiển thị:

- `status: 0` (`NETWORK_ERROR`) → *"Không kết nối được server — server đã chạy chưa?"*
  (câu chữ từ [`web-settings/PLAN.md`](../web-settings/PLAN.md) bước 7).
- `status: 500` → thông báo chung + gợi ý thử lại.
- `status: 400` với `fields[]` → **không** dùng `ErrorState`. Lỗi validate thuộc về từng ô
  nhập (§7.3), không thuộc về một khối lỗi cấp trang.
- Luôn có nút **Thử lại** gọi lại đúng hàm nạp dữ liệu.

### 7.3 `useFieldErrors` — hook dùng chung

[`web-today/PLAN.md`](../web-today/PLAN.md) §3 đặt nó ở `features/today/hooks/useFieldErrors.ts`.
**Chốt: chuyển lên `web/src/hooks/useFieldErrors.ts`** — `web-settings` cần đúng cùng hành vi
([`web-settings/SPEC.md`](../web-settings/SPEC.md) §4: *"UI phải map nó về đúng ô nhập và hiện
thông báo ngay dưới ô đó"*), và hai bản sao của cùng một hàm map là hai chỗ để lệch nhau.

Hợp đồng:

- Nhận `ApiError | null`, trả `Record<path, message>` **cộng** một danh sách lỗi **không map
  được vào ô nào** — `path` như `"date"` có thể không thuộc ô nhập nào của form đang mở, và
  **không được nuốt im lặng** ([`web-today/SPEC.md`](../web-today/SPEC.md) §5.2).
- `reset()` xóa sạch. **Xóa toàn bộ lỗi cũ trước mỗi lần gửi** — lỗi tồn đọng của lần trước
  trên một ô đã sửa đúng là bug hay gặp.
- Hàm thuần hoặc hook mỏng, **không** gọi API.

Kèm một component `FieldError` để cả ba trang render giống nhau (thông báo + `aria-invalid`
trên `<input>`).

## 8. Không dùng thư viện state — hệ quả phải tự gánh

Bỏ TanStack Query (§3.2) không miễn phí. Thứ nó lo hộ mà giờ phải tự lo, **và là thứ duy nhất
thật sự khó**:

> **Đổi tham số truy vấn hai lần liên tiếp thì response về không đúng thứ tự.**

Kịch bản: người dùng đổi ngày `05` → `06` → `07`. Ba request bay đi. Response của `05` về
**sau** response của `07` (mạng, hoặc chỉ là thứ tự microtask). Nếu mỗi response cứ thế
`setState`, màn hình hiển thị dữ liệu của ngày `05` trong khi bộ chọn ngày ghi `07`. **Không
có lỗi nào, không có cảnh báo nào, và người dùng có thể ghi đè dữ liệu sang nhầm ngày.**

Cả hai trang có bộ chọn đều dính: `web-today` (bộ chọn ngày) và `web-charts` (bộ chọn khoảng
30/90/365). [`web-today/SPEC.md`](../web-today/SPEC.md) §7 câu 8 nêu đây là **câu hỏi mở**;
**tài liệu này chốt cách làm dùng chung.**

### 8.1 Chốt: `web/src/hooks/useApiResource.ts`

Một hook dùng chung, nhận một hàm nạp dữ liệu và một mảng phụ thuộc, trả
`{ data, isLoading, error, reload }`.

Ba luật bắt buộc bên trong:

1. **Cờ `cancelled` trong cleanup của `useEffect`.** Mỗi lần effect chạy đặt `cancelled = false`;
   hàm cleanup đặt `cancelled = true`. Sau mỗi `await`, kiểm `if (cancelled) return;` **trước
   khi** `setState`. Đây là hợp đồng, và nó có test canh:
   [`web-today/PLAN.md`](../web-today/PLAN.md) Bước 4 — *"đổi `date` hai lần liên tiếp,
   response của ngày cũ về **sau** nhưng state phải mang dữ liệu của ngày mới."*
2. **Cờ `cancelled` áp cho **cả** nhánh lỗi.** Bỏ sót nhánh `catch` là bug tinh vi hơn: request
   cũ hỏng sẽ hiện một khối lỗi đỏ cho dữ liệu mới đang hiển thị đúng.
3. **`AbortController` là tùy chọn, cờ `cancelled` là bắt buộc.** Abort tiết kiệm băng thông
   nhưng **không** thay được cờ — một request đã về tới `.then()` thì abort không còn tác dụng,
   chỉ cờ mới chặn được `setState`. Làm cả hai thì tốt; làm mỗi abort thì sai.

### 8.2 Không cache

**Chốt: không cache.** Đổi ngày rồi quay lại thì nạp lại. Đơn giản nhất và **luôn đúng** —
đúng đề nghị của [`web-today/SPEC.md`](../web-today/SPEC.md) §7 câu 8. Với localhost + SQLite,
một request thêm không đáng để đổi lấy một lớp bất biến cache phải tự bảo trì.

Hệ quả cho ba trang: sau mỗi thao tác **ghi** thành công, gọi `reload()` của resource tương
ứng. Không có invalidation tự động, và **đó là lý do `reload()` phải nằm trong hợp đồng của
hook** chứ không phải mỗi trang tự bịa.

### 8.3 Cái gì được phép nằm trong Context

Chỉ **một** thứ: `SessionContext` — `user`, `permissions`, `hasPermission`,
`hasAnyPermission`, `reloadSession`, `logout`.

**Không** nhét dữ liệu nghiệp vụ (bodyLog, meals, goal, summary) vào Context. Mỗi trang tự nạp
dữ liệu của nó. Ba trang không chia sẻ dữ liệu với nhau — `web-today` và `web-charts` cùng
động tới cân nặng nhưng qua **hai endpoint khác nhau** với hai hình dạng khác nhau, và
`web-charts/SPEC.md` §2 cấm gọi thêm endpoint để bù.

## 9. Cây file `web-shell` sở hữu

Bám đúng [`01-architecture.md`](../../overview/01-architecture.md). Test đặt cạnh file được
test (`*.test.ts` / `*.test.tsx`).

```
web/
├── package.json  tsconfig.json  vite.config.ts  vitest.config.ts  index.html
├── test/setup.ts                       # dọn DOM, mở rộng expect
└── src/
    ├── main.tsx                        # createRoot + RouterProvider
    ├── App.tsx                         # SessionProvider + router
    ├── types/api.ts                    # §3.4 — mọi kiểu response API
    ├── constants/meals.ts              # §3.4 — MEAL_SLOTS, SLOT_LABEL
    ├── lib/
    │   ├── apiClient.ts                # §4 — CHỖ DUY NHẤT gọi fetch()
    │   └── format.ts                   # §3.4 — todayIso, format ngày/số
    ├── hooks/
    │   ├── useApiResource.ts           # §8.1 — chống race
    │   └── useFieldErrors.ts           # §7.3 — fields[] → từng ô nhập
    ├── components/
    │   ├── ui/                         # Button, Input, Select, Switch, Card…
    │   └── shared/
    │       ├── LoadingState.tsx
    │       ├── ErrorState.tsx
    │       ├── EmptyState.tsx
    │       └── FieldError.tsx
    ├── router/
    │   ├── routes.tsx                  # §5.2 — 4 route
    │   ├── AppLayout.tsx               # tab + danh tính + đăng xuất
    │   ├── RequireSession.tsx          # §5.3 — guard
    │   └── NotFoundPage.tsx
    └── features/auth/                  # §5.3, §6 — THUỘC web-shell
        ├── SessionContext.tsx          # user + permissions + hasPermission
        ├── api/auth.api.ts             # login, logout, "tôi là ai", csrf
        ├── components/LoginPage.tsx
        └── index.ts
```

`web/src/features/{today,charts,settings}/` **không** thuộc `web-shell`.

> `web/src/features/auth/` là feature web **thứ tư**, không có trong cây của
> `01-architecture.md` (cây đó viết `features/{today,charts,settings}`). Đây là hệ quả của
> quyết định thêm auth ngày 2026-08-07, và [`rbac/SPEC.md`](../rbac/SPEC.md) §12 đã chỉ định
> đúng thư mục này. **Không sửa `01-architecture.md` bây giờ** — tài liệu `overview/` mô tả
> hành vi thật, và hành vi thật là `web/` chưa tồn tại. Cập nhật khi có code chạy (§10 câu 5).

## 10. Câu hỏi mở

Chưa ai chốt. Người implement phải chốt (hoặc hỏi chủ dự án) và ghi kết quả ngược lại vào file
này. Câu 1 là câu **chặn**.

**1. ~~Endpoint "tôi là ai" tên là gì, và có trả `permissions` không?~~ — ĐÃ CHỐT 2026-08-07,
KHÔNG CÒN CHẶN §5.3 và §6.**

> **Kết luận: giữ `GET /api/auth/session`.** Feature `rbac` mở rộng `SessionResponse` thêm
> `permissions: string[]` khi làm; **không** tạo `/api/auth/me`. Đã sửa cho khớp ở
> `rbac/SPEC.md` §12, `rbac/PLAN.md` Bước 11, và `auth/SPEC.md` mục `SessionResponse`.
> Ghi chú về hành vi trước khi có `rbac` ở cuối mục này vẫn đúng, giữ nguyên.

Bối cảnh gốc của mâu thuẫn (giữ lại để hiểu vì sao phải chốt):

- [`auth/SPEC.md`](../auth/SPEC.md) §4 khai `GET /api/auth/session` → `SessionResponse` gồm
  `{ user: { id, email, displayName, status }, expiresAt }`. **Không có `permissions`.**
- [`rbac/SPEC.md`](../rbac/SPEC.md) §12 khai *"endpoint 'tôi là ai' của feature `auth`
  (`GET /api/auth/me`) trả kèm `permissions: string[]`"*. **`/api/auth/me` không có trong bảng
  endpoint của `auth`.**

Hai tên khác nhau, một trong hai có `permissions`, một không. `web-shell` **không tự quyết**
— đây là hợp đồng API, thuộc `auth`. Cần `auth` và `rbac` chốt **một** tên và **một** hình
dạng response. *Nghiêng về: giữ `GET /api/auth/session` (đã có bảng endpoint, đã có test dự
kiến ở `auth/PLAN.md` Bước 7) và **thêm** `permissions: string[]` vào `SessionResponse` khi làm
`rbac`.* Trước khi có `rbac`, `permissions` là mảng rỗng và `hasPermission` trả `true` cho mọi
mã (§6 chưa có hiệu lực) — **không** trả `false`, nếu không toàn bộ menu biến mất.

**2. `web-shell` có tự dựng được khi `auth` chưa xong không?** Chốt: **có, phần lớn.** Chia
đôi ở [`PLAN.md`](PLAN.md) §3 — Bước 1–7 làm được ngay, Bước 8–11 chờ `auth`. Rủi ro cần theo
dõi: `apiClient` phải được viết với **chỗ móc sẵn** cho CSRF và `401` ngay từ Bước 3, để Bước
8 là bật lên chứ không phải viết lại.

**3. Nút đăng xuất: layout hay trang Cài đặt?** §5.2 chốt **layout**, vì
`web-settings/SPEC.md` §1 nói trang đó chỉ có hai nhóm và "không có gì khác". Nếu chủ dự án
muốn theo đúng `auth/PLAN.md` Bước 11 thì phải **mở rộng `web-settings/SPEC.md`** — quyết định
đó thuộc chủ trang Cài đặt, không thuộc `web-shell`.

**4. Màn quản trị "Tài khoản" và "Phân quyền" thuộc feature nào?**
[`rbac/SPEC.md`](../rbac/SPEC.md) §12 đặt chúng dưới trang Cài đặt và
[`rbac/SPEC.md`](../rbac/SPEC.md) §10 đã khai 5 endpoint cho chúng. Nhưng
[`web-settings/SPEC.md`](../web-settings/SPEC.md) không biết chúng tồn tại, và `web-shell`
không làm nội dung trang. *Đề nghị: một feature riêng `web-admin`, cắm vào route con của
`/settings` hoặc route riêng `/admin`.* **Không** nhét vào `web-shell`, **không** âm thầm mở
rộng `web-settings`.

**5. Bao giờ cập nhật `01-architecture.md`?** Cây `web/src/` ở đó chưa có `features/auth/`,
chưa có `types/`, chưa có `router/AppLayout.tsx`. Theo luật *"tài liệu Lean mô tả hành vi
thật, không mô tả ý định"* ([`auth/SPEC.md`](../auth/SPEC.md) §10), sửa **sau** khi `web/` có
code chạy, không sửa bây giờ. Ai làm bước cuối của [`PLAN.md`](PLAN.md) chịu trách nhiệm.

**6. Production phục vụ `web/` thế nào?** [`auth/SPEC.md`](../auth/SPEC.md) §7.5 nhắc tới ca
*"Express phục vụ luôn bản build tĩnh của `web/`"* — nếu vậy thì cùng origin, cookie
`sameSite: 'lax'` đúng, không cần CORS, và CSP của `helmet` phải nới cho asset của Vite. Nếu
deploy tách (web ở CDN, API ở nơi khác) thì **toàn bộ mô hình cookie ở §4.2 phải xét lại**.
Chưa ai chốt. *Nghiêng về: Express phục vụ bản build tĩnh — nó giữ được mọi giả định ở đây và
khớp với việc Lean chỉ có một server ([`auth/SPEC.md`](../auth/SPEC.md) §2, "Express giữ luôn
vai BFF").*

**7. ~~CSS: viết thế nào?~~ — ĐÃ CHỐT 2026-08-07: CSS Modules. Không còn chặn Bước 5.**

Không dùng shadcn/Tailwind (§3.2). Chốt **CSS Modules**: file đặt tên `Card.module.css`,
dùng `className={s.card}` thay cho `className="card"`.

Đây **vẫn là CSS bình thường** — không cú pháp mới, không runtime, Vite hỗ trợ sẵn không
cần cấu hình. Khác đúng một điểm: công cụ tự thêm hậu tố vào tên class nên hai file không
bao giờ đụng nhau.

Vì sao không dùng CSS thuần một file: tên class là **toàn cục**. `web-today` đặt `.card`,
`web-charts` cũng đặt `.card` — cái sau đè cái trước, và lỗi hiện ra ở màn hình mà người
sửa không đụng tới. Ba trang do ba người/agent khác nhau làm thì đây là chuyện sẽ xảy ra,
không phải có thể xảy ra. Cũng khớp yêu cầu trong `CLAUDE.local.md` của chủ dự án:
*"không dùng chung css của ai hết, tôi không muốn đến lúc sửa thì họ làm lỗi của tôi"*.

**8. Test e2e (Playwright) có làm không?** [`web-today/PLAN.md`](../web-today/PLAN.md) §6 nợ
số 4 ghi *"Chưa có test e2e thật"*, và deliverable cuối của cả ba trang đang là **kiểm bằng
mắt**. Luồng đáng có e2e nhất thuộc `web-shell`: đăng nhập → vào được `/` → hết phiên → bị đá
về `/login`. *Đề nghị: không làm ở bản đầu; ghi thành nợ chính thức ở
[`PLAN.md`](PLAN.md) §6.*

**9. `apiClient` có timeout không?** Hiện không đề xuất. Trên localhost thì thừa; nếu §10 câu
6 chốt deploy tách thì một request treo vô hạn sẽ khiến `LoadingState` quay mãi và người dùng
không có nút nào bấm. Xem lại cùng lúc với câu 6.

## 11. Tham chiếu

- Ba trang tiêu thụ tầng này: [`web-today`](../web-today/SPEC.md) ·
  [`web-charts`](../web-charts/SPEC.md) · [`web-settings`](../web-settings/SPEC.md)
- Phiên, cookie, CSRF, `401`: [`auth/SPEC.md`](../auth/SPEC.md) §3, §4, §7.2 ·
  [`auth/PLAN.md`](../auth/PLAN.md) Bước 11 (danh sách việc phía web)
- Quyền trên FE: [`rbac/SPEC.md`](../rbac/SPEC.md) §12
- Cây `web/src/`, lý do không bê stack upip: [`01-architecture.md`](../../overview/01-architecture.md)
- Hình dạng lỗi, phiên bản thư viện, quy ước đặt tên: [`04-conventions.md`](../../overview/04-conventions.md)
- Bố cục gốc 3 trang: [`docs/archive/2026-08-06-original-design.md`](../../archive/2026-08-06-original-design.md) §7
- Cạm bẫy toàn dự án: [`CLAUDE.md`](../../../CLAUDE.md)
- Thứ tự thi công, tên script, lệnh verify: [`PLAN.md`](PLAN.md)
