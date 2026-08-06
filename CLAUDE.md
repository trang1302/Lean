# Lean — Health Tracker

## Project Overview

App theo dõi sức khỏe cá nhân, chạy localhost trên một máy, một người dùng. Ghi tay hàng ngày: cân nặng, số đo vòng bụng, và các bữa ăn (tên món + calo). Hiển thị xu hướng, thống kê calo, tiến độ mục tiêu, và nhắc nhở qua ntfy.

**Không có:** AI phân tích ảnh, lưu ảnh bữa ăn, database món ăn dựng sẵn, đăng nhập, truy cập từ điện thoại. Đây là quyết định có chủ đích — xem `2026-08-06-health-tracker-design.md` §2 để biết lý do trước khi đề xuất thêm lại.

**Trạng thái:** mới có spec, chưa có code.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript | Prisma + **SQLite** | Zod (validate) | node-cron (nhắc nhở)
- **Frontend**: React + TypeScript + Vite | Recharts (biểu đồ)
- **Test**: Vitest + supertest
- **Thông báo**: ntfy.sh

## Cấu trúc

```
Lean/
├── 2026-08-06-health-tracker-design.md   # SPEC — nguồn chân lý
├── server/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── server.ts app.ts env.ts db.ts time.ts
│       ├── stats.ts        # hàm thuần: MA7, tổng calo, tiến độ
│       ├── ntfy.ts scheduler.ts
│       └── routes/{bodyLogs,meals,summary,goal,reminders}.ts
└── web/src/
    ├── api.ts
    ├── pages/{Today,Charts,Settings}.tsx
    └── components/
```

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
npm run dev               # http://localhost:5173
npm run build
```

## Quy ước bắt buộc

### Ngày tháng — đọc kỹ mục này

**`date` luôn là chuỗi `"YYYY-MM-DD"`, không bao giờ là `DateTime`.** "Ngày tôi cân" là một ngày trên lịch, không phải một thời điểm. Dùng `DateTime` sẽ sinh lỗi lệch múi giờ (bản ghi 7h sáng giờ VN bị lưu thành ngày hôm trước theo UTC). Mọi xử lý ngày đi qua `server/src/time.ts`, timezone `Asia/Ho_Chi_Minh`.

### Tách logic thống kê

Mọi phép tính (MA7, tốc độ thay đổi, trung bình tuần, tiến độ mục tiêu) nằm trong `server/src/stats.ts` dưới dạng **hàm thuần** — không đọc DB, không đụng HTTP. Route chỉ lấy dữ liệu rồi gọi hàm. Giữ nguyên ranh giới này; nó là thứ làm cho phần khó nhất của app test được.

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
- **SQLite + không auth là quyết định có chủ đích** cho bối cảnh localhost một người. Nếu mở ra LAN hoặc cloud thì **bắt buộc** thêm auth trước.

## Tham chiếu

- **Spec đầy đủ**: `@2026-08-06-health-tracker-design.md` — data model, API, logic thống kê, kế hoạch test đều ở đây
- **Tham khảo code** (chỉ có trên máy tôi, **không thuộc repo này**): `C:\Project\WorkSpace\Todo\` dùng cùng stack (Express + Prisma + React + ntfy). `ntfy.ts`, `scheduler.ts`, `time.ts` và cấu hình test port lấy từ đó sang. Nếu đường dẫn này không tồn tại thì bỏ qua, đừng đi tìm.
