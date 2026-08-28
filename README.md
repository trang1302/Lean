# Lean — Theo dõi sức khỏe cá nhân

App ghi cân nặng, vòng bụng và bữa ăn hàng ngày, rồi cho biết xu hướng, lượng calo nạp vào và
tiến độ so với cân nặng mục tiêu. Chạy hoàn toàn trên máy bạn: một tiến trình Node, một file
SQLite, không tài khoản, không gửi dữ liệu đi đâu, không tốn phí.

Giá trị cốt lõi không phải con số của một ngày mà là **xu hướng** — cân nặng dao động 1–2 kg
mỗi ngày, nên mọi biểu đồ đều đi kèm trung bình trượt 7 ngày và đó mới là đường đáng nhìn.

## Trạng thái: backend xong, chưa có giao diện

| Phần | Trạng thái |
|---|---|
| Server (`server/`) — 5 feature: `body-logs` `meals` `goal` `summary` `reminders` | **Đã xong**, 239 test pass |
| Web (`web/`) — 3 trang: Hôm nay · Biểu đồ · Cài đặt | **Chưa bắt đầu**, thư mục `web/` chưa tồn tại |

Nghĩa là hiện tại app dùng được **qua HTTP API**, chưa có màn hình để bấm. Mọi lệnh
`cd web` trong tài liệu cũ đều chưa chạy được.

## Yêu cầu

- Node.js **24 trở lên** (đang phát triển trên v24.19 LTS). Stack dùng TypeScript 7,
  Prisma 7, Express 5, Vitest 4, React Router 8, jsdom 30 — Node 22 **không đủ**:
  `react-router@8` đòi `>=22.22.0` và `jsdom@30` đòi `^22.22.2 || ^24.15.0 || >=26.0.0`.

> **Đổi phiên bản Node? Phải rebuild native module.**
> `server/` dùng `better-sqlite3` — một native module biên dịch theo ABI của Node.
> Đổi Node major mà không rebuild thì test đổ hàng loạt với
> `NODE_MODULE_VERSION 127 ... requires NODE_MODULE_VERSION 137`.
>
> ```bash
> cd server && npm rebuild better-sqlite3
> ```
>
> **Cảnh báo về cách kiểm:** `node -e "require('better-sqlite3')"` chạy được **không**
> chứng minh gì — nó chỉ nạp lớp JS bọc ngoài, binding gốc chỉ nổ khi thật sự truy vấn.
> Bằng chứng duy nhất đáng tin là `cd server && npm test`. (Đã vấp đúng bẫy này
> ngày 2026-08-07 khi nâng Node 22 → 24.)
- Không cần cài database. SQLite nằm gọn trong `server/data.db`.

## Chạy lần đầu

```bash
cd server
npm install
cp .env.example .env      # PowerShell: copy .env.example .env
npm run prisma:push       # tạo server/data.db + sinh Prisma client
npm run dev               # http://localhost:3000
```

Kiểm tra server sống: `curl http://localhost:3000/api/health` → `{"ok":true}`.

`npm run prisma:push` bắt buộc chạy ít nhất một lần: Prisma client được sinh ra ở
`server/src/generated/prisma` và **không commit vào repo**. Thiếu bước này thì server không
khởi động được. Cần sinh lại client mà không đụng DB thì dùng `npm run prisma:generate`.

**Prisma 7:** connection string không nằm trong `prisma/schema.prisma` mà trong
`server/prisma.config.ts`, đọc từ biến `DATABASE_URL`. Đừng thêm `url` vào block
`datasource` — Prisma 7 sẽ báo lỗi.

Biến môi trường (`server/.env`, đọc và validate ở `server/src/config/env.ts`):

```
DATABASE_URL="file:./data.db"      # tương đối với server/, KHÔNG phải prisma/
PORT=3000
NTFY_BASE_URL="https://ntfy.sh"
```

**Đường dẫn `file:` tương đối được resolve theo `server/`** — thư mục chứa
`prisma.config.ts`, cũng là cwd của mọi `npm run`. Nên `file:./data.db` là `server/data.db`,
**không** phải `server/prisma/data.db`. Prisma ≤ 6 resolve theo thư mục `prisma/`; bản 7 dời
connection string sang `prisma.config.ts` và đổi luôn gốc resolve. Chạy `tsx src/server.ts`
từ cwd khác (IDE run config, script ở gốc repo) sẽ mở một file `data.db` **khác và rỗng** —
không báo lỗi lúc khởi động, chỉ nổ `P2021 table does not exist` khi gọi API. Vấp ngày
2026-08-10, do `prisma/data.db` sinh từ thời Prisma 6 còn sót lại.

Không có biến timezone. Múi giờ là hằng `TZ = 'Asia/Ho_Chi_Minh'` trong
`server/src/lib/time.ts` — sửa ở đó nếu cần đổi.

## Chạy các lần sau

```bash
cd server && npm run dev
```

Chạy lại `npm run prisma:push` chỉ khi `prisma/schema.prisma` đổi.

## Dùng thử khi chưa có giao diện

Mọi endpoint nằm dưới `/api`. Vài lệnh đủ để đi hết một vòng:

```bash
# Ghi cân nặng hôm nay (upsert — trường vắng mặt giữ nguyên, gửi null mới xóa)
curl -X PUT http://localhost:3000/api/body-logs/2026-08-07 \
  -H 'Content-Type: application/json' -d '{"weightKg":72.4,"waistCm":86}'

# Thêm một bữa ăn
curl -X POST http://localhost:3000/api/meals \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-08-07","slot":"lunch","name":"Cơm gà","calories":650}'

# Đặt mục tiêu
curl -X PUT http://localhost:3000/api/goal \
  -H 'Content-Type: application/json' \
  -d '{"targetWeightKg":68,"targetDate":"2026-12-31","dailyCalorieTarget":1900}'

# Xem tổng hợp: MA7, tổng calo theo ngày, trung bình tuần, tiến độ mục tiêu
curl 'http://localhost:3000/api/summary?from=2026-07-01&to=2026-08-07'
```

