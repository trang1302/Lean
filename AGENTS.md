# AGENTS.md — Lean Health Tracker

Hướng dẫn cho mọi coding agent làm việc trong repo này (Claude Code, Codex, và các
agent khác). Claude Code đọc thêm `CLAUDE.md`; nội dung dưới đây là phần bắt buộc
chung, không được vi phạm bất kể agent nào.

## Bối cảnh 30 giây

App theo dõi sức khỏe cá nhân, chạy **localhost, một máy, một người dùng**. Ghi tay
cân nặng, số đo vòng bụng, bữa ăn (tên + calo). Hiển thị xu hướng, thống kê calo,
tiến độ mục tiêu, nhắc nhở qua ntfy.

Stack (luôn dùng bản mới nhất): Express 5 + TypeScript 7 + Prisma 7 + SQLite +
Zod 4 + node-cron 4 (server) · React 19 + Vite 8 + Recharts 3 (web) ·
Vitest 4 + supertest (test).

Cấu trúc feature-first 4 lớp, bám quán lệ của `upip`. Mọi bảng có cột `userId`
dù chưa có đăng nhập — dùng hằng `LOCAL_USER_ID`.

Tài liệu: `docs/README.md` là bản đồ. Phần dùng chung ở `docs/overview/`,
mỗi chức năng có `docs/features/<tên>/SPEC.md` + `PLAN.md`.

Trước khi sửa feature nào, đọc `SPEC.md` của nó — nhất là mục "Quyết định vượt
spec". Code và tài liệu lệch nhau thì **code đúng**, sửa tài liệu cho khớp.

## Always Do

- **Đọc spec trước khi code.** §4 mô hình dữ liệu, §5 API, §6 logic thống kê,
  §9 kế hoạch test. Đừng suy diễn lại thứ spec đã định nghĩa.
- **`date` luôn là chuỗi `"YYYY-MM-DD"`.** Mọi xử lý ngày đi qua
  `server/src/lib/time.ts`, timezone `Asia/Ho_Chi_Minh`.
- **Mọi phép tính nằm trong `server/src/shared/stats/` dưới dạng hàm thuần** —
  không đọc DB, không đụng HTTP. Service lấy dữ liệu rồi gọi hàm.
- **Mọi truy vấn mang `userId`**, lấy từ `LOCAL_USER_ID` trong
  `server/src/shared/constants.ts`.
- **Viết test trước implementation.** `shared/stats/` là ưu tiên test cao nhất.
- **Validate mọi input bằng Zod.** Validate hỏng → `400` kèm danh sách trường sai.
  Không tìm thấy → `404`.
- **Chạy verify và dán output thật** trước khi nói là xong:
  `cd server && npm test` và `cd server && npx tsc --noEmit`.

## Never Do

- **NEVER** dùng `DateTime`/`Date` cho field `date`. Bản ghi 7h sáng giờ VN sẽ bị
  lưu thành ngày hôm trước theo UTC.
- **NEVER** đặt phép tính (MA7, tốc độ thay đổi, trung bình tuần, tiến độ mục
  tiêu) trong controller, service hay component. Chúng thuộc về `shared/stats/`.
- **NEVER** import `PrismaClient` từ `@prisma/client` — Prisma 7 sinh client ra
  `src/generated/prisma`, và nó cần driver adapter mới nối được DB.
- **NEVER** cài `express-async-errors` — Express 5 đã bắt lỗi async trong core.
- **NEVER** để `PUT /body-logs/:date` hay `PUT /goal` xóa mất một trường chỉ vì
  client không gửi nó. Vắng mặt = giữ nguyên; `null` = xóa.
- **NEVER** hiển thị MA7 khi cửa sổ có dưới 2 giá trị — hàm trả `null`, UI phải
  tôn trọng điều đó.
- **NEVER** tính ngày không ghi bữa nào là 0 calo khi lấy trung bình tuần. Bỏ qua
  ngày đó.
- **NEVER** mở ra LAN/cloud khi chưa làm xong `auth` + `rbac`. Bản đang chạy
  không có xác thực — mở mạng là phơi toàn bộ dữ liệu sức khỏe.
  (Auth/phân quyền **đã có spec + plan** ở `docs/features/{auth,rbac}/` từ
  2026-08-07, chưa implement. Được phép làm khi có yêu cầu — đây không còn là
  điều cấm như bản trước của file này.)
- **NEVER** thêm AI phân tích ảnh, lưu ảnh bữa ăn,
  hay DB món ăn dựng sẵn. Đây là những thứ §2 của spec đã cố tình loại bỏ —
  đọc lý do ở đó rồi hỏi trước khi đề xuất lại.
- **NEVER** chạy `git commit` hoặc `git push`. Chủ repo tự commit.
- **NEVER** để chữ "Claude" hay "AI-generated" trong commit message.
- **NEVER** xóa hay reset `server/prisma/data.db` — đó là dữ liệu thật của người dùng.

## Cạm bẫy đã biết

- Cân nặng dao động 1–2 kg/ngày là bình thường. Biểu đồ luôn phải làm MA7 nổi bật
  hơn điểm thô, nếu không người dùng đọc sai xu hướng.
- Nhắc nhở chỉ chạy khi server bật. Máy tắt thì không có nhắc và không gửi bù.
  Điều này phải được ghi rõ trên giao diện Cài đặt.
- SQLite + không auth là quyết định có chủ đích cho bối cảnh localhost một người.
  Phần "không auth" **đã được đảo ngày 2026-08-07** — xem
  `docs/overview/00-goals-and-scope.md`. Spec + plan có ở
  `docs/features/{auth,rbac}/`, code thì chưa. Cho tới khi code xong: chỉ chạy
  localhost.

## Lệnh

```bash
# Server
cd server && npm install
cd server && npx prisma db push     # tạo/cập nhật data.db
cd server && npm run dev            # http://localhost:3000
cd server && npm test               # vitest
cd server && npx tsc --noEmit       # type check

# Web
cd web && npm install
cd web && npm run dev               # http://localhost:5173
cd web && npm run build
```

## File cần đọc trước khi sửa

| Định làm gì | Đọc trước |
|---|---|
| Bất cứ thứ gì liên quan ngày | `server/src/lib/time.ts` |
| Thêm phép tính | `server/src/shared/stats/` + spec §6 |
| Thêm/sửa endpoint | spec §5 + `server/src/features/<feature>/` |
| Đổi bảng | `server/prisma/schema.prisma` + spec §4 |
| Đổi connection string | `server/prisma.config.ts` (không phải schema) |
| Viết test | `server/test/**/*.test.ts` + spec §9 |

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
