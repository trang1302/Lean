# Lean — Health Tracker

## Project Overview

App theo dõi sức khỏe cá nhân, chạy localhost trên một máy, một người dùng. Ghi tay hàng ngày: cân nặng, số đo vòng bụng, và các bữa ăn (tên món + calo). Hiển thị xu hướng, thống kê calo, tiến độ mục tiêu, và nhắc nhở qua ntfy.

**Không có:** AI phân tích ảnh, lưu ảnh bữa ăn, database món ăn dựng sẵn, truy cập từ điện thoại. Đây là quyết định có chủ đích — xem `docs/overview/00-goals-and-scope.md` để biết lý do trước khi đề xuất thêm lại.

**Đăng nhập/phân quyền:** trước đây nằm trong danh sách trên, **đã đảo quyết định ngày 2026-08-07** theo hướng nhiều người dùng. Đã có spec + plan ở `docs/features/{auth,rbac}/`, **chưa có dòng code nào**. Tới khi làm xong: chỉ chạy localhost.

**Trạng thái:** mới có spec, chưa có code.

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
│   │   │   ├── constants.ts              # LOCAL_USER_ID
│   │   │   ├── stats/{movingAverage,rate,weekly}.ts   # HÀM THUẦN
│   │   │   ├── clients/ntfy.client.ts
│   │   │   ├── errors/  validation/
│   │   └── features/<feature>/           # bodyLogs meals goal summary reminders
│   │       ├── controllers/  services/  repositories/  dtos/
│   │       └── index.ts                  # export router
│   └── test/                             # soi gương cây src/
└── web/src/
    ├── components/{ui,shared}/  lib/  router/
    └── features/{today,charts,settings}/{api,components,hooks}/
```

**Mọi CRUD đi đủ 4 lớp** controller → service → repository → Prisma, kể cả khi service chỉ chuyển tiếp. Nhất quán quan trọng hơn việc tiết kiệm vài file.

**Mọi bảng có `userId`.** Chưa có đăng nhập; dùng hằng `LOCAL_USER_ID` trong `src/shared/constants.ts`. Mọi truy vấn phải mang `userId` kể cả khi chỉ có một người dùng — đó là thứ giữ cho việc thêm auth sau này không phải migrate lại schema.

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
- **SQLite + không auth là quyết định có chủ đích** cho bối cảnh localhost một người. Phần "không auth" đã đảo (2026-08-07) — spec ở `docs/features/{auth,rbac}/`, code chưa có. **Cho tới lúc đó, đừng mở ra LAN hay cloud**: không có xác thực nghĩa là ai trong mạng cũng đọc được toàn bộ dữ liệu sức khỏe.

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
