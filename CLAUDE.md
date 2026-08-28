# Lean — Health Tracker

## Project Overview

App theo dõi sức khỏe cá nhân, chạy localhost trên một máy, một người dùng. Ghi tay hàng ngày: cân nặng, số đo vòng bụng, và các bữa ăn (tên món + calo). Hiển thị xu hướng, thống kê calo, tiến độ mục tiêu, và nhắc nhở qua ntfy.

**Không có:** AI phân tích ảnh, lưu ảnh bữa ăn, database món ăn dựng sẵn, truy cập từ điện thoại. Đây là quyết định có chủ đích — xem `docs/overview/00-goals-and-scope.md` để biết lý do trước khi đề xuất thêm lại.

**Đăng nhập/phân quyền:** trước đây nằm trong danh sách trên, **đã đảo quyết định ngày 2026-08-07** theo hướng nhiều người dùng. Spec + plan ở `docs/features/{auth,rbac}/`. **Đăng nhập và phân quyền đều đã có** (giai đoạn A→D). Ba vai trò `USER` / `ADMIN` / `SYSTEM_ADMIN`, mười quyền `resource:action`.

**Trạng thái:** backend + web đã chạy. Auth + RBAC **xong trọn giai đoạn A→D**: đăng ký,
đăng nhập, phiên server-side, CSRF, chống brute-force, cách ly dữ liệu theo người dùng,
3 vai trò + 10 quyền, API quản trị tài khoản/phân quyền, và hai khối quản trị trên web.

## Tech Stack

Luôn dùng bản mới nhất. Đang chạy:

- **Backend**: Express **5** + TypeScript **7** | Prisma **7** + SQLite | Zod **4** | node-cron **4**
- **Frontend**: React **19** + Vite **8** | Recharts **3**
- **Test**: Vitest **4** + supertest 7
- **Thông báo**: ntfy.sh

Hai điều dễ vấp vì bản mới:

- **Express 5 bắt lỗi async sẵn** — không cài `express-async-errors`, không tự bọc try/catch để nuốt lỗi.
- **Prisma 7 bỏ `url` khỏi `datasource`** — connection string ở `prisma.config.ts`, client nối DB qua `PrismaBetterSqlite3` adapter, và client sinh ra ở `src/generated/prisma` (import từ đó, **không** từ `@prisma/client`).

## Cấu trúc

Feature-first, phân lớp bên trong — bám quán lệ của `upip`. Chi tiết đầy đủ ở §3 của spec.

```
Lean/
├── docs/
│   ├── README.md                         # bản đồ tài liệu — VÀO ĐÂY TRƯỚC
│   ├── overview/                         # dùng chung: mục tiêu, kiến trúc,
│   │                                     #   mô hình dữ liệu, công thức, quy ước
│   └── features/<tên>/{SPEC.md,PLAN.md}  # mỗi chức năng một thư mục
├── server/
│   ├── prisma.config.ts                  # Prisma 7: connection string
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── server.ts  app.ts
│   │   ├── config/env.ts
│   │   ├── generated/prisma/             # máy sinh, gitignore
│   │   ├── lib/{db,time}.ts
│   │   ├── shared/
│   │   │   ├── stats/{movingAverage,rate,weekly}.ts   # HÀM THUẦN
│   │   │   ├── clients/ntfy.client.ts
│   │   │   ├── errors/  validation/
│   │   │   ├── security/{password,csrf}.ts
│   │   │   ├── rbac/{permissionRegistry,permissionGuard,permissionCache}.ts
│   │   └── features/<feature>/           # auth rbac users bodyLogs meals goal summary reminders
│   │       ├── controllers/  services/  repositories/  dtos/
│   │       └── index.ts                  # export router
│   └── test/                             # soi gương cây src/
└── web/src/
    ├── components/{ui,shared}/  lib/  router/
    └── features/{auth,admin,today,charts,settings}/{api,components,hooks}/
```

**Mọi CRUD đi đủ 4 lớp** controller → service → repository → Prisma, kể cả khi service chỉ chuyển tiếp. Nhất quán quan trọng hơn việc tiết kiệm vài file.

**Mọi bảng có `userId`, và nguồn của nó là phiên đăng nhập.** `requireAuth` (mắc MỘT lần ở `app.ts`, trước năm router dữ liệu) gắn `req.user.id`; controller truyền xuống service, service xuống repository. Hằng `LOCAL_USER_ID` và `src/shared/constants.ts` **đã bị xóa** — thấy tên đó ở đâu là tài liệu cũ.

**Mọi truy vấn PHẢI mang `userId`, kể cả khi tra theo khóa chính.** `Meal.id` là cuid toàn cục nên `where: { id }` trần chạm được bản ghi người khác. Chỗ dễ quên nhất là `groupBy` trong `summary.repository.ts`: thiếu `userId` ở đó là gộp calo của mọi người vào một tổng, không ném lỗi, không test feature nào bắt được. `test/features/userIsolation.test.ts` là lưới an toàn cho đúng lớp lỗi này.