Chi tiết từng endpoint ở `docs/features/<tên>/SPEC.md`.

## Nhắc nhở qua điện thoại

App gửi nhắc qua [ntfy.sh](https://ntfy.sh) — dịch vụ push miễn phí, không cần tài khoản.
Server POST vào một *topic*, ai subscribe topic đó thì nhận được thông báo.

1. Cài app **ntfy** (iOS / Android).
2. Nghĩ một topic khó đoán, ví dụ `lean-<tên>-<vài ký tự ngẫu nhiên>`. **Ai biết topic cũng
   đọc được thông báo của bạn** — đừng đặt tên dễ đoán.
3. Subscribe topic đó trong app.
4. Bật nhắc nhở. Khi có trang Cài đặt thì nhập ở đó; hiện tại gọi API:

```bash
curl -X PUT http://localhost:3000/api/reminders/weigh_in \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"timeOfDay":"07:00","ntfyTopic":"lean-abc123"}'
```

Có đúng hai loại nhắc: `weigh_in` (nhắc cân) và `meal_log` (nhắc ghi bữa ăn). `kind` khác trả
`404`. Nhắc chỉ gửi khi hôm đó **chưa có** dữ liệu tương ứng — ghi cân rồi thì không bị làm
phiền nữa.

> **Nhắc nhở chỉ chạy khi server đang bật.** Cron sống trong tiến trình server. Tắt máy, đóng
> terminal, hoặc máy ngủ đúng lúc đến giờ thì **mất lượt đó và không có gửi bù** — server bật
> lại sẽ không đuổi theo những lần đã lỡ. Đây là hệ quả có chủ đích của việc không dựng dịch
> vụ nền.

## Sao lưu

Toàn bộ dữ liệu nằm trong một file: `server/data.db`. Copy file đó là xong bản backup;
chép ngược vào chỗ cũ là khôi phục. Nên dừng server trước khi copy.

File này nằm trong `.gitignore` — dữ liệu cá nhân, không commit.

## Test

```bash
cd server && npm test          # vitest run — 239 test, 11 file
cd server && npm run typecheck # tsc --noEmit
cd server && npm run build     # tsc -p tsconfig.json
```

Test dùng DB riêng (`server/test.db`), **không bao giờ** chạm `data.db` thật — cấu hình ở
`server/vitest.config.ts` và `server/test/globalSetup.ts`.

Chưa có test cho web vì chưa có web.

## Tài liệu

Bắt đầu ở [`docs/README.md`](docs/README.md) — bản đồ toàn bộ tài liệu.

| Cần biết | Đọc |
|---|---|
| App làm gì và cố tình không làm gì | `docs/overview/00-goals-and-scope.md` |
| Code tổ chức thế nào | `docs/overview/01-architecture.md` |
| MA7 / tốc độ / tiến độ tính ra sao | `docs/overview/03-stats.md` |
| Quy ước bắt buộc khi code | `docs/overview/04-conventions.md` |
| Hành vi chính xác của một endpoint | `docs/features/<tên>/SPEC.md` |
| Câu hỏi còn treo, cần chốt | `docs/overview/06-open-questions.md` |
| Hướng dẫn cho coding agent | `CLAUDE.md` · `AGENTS.md` |

## Vì sao không có AI tính calo từ ảnh

Đã cân nhắc và bỏ. Ước tính calo từ ảnh có sai số ±20–40% vì AI không thấy được khối lượng
thật, lượng dầu mỡ hay cách chế biến — và nó là phần duy nhất tốn tiền trong toàn bộ app. Nhập
tay chính xác hơn, nhanh hơn với vài món ăn quen thuộc, và miễn phí.

Cùng lý do đó, app cũng **không** lưu ảnh bữa ăn, **không** có database món ăn dựng sẵn,
và **không** truy cập được từ điện thoại. Ba quyết định này đều có lý do riêng ở
`docs/overview/00-goals-and-scope.md` §2 — đọc trước khi đề xuất thêm lại.

Nếu sau này đổi ý: `docs/overview/05-future-ai.md` mô tả đường mở rộng đã chừa sẵn, thêm vào
được mà không phải đập đi làm lại.

## Bảo mật

App có xác thực thật: phiên server-side (cookie `httpOnly`), CSRF double-submit, mật khẩu
Argon2id, khóa đăng nhập sau 5 lần sai trong 15 phút, và phân quyền theo vai trò
(`USER` / `ADMIN` / `SYSTEM_ADMIN`).

Hai lớp trực giao, cần cả hai: **RBAC** gác chức năng (`403`), **ownership** gác hàng dữ liệu
(`404`). `SYSTEM_ADMIN` có quyền `log:view` vẫn **không** đọc được nhật ký của người khác.

Bootstrap máy mới: `npm run seed:rbac` rồi (tùy chọn) `npm run seed:users`.

**Vẫn nên chỉ chạy localhost** cho tới khi có audit log cho thao tác phân quyền, và cho tới khi
cache quyền chuyển sang Redis nếu chạy nhiều tiến trình. `app.listen()` không chỉ định host,
nên nếu máy bạn mở cổng 3000 ra ngoài thì API mở theo — luôn chạy app trên máy cá nhân, sau tường lửa.
