# Kiến trúc

File này trả lời: **code nằm ở đâu, chia theo nguyên tắc nào, và vì sao chọn từng món trong stack.** Khi cần biết một file mới nên đặt chỗ nào, đọc file này.

Liên quan: [`00-goals-and-scope.md`](00-goals-and-scope.md) (phạm vi) · [`02-data-model.md`](02-data-model.md) (bảng và khóa) · [`03-stats.md`](03-stats.md) (nội dung của `shared/stats/`) · [`04-conventions.md`](04-conventions.md) (ràng buộc bắt buộc khi code).

---

## 3. Kiến trúc

Cấu trúc bám theo quán lệ của dự án **`upip`** (`C:\Project\WorkSpace\upip`, chỉ có trên máy dev — không thuộc repo này): chia theo **feature trước, phân lớp bên trong**. Mục tiêu là đi qua lại giữa hai dự án mà không phải học lại cách sắp xếp.

Stack giữ nguyên của Lean (Express + Prisma + React), **không** bê stack frontend của upip (TanStack, Jotai, shadcn) sang.

```
LEAN/
├── server/
│   ├── prisma.config.ts             # Prisma 7: connection string ở đây, không ở schema
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── server.ts                # entry point: listen + start scheduler
│   │   ├── app.ts                   # lắp express app (không listen — để supertest dùng)
│   │   ├── config/env.ts            # đọc + validate biến môi trường
│   │   ├── generated/prisma/        # Prisma client máy sinh (gitignore)
│   │   ├── lib/
│   │   │   ├── db.ts                # PrismaClient + driver adapter
│   │   │   └── time.ts              # xử lý ngày theo timezone local
│   │   ├── shared/
│   │   │   ├── constants.ts         # LOCAL_USER_ID
│   │   │   ├── stats/               # HÀM THUẦN — không DB, không HTTP
│   │   │   │   ├── movingAverage.ts # MA7
│   │   │   │   ├── rate.ts          # currentRate, requiredRate, onTrack, remainingKg
│   │   │   │   ├── weekly.ts        # avgCalories, avgWeightKg
│   │   │   │   └── index.ts
│   │   │   ├── clients/ntfy.client.ts
│   │   │   ├── errors/              # AppError.ts, errorHandler.ts
│   │   │   └── validation/commonSchemas.ts
│   │   └── features/                # bodyLogs · meals · goal · summary · reminders
│   │       └── <feature>/
│   │           ├── controllers/<feature>.controller.ts
│   │           ├── services/<feature>.service.ts
│   │           ├── repositories/<feature>.repository.ts
│   │           ├── dtos/<feature>.request.ts    # Zod
│   │           ├── dtos/<feature>.response.ts
│   │           └── index.ts                     # export router
│   └── test/                        # soi gương cây src/
│       ├── lib/{time,db}.test.ts
│       ├── shared/stats/{movingAverage,rate,weekly}.test.ts
│       └── features/<f>/<f>.controller.test.ts   # integration, supertest
└── web/
    ├── package.json  tsconfig.json  vite.config.ts  index.html
    └── src/
        ├── main.tsx  App.tsx
        ├── components/{ui,shared}/
        ├── constants/  hooks/
        ├── lib/{apiClient.ts,format.ts}
        ├── router/routes.tsx
        └── features/{today,charts,settings}/
            ├── api/<name>.api.ts
            ├── components/<Name>Page.tsx
            ├── hooks/use<Name>.ts
            └── index.ts
```

**Server chia theo 5 miền dữ liệu, web chia theo 3 trang** — bất đối xứng có chủ đích. Trang "Hôm nay" đọc cả `bodyLogs` lẫn `meals`; chia web theo miền sẽ thành 5 feature cho 3 màn hình. upip cũng trộn hai kiểu: `features/dashboard` theo trang, `features/permits` theo miền.

**Mọi CRUD đều đi đủ 4 lớp**, kể cả khi service chỉ chuyển tiếp. Đổi lấy sự nhất quán: mở feature nào cũng thấy đúng bộ file, không phải phán đoán.

Đặt tên theo quán lệ TypeScript của upip (`userManage.api.ts`, `auth.service.ts`): camelCase + hậu tố chấm. Component React vẫn PascalCase.

### Ranh giới quan trọng

- `shared/stats/` không biết gì về DB và HTTP — nhận mảng, trả kết quả.
- `repositories/` là **chỗ duy nhất** import `prisma`. Controller và service không được chạm.
- `services/` gọi repository rồi gọi `shared/stats/`; không tự viết công thức.
- `app.ts` không gọi `listen()` để supertest dùng được.

### Lựa chọn kỹ thuật và lý do

| Quyết định | Lý do | Đánh đổi |
|---|---|---|
| **SQLite** thay vì Postgres | Một file `data.db`, không cần cài dịch vụ, backup = copy file | Không chạy được nhiều tiến trình ghi đồng thời — không thành vấn đề với 1 người dùng |
| ~~**Không có đăng nhập**~~ **← đã đảo 2026-08-07** | Lý do gốc: localhost, một người; auth chỉ thêm một màn hình bấm qua mỗi ngày mà không bảo vệ thêm gì. Điều kiện "nếu mở ra LAN/cloud" nay đã xảy ra — xem [`00-goals-and-scope.md`](00-goals-and-scope.md) | Spec + plan ở `../features/{auth,rbac}/`, **chưa implement**. Bản đang chạy vẫn không có auth → chỉ localhost |
| Express 5 + Prisma 7 + TypeScript 7 | Bản mới nhất tại thời điểm dựng dự án. Express 5 bắt lỗi async sẵn trong core nên **không cần** `express-async-errors` | Prisma 7 bỏ `url` khỏi `datasource` — connection string chuyển sang `prisma.config.ts`, client nối DB qua driver adapter `@prisma/adapter-better-sqlite3` |
| Zod 4 | Mới nhất, và trùng bản upip đang dùng | Format validator lên top-level: `z.url()` thay cho `z.string().url()` |
| React 19 + Vite 8 + Recharts 3 | Bản mới nhất | — |
| Cấu trúc feature-first 4 lớp | Giống `upip` — đi qua lại giữa hai dự án không phải học lại cách sắp xếp | CRUD tầm thường vẫn tốn 5 file; đổi lấy tính nhất quán |
| Logic thống kê tách vào `shared/stats/` | Hàm thuần, không đụng DB hay HTTP → test được độc lập. Để ngoài `features/` vì MA7 dùng chung bởi `summary` và `goal` | — |
| Cột `userId` từ đầu, chưa có auth | Nhét khóa người dùng vào sau nghĩa là sửa mọi bảng, mọi unique constraint, mọi truy vấn và migrate dữ liệu. Làm ngay chỉ tốn một cột và một hằng | Mọi truy vấn phải mang `userId`, kể cả khi chỉ có một người dùng |

Quyết định SQLite vẫn là thay đổi cục bộ nếu cần đảo: đổi `provider` trong `schema.prisma` để sang Postgres.

Quyết định "không đăng nhập" **đã đảo**. Việc thêm auth hóa ra không chỉ là "thêm middleware vào `app.ts`" như câu này từng viết — nó kéo theo bảng `User`/`Role`/`Permission`, thay hằng `LOCAL_USER_ID` ở mọi repository, migrate dữ liệu `userId='local'`, và một trang đăng nhập ở web. Xem `../features/auth/PLAN.md`.