## Key Commands

```bash
# Server
cd server
npm install
npx prisma db push        # tạo/cập nhật data.db
npm run dev               # http://localhost:3000
npm test                  # vitest
npm run build

# Web
cd web
npm install
npm run dev               # http://localhost:7173
npm run build
```

## Quy ước bắt buộc

### Ngày tháng — đọc kỹ mục này

**`date` luôn là chuỗi `"YYYY-MM-DD"`, không bao giờ là `DateTime`.** "Ngày tôi cân" là một ngày trên lịch, không phải một thời điểm. Dùng `DateTime` sẽ sinh lỗi lệch múi giờ (bản ghi 7h sáng giờ VN bị lưu thành ngày hôm trước theo UTC). Mọi xử lý ngày đi qua `server/src/lib/time.ts`, timezone `Asia/Ho_Chi_Minh`.

### Tách logic thống kê

Mọi phép tính (MA7, tốc độ thay đổi, trung bình tuần, tiến độ mục tiêu) nằm trong `server/src/shared/stats/` dưới dạng **hàm thuần** — không đọc DB, không đụng HTTP. Service lấy dữ liệu rồi gọi hàm. Giữ nguyên ranh giới này; nó là thứ làm cho phần khó nhất của app test được.

Để ở `shared/` chứ không trong `features/` vì MA7 dùng chung bởi `summary` và `goal` — nhân bản công thức ra hai chỗ là cách chắc chắn nhất để hai chỗ lệch nhau.

Định nghĩa chính xác của MA7, `currentRate`, `onTrack`, `remainingKg` nằm ở §6 của spec — **không tự suy diễn lại**.

### API

- Prefix `/api`, validate mọi input bằng Zod
- Lỗi validate → `400` kèm danh sách trường sai; không tìm thấy → `404`
- `PUT /body-logs/:date` là **upsert** — trường vắng mặt giữ nguyên giá trị cũ, gửi `null` mới xóa

### Naming & style

- Biến/hàm: camelCase · Type/Component: PascalCase · Hằng: UPPER_SNAKE_CASE · File: camelCase (server), PascalCase (React component)
- Indent 2 spaces, single quotes, có semicolon
- Cột DB: camelCase (Prisma tự map)

