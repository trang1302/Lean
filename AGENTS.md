# AGENTS.md — Lean Health Tracker

Hướng dẫn cho mọi coding agent làm việc trong repo này (Claude Code, Codex, và các
agent khác). Claude Code đọc thêm `CLAUDE.md`; nội dung dưới đây là phần bắt buộc
chung, không được vi phạm bất kể agent nào.

## Bối cảnh 30 giây

App theo dõi sức khỏe cá nhân, chạy **localhost, một máy, một người dùng**. Ghi tay
cân nặng, số đo vòng bụng, bữa ăn (tên + calo). Hiển thị xu hướng, thống kê calo,
tiến độ mục tiêu, nhắc nhở qua ntfy.

Stack: Express + TypeScript + Prisma + SQLite + Zod + node-cron (server) ·
React + Vite + Recharts (web) · Vitest + supertest (test).

Nguồn chân lý: `2026-08-06-health-tracker-design.md`.
Kế hoạch thực thi theo task: `2026-08-06-health-tracker-plan.md`.

## Always Do

- **Đọc spec trước khi code.** §4 mô hình dữ liệu, §5 API, §6 logic thống kê,
  §9 kế hoạch test. Đừng suy diễn lại thứ spec đã định nghĩa.
- **`date` luôn là chuỗi `"YYYY-MM-DD"`.** Mọi xử lý ngày đi qua
  `server/src/time.ts`, timezone `Asia/Ho_Chi_Minh`.
- **Mọi phép tính nằm trong `server/src/stats.ts` dưới dạng hàm thuần** —
  không đọc DB, không đụng HTTP. Route chỉ lấy dữ liệu rồi gọi hàm.
- **Viết test trước implementation.** `stats.ts` là ưu tiên test cao nhất.
- **Validate mọi input bằng Zod.** Validate hỏng → `400` kèm danh sách trường sai.
  Không tìm thấy → `404`.
- **Chạy verify và dán output thật** trước khi nói là xong:
  `cd server && npm test` và `cd server && npx tsc --noEmit`.

## Never Do

- **NEVER** dùng `DateTime`/`Date` cho field `date`. Bản ghi 7h sáng giờ VN sẽ bị
  lưu thành ngày hôm trước theo UTC.
- **NEVER** đặt phép tính (MA7, tốc độ thay đổi, trung bình tuần, tiến độ mục
  tiêu) trong file route hay component. Chúng thuộc về `stats.ts`.
- **NEVER** để `PUT /body-logs/:date` hay `PUT /goal` xóa mất một trường chỉ vì
  client không gửi nó. Vắng mặt = giữ nguyên; `null` = xóa.
- **NEVER** hiển thị MA7 khi cửa sổ có dưới 2 giá trị — hàm trả `null`, UI phải
  tôn trọng điều đó.
- **NEVER** tính ngày không ghi bữa nào là 0 calo khi lấy trung bình tuần. Bỏ qua
  ngày đó.
- **NEVER** thêm auth, mở ra LAN/cloud, thêm AI phân tích ảnh, lưu ảnh bữa ăn,
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
  Mở ra LAN hoặc cloud thì **bắt buộc** thêm auth trước.

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
| Bất cứ thứ gì liên quan ngày | `server/src/time.ts` |
| Thêm phép tính | `server/src/stats.ts` + spec §6 |
| Thêm/sửa endpoint | spec §5 + `server/src/routes/*` |
| Đổi bảng | `server/prisma/schema.prisma` + spec §4 |
| Viết test | `server/test/*.test.ts` + spec §9 |