### Git commit

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Ví dụ: feat(stats): add 7-day moving average for weight
```

## Cạm bẫy đã biết

- **Cân nặng dao động 1–2 kg/ngày** là bình thường. Biểu đồ luôn phải hiển thị MA7 nổi bật hơn điểm thô, nếu không người dùng sẽ đọc sai xu hướng.
- **MA7 trả `null` khi cửa sổ có dưới 2 giá trị.** Đừng hiển thị một điểm đơn lẻ như thể nó là trung bình.
- **Trung bình calo tuần bỏ qua ngày không ghi bữa nào.** Tính ngày quên ghi là 0 calo sẽ kéo trung bình xuống sai lệch.
- **Nhắc nhở chỉ chạy khi server bật.** Máy tắt thì không có nhắc và không gửi bù. Phải ghi rõ điều này trên giao diện Cài đặt.
- **CSRF token buộc vào `req.session.userId`, không phải `req.sessionID`.** Bảng `Session` có `userId` NOT NULL + khóa ngoại nên phiên vô danh KHÔNG ghi được, khiến `sessionID` đổi mỗi request khi chưa đăng nhập. Hệ quả phải nhớ: **token lấy trước khi đăng nhập hết hiệu lực ngay sau khi đăng nhập** — client phải gọi lại `GET /api/auth/csrf` sau mỗi lần login/logout (web đã làm ở `features/auth/api/auth.api.ts`). Quên bước này là 403 CSRF_ERROR ở mọi thao tác ghi.
- **`requireAuth` mắc MỘT lần ở `app.ts`**, không rải vào từng feature. Router thêm mới ở DƯỚI dòng đó được bảo vệ sẵn; thêm ở TRÊN là mở công khai. `test/features/auth/middleware.test.ts` canh đúng ranh giới này.
- **Thêm route mới thì PHẢI khai vào `shared/rbac/permissionRegistry.ts`.** Mặc định là TỪ CHỐI: route không khai trả `403`. Đó là chủ đích — quên khai thành lỗi ồn ào ngay lần test đầu thay vì một route dữ liệu sức khỏe im lặng không được bảo vệ. Thứ tự các dòng là **một phần của đặc tả**: dòng hẹp trước dòng rộng, và `/users/*/role` PHẢI đứng trước `/users/*`.
- **RBAC gác CHỨC NĂNG, ownership gác HÀNG DỮ LIỆU — hai lớp trực giao, cần cả hai.** `SYSTEM_ADMIN` có `log:view` KHÔNG đọc được nhật ký của người khác: mọi truy vấn vẫn mang `userId`. Ba mã trạng thái, ba chủ thể quyết định: `401` chưa đăng nhập (requireAuth) · `403` thiếu quyền (permissionGuard) · `404` hàng của người khác (repository).
- **KHÔNG viết `if (user.role === 'ADMIN')` ở controller hay service.** Quyết định cho/chặn nằm ở đúng một file. Bất biến trên HÀNG ĐÍCH (vd. `ADMIN` không đụng được tài khoản `SYSTEM_ADMIN`) thì ở service, và phân biệt bằng **mã quyền** (`rbac:manage`), không bằng tên vai trò.
- **Đổi vai trò hay sửa ma trận quyền PHẢI gọi evict cache.** Quyền cache theo `userId`, TTL 30 phút. `evictRole` phải tra ngược ra mọi user mang vai trò đó — đây là chỗ dễ quên nhất. Dựa vào TTL để một thay đổi có hiệu lực nghĩa là đang thiếu một lời gọi evict.
- **Cache quyền chỉ đúng với MỘT tiến trình server.** Nhiều instance là sai theo kiểu im lặng và cho kết quả không xác định — đổi sang Redis trước khi scale ngang.
- **Khóa đăng nhập đếm theo CẢ email lẫn IP** (5 lần thất bại / 15 phút, hằng ở đầu `auth.service.ts`). Ngưỡng được kiểm TRƯỚC Argon2 và trước cả `findUserByEmail`: trước Argon2 vì verify tốn CPU có chủ đích (để kẻ tấn công gọi vô hạn là biến chống-brute-force thành lỗ DoS), trước `findUserByEmail` vì chỉ khóa email có thật sẽ biến chính mã 429 thành oracle đoán tài khoản. Lần thử BỊ CHẶN không được ghi lại — ghi là cửa sổ tự gia hạn vô tận.
- **`trust proxy` chỉ bật ở production.** Bật nhầm khi không có proxy là để client tự khai IP qua `X-Forwarded-For` và né bộ đếm; không bật khi có proxy là khóa nhầm toàn bộ người dùng.
- **Một tài khoản, một phiên.** Đăng nhập ở nơi thứ hai đá phiên thứ nhất (`revokeOtherSessions`, chạy SAU `regenerate` + `save` — chạy trước là tự xóa phiên vừa tạo).

## Tham chiếu

- **Tài liệu**: `@docs/README.md` là bản đồ. Phần dùng chung ở `docs/overview/` (mục tiêu & phạm vi, kiến trúc, mô hình dữ liệu, công thức thống kê, quy ước). Mỗi chức năng có `docs/features/<tên>/SPEC.md` + `PLAN.md`.
- **Trước khi sửa một feature, đọc `SPEC.md` của nó** — nhất là mục "Quyết định vượt spec". Nhiều hành vi trông như tùy tiện thật ra là có lý do, và lý do chỉ nằm ở đó chứ không đọc ra được từ code.
- **Code và tài liệu lệch nhau thì code đúng.** Sửa tài liệu cho khớp, đừng sửa code cho khớp tài liệu.
- **Chuẩn cấu trúc code** (chỉ có trên máy tôi, **không thuộc repo này**): `C:\Project\WorkSpace\upip\` — nguồn của quán lệ feature-first 4 lớp mà dự án này bám theo. Xem `services/business-service/src/main/java/com/upisl/business/<domain>/` cho phân lớp backend, `services/front_end_business/src/features/<domain>/` cho frontend và cách đặt tên file TypeScript. Lean **không** bê stack của upip (TanStack, Jotai, shadcn) sang — chỉ lấy cách sắp xếp.
- **Tham khảo cài đặt** (cũng chỉ có trên máy tôi): `C:\Project\WorkSpace\Todo\` dùng cùng stack Express + Prisma + ntfy — lấy pattern `ntfy`, `scheduler`, cấu hình test port từ đó.
- Cả hai đường dẫn trên không tồn tại thì bỏ qua, đừng đi tìm.

## Về khối GitNexus bên dưới

Khối giữa `<!-- gitnexus:start -->` và `<!-- gitnexus:end -->` do `npx gitnexus analyze` **tự sinh ra** — đừng sửa tay, lần chạy sau sẽ ghi đè. Nó có mục `Always Do` / `Never Do` riêng, trùng tên với các mục ở trên.

**Khi hai bên mâu thuẫn, phần ở trên thắng.** Luật GitNexus chỉ áp dụng khi các tool `impact`, `query`, `context`, `detect_changes` thực sự có trong session. Không thấy tool → bỏ qua cả khối, đừng đi tìm, đừng báo lỗi.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Lean** (132 symbols, 160 relationships, 4 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Lean/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Lean/clusters` | All functional areas |
| `gitnexus://repo/Lean/processes` | All execution flows |
| `gitnexus://repo/Lean/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
