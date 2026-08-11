# Lean Health Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây app theo dõi sức khỏe cá nhân chạy localhost — ghi cân nặng, vòng bụng, bữa ăn (nhập tay), hiển thị xu hướng và tiến độ mục tiêu, nhắc nhở qua ntfy.

**Architecture:** Server Express + Prisma/SQLite phơi ra REST API dưới `/api`; mọi phép tính thống kê nằm trong `stats.ts` dưới dạng hàm thuần không đụng DB/HTTP nên test được độc lập. Web là SPA React + Vite gọi API, ba trang: Hôm nay / Biểu đồ / Cài đặt. Không đăng nhập, một người dùng.

**Tech Stack:** Node 20+ · Express 4 · TypeScript 5.5 · Prisma 5 + SQLite · Zod 3 · node-cron 3 · React 18 + Vite 5 + Recharts 2 · Test: Vitest 2 + supertest 7 (server), Vitest 2 + jsdom + Testing Library (web)

**Spec:** `2026-08-06-health-tracker-design.md` — mọi định nghĩa chi tiết nằm ở đó.

## Global Constraints

Áp dụng cho **mọi task**, không lặp lại trong từng task:

- **Phiên bản: luôn dùng bản mới nhất.** Đang chạy Express **5** · TypeScript **7** · Prisma **7** · Zod **4** · node-cron **4** · Vitest **4** · React **19** · Vite **8** · Recharts **3**. Ba hệ quả bắt buộc nhớ:
  - **Prisma 7**: `url` không khai trong `datasource` mà ở `prisma.config.ts`; client sinh ra ở `src/generated/prisma` và import **từ đó**, không từ `@prisma/client`; nối DB qua `PrismaBetterSqlite3` adapter; `db push` không còn cờ `--skip-generate`.
  - **Zod 4**: format validator lên top-level — `z.url()`, `z.email()`, không phải `z.url()`.
- **Cấu trúc feature-first 4 lớp** (bám quán lệ `upip`): `controller → service → repository → Prisma`, **không ngoại lệ** kể cả CRUD tầm thường. `repositories/` là chỗ duy nhất được import `prisma`.
- **Mọi bảng và mọi truy vấn mang `userId`**, lấy từ hằng `LOCAL_USER_ID` trong `server/src/shared/constants.ts`. Chưa có đăng nhập — nhưng khóa đã là `(userId, date)` để sau này thêm auth không phải migrate lại schema.
- **`date` luôn là chuỗi `"YYYY-MM-DD"`.** Không bao giờ dùng `DateTime`/`Date` cho ngày lịch trong DB hoặc trong API payload. Mọi thao tác ngày đi qua `server/src/lib/time.ts`.
- **Timezone: `Asia/Ho_Chi_Minh`.** Chỉ dùng cho việc xác định "hôm nay"; số học ngày thực hiện trên UTC nên không lệch.
- **`shared/stats/` là hàm thuần** — không import `lib/db.ts`, không import express, không đọc `Date.now()` trực tiếp (nhận `todayIso` làm tham số). Để ngoài `features/` vì MA7 dùng chung bởi `summary` và `goal`.
- **Không có auth, không có middleware xác thực.** Server chỉ bind localhost.
- **Zod validate mọi input** (body + query + params) tại tầng controller, schema đặt trong `features/<f>/dtos/<f>.request.ts`.
- **Hình dạng lỗi API** (spec không định nghĩa, chốt tại đây):
  - `400` → `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": [{ "path": "weightKg", "message": "..." }] } }`
  - `404` → `{ "error": { "code": "NOT_FOUND", "message": "..." } }`
  - `500` → `{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }`
- **Ràng buộc validate** (spec §5): `weightKg` ∈ (0, 500) · `waistCm` ∈ (0, 300) · `calories` số nguyên ∈ [0, 20000] · `name` không rỗng sau trim, ≤ 200 ký tự · `slot` ∈ `["breakfast","lunch","dinner","snack"]` · `timeOfDay` khớp `^([01]\d|2[0-3]):[0-5]\d$` · `date` hợp lệ và **không ở tương lai** · khoảng `from`–`to` tối đa **730 ngày**, `from <= to`.
- **MA7 trả `null` khi cửa sổ có dưới 2 giá trị.** Cửa sổ là 7 ngày **lịch** `[d-6, d]`, không phải 7 điểm dữ liệu gần nhất.
- **Tuần bắt đầu thứ Hai.**
- **Commit sau mỗi task**, format `<type>(<scope>): <subject>`.
- Chạy mọi lệnh `npm` của server từ `Lean/server`, của web từ `Lean/web`.

---

## File Structure

```
Lean/
├── server/
│   ├── package.json  tsconfig.json  vitest.config.ts  .env.example
│   ├── prisma.config.ts             # Prisma 7: connection string (KHÔNG ở schema)
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── server.ts                # entry point: listen + start scheduler
│   │   ├── app.ts                   # lắp express app (KHÔNG listen — để supertest dùng)
│   │   ├── config/env.ts            # đọc + validate biến môi trường
│   │   ├── generated/prisma/        # Prisma client máy sinh (gitignore)
│   │   ├── lib/
│   │   │   ├── db.ts                # PrismaClient + PrismaBetterSqlite3 adapter
│   │   │   └── time.ts              # số học ngày "YYYY-MM-DD", "hôm nay" theo TZ
│   │   ├── shared/
│   │   │   ├── constants.ts         # LOCAL_USER_ID
│   │   │   ├── stats/               # HÀM THUẦN — không DB, không HTTP
│   │   │   │   ├── movingAverage.ts # MA7
│   │   │   │   ├── rate.ts          # currentRate, requiredRate, onTrack, remainingKg
│   │   │   │   ├── weekly.ts        # avgCalories, avgWeightKg
│   │   │   │   └── index.ts
│   │   │   ├── clients/ntfy.client.ts
│   │   │   ├── errors/{AppError,errorHandler}.ts
│   │   │   └── validation/commonSchemas.ts   # dateString, dateRange dùng lại
│   │   └── features/<f>/            # bodyLogs meals goal summary reminders
│   │       ├── controllers/<f>.controller.ts
│   │       ├── services/<f>.service.ts
│   │       ├── repositories/<f>.repository.ts
│   │       ├── dtos/<f>.request.ts  dtos/<f>.response.ts
│   │       └── index.ts             # export router
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
        ├── lib/{apiClient,format}.ts
        ├── router/routes.tsx
        └── features/{today,charts,settings}/
            ├── api/<name>.api.ts
            ├── components/<Name>Page.tsx + component con
            ├── hooks/use<Name>.ts
            └── index.ts
```

Ranh giới quan trọng:

- `shared/stats/` không biết gì về DB và HTTP — nhận mảng, trả kết quả.
- `repositories/` là **chỗ duy nhất** import `prisma`. Controller và service không được chạm.
- `services/` gọi repository rồi gọi `shared/stats/`; không tự viết công thức.
- `app.ts` không gọi `listen()` để supertest dùng được.
- Server chia theo **5 miền dữ liệu**, web chia theo **3 trang** — bất đối xứng có chủ đích, xem §3 spec.

---

## Task 1: Server scaffold + `time.ts`

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/.env.example`
- Create: `server/src/lib/time.ts`
- Test: `server/test/lib/time.test.ts`

**Interfaces:**
- Consumes: (không có — task đầu tiên)
- Produces: từ `src/lib/time.ts` —
  - `TZ: string` (hằng `"Asia/Ho_Chi_Minh"`)
  - `todayIso(): string`
  - `isValidIsoDate(value: string): boolean`
  - `addDays(iso: string, days: number): string`
  - `daysBetween(fromIso: string, toIso: string): number`
  - `enumerateDates(fromIso: string, toIso: string): string[]`
  - `startOfWeekMonday(iso: string): string`

- [ ] **Step 1: Tạo `server/package.json`**

```json
{
  "name": "lean-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0",
    "express": "^4.19.2",
    "node-cron": "^3.0.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/node-cron": "^3.0.11",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.18.0",
    "supertest": "^7.0.0",
    "tsx": "^4.16.0",
    "typescript": "~5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Tạo `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Tạo `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    // DB riêng cho test. Bắt buộc: các test gọi deleteMany() ở beforeEach —
    // trỏ vào data.db sẽ xóa sạch dữ liệu sức khỏe thật của người dùng.
    env: { DATABASE_URL: 'file:./test.db' },
  },
});
```

Hai thiết lập đều bắt buộc:
- `fileParallelism: false` — SQLite một file, các test file chạy song song sẽ tranh ghi.
- `env.DATABASE_URL` trỏ sang `test.db` — **không được để test chạy trên `data.db`.**

Task 2 sẽ thêm `globalSetup` vào file này sau khi có `schema.prisma`. Đừng thêm ở task này — `prisma db push` sẽ lỗi vì chưa có schema.

- [ ] **Step 4: Tạo `server/.env.example`**

```
DATABASE_URL="file:./data.db"
PORT=3000
NTFY_BASE_URL="https://ntfy.sh"
```

- [ ] **Step 5: Cài dependencies**

Chạy: `npm install`
Kỳ vọng: tạo `node_modules/` và `package-lock.json`, không có lỗi.

- [ ] **Step 6: Viết test cho `time.ts` (fail trước)**

Tạo `server/test/lib/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  isValidIsoDate,
  addDays,
  daysBetween,
  enumerateDates,
  startOfWeekMonday,
  todayIso,
} from '../../src/lib/time.js';

describe('isValidIsoDate', () => {
  it('chấp nhận ngày hợp lệ', () => {
    expect(isValidIsoDate('2026-08-06')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true); // năm nhuận
  });

  it('từ chối sai định dạng', () => {
    expect(isValidIsoDate('2026-8-6')).toBe(false);
    expect(isValidIsoDate('06/08/2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('từ chối ngày không tồn tại', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2025-02-29')).toBe(false); // không nhuận
  });
});

describe('addDays', () => {
  it('cộng và trừ ngày', () => {
    expect(addDays('2026-08-06', 1)).toBe('2026-08-07');
    expect(addDays('2026-08-06', -6)).toBe('2026-07-31');
  });

  it('vượt ranh giới tháng và năm', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('xử lý năm nhuận', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });
});

describe('daysBetween', () => {
  it('đếm số ngày giữa hai mốc', () => {
    expect(daysBetween('2026-08-01', '2026-08-06')).toBe(5);
    expect(daysBetween('2026-08-06', '2026-08-06')).toBe(0);
  });

  it('trả số âm khi to sớm hơn from', () => {
    expect(daysBetween('2026-08-06', '2026-08-01')).toBe(-5);
  });
});

describe('enumerateDates', () => {
  it('liệt kê đủ hai đầu mút', () => {
    expect(enumerateDates('2026-08-04', '2026-08-07')).toEqual([
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
  });

  it('trả một phần tử khi from === to', () => {
    expect(enumerateDates('2026-08-06', '2026-08-06')).toEqual(['2026-08-06']);
  });

  it('trả mảng rỗng khi from > to', () => {
    expect(enumerateDates('2026-08-07', '2026-08-06')).toEqual([]);
  });
});

describe('startOfWeekMonday', () => {
  it('thứ Hai trả về chính nó', () => {
    // 2026-08-03 là thứ Hai
    expect(startOfWeekMonday('2026-08-03')).toBe('2026-08-03');
  });

  it('chủ Nhật lùi về thứ Hai tuần đó', () => {
    // 2026-08-09 là Chủ Nhật
    expect(startOfWeekMonday('2026-08-09')).toBe('2026-08-03');
  });

  it('giữa tuần lùi đúng', () => {
    // 2026-08-06 là thứ Năm
    expect(startOfWeekMonday('2026-08-06')).toBe('2026-08-03');
  });
});

describe('todayIso', () => {
  it('trả chuỗi đúng định dạng', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidIsoDate(todayIso())).toBe(true);
  });
});
```

- [ ] **Step 7: Chạy test để xác nhận fail**

Chạy: `npm test -- time`
Kỳ vọng: FAIL — `Cannot find module '../src/time.js'`

- [ ] **Step 8: Viết `server/src/lib/time.ts`**

```ts
export const TZ = 'Asia/Ho_Chi_Minh';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Ngày hôm nay theo TZ, dạng "YYYY-MM-DD". */
export function todayIso(): string {
  // 'en-CA' cho ra đúng định dạng YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Chuỗi có đúng định dạng và là ngày thật (bắt 2026-02-30, 2026-13-01). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  // Date.parse chấp nhận vài chuỗi bị "cuộn" — so lại để loại
  return new Date(ms).toISOString().slice(0, 10) === value;
}

function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * MS_PER_DAY);
}

/** Số ngày từ fromIso đến toIso. Âm nếu toIso sớm hơn. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / MS_PER_DAY);
}

/** Mọi ngày lịch trong [fromIso, toIso]. Rỗng nếu fromIso > toIso. */
export function enumerateDates(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const total = daysBetween(fromIso, toIso);
  for (let i = 0; i <= total; i++) out.push(addDays(fromIso, i));
  return out;
}

/** Thứ Hai của tuần chứa iso. */
export function startOfWeekMonday(iso: string): string {
  const dow = new Date(toUtcMs(iso)).getUTCDay(); // 0 = CN, 1 = T2
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(iso, -back);
}
```

- [ ] **Step 9: Chạy test để xác nhận pass**

Chạy: `npm test -- time`
Kỳ vọng: PASS, toàn bộ test trong `time.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/vitest.config.ts server/.env.example server/src/lib/time.ts server/test/lib/time.test.ts
git commit -m "feat(server): scaffold + date helpers for YYYY-MM-DD arithmetic"
```

---

## Task 2: Prisma schema + `db.ts` + `env.ts`

**Files:**
- Create: `server/prisma/schema.prisma`, `server/src/lib/db.ts`, `server/src/config/env.ts`
- Test: `server/test/db.test.ts`

**Interfaces:**
- Consumes: (không)
- Produces:
  - `src/lib/db.ts` → `prisma: PrismaClient`
  - `src/config/env.ts` → `env: { DATABASE_URL: string; PORT: number; NTFY_BASE_URL: string }`
  - Prisma models: `BodyLog`, `Meal`, `Goal`, `Reminder` (trường như dưới)

- [ ] **Step 1: Tạo `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model BodyLog {
  id        String   @id @default(cuid())
  date      String   @unique
  weightKg  Float?
  waistCm   Float?
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Meal {
  id        String   @id @default(cuid())
  date      String
  slot      String
  name      String
  calories  Int
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([date])
}

model Goal {
  id                 String   @id @default("singleton")
  targetWeightKg     Float?
  targetDate         String?
  dailyCalorieTarget Int?
  updatedAt          DateTime @updatedAt
}

model Reminder {
  id        String   @id @default(cuid())
  kind      String   @unique
  timeOfDay String
  enabled   Boolean  @default(false)
  ntfyTopic String?
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Tạo `server/.env` từ mẫu**

```bash
cp .env.example .env
```

- [ ] **Step 3: Sinh client và tạo DB**

Chạy: `npx prisma db push`
Kỳ vọng: in ra `Your database is now in sync with your Prisma schema`, tạo file `prisma/data.db`.

- [ ] **Step 4: Viết `server/src/config/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NTFY_BASE_URL: z.url().default('https://ntfy.sh'),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data.db',
  PORT: process.env.PORT,
  NTFY_BASE_URL: process.env.NTFY_BASE_URL,
});
```

- [ ] **Step 5: Viết `server/src/lib/db.ts`**

```ts
import { PrismaClient } from '../generated/prisma/client.js';

export const prisma = new PrismaClient();
```

- [ ] **Step 5b: Tạo `server/test/globalSetup.ts` và nối vào vitest**

Đến bước này `schema.prisma` đã tồn tại nên `prisma db push` chạy được. Tạo `server/test/globalSetup.ts`:

```ts
import { execSync } from 'node:child_process';

/** Dựng schema cho DB test trước khi chạy suite. Chạy một lần cho cả run. */
export default function setup(): void {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
}
```

Rồi thêm dòng `globalSetup` vào `server/vitest.config.ts` (ngay sau `env`):

```ts
    env: { DATABASE_URL: 'file:./test.db' },
    globalSetup: ['./test/globalSetup.ts'],
```

Prisma resolve `file:./test.db` tương đối với thư mục `prisma/`, nên file test nằm cạnh `data.db` và đã được `.gitignore` che qua pattern `*.db`.

- [ ] **Step 6: Viết test xác minh schema (fail trước)**

Tạo `server/test/db.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db.js';

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('BodyLog', () => {
  it('date là unique — không tạo được hai bản ghi cùng ngày', async () => {
    await prisma.bodyLog.create({ data: { date: '2026-08-06', weightKg: 72.4 } });
    await expect(
      prisma.bodyLog.create({ data: { date: '2026-08-06', weightKg: 72.5 } }),
    ).rejects.toThrow();
  });

  it('weightKg và waistCm đều nullable', async () => {
    const row = await prisma.bodyLog.create({ data: { date: '2026-08-06' } });
    expect(row.weightKg).toBeNull();
    expect(row.waistCm).toBeNull();
  });
});

describe('Meal', () => {
  it('cho phép nhiều bữa trong cùng một ngày', async () => {
    await prisma.meal.create({
      data: { date: '2026-08-06', slot: 'breakfast', name: 'Phở', calories: 450 },
    });
    await prisma.meal.create({
      data: { date: '2026-08-06', slot: 'lunch', name: 'Cơm tấm', calories: 700 },
    });
    expect(await prisma.meal.count({ where: { date: '2026-08-06' } })).toBe(2);
  });
});

describe('Reminder', () => {
  it('kind là unique', async () => {
    await prisma.reminder.create({ data: { kind: 'weigh_in', timeOfDay: '07:00' } });
    await expect(
      prisma.reminder.create({ data: { kind: 'weigh_in', timeOfDay: '08:00' } }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Chạy test**

Chạy: `npm test -- db`
Kỳ vọng: PASS (schema đã push ở Step 3 nên test chạy được ngay).

- [ ] **Step 8: Commit**

```bash
git add server/prisma/schema.prisma server/src/lib/db.ts server/src/config/env.ts server/test/db.test.ts server/test/globalSetup.ts server/vitest.config.ts
git commit -m "feat(server): prisma schema, db client, env validation"
```

---

## Task 3: `stats.ts` — trung bình trượt 7 ngày

**Files:**
- Create: `server/src/shared/stats/`
- Test: `server/test/shared/stats/`

**Interfaces:**
- Consumes: `src/lib/time.ts` → `addDays`, `daysBetween`
- Produces: từ `src/shared/stats/` —
  - `interface DailyValue { date: string; value: number | null }`
  - `movingAverage7(series: DailyValue[]): DailyValue[]` — trả mảng **cùng độ dài, cùng thứ tự, cùng `date`**; `value` là MA7 hoặc `null`.

- [ ] **Step 1: Viết test (fail trước)**

Tạo `server/test/shared/stats/`:

```ts
import { describe, it, expect } from 'vitest';
import { movingAverage7, type DailyValue } from '../../../src/shared/stats/index.js';

const d = (date: string, value: number | null): DailyValue => ({ date, value });

describe('movingAverage7', () => {
  it('trả null khi cửa sổ chỉ có 1 giá trị', () => {
    const out = movingAverage7([d('2026-08-01', 70)]);
    expect(out).toEqual([{ date: '2026-08-01', value: null }]);
  });

  it('trả null khi cửa sổ không có giá trị nào', () => {
    const out = movingAverage7([d('2026-08-01', null), d('2026-08-02', null)]);
    expect(out.map((x) => x.value)).toEqual([null, null]);
  });

  it('tính trung bình từ điểm thứ hai trở đi', () => {
    const out = movingAverage7([d('2026-08-01', 70), d('2026-08-02', 72)]);
    expect(out[0]!.value).toBeNull();
    expect(out[1]!.value).toBe(71);
  });

  it('cửa sổ là 7 ngày lịch, không phải 7 điểm dữ liệu', () => {
    // 2026-08-01 và 2026-08-10 cách nhau 9 ngày > cửa sổ 7 ngày
    const out = movingAverage7([
      d('2026-08-01', 100),
      d('2026-08-02', null),
      d('2026-08-03', null),
      d('2026-08-04', null),
      d('2026-08-05', null),
      d('2026-08-06', null),
      d('2026-08-07', null),
      d('2026-08-08', null),
      d('2026-08-09', null),
      d('2026-08-10', 200),
    ]);
    // Tại 2026-08-10 cửa sổ là [08-04, 08-10] — chỉ có mỗi giá trị 200
    expect(out[9]!.value).toBeNull();
  });

  it('bỏ qua ngày trống trong cửa sổ, không nội suy', () => {
    const out = movingAverage7([
      d('2026-08-01', 70),
      d('2026-08-02', null),
      d('2026-08-03', 74),
    ]);
    // Tại 08-03 cửa sổ [07-28, 08-03] có 70 và 74 → 72
    expect(out[2]!.value).toBe(72);
  });

  it('cửa sổ trượt bỏ giá trị quá cũ', () => {
    const series: DailyValue[] = [
      d('2026-08-01', 10),
      d('2026-08-02', 20),
      d('2026-08-03', 30),
      d('2026-08-04', 40),
      d('2026-08-05', 50),
      d('2026-08-06', 60),
      d('2026-08-07', 70),
      d('2026-08-08', 80),
    ];
    const out = movingAverage7(series);
    // Tại 08-07 cửa sổ [08-01, 08-07] = 10..70 → 40
    expect(out[6]!.value).toBe(40);
    // Tại 08-08 cửa sổ [08-02, 08-08] = 20..80 → 50 (đã bỏ 10)
    expect(out[7]!.value).toBe(50);
  });

  it('giữ nguyên thứ tự và độ dài đầu vào', () => {
    const series = [d('2026-08-01', 1), d('2026-08-02', 2), d('2026-08-03', 3)];
    const out = movingAverage7(series);
    expect(out).toHaveLength(3);
    expect(out.map((x) => x.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });

  it('trả mảng rỗng cho đầu vào rỗng', () => {
    expect(movingAverage7([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Chạy: `npm test -- stats`
Kỳ vọng: FAIL — `Cannot find module '../src/stats.js'`

- [ ] **Step 3: Viết `server/src/shared/stats/`**

```ts
import { addDays } from './time.js';

export interface DailyValue {
  date: string;
  value: number | null;
}

/** Số giá trị tối thiểu trong cửa sổ để MA7 có nghĩa. */
const MIN_WINDOW_SAMPLES = 2;
const WINDOW_DAYS = 7;

/**
 * Trung bình trượt 7 ngày lịch. Với mỗi phần tử tại ngày d, lấy trung bình
 * các giá trị khác null có ngày nằm trong [d-6, d]. Dưới 2 giá trị → null.
 * Trả về mảng cùng độ dài, cùng thứ tự, cùng date.
 */
export function movingAverage7(series: DailyValue[]): DailyValue[] {
  const byDate = new Map<string, number>();
  for (const point of series) {
    if (point.value !== null) byDate.set(point.date, point.value);
  }

  return series.map((point) => {
    const windowStart = addDays(point.date, -(WINDOW_DAYS - 1));
    let sum = 0;
    let count = 0;
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const value = byDate.get(addDays(windowStart, i));
      if (value !== undefined) {
        sum += value;
        count += 1;
      }
    }
    return {
      date: point.date,
      value: count >= MIN_WINDOW_SAMPLES ? sum / count : null,
    };
  });
}

/** Tra MA7 tại một ngày cụ thể trong chuỗi đã tính. Không có → null. */
export function valueAt(series: DailyValue[], date: string): number | null {
  return series.find((point) => point.date === date)?.value ?? null;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Chạy: `npm test -- stats`
Kỳ vọng: PASS, 8 test.

- [ ] **Step 5: Commit**

```bash
git add server/src/shared/stats/ server/test/shared/stats/
git commit -m "feat(stats): 7-day calendar-window moving average"
```

---

## Task 4: `stats.ts` — tốc độ thay đổi và tiến độ mục tiêu

**Files:**
- Modify: `server/src/shared/stats/`
- Modify: `server/test/shared/stats/` (thêm describe block)

**Interfaces:**
- Consumes: `movingAverage7`, `valueAt`, `DailyValue` (Task 3); `daysBetween` (Task 1)
- Produces:
  - `currentRateKgPerWeek(ma7: DailyValue[], todayIsoDate: string): number | null`
  - `requiredRateKgPerWeek(currentMa7: number | null, targetWeightKg: number | null, targetDate: string | null, todayIsoDate: string): number | null`
  - `isOnTrack(currentRate: number | null, requiredRate: number | null): boolean | null`
  - `remainingKg(currentMa7: number | null, targetWeightKg: number | null): number | null`

- [ ] **Step 1: Thêm test vào `server/test/shared/stats/`**

Thêm vào cuối file (giữ nguyên import cũ, mở rộng dòng import):

```ts
import {
  movingAverage7,
  currentRateKgPerWeek,
  requiredRateKgPerWeek,
  isOnTrack,
  remainingKg,
  type DailyValue,
} from '../../../src/shared/stats/index.js';

describe('currentRateKgPerWeek', () => {
  /** Chuỗi 21 ngày kết thúc ở endDate, mỗi ngày giảm `perDay` kg. */
  function decliningSeries(endDate: string, startWeight: number, perDay: number): DailyValue[] {
    const out: DailyValue[] = [];
    for (let i = 20; i >= 0; i--) {
      const date = new Date(Date.parse(`${endDate}T00:00:00Z`) - i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      out.push({ date, value: startWeight - (20 - i) * perDay });
    }
    return out;
  }

  it('tính tốc độ kg/tuần từ chênh lệch MA7 qua 14 ngày', () => {
    // giảm 0.1 kg/ngày = 0.7 kg/tuần
    const ma7 = movingAverage7(decliningSeries('2026-08-20', 80, 0.1));
    const rate = currentRateKgPerWeek(ma7, '2026-08-20');
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(-0.7, 5);
  });

  it('trả null khi thiếu MA7 ở ngày hôm nay', () => {
    const ma7 = movingAverage7([{ date: '2026-08-20', value: 80 }]);
    expect(currentRateKgPerWeek(ma7, '2026-08-20')).toBeNull();
  });

  it('trả null khi thiếu MA7 ở mốc 14 ngày trước', () => {
    const ma7 = movingAverage7([
      { date: '2026-08-19', value: 80 },
      { date: '2026-08-20', value: 79 },
    ]);
    // Có MA7 tại 08-20 nhưng không có tại 08-06
    expect(currentRateKgPerWeek(ma7, '2026-08-20')).toBeNull();
  });

  it('trả 0 khi cân nặng đứng yên', () => {
    const ma7 = movingAverage7(decliningSeries('2026-08-20', 80, 0));
    expect(currentRateKgPerWeek(ma7, '2026-08-20')).toBeCloseTo(0, 5);
  });
});

describe('requiredRateKgPerWeek', () => {
  it('tính tốc độ cần thiết để giảm cân đúng hạn', () => {
    // cần giảm 4 kg trong 8 tuần (56 ngày) → -0.5 kg/tuần
    const rate = requiredRateKgPerWeek(72, 68, '2026-10-01', '2026-08-06');
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(-0.5, 5);
  });

  it('dương khi mục tiêu là tăng cân', () => {
    const rate = requiredRateKgPerWeek(60, 64, '2026-10-01', '2026-08-06');
    expect(rate!).toBeGreaterThan(0);
  });

  it('trả null khi chưa đặt mục tiêu', () => {
    expect(requiredRateKgPerWeek(72, null, '2026-10-01', '2026-08-06')).toBeNull();
    expect(requiredRateKgPerWeek(72, 68, null, '2026-08-06')).toBeNull();
  });

  it('trả null khi MA7 hiện tại là null', () => {
    expect(requiredRateKgPerWeek(null, 68, '2026-10-01', '2026-08-06')).toBeNull();
  });

  it('trả null khi hạn đã qua hoặc là hôm nay', () => {
    expect(requiredRateKgPerWeek(72, 68, '2026-08-01', '2026-08-06')).toBeNull();
    expect(requiredRateKgPerWeek(72, 68, '2026-08-06', '2026-08-06')).toBeNull();
  });
});

describe('isOnTrack', () => {
  it('mục tiêu giảm cân: đạt khi giảm nhanh bằng hoặc hơn mức cần', () => {
    expect(isOnTrack(-0.6, -0.5)).toBe(true);
    expect(isOnTrack(-0.5, -0.5)).toBe(true);
    expect(isOnTrack(-0.3, -0.5)).toBe(false);
    expect(isOnTrack(0.2, -0.5)).toBe(false);
  });

  it('mục tiêu tăng cân: đạt khi tăng nhanh bằng hoặc hơn mức cần', () => {
    expect(isOnTrack(0.6, 0.5)).toBe(true);
    expect(isOnTrack(0.3, 0.5)).toBe(false);
    expect(isOnTrack(-0.2, 0.5)).toBe(false);
  });

  it('đã ở mục tiêu (requiredRate = 0) thì luôn đạt', () => {
    expect(isOnTrack(0.1, 0)).toBe(true);
    expect(isOnTrack(-0.1, 0)).toBe(true);
  });

  it('trả null khi thiếu dữ liệu', () => {
    expect(isOnTrack(null, -0.5)).toBeNull();
    expect(isOnTrack(-0.5, null)).toBeNull();
  });
});

describe('remainingKg', () => {
  it('luôn dương, biểu thị độ lớn', () => {
    expect(remainingKg(72.9, 68)).toBeCloseTo(4.9, 5);
    expect(remainingKg(60, 64)).toBeCloseTo(4, 5);
  });

  it('trả 0 khi đã đạt mục tiêu', () => {
    expect(remainingKg(68, 68)).toBe(0);
  });

  it('trả null khi thiếu dữ liệu', () => {
    expect(remainingKg(null, 68)).toBeNull();
    expect(remainingKg(72, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Chạy: `npm test -- stats`
Kỳ vọng: FAIL — `currentRateKgPerWeek is not a function` (hoặc lỗi import tương đương).

- [ ] **Step 3: Thêm implementation vào `server/src/shared/stats/`**

Sửa dòng import đầu file thành `import { addDays, daysBetween } from './time.js';` rồi thêm vào cuối file:

```ts
const RATE_LOOKBACK_DAYS = 14;
const DAYS_PER_WEEK = 7;

/**
 * Tốc độ thay đổi cân nặng hiện tại, kg/tuần. Âm = đang giảm.
 * Dùng chênh lệch MA7 giữa hôm nay và 14 ngày trước, chia cho 2 tuần.
 * Null nếu thiếu MA7 ở một trong hai đầu.
 */
export function currentRateKgPerWeek(
  ma7: DailyValue[],
  todayIsoDate: string,
): number | null {
  const now = valueAt(ma7, todayIsoDate);
  const past = valueAt(ma7, addDays(todayIsoDate, -RATE_LOOKBACK_DAYS));
  if (now === null || past === null) return null;
  return (now - past) / (RATE_LOOKBACK_DAYS / DAYS_PER_WEEK);
}

/**
 * Tốc độ cần thiết để đạt mục tiêu đúng hạn, kg/tuần.
 * Null nếu chưa đặt mục tiêu, hạn không còn ở tương lai, hoặc MA7 hiện tại null.
 */
export function requiredRateKgPerWeek(
  currentMa7: number | null,
  targetWeightKg: number | null,
  targetDate: string | null,
  todayIsoDate: string,
): number | null {
  if (currentMa7 === null || targetWeightKg === null || targetDate === null) return null;
  const daysLeft = daysBetween(todayIsoDate, targetDate);
  if (daysLeft <= 0) return null;
  return (targetWeightKg - currentMa7) / (daysLeft / DAYS_PER_WEEK);
}

/**
 * Đang đúng tiến độ chưa. Null nếu thiếu dữ liệu để kết luận.
 * requiredRate = 0 nghĩa là đã ở mục tiêu → luôn true.
 */
export function isOnTrack(
  currentRate: number | null,
  requiredRate: number | null,
): boolean | null {
  if (currentRate === null || requiredRate === null) return null;
  if (requiredRate === 0) return true;
  return requiredRate < 0 ? currentRate <= requiredRate : currentRate >= requiredRate;
}

/** Khoảng cách còn lại tới mục tiêu, luôn dương. Null nếu thiếu dữ liệu. */
export function remainingKg(
  currentMa7: number | null,
  targetWeightKg: number | null,
): number | null {
  if (currentMa7 === null || targetWeightKg === null) return null;
  return Math.abs(targetWeightKg - currentMa7);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Chạy: `npm test -- stats`
Kỳ vọng: PASS, toàn bộ test.

- [ ] **Step 5: Commit**

```bash
git add server/src/shared/stats/ server/test/shared/stats/
git commit -m "feat(stats): current/required rate and goal progress"
```

---

## Task 5: `stats.ts` — tổng hợp theo tuần

**Files:**
- Modify: `server/src/shared/stats/`
- Modify: `server/test/shared/stats/`

**Interfaces:**
- Consumes: `startOfWeekMonday` (Task 1)
- Produces:
  - `interface DayInput { date: string; weightKg: number | null; totalCalories: number; mealCount: number }`
  - `interface WeekSummary { weekStart: string; avgCalories: number | null; avgWeightKg: number | null }`
  - `weeklySummaries(days: DayInput[]): WeekSummary[]` — sắp xếp tăng dần theo `weekStart`

- [ ] **Step 1: Thêm test vào `server/test/shared/stats/`**

Mở rộng import thêm `weeklySummaries` và `type DayInput`, rồi thêm:

```ts
describe('weeklySummaries', () => {
  const day = (
    date: string,
    totalCalories: number,
    mealCount: number,
    weightKg: number | null = null,
  ): DayInput => ({ date, totalCalories, mealCount, weightKg });

  it('nhóm theo tuần bắt đầu thứ Hai', () => {
    // 2026-08-03 T2 ... 2026-08-09 CN, rồi 2026-08-10 T2 sang tuần mới
    const out = weeklySummaries([
      day('2026-08-03', 2000, 3),
      day('2026-08-09', 1800, 3),
      day('2026-08-10', 1900, 3),
    ]);
    expect(out.map((w) => w.weekStart)).toEqual(['2026-08-03', '2026-08-10']);
  });

  it('avgCalories bỏ qua ngày không ghi bữa nào', () => {
    const out = weeklySummaries([
      day('2026-08-03', 2000, 3),
      day('2026-08-04', 0, 0), // quên ghi — không được kéo trung bình xuống
      day('2026-08-05', 1600, 2),
    ]);
    expect(out[0]!.avgCalories).toBe(1800); // (2000 + 1600) / 2
  });

  it('avgCalories là null khi cả tuần không ghi bữa nào', () => {
    const out = weeklySummaries([day('2026-08-03', 0, 0), day('2026-08-04', 0, 0)]);
    expect(out[0]!.avgCalories).toBeNull();
  });

  it('avgWeightKg dùng số đo thô, bỏ qua ngày không cân', () => {
    const out = weeklySummaries([
      day('2026-08-03', 0, 0, 70),
      day('2026-08-04', 0, 0, null),
      day('2026-08-05', 0, 0, 72),
    ]);
    expect(out[0]!.avgWeightKg).toBe(71);
  });

  it('avgWeightKg là null khi cả tuần không cân lần nào', () => {
    const out = weeklySummaries([day('2026-08-03', 2000, 3, null)]);
    expect(out[0]!.avgWeightKg).toBeNull();
  });

  it('trả mảng rỗng cho đầu vào rỗng', () => {
    expect(weeklySummaries([])).toEqual([]);
  });

  it('sắp xếp tăng dần theo weekStart kể cả khi đầu vào lộn xộn', () => {
    const out = weeklySummaries([day('2026-08-17', 1000, 1), day('2026-08-03', 1000, 1)]);
    expect(out.map((w) => w.weekStart)).toEqual(['2026-08-03', '2026-08-17']);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Chạy: `npm test -- stats`
Kỳ vọng: FAIL — `weeklySummaries is not a function`

- [ ] **Step 3: Thêm implementation vào `server/src/shared/stats/`**

Sửa dòng import đầu file thành `import { addDays, daysBetween, startOfWeekMonday } from './time.js';` rồi thêm vào cuối:

```ts
export interface DayInput {
  date: string;
  weightKg: number | null;
  totalCalories: number;
  mealCount: number;
}

export interface WeekSummary {
  weekStart: string;
  avgCalories: number | null;
  avgWeightKg: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Gộp theo tuần (bắt đầu thứ Hai).
 * avgCalories chỉ tính trên ngày có ít nhất một bữa được ghi — ngày quên ghi
 * không được coi là 0 calo, vì như vậy sẽ kéo trung bình xuống sai lệch.
 * avgWeightKg dùng số đo thô (không phải MA7).
 */
export function weeklySummaries(days: DayInput[]): WeekSummary[] {
  const buckets = new Map<string, DayInput[]>();
  for (const day of days) {
    const key = startOfWeekMonday(day.date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(day);
    else buckets.set(key, [day]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, items]) => ({
      weekStart,
      avgCalories: average(
        items.filter((d) => d.mealCount > 0).map((d) => d.totalCalories),
      ),
      avgWeightKg: average(
        items.filter((d) => d.weightKg !== null).map((d) => d.weightKg as number),
      ),
    }));
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Chạy: `npm test -- stats`
Kỳ vọng: PASS, toàn bộ test trong file.

- [ ] **Step 5: Commit**

```bash
git add server/src/shared/stats/ server/test/shared/stats/
git commit -m "feat(stats): weekly summaries with Monday week start"
```

---

## Task 6: Zod schemas + express app + xử lý lỗi

**Files:**
- Create: `server/src/shared/validation/commonSchemas.ts`, `server/src/shared/errors/errorHandler.ts`, `server/src/app.ts`, `server/src/server.ts`
- Test: `server/test/app.test.ts`

**Interfaces:**
- Consumes: `isValidIsoDate`, `todayIso` (Task 1); `env` (Task 2)
- Produces:
  - `src/shared/errors/errorHandler.ts` → `class NotFoundError extends Error`, `errorHandler: ErrorRequestHandler`
  - `src/app.ts` → `createApp(): express.Express`
  - `src/shared/validation/commonSchemas.ts` → `isoDateSchema`, `pastOrTodayDateSchema`, `rangeQuerySchema`, `MEAL_SLOTS`

- [ ] **Step 1: Viết `server/src/shared/validation/commonSchemas.ts`**

```ts
import { z } from 'zod';
import { isValidIsoDate, todayIso, daysBetween } from './time.js';

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const MAX_RANGE_DAYS = 730;

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, { message: 'Ngày phải đúng định dạng YYYY-MM-DD và có thật' });

export const pastOrTodayDateSchema = isoDateSchema.refine(
  (value) => value <= todayIso(),
  { message: 'Không được ghi cho ngày ở tương lai' },
);

export const rangeQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((v) => v.from <= v.to, {
    message: 'from phải nhỏ hơn hoặc bằng to',
    path: ['from'],
  })
  .refine((v) => daysBetween(v.from, v.to) <= MAX_RANGE_DAYS, {
    message: `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày`,
    path: ['to'],
  });
```

- [ ] **Step 2: Viết `server/src/shared/errors/errorHandler.ts`**

```ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class NotFoundError extends Error {
  constructor(message = 'Không tìm thấy') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        fields: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ' },
  });
};
```

- [ ] **Step 3: Viết `server/src/app.ts`**

```ts
import express from 'express';
import { errorHandler, NotFoundError } from './errors.js';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Các router sẽ được mount ở đây trong các task sau.

  app.use((_req, _res, next) => {
    next(new NotFoundError('Endpoint không tồn tại'));
  });
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 4: Viết `server/src/server.ts`**

```ts
import { createApp } from './app.js';
import { env } from './env.js';

const app = createApp();

app.listen(env.PORT, '127.0.0.1', () => {
  console.log(`Lean server đang chạy tại http://localhost:${env.PORT}`);
});
```

Bind `127.0.0.1` chứ không phải `0.0.0.0`: app không có auth, không được phơi ra mạng LAN.

- [ ] **Step 5: Viết test (fail trước)**

Tạo `server/test/app.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';

const app = createApp();

describe('app', () => {
  it('GET /api/health trả ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('endpoint không tồn tại trả 404 đúng hình dạng', async () => {
    const res = await request(app).get('/api/khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
```

- [ ] **Step 6: Chạy test để xác nhận fail rồi pass**

Chạy: `npm test -- app`
Kỳ vọng: lần đầu FAIL (chưa có `src/app.ts` nếu chạy trước Step 3), sau khi có đủ file → PASS 2 test.

- [ ] **Step 7: Kiểm tra server chạy thật**

Chạy: `npm run dev`
Mở terminal khác: `curl -s http://localhost:3000/api/health`
Kỳ vọng: `{"ok":true}`. Dừng server bằng Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add server/src/shared/validation/commonSchemas.ts server/src/shared/errors/errorHandler.ts server/src/app.ts server/src/server.ts server/test/app.test.ts
git commit -m "feat(server): express app, zod schemas, error handling"
```

---

## Task 7: Routes `/api/body-logs`

**Files:**
- Create: `server/src/features/bodyLogs/`
- Modify: `server/src/app.ts` (mount router)
- Test: `server/test/features/bodyLogs/bodyLogs.controller.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `pastOrTodayDateSchema`/`rangeQuerySchema` (Task 6), `NotFoundError` (Task 6)
- Produces: `src/features/bodyLogs/` → `export const bodyLogsRouter: express.Router`, mount tại `/api/body-logs`

Endpoints: `GET /:date` · `PUT /:date` (upsert) · `DELETE /:date` · `GET /?from=&to=`

- [ ] **Step 1: Viết test (fail trước)**

Tạo `server/test/features/bodyLogs/bodyLogs.controller.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';

const app = createApp();

beforeEach(async () => {
  await prisma.bodyLog.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PUT /api/body-logs/:date', () => {
  it('tạo mới rồi cập nhật cùng ngày, không sinh bản ghi thứ hai', async () => {
    await request(app)
      .put('/api/body-logs/2026-08-06')
      .send({ weightKg: 72.4, waistCm: 88 })
      .expect(200);

    const res = await request(app)
      .put('/api/body-logs/2026-08-06')
      .send({ weightKg: 72.1 })
      .expect(200);

    expect(res.body.weightKg).toBe(72.1);
    expect(await prisma.bodyLog.count()).toBe(1);
  });

  it('trường vắng mặt giữ nguyên giá trị cũ', async () => {
    await request(app)
      .put('/api/body-logs/2026-08-06')
      .send({ weightKg: 72.4, waistCm: 88 })
      .expect(200);

    const res = await request(app)
      .put('/api/body-logs/2026-08-06')
      .send({ weightKg: 72.1 })
      .expect(200);

    expect(res.body.waistCm).toBe(88);
  });

  it('gửi null thì xóa giá trị', async () => {
    await request(app)
      .put('/api/body-logs/2026-08-06')
      .send({ weightKg: 72.4, waistCm: 88 })
      .expect(200);

    const res = await request(app)
      .put('/api/body-logs/2026-08-06')
      .send({ waistCm: null })
      .expect(200);

    expect(res.body.waistCm).toBeNull();
    expect(res.body.weightKg).toBe(72.4);
  });

  it('từ chối cân nặng âm', async () => {
    const res = await request(app)
      .put('/api/body-logs/2026-08-06')
      .send({ weightKg: -5 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.some((f: any) => f.path === 'weightKg')).toBe(true);
  });

  it('từ chối cân nặng phi lý', async () => {
    await request(app).put('/api/body-logs/2026-08-06').send({ weightKg: 900 }).expect(400);
  });

  it('từ chối vòng bụng âm', async () => {
    await request(app).put('/api/body-logs/2026-08-06').send({ waistCm: -1 }).expect(400);
  });

  it('từ chối ngày ở tương lai', async () => {
    await request(app).put('/api/body-logs/2999-01-01').send({ weightKg: 70 }).expect(400);
  });

  it('từ chối ngày sai định dạng', async () => {
    await request(app).put('/api/body-logs/06-08-2026').send({ weightKg: 70 }).expect(400);
  });
});

describe('GET /api/body-logs/:date', () => {
  it('trả bản ghi đã lưu', async () => {
    await request(app).put('/api/body-logs/2026-08-06').send({ weightKg: 72.4 });
    const res = await request(app).get('/api/body-logs/2026-08-06').expect(200);
    expect(res.body.date).toBe('2026-08-06');
    expect(res.body.weightKg).toBe(72.4);
  });

  it('trả 404 khi ngày chưa có dữ liệu', async () => {
    const res = await request(app).get('/api/body-logs/2026-08-06').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/body-logs/:date', () => {
  it('xóa bản ghi', async () => {
    await request(app).put('/api/body-logs/2026-08-06').send({ weightKg: 72.4 });
    await request(app).delete('/api/body-logs/2026-08-06').expect(204);
    expect(await prisma.bodyLog.count()).toBe(0);
  });

  it('trả 404 khi không có gì để xóa', async () => {
    await request(app).delete('/api/body-logs/2026-08-06').expect(404);
  });
});

describe('GET /api/body-logs?from=&to=', () => {
  it('trả danh sách tăng dần theo ngày', async () => {
    await request(app).put('/api/body-logs/2026-08-05').send({ weightKg: 73 });
    await request(app).put('/api/body-logs/2026-08-03').send({ weightKg: 74 });

    const res = await request(app)
      .get('/api/body-logs?from=2026-08-01&to=2026-08-06')
      .expect(200);

    expect(res.body.map((r: any) => r.date)).toEqual(['2026-08-03', '2026-08-05']);
  });

  it('từ chối from > to', async () => {
    await request(app).get('/api/body-logs?from=2026-08-06&to=2026-08-01').expect(400);
  });

  it('từ chối khoảng quá 730 ngày', async () => {
    await request(app).get('/api/body-logs?from=2020-01-01&to=2026-01-01').expect(400);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Chạy: `npm test -- bodyLogs`
Kỳ vọng: FAIL — mọi request trả 404 vì router chưa được mount.

- [ ] **Step 3: Viết `server/src/features/bodyLogs/`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';
import { pastOrTodayDateSchema, rangeQuerySchema } from '../schemas.js';

const upsertBodySchema = z.object({
  weightKg: z.number().positive().lt(500).nullable().optional(),
  waistCm: z.number().positive().lt(300).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export const bodyLogsRouter = Router();

bodyLogsRouter.get('/', async (req, res) => {
  const { from, to } = rangeQuerySchema.parse(req.query);
  const rows = await prisma.bodyLog.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });
  res.json(rows);
});

bodyLogsRouter.get('/:date', async (req, res) => {
  const date = pastOrTodayDateSchema.parse(req.params.date);
  const row = await prisma.bodyLog.findUnique({ where: { date } });
  if (!row) throw new NotFoundError(`Chưa có số đo cho ngày ${date}`);
  res.json(row);
});

bodyLogsRouter.put('/:date', async (req, res) => {
  const date = pastOrTodayDateSchema.parse(req.params.date);
  const patch = upsertBodySchema.parse(req.body);

  // Trường vắng mặt = giữ nguyên. Gửi null = xóa giá trị.
  const row = await prisma.bodyLog.upsert({
    where: { date },
    create: {
      date,
      weightKg: patch.weightKg ?? null,
      waistCm: patch.waistCm ?? null,
      note: patch.note ?? null,
    },
    update: patch,
  });
  res.json(row);
});

bodyLogsRouter.delete('/:date', async (req, res) => {
  const date = pastOrTodayDateSchema.parse(req.params.date);
  const existing = await prisma.bodyLog.findUnique({ where: { date } });
  if (!existing) throw new NotFoundError(`Chưa có số đo cho ngày ${date}`);
  await prisma.bodyLog.delete({ where: { date } });
  res.status(204).end();
});
```

`update: patch` hoạt động đúng vì Prisma bỏ qua key `undefined` và ghi `null` cho key có giá trị `null` — chính là ngữ nghĩa spec yêu cầu.

- [ ] **Step 4: Mount router trong `server/src/app.ts`**

Thay dòng comment `// Các router sẽ được mount ở đây trong các task sau.` bằng:

```ts
  app.use('/api/body-logs', bodyLogsRouter);
```

Và thêm import ở đầu file:

```ts
import { bodyLogsRouter } from './routes/bodyLogs.js';
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Chạy: `npm test -- bodyLogs`
Kỳ vọng: PASS, 14 test.

- [ ] **Step 6: Commit**

```bash
git add server/src/features/bodyLogs/ server/src/app.ts server/test/features/bodyLogs/bodyLogs.controller.test.ts
git commit -m "feat(api): body-logs CRUD with date-keyed upsert"
```

---

## Task 8: Routes `/api/meals`

**Files:**
- Create: `server/src/features/meals/`
- Modify: `server/src/app.ts`
- Test: `server/test/features/meals/meals.controller.test.ts`

**Interfaces:**
- Consumes: `prisma`, `pastOrTodayDateSchema`, `MEAL_SLOTS`, `NotFoundError`
- Produces: `src/features/meals/` → `export const mealsRouter: express.Router`, mount tại `/api/meals`

Endpoints: `GET /?date=` · `POST /` · `PATCH /:id` · `DELETE /:id`

- [ ] **Step 1: Viết test (fail trước)**

Tạo `server/test/features/meals/meals.controller.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';

const app = createApp();

beforeEach(async () => {
  await prisma.meal.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const validMeal = {
  date: '2026-08-06',
  slot: 'breakfast',
  name: 'Phở bò',
  calories: 450,
};

describe('POST /api/meals', () => {
  it('tạo bữa ăn', async () => {
    const res = await request(app).post('/api/meals').send(validMeal).expect(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('Phở bò');
    expect(res.body.calories).toBe(450);
  });

  it('cho phép nhiều bữa cùng ngày cùng buổi', async () => {
    await request(app).post('/api/meals').send(validMeal).expect(201);
    await request(app).post('/api/meals').send(validMeal).expect(201);
    expect(await prisma.meal.count()).toBe(2);
  });

  it('từ chối slot không hợp lệ', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ ...validMeal, slot: 'brunch' })
      .expect(400);
    expect(res.body.error.fields.some((f: any) => f.path === 'slot')).toBe(true);
  });

  it('từ chối calo âm', async () => {
    await request(app).post('/api/meals').send({ ...validMeal, calories: -1 }).expect(400);
  });

  it('từ chối calo không phải số nguyên', async () => {
    await request(app).post('/api/meals').send({ ...validMeal, calories: 12.5 }).expect(400);
  });

  it('từ chối calo phi lý', async () => {
    await request(app).post('/api/meals').send({ ...validMeal, calories: 99999 }).expect(400);
  });

  it('từ chối tên rỗng hoặc chỉ có khoảng trắng', async () => {
    await request(app).post('/api/meals').send({ ...validMeal, name: '   ' }).expect(400);
  });

  it('cắt khoảng trắng thừa ở tên', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ ...validMeal, name: '  Bún chả  ' })
      .expect(201);
    expect(res.body.name).toBe('Bún chả');
  });

  it('từ chối ngày ở tương lai', async () => {
    await request(app).post('/api/meals').send({ ...validMeal, date: '2999-01-01' }).expect(400);
  });
});

describe('GET /api/meals?date=', () => {
  it('chỉ trả bữa của ngày được hỏi', async () => {
    await request(app).post('/api/meals').send(validMeal);
    await request(app).post('/api/meals').send({ ...validMeal, date: '2026-08-05' });

    const res = await request(app).get('/api/meals?date=2026-08-06').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe('2026-08-06');
  });

  it('trả mảng rỗng khi ngày chưa có bữa nào', async () => {
    const res = await request(app).get('/api/meals?date=2026-08-06').expect(200);
    expect(res.body).toEqual([]);
  });

  it('thiếu tham số date trả 400', async () => {
    await request(app).get('/api/meals').expect(400);
  });
});

describe('PATCH /api/meals/:id', () => {
  it('sửa một phần', async () => {
    const created = await request(app).post('/api/meals').send(validMeal);
    const res = await request(app)
      .patch(`/api/meals/${created.body.id}`)
      .send({ calories: 500 })
      .expect(200);

    expect(res.body.calories).toBe(500);
    expect(res.body.name).toBe('Phở bò');
  });

  it('trả 404 với id không tồn tại', async () => {
    const res = await request(app)
      .patch('/api/meals/khong-co-that')
      .send({ calories: 500 })
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('vẫn validate khi sửa', async () => {
    const created = await request(app).post('/api/meals').send(validMeal);
    await request(app)
      .patch(`/api/meals/${created.body.id}`)
      .send({ calories: -5 })
      .expect(400);
  });
});

describe('DELETE /api/meals/:id', () => {
  it('xóa bữa ăn', async () => {
    const created = await request(app).post('/api/meals').send(validMeal);
    await request(app).delete(`/api/meals/${created.body.id}`).expect(204);
    expect(await prisma.meal.count()).toBe(0);
  });

  it('trả 404 với id không tồn tại', async () => {
    await request(app).delete('/api/meals/khong-co-that').expect(404);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Chạy: `npm test -- meals`
Kỳ vọng: FAIL — router chưa tồn tại.

- [ ] **Step 3: Viết `server/src/features/meals/`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';
import { MEAL_SLOTS, pastOrTodayDateSchema } from '../schemas.js';

const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'Tên món không được để trống').max(200));

const caloriesSchema = z.number().int().min(0).max(20_000);

const createSchema = z.object({
  date: pastOrTodayDateSchema,
  slot: z.enum(MEAL_SLOTS),
  name: nameSchema,
  calories: caloriesSchema,
  note: z.string().max(1000).nullable().optional(),
});

const patchSchema = z.object({
  date: pastOrTodayDateSchema.optional(),
  slot: z.enum(MEAL_SLOTS).optional(),
  name: nameSchema.optional(),
  calories: caloriesSchema.optional(),
  note: z.string().max(1000).nullable().optional(),
});

const listQuerySchema = z.object({ date: pastOrTodayDateSchema });

export const mealsRouter = Router();

mealsRouter.get('/', async (req, res) => {
  const { date } = listQuerySchema.parse(req.query);
  const rows = await prisma.meal.findMany({
    where: { date },
    orderBy: { createdAt: 'asc' },
  });
  res.json(rows);
});

mealsRouter.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  const row = await prisma.meal.create({
    data: { ...data, note: data.note ?? null },
  });
  res.status(201).json(row);
});

mealsRouter.patch('/:id', async (req, res) => {
  const id = req.params.id;
  const patch = patchSchema.parse(req.body);
  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Không có bữa ăn với id ${id}`);
  const row = await prisma.meal.update({ where: { id }, data: patch });
  res.json(row);
});

mealsRouter.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Không có bữa ăn với id ${id}`);
  await prisma.meal.delete({ where: { id } });
  res.status(204).end();
});
```

- [ ] **Step 4: Mount router trong `server/src/app.ts`**

Thêm import và dòng mount:

```ts
import { mealsRouter } from './routes/meals.js';
// ...
  app.use('/api/meals', mealsRouter);
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Chạy: `npm test -- meals`
Kỳ vọng: PASS, 17 test.

- [ ] **Step 6: Commit**

```bash
git add server/src/features/meals/ server/src/app.ts server/test/features/meals/meals.controller.test.ts
git commit -m "feat(api): meals CRUD with slot and calorie validation"
```

---

## Task 9: Routes `/api/goal`

**Files:**
- Create: `server/src/features/goal/`
- Modify: `server/src/app.ts`
- Test: `server/test/features/goal/goal.controller.test.ts`

**Interfaces:**
- Consumes: `prisma`, `isoDateSchema`
- Produces: `src/features/goal/` → `export const goalRouter: express.Router`, mount tại `/api/goal`. Hằng `GOAL_SINGLETON_ID = 'singleton'`.

- [ ] **Step 1: Viết test (fail trước)**

Tạo `server/test/features/goal/goal.controller.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';

const app = createApp();

beforeEach(async () => {
  await prisma.goal.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/goal', () => {
  it('trả object với các trường null khi chưa đặt mục tiêu', async () => {
    const res = await request(app).get('/api/goal').expect(200);
    expect(res.body.targetWeightKg).toBeNull();
    expect(res.body.targetDate).toBeNull();
    expect(res.body.dailyCalorieTarget).toBeNull();
  });
});

describe('PUT /api/goal', () => {
  it('đặt mục tiêu rồi đọc lại được', async () => {
    await request(app)
      .put('/api/goal')
      .send({ targetWeightKg: 68, targetDate: '2026-12-31', dailyCalorieTarget: 1900 })
      .expect(200);

    const res = await request(app).get('/api/goal').expect(200);
    expect(res.body.targetWeightKg).toBe(68);
    expect(res.body.targetDate).toBe('2026-12-31');
    expect(res.body.dailyCalorieTarget).toBe(1900);
  });

  it('gọi hai lần chỉ tạo một hàng', async () => {
    await request(app).put('/api/goal').send({ targetWeightKg: 68 }).expect(200);
    await request(app).put('/api/goal').send({ targetWeightKg: 66 }).expect(200);
    expect(await prisma.goal.count()).toBe(1);
  });

  it('trường vắng mặt giữ nguyên, null thì xóa', async () => {
    await request(app)
      .put('/api/goal')
      .send({ targetWeightKg: 68, dailyCalorieTarget: 1900 })
      .expect(200);

    const res = await request(app)
      .put('/api/goal')
      .send({ dailyCalorieTarget: null })
      .expect(200);

    expect(res.body.targetWeightKg).toBe(68);
    expect(res.body.dailyCalorieTarget).toBeNull();
  });

  it('cho phép targetDate ở tương lai', async () => {
    await request(app).put('/api/goal').send({ targetDate: '2999-01-01' }).expect(200);
  });

  it('từ chối targetWeightKg phi lý', async () => {
    await request(app).put('/api/goal').send({ targetWeightKg: 0 }).expect(400);
    await request(app).put('/api/goal').send({ targetWeightKg: 900 }).expect(400);
  });

  it('từ chối dailyCalorieTarget âm', async () => {
    await request(app).put('/api/goal').send({ dailyCalorieTarget: -100 }).expect(400);
  });

  it('từ chối targetDate sai định dạng', async () => {
    await request(app).put('/api/goal').send({ targetDate: '31/12/2026' }).expect(400);
  });
});
```

Chú ý: `targetDate` dùng `isoDateSchema` chứ **không** dùng `pastOrTodayDateSchema` — mục tiêu đương nhiên nằm ở tương lai.

- [ ] **Step 2: Chạy test để xác nhận fail**

Chạy: `npm test -- goal`
Kỳ vọng: FAIL.

- [ ] **Step 3: Viết `server/src/features/goal/`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isoDateSchema } from '../schemas.js';

export const GOAL_SINGLETON_ID = 'singleton';

const goalSchema = z.object({
  targetWeightKg: z.number().positive().lt(500).nullable().optional(),
  targetDate: isoDateSchema.nullable().optional(),
  dailyCalorieTarget: z.number().int().min(0).max(20_000).nullable().optional(),
});

const EMPTY_GOAL = {
  id: GOAL_SINGLETON_ID,
  targetWeightKg: null,
  targetDate: null,
  dailyCalorieTarget: null,
};

export const goalRouter = Router();

goalRouter.get('/', async (_req, res) => {
  const row = await prisma.goal.findUnique({ where: { id: GOAL_SINGLETON_ID } });
  res.json(row ?? EMPTY_GOAL);
});

goalRouter.put('/', async (req, res) => {
  const patch = goalSchema.parse(req.body);
  const row = await prisma.goal.upsert({
    where: { id: GOAL_SINGLETON_ID },
    create: {
      id: GOAL_SINGLETON_ID,
      targetWeightKg: patch.targetWeightKg ?? null,
      targetDate: patch.targetDate ?? null,
      dailyCalorieTarget: patch.dailyCalorieTarget ?? null,
    },
    update: patch,
  });
  res.json(row);
});
```

- [ ] **Step 4: Mount router trong `server/src/app.ts`**

```ts
import { goalRouter } from './routes/goal.js';
// ...
  app.use('/api/goal', goalRouter);
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Chạy: `npm test -- goal`
Kỳ vọng: PASS, 8 test.

- [ ] **Step 6: Commit**

```bash
git add server/src/features/goal/ server/src/app.ts server/test/features/goal/goal.controller.test.ts
git commit -m "feat(api): singleton goal endpoint"
```

---

## Task 10: Route `/api/summary`

**Files:**
- Create: `server/src/features/summary/`
- Modify: `server/src/app.ts`
- Test: `server/test/features/summary/summary.controller.test.ts`

**Interfaces:**
- Consumes: `prisma`; `rangeQuerySchema`; `movingAverage7`, `valueAt`, `currentRateKgPerWeek`, `requiredRateKgPerWeek`, `isOnTrack`, `remainingKg`, `weeklySummaries`, `DailyValue`, `DayInput` (Tasks 3–5); `enumerateDates`, `addDays`, `todayIso` (Task 1); `GOAL_SINGLETON_ID` (Task 9)
- Produces: `src/features/summary/` → `export const summaryRouter: express.Router`, mount tại `/api/summary`

**Chi tiết quan trọng:** MA7 tại ngày `from` cần dữ liệu từ `from - 6`; `currentRateKgPerWeek` cần MA7 tại `today - 14`, tức dữ liệu từ `today - 20`. Vì vậy truy vấn DB phải mở rộng ra ngoài `[from, to]` mà người dùng hỏi — nhưng mảng `days` trả về chỉ chứa `[from, to]`.

- [ ] **Step 1: Viết test (fail trước)**

Tạo `server/test/features/summary/summary.controller.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { addDays, todayIso } from '../../../src/lib/time.js';

const app = createApp();

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.goal.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/summary', () => {
  it('trả cấu trúc đúng khi DB rỗng, không lỗi', async () => {
    const res = await request(app)
      .get('/api/summary?from=2026-08-01&to=2026-08-03')
      .expect(200);

    expect(Array.isArray(res.body.days)).toBe(true);
    expect(Array.isArray(res.body.weeks)).toBe(true);
    expect(res.body.goal).toBeTruthy();
    expect(res.body.goal.targetWeightKg).toBeNull();
  });

  it('days phủ mọi ngày lịch trong khoảng, kể cả ngày trống', async () => {
    const res = await request(app)
      .get('/api/summary?from=2026-08-01&to=2026-08-03')
      .expect(200);

    expect(res.body.days.map((d: any) => d.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ]);
    expect(res.body.days[0].totalCalories).toBe(0);
    expect(res.body.days[0].mealCount).toBe(0);
    expect(res.body.days[0].weightKg).toBeNull();
  });

  it('cộng đúng tổng calo theo ngày', async () => {
    await prisma.meal.createMany({
      data: [
        { date: '2026-08-02', slot: 'breakfast', name: 'Phở', calories: 450 },
        { date: '2026-08-02', slot: 'lunch', name: 'Cơm', calories: 700 },
        { date: '2026-08-03', slot: 'dinner', name: 'Bún', calories: 500 },
      ],
    });

    const res = await request(app)
      .get('/api/summary?from=2026-08-01&to=2026-08-03')
      .expect(200);

    const byDate = Object.fromEntries(res.body.days.map((d: any) => [d.date, d]));
    expect(byDate['2026-08-02'].totalCalories).toBe(1150);
    expect(byDate['2026-08-02'].mealCount).toBe(2);
    expect(byDate['2026-08-03'].totalCalories).toBe(500);
  });

  it('xóa bữa ăn làm giảm tổng calo của ngày đó', async () => {
    const created = await request(app)
      .post('/api/meals')
      .send({ date: '2026-08-02', slot: 'lunch', name: 'Cơm', calories: 700 });

    let res = await request(app).get('/api/summary?from=2026-08-02&to=2026-08-02');
    expect(res.body.days[0].totalCalories).toBe(700);

    await request(app).delete(`/api/meals/${created.body.id}`).expect(204);

    res = await request(app).get('/api/summary?from=2026-08-02&to=2026-08-02');
    expect(res.body.days[0].totalCalories).toBe(0);
    expect(res.body.days[0].mealCount).toBe(0);
  });

  it('MA7 tại đầu khoảng dùng cả dữ liệu trước from', async () => {
    // Hai số đo trước from — MA7 tại from phải thấy được chúng
    await prisma.bodyLog.createMany({
      data: [
        { date: '2026-08-01', weightKg: 70 },
        { date: '2026-08-02', weightKg: 72 },
        { date: '2026-08-03', weightKg: 74 },
      ],
    });

    const res = await request(app)
      .get('/api/summary?from=2026-08-03&to=2026-08-03')
      .expect(200);

    // Cửa sổ [07-28, 08-03] có 70, 72, 74 → 72
    expect(res.body.days[0].weightMa7).toBeCloseTo(72, 5);
  });

  it('weightMa7 là null khi chỉ có một số đo', async () => {
    await prisma.bodyLog.create({ data: { date: '2026-08-03', weightKg: 74 } });
    const res = await request(app).get('/api/summary?from=2026-08-03&to=2026-08-03');
    expect(res.body.days[0].weightMa7).toBeNull();
  });

  it('tính tiến độ mục tiêu khi có đủ dữ liệu', async () => {
    const today = todayIso();
    // 21 ngày liên tiếp, giảm 0.1 kg/ngày
    const data = [];
    for (let i = 20; i >= 0; i--) {
      data.push({ date: addDays(today, -i), weightKg: 80 - (20 - i) * 0.1 });
    }
    await prisma.bodyLog.createMany({ data });
    await prisma.goal.create({
      data: { id: 'singleton', targetWeightKg: 70, targetDate: addDays(today, 140) },
    });

    const res = await request(app)
      .get(`/api/summary?from=${addDays(today, -20)}&to=${today}`)
      .expect(200);

    expect(res.body.goal.currentRateKgPerWeek).toBeCloseTo(-0.7, 3);
    expect(res.body.goal.remainingKg).toBeGreaterThan(0);
    expect(typeof res.body.goal.onTrack).toBe('boolean');
  });

  it('goal.currentRateKgPerWeek là null khi thiếu dữ liệu', async () => {
    await prisma.goal.create({ data: { id: 'singleton', targetWeightKg: 70 } });
    const res = await request(app).get('/api/summary?from=2026-08-01&to=2026-08-03');
    expect(res.body.goal.currentRateKgPerWeek).toBeNull();
    expect(res.body.goal.onTrack).toBeNull();
  });

  it('weeks gộp theo tuần bắt đầu thứ Hai', async () => {
    await prisma.meal.createMany({
      data: [
        { date: '2026-08-03', slot: 'lunch', name: 'A', calories: 2000 },
        { date: '2026-08-10', slot: 'lunch', name: 'B', calories: 1800 },
      ],
    });

    const res = await request(app)
      .get('/api/summary?from=2026-08-03&to=2026-08-10')
      .expect(200);

    expect(res.body.weeks.map((w: any) => w.weekStart)).toEqual(['2026-08-03', '2026-08-10']);
    expect(res.body.weeks[0].avgCalories).toBe(2000);
  });

  it('từ chối khoảng không hợp lệ', async () => {
    await request(app).get('/api/summary?from=2026-08-10&to=2026-08-01').expect(400);
    await request(app).get('/api/summary').expect(400);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Chạy: `npm test -- summary`
Kỳ vọng: FAIL.

- [ ] **Step 3: Viết `server/src/features/summary/`**

```ts
import { Router } from 'express';
import { prisma } from '../db.js';
import { rangeQuerySchema } from '../schemas.js';
import { addDays, enumerateDates, todayIso } from '../time.js';
import {
  currentRateKgPerWeek,
  isOnTrack,
  movingAverage7,
  remainingKg,
  requiredRateKgPerWeek,
  valueAt,
  weeklySummaries,
  type DailyValue,
  type DayInput,
} from '../stats.js';
import { GOAL_SINGLETON_ID } from './goal.js';

/** MA7 tại ngày d cần dữ liệu từ d-6. */
const MA_WARMUP_DAYS = 6;
/** currentRate cần MA7 tại today-14, tức dữ liệu từ today-20. */
const RATE_WARMUP_DAYS = 20;

export const summaryRouter = Router();

summaryRouter.get('/', async (req, res) => {
  const { from, to } = rangeQuerySchema.parse(req.query);
  const today = todayIso();

  // Mở rộng cửa sổ truy vấn để MA7 và tốc độ có đủ dữ liệu đầu vào,
  // dù mảng days trả về chỉ chứa [from, to].
  const queryFrom = [addDays(from, -MA_WARMUP_DAYS), addDays(today, -RATE_WARMUP_DAYS)]
    .sort()[0]!;
  const queryTo = to > today ? to : today;

  const [bodyLogs, meals, goal] = await Promise.all([
    prisma.bodyLog.findMany({
      where: { date: { gte: queryFrom, lte: queryTo } },
      orderBy: { date: 'asc' },
    }),
    prisma.meal.findMany({
      where: { date: { gte: queryFrom, lte: queryTo } },
    }),
    prisma.goal.findUnique({ where: { id: GOAL_SINGLETON_ID } }),
  ]);

  const bodyByDate = new Map(bodyLogs.map((row) => [row.date, row]));

  const mealAgg = new Map<string, { totalCalories: number; mealCount: number }>();
  for (const meal of meals) {
    const acc = mealAgg.get(meal.date) ?? { totalCalories: 0, mealCount: 0 };
    acc.totalCalories += meal.calories;
    acc.mealCount += 1;
    mealAgg.set(meal.date, acc);
  }

  // Chuỗi đầy đủ (kể cả phần warm-up) để tính MA7 đúng.
  const fullDates = enumerateDates(queryFrom, queryTo);
  const weightSeries: DailyValue[] = fullDates.map((date) => ({
    date,
    value: bodyByDate.get(date)?.weightKg ?? null,
  }));
  const waistSeries: DailyValue[] = fullDates.map((date) => ({
    date,
    value: bodyByDate.get(date)?.waistCm ?? null,
  }));

  const weightMa7 = movingAverage7(weightSeries);
  const waistMa7 = movingAverage7(waistSeries);

  // Chỉ trả về phần người dùng hỏi.
  const visibleDates = enumerateDates(from, to);
  const days = visibleDates.map((date) => {
    const agg = mealAgg.get(date);
    return {
      date,
      weightKg: bodyByDate.get(date)?.weightKg ?? null,
      weightMa7: valueAt(weightMa7, date),
      waistCm: bodyByDate.get(date)?.waistCm ?? null,
      waistMa7: valueAt(waistMa7, date),
      totalCalories: agg?.totalCalories ?? 0,
      mealCount: agg?.mealCount ?? 0,
    };
  });

  const weekInput: DayInput[] = days.map((d) => ({
    date: d.date,
    weightKg: d.weightKg,
    totalCalories: d.totalCalories,
    mealCount: d.mealCount,
  }));

  const currentMa7 = valueAt(weightMa7, today);
  const currentRate = currentRateKgPerWeek(weightMa7, today);
  const requiredRate = requiredRateKgPerWeek(
    currentMa7,
    goal?.targetWeightKg ?? null,
    goal?.targetDate ?? null,
    today,
  );

  res.json({
    days,
    weeks: weeklySummaries(weekInput),
    goal: {
      targetWeightKg: goal?.targetWeightKg ?? null,
      targetDate: goal?.targetDate ?? null,
      dailyCalorieTarget: goal?.dailyCalorieTarget ?? null,
      currentMa7WeightKg: currentMa7,
      remainingKg: remainingKg(currentMa7, goal?.targetWeightKg ?? null),
      currentRateKgPerWeek: currentRate,
      requiredRateKgPerWeek: requiredRate,
      onTrack: isOnTrack(currentRate, requiredRate),
    },
  });
});
```

- [ ] **Step 4: Mount router trong `server/src/app.ts`**

```ts
import { summaryRouter } from './routes/summary.js';
// ...
  app.use('/api/summary', summaryRouter);
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Chạy: `npm test -- summary`
Kỳ vọng: PASS, 11 test.

- [ ] **Step 6: Chạy toàn bộ test suite**

Chạy: `npm test`
Kỳ vọng: PASS tất cả — không task nào làm hỏng task trước.

- [ ] **Step 7: Commit**

```bash
git add server/src/features/summary/ server/src/app.ts server/test/features/summary/summary.controller.test.ts
git commit -m "feat(api): summary endpoint with MA7 warm-up window"
```

---

## Task 11: ntfy + routes `/api/reminders` + scheduler

**Files:**
- Create: `server/src/shared/clients/ntfy.client.ts`, `server/src/features/reminders/`, `server/src/features/reminders/services/reminders.scheduler.ts`
- Modify: `server/src/app.ts`, `server/src/server.ts`
- Test: `server/test/features/reminders/reminders.controller.test.ts`, `server/test/features/reminders/reminders.scheduler.test.ts`

**Interfaces:**
- Consumes: `prisma`, `env`, `todayIso`, `NotFoundError`
- Produces:
  - `src/shared/clients/ntfy.client.ts` → `sendNtfy(topic: string, title: string, message: string, tags?: string): Promise<boolean>`
  - `src/features/reminders/` → `remindersRouter`, `REMINDER_KINDS` (`['weigh_in','meal_log']`), mount tại `/api/reminders`
  - `src/features/reminders/services/reminders.scheduler.ts` → `runReminderTick(nowHHmm: string): Promise<string[]>` (trả danh sách `kind` đã gửi — để test), `startScheduler(): void`

- [ ] **Step 1: Viết `server/src/shared/clients/ntfy.client.ts`**

```ts
import { env } from './env.js';

/**
 * Gửi thông báo qua ntfy. Trả về true nếu gửi thành công.
 * Không bao giờ throw — nhắc nhở hỏng không được làm chết scheduler.
 * Title được encode base64 vì header HTTP không mang được UTF-8 thô.
 */
export async function sendNtfy(
  topic: string,
  title: string,
  message: string,
  tags = 'bell',
): Promise<boolean> {
  try {
    const response = await fetch(`${env.NTFY_BASE_URL}/${topic}`, {
      method: 'POST',
      body: message,
      headers: {
        Title: `=?UTF-8?B?${Buffer.from(title, 'utf8').toString('base64')}?=`,
        Tags: tags,
      },
    });
    return response.ok;
  } catch (error) {
    console.error('[ntfy] gửi thất bại:', error);
    return false;
  }
}
```

- [ ] **Step 2: Viết test cho reminders (fail trước)**

Tạo `server/test/features/reminders/reminders.controller.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';

const app = createApp();

beforeEach(async () => {
  await prisma.reminder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/reminders', () => {
  it('trả cả hai loại với giá trị mặc định khi chưa cấu hình', async () => {
    const res = await request(app).get('/api/reminders').expect(200);
    expect(res.body.map((r: any) => r.kind).sort()).toEqual(['meal_log', 'weigh_in']);
    expect(res.body.every((r: any) => r.enabled === false)).toBe(true);
  });
});

describe('PUT /api/reminders/:kind', () => {
  it('cập nhật rồi đọc lại được', async () => {
    await request(app)
      .put('/api/reminders/weigh_in')
      .send({ timeOfDay: '07:00', enabled: true, ntfyTopic: 'lean-test' })
      .expect(200);

    const res = await request(app).get('/api/reminders').expect(200);
    const weighIn = res.body.find((r: any) => r.kind === 'weigh_in');
    expect(weighIn.timeOfDay).toBe('07:00');
    expect(weighIn.enabled).toBe(true);
    expect(weighIn.ntfyTopic).toBe('lean-test');
  });

  it('gọi hai lần không sinh bản ghi thứ hai', async () => {
    await request(app).put('/api/reminders/weigh_in').send({ timeOfDay: '07:00' });
    await request(app).put('/api/reminders/weigh_in').send({ timeOfDay: '08:00' });
    expect(await prisma.reminder.count({ where: { kind: 'weigh_in' } })).toBe(1);
  });

  it('từ chối kind không hợp lệ', async () => {
    await request(app).put('/api/reminders/khong-co-that').send({ timeOfDay: '07:00' }).expect(400);
  });

  it('từ chối giờ sai định dạng', async () => {
    await request(app).put('/api/reminders/weigh_in').send({ timeOfDay: '7:00' }).expect(400);
    await request(app).put('/api/reminders/weigh_in').send({ timeOfDay: '25:00' }).expect(400);
    await request(app).put('/api/reminders/weigh_in').send({ timeOfDay: '07:60' }).expect(400);
  });

  it('chấp nhận giờ biên', async () => {
    await request(app).put('/api/reminders/weigh_in').send({ timeOfDay: '00:00' }).expect(200);
    await request(app).put('/api/reminders/weigh_in').send({ timeOfDay: '23:59' }).expect(200);
  });
});
```

- [ ] **Step 3: Viết `server/src/features/reminders/`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';

export const REMINDER_KINDS = ['weigh_in', 'meal_log'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

const DEFAULT_TIME: Record<ReminderKind, string> = {
  weigh_in: '07:00',
  meal_log: '20:00',
};

const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm (24 giờ)');

const updateSchema = z.object({
  timeOfDay: timeOfDaySchema.optional(),
  enabled: z.boolean().optional(),
  ntfyTopic: z.string().max(100).nullable().optional(),
});

const kindSchema = z.enum(REMINDER_KINDS);

export const remindersRouter = Router();

remindersRouter.get('/', async (_req, res) => {
  const rows = await prisma.reminder.findMany();
  const byKind = new Map(rows.map((row) => [row.kind, row]));
  res.json(
    REMINDER_KINDS.map(
      (kind) =>
        byKind.get(kind) ?? {
          kind,
          timeOfDay: DEFAULT_TIME[kind],
          enabled: false,
          ntfyTopic: null,
        },
    ),
  );
});

remindersRouter.put('/:kind', async (req, res) => {
  const kind = kindSchema.parse(req.params.kind);
  const patch = updateSchema.parse(req.body);
  const row = await prisma.reminder.upsert({
    where: { kind },
    create: {
      kind,
      timeOfDay: patch.timeOfDay ?? DEFAULT_TIME[kind],
      enabled: patch.enabled ?? false,
      ntfyTopic: patch.ntfyTopic ?? null,
    },
    update: patch,
  });
  res.json(row);
});
```

- [ ] **Step 4: Mount router và chạy test reminders**

Thêm vào `server/src/app.ts`:

```ts
import { remindersRouter } from './routes/reminders.js';
// ...
  app.use('/api/reminders', remindersRouter);
```

Chạy: `npm test -- reminders`
Kỳ vọng: PASS, 7 test.

- [ ] **Step 5: Viết test cho scheduler (fail trước)**

Tạo `server/test/features/reminders/reminders.scheduler.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../../../src/lib/db.js';
import { todayIso } from '../../../src/lib/time.js';

vi.mock('../src/ntfy.js', () => ({
  sendNtfy: vi.fn(async () => true),
}));

const { sendNtfy } = await import('../src/ntfy.js');
const { runReminderTick } = await import('../src/scheduler.js');

beforeEach(async () => {
  vi.mocked(sendNtfy).mockClear();
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.reminder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('runReminderTick', () => {
  it('không gửi khi nhắc nhở đang tắt', async () => {
    await prisma.reminder.create({
      data: { kind: 'weigh_in', timeOfDay: '07:00', enabled: false, ntfyTopic: 't' },
    });
    expect(await runReminderTick('07:00')).toEqual([]);
    expect(sendNtfy).not.toHaveBeenCalled();
  });

  it('không gửi khi chưa tới giờ', async () => {
    await prisma.reminder.create({
      data: { kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 't' },
    });
    expect(await runReminderTick('06:59')).toEqual([]);
  });

  it('không gửi khi chưa cấu hình ntfyTopic', async () => {
    await prisma.reminder.create({
      data: { kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: null },
    });
    expect(await runReminderTick('07:00')).toEqual([]);
    expect(sendNtfy).not.toHaveBeenCalled();
  });

  it('gửi nhắc cân khi đúng giờ và hôm nay chưa cân', async () => {
    await prisma.reminder.create({
      data: { kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'lean-test' },
    });
    expect(await runReminderTick('07:00')).toEqual(['weigh_in']);
    expect(sendNtfy).toHaveBeenCalledOnce();
    expect(vi.mocked(sendNtfy).mock.calls[0]![0]).toBe('lean-test');
  });

  it('không gửi nhắc cân khi hôm nay đã cân', async () => {
    await prisma.reminder.create({
      data: { kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'lean-test' },
    });
    await prisma.bodyLog.create({ data: { date: todayIso(), weightKg: 72 } });
    expect(await runReminderTick('07:00')).toEqual([]);
  });

  it('vẫn nhắc cân nếu hôm nay chỉ đo bụng mà chưa cân', async () => {
    await prisma.reminder.create({
      data: { kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'lean-test' },
    });
    await prisma.bodyLog.create({ data: { date: todayIso(), waistCm: 88 } });
    expect(await runReminderTick('07:00')).toEqual(['weigh_in']);
  });

  it('không gửi nhắc ghi bữa khi hôm nay đã ghi ít nhất một bữa', async () => {
    await prisma.reminder.create({
      data: { kind: 'meal_log', timeOfDay: '20:00', enabled: true, ntfyTopic: 'lean-test' },
    });
    await prisma.meal.create({
      data: { date: todayIso(), slot: 'lunch', name: 'Cơm', calories: 600 },
    });
    expect(await runReminderTick('20:00')).toEqual([]);
  });

  it('gửi nhắc ghi bữa khi hôm nay chưa ghi gì', async () => {
    await prisma.reminder.create({
      data: { kind: 'meal_log', timeOfDay: '20:00', enabled: true, ntfyTopic: 'lean-test' },
    });
    expect(await runReminderTick('20:00')).toEqual(['meal_log']);
  });
});
```

- [ ] **Step 6: Chạy test để xác nhận fail**

Chạy: `npm test -- scheduler`
Kỳ vọng: FAIL — `Cannot find module '../src/scheduler.js'`

- [ ] **Step 7: Viết `server/src/features/reminders/services/reminders.scheduler.ts`**

```ts
import cron from 'node-cron';
import { prisma } from './db.js';
import { sendNtfy } from './ntfy.js';
import { todayIso, TZ } from './time.js';

const MESSAGES: Record<string, { title: string; body: string; tags: string }> = {
  weigh_in: {
    title: 'Lean — nhắc cân',
    body: 'Hôm nay bạn chưa cân. Cân buổi sáng lúc bụng đói cho số ổn định nhất.',
    tags: 'scales',
  },
  meal_log: {
    title: 'Lean — nhắc ghi bữa ăn',
    body: 'Hôm nay bạn chưa ghi bữa nào.',
    tags: 'fork_and_knife',
  },
};

/** Hôm nay đã có số đo cân nặng chưa. */
async function hasWeighedToday(): Promise<boolean> {
  const row = await prisma.bodyLog.findUnique({ where: { date: todayIso() } });
  return row?.weightKg != null;
}

/** Hôm nay đã ghi bữa nào chưa. */
async function hasLoggedMealToday(): Promise<boolean> {
  return (await prisma.meal.count({ where: { date: todayIso() } })) > 0;
}

/**
 * Một nhịp kiểm tra. Trả về danh sách kind đã thực sự gửi.
 * Tách khỏi cron để test được mà không phải chờ đồng hồ.
 */
export async function runReminderTick(nowHHmm: string): Promise<string[]> {
  const due = await prisma.reminder.findMany({
    where: { enabled: true, timeOfDay: nowHHmm },
  });

  const sent: string[] = [];
  for (const reminder of due) {
    if (!reminder.ntfyTopic) continue;

    const alreadyDone =
      reminder.kind === 'weigh_in' ? await hasWeighedToday() : await hasLoggedMealToday();
    if (alreadyDone) continue;

    const msg = MESSAGES[reminder.kind];
    if (!msg) continue;

    const ok = await sendNtfy(reminder.ntfyTopic, msg.title, msg.body, msg.tags);
    if (ok) sent.push(reminder.kind);
  }
  return sent;
}

/** Chạy mỗi phút, so giờ hiện tại với timeOfDay của các nhắc nhở đang bật. */
export function startScheduler(): void {
  cron.schedule(
    '* * * * *',
    () => {
      const nowHHmm = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
      void runReminderTick(nowHHmm).catch((error) => {
        console.error('[scheduler] lỗi khi chạy nhắc nhở:', error);
      });
    },
    { timezone: TZ },
  );
  console.log('Scheduler nhắc nhở đã khởi động (chỉ chạy khi server bật).');
}
```

- [ ] **Step 8: Gọi scheduler trong `server/src/server.ts`**

Thay nội dung file thành:

```ts
import { createApp } from './app.js';
import { env } from './env.js';
import { startScheduler } from './scheduler.js';

const app = createApp();

app.listen(env.PORT, '127.0.0.1', () => {
  console.log(`Lean server đang chạy tại http://localhost:${env.PORT}`);
  startScheduler();
});
```

- [ ] **Step 9: Chạy toàn bộ test**

Chạy: `npm test`
Kỳ vọng: PASS tất cả (time, db, stats, app, bodyLogs, meals, goal, summary, reminders, scheduler).

- [ ] **Step 10: Commit**

```bash
git add server/src/shared/clients/ntfy.client.ts server/src/features/reminders/ server/src/features/reminders/services/reminders.scheduler.ts server/src/app.ts server/src/server.ts server/test/features/reminders/reminders.controller.test.ts server/test/features/reminders/reminders.scheduler.test.ts
git commit -m "feat(server): ntfy reminders with cron scheduler"
```

---

## Task 12: Web scaffold + API client + khung điều hướng

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/types.ts`, `web/src/api.ts`, `web/src/styles.css`
- Modify: `Lean/.gitignore` (không cần — đã có `web/dist/` và `node_modules/`)

**Interfaces:**
- Consumes: REST API từ Tasks 7–11
- Produces: từ `web/src/api.ts` —
  - `getBodyLog(date): Promise<BodyLog | null>` · `putBodyLog(date, patch): Promise<BodyLog>`
  - `getMeals(date): Promise<Meal[]>` · `createMeal(input): Promise<Meal>` · `patchMeal(id, patch): Promise<Meal>` · `deleteMeal(id): Promise<void>`
  - `getSummary(from, to): Promise<Summary>`
  - `getGoal(): Promise<Goal>` · `putGoal(patch): Promise<Goal>`
  - `getReminders(): Promise<Reminder[]>` · `putReminder(kind, patch): Promise<Reminder>`

**Ghi chú về test web:** spec §9 chỉ liệt kê test cho `stats.ts`, API và nhắc nhở, nhưng Tasks 12–15 **có** test tự động (Vitest + jsdom + Testing Library) theo quyết định mở rộng phạm vi. Nguyên tắc: test hành vi người dùng thấy được — validate form, trạng thái rỗng, tổng calo, xử lý lỗi API — **không** test chi tiết render của Recharts (thư viện bên thứ ba, test sẽ giòn và không nói lên điều gì). Checklist kiểm tra trình duyệt vẫn giữ, bổ sung cho test chứ không thay thế.

- [ ] **Step 1: Tạo `web/package.json`**

```json
{
  "name": "lean-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "~5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Tạo `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Tạo `web/vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Proxy để frontend gọi `/api/...` tương đối, không cần cấu hình CORS ở server.

- [ ] **Step 3b: Tạo `web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
```

- [ ] **Step 4: Tạo `web/index.html`**

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lean — Theo dõi sức khỏe</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Tạo `web/src/types.ts`**

```ts
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Sáng',
  lunch: 'Trưa',
  dinner: 'Tối',
  snack: 'Phụ',
};

export interface BodyLog {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  note: string | null;
}

export interface Meal {
  id: string;
  date: string;
  slot: MealSlot;
  name: string;
  calories: number;
  note: string | null;
}

export interface Goal {
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
}

export interface GoalProgress extends Goal {
  currentMa7WeightKg: number | null;
  remainingKg: number | null;
  currentRateKgPerWeek: number | null;
  requiredRateKgPerWeek: number | null;
  onTrack: boolean | null;
}

export interface SummaryDay {
  date: string;
  weightKg: number | null;
  weightMa7: number | null;
  waistCm: number | null;
  waistMa7: number | null;
  totalCalories: number;
  mealCount: number;
}

export interface SummaryWeek {
  weekStart: string;
  avgCalories: number | null;
  avgWeightKg: number | null;
}

export interface Summary {
  days: SummaryDay[];
  weeks: SummaryWeek[];
  goal: GoalProgress;
}

export interface Reminder {
  kind: 'weigh_in' | 'meal_log';
  timeOfDay: string;
  enabled: boolean;
  ntfyTopic: string | null;
}
```

- [ ] **Step 6: Tạo `web/src/api.ts`**

```ts
import type { BodyLog, Goal, Meal, MealSlot, Reminder, Summary } from './types';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? `Lỗi ${response.status}`;
    const fields = body?.error?.fields
      ?.map((f: { path: string; message: string }) => `${f.path}: ${f.message}`)
      .join('; ');
    throw new Error(fields ? `${message} (${fields})` : message);
  }
  return body as T;
}

export function todayIsoLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export async function getBodyLog(date: string): Promise<BodyLog | null> {
  const response = await fetch(`/api/body-logs/${date}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Không tải được số đo ngày ${date}`);
  return (await response.json()) as BodyLog;
}

export function putBodyLog(
  date: string,
  patch: Partial<Pick<BodyLog, 'weightKg' | 'waistCm' | 'note'>>,
): Promise<BodyLog> {
  return call<BodyLog>(`/body-logs/${date}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export function getMeals(date: string): Promise<Meal[]> {
  return call<Meal[]>(`/meals?date=${date}`);
}

export function createMeal(input: {
  date: string;
  slot: MealSlot;
  name: string;
  calories: number;
}): Promise<Meal> {
  return call<Meal>('/meals', { method: 'POST', body: JSON.stringify(input) });
}

export function patchMeal(id: string, patch: Partial<Meal>): Promise<Meal> {
  return call<Meal>(`/meals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteMeal(id: string): Promise<void> {
  return call<void>(`/meals/${id}`, { method: 'DELETE' });
}

export function getSummary(from: string, to: string): Promise<Summary> {
  return call<Summary>(`/summary?from=${from}&to=${to}`);
}

export function getGoal(): Promise<Goal> {
  return call<Goal>('/goal');
}

export function putGoal(patch: Partial<Goal>): Promise<Goal> {
  return call<Goal>('/goal', { method: 'PUT', body: JSON.stringify(patch) });
}

export function getReminders(): Promise<Reminder[]> {
  return call<Reminder[]>('/reminders');
}

export function putReminder(
  kind: Reminder['kind'],
  patch: Partial<Omit<Reminder, 'kind'>>,
): Promise<Reminder> {
  return call<Reminder>(`/reminders/${kind}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}
```

- [ ] **Step 7: Tạo `web/src/styles.css`**

```css
:root {
  --bg: #faf9f7;
  --fg: #1c1b19;
  --muted: #6b6862;
  --line: #e3e0da;
  --accent: #2f6f4f;
  --warn: #b4553a;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--fg);
}

.container { max-width: 880px; margin: 0 auto; padding: 24px 16px 64px; }

nav { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 24px; }
nav button {
  background: none; border: none; padding: 12px 20px; cursor: pointer;
  font-size: 15px; color: var(--muted); border-bottom: 2px solid transparent;
}
nav button.active { color: var(--fg); border-bottom-color: var(--accent); font-weight: 600; }

.card {
  background: #fff; border: 1px solid var(--line); border-radius: 10px;
  padding: 20px; margin-bottom: 20px;
}
.card h2 { margin: 0 0 16px; font-size: 17px; }

label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }
input, select {
  padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px;
  font-size: 15px; font-family: inherit; background: #fff;
}
button.primary {
  background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 9px 16px; font-size: 15px; cursor: pointer;
}
button.link { background: none; border: none; color: var(--warn); cursor: pointer; font-size: 13px; }

.row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.muted { color: var(--muted); font-size: 13px; }
.error { color: var(--warn); font-size: 14px; margin-top: 8px; }
.empty { color: var(--muted); text-align: center; padding: 32px 16px; }

table { width: 100%; border-collapse: collapse; }
td, th { padding: 8px 4px; text-align: left; border-bottom: 1px solid var(--line); font-size: 14px; }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
```

- [ ] **Step 8: Tạo `web/src/App.tsx`**

```tsx
import { useState } from 'react';
import { Today } from './pages/Today';
import { Charts } from './pages/Charts';
import { Settings } from './pages/Settings';

type Tab = 'today' | 'charts' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'charts', label: 'Biểu đồ' },
  { id: 'settings', label: 'Cài đặt' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('today');

  return (
    <div className="container">
      <nav>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'today' && <Today />}
      {tab === 'charts' && <Charts />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}
```

- [ ] **Step 9: Tạo `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: Tạo ba trang rỗng tạm thời để build chạy được**

Tạo `web/src/pages/Today.tsx`, `web/src/pages/Charts.tsx`, `web/src/pages/Settings.tsx`, mỗi file:

```tsx
export function Today() {
  return <div className="card">Chưa xây</div>;
}
```

(đổi tên hàm thành `Charts` / `Settings` cho hai file còn lại)

- [ ] **Step 11: Cài dependencies**

```bash
cd web
npm install
```

- [ ] **Step 12: Viết test cho `api.ts` (fail trước)**

Tạo `web/src/api.test.ts`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { createMeal, deleteMeal, getBodyLog, getSummary, todayIsoLocal } from './api';

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe('todayIsoLocal', () => {
  it('trả đúng định dạng YYYY-MM-DD', () => {
    expect(todayIsoLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getBodyLog', () => {
  it('trả null khi server báo 404 thay vì ném lỗi', async () => {
    mockFetch(404, { error: { code: 'NOT_FOUND', message: 'x' } });
    await expect(getBodyLog('2026-08-06')).resolves.toBeNull();
  });

  it('trả dữ liệu khi 200', async () => {
    mockFetch(200, { date: '2026-08-06', weightKg: 72.4, waistCm: null, note: null });
    const row = await getBodyLog('2026-08-06');
    expect(row?.weightKg).toBe(72.4);
  });
});

describe('xử lý lỗi', () => {
  it('ném Error kèm message từ server', async () => {
    mockFetch(400, { error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ' } });
    await expect(
      createMeal({ date: '2026-08-06', slot: 'lunch', name: 'x', calories: -1 }),
    ).rejects.toThrow('Dữ liệu không hợp lệ');
  });

  it('gộp danh sách trường sai vào message', async () => {
    mockFetch(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        fields: [{ path: 'calories', message: 'phải >= 0' }],
      },
    });
    await expect(
      createMeal({ date: '2026-08-06', slot: 'lunch', name: 'x', calories: -1 }),
    ).rejects.toThrow(/calories: phải >= 0/);
  });
});

describe('deleteMeal', () => {
  it('xử lý 204 không có body, không ném lỗi parse JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('không có body');
      },
    } as unknown as Response);
    await expect(deleteMeal('abc')).resolves.toBeUndefined();
  });
});

describe('getSummary', () => {
  it('gọi đúng URL kèm from và to', async () => {
    const spy = mockFetch(200, { days: [], weeks: [], goal: {} });
    await getSummary('2026-08-01', '2026-08-06');
    expect(spy.mock.calls[0]![0]).toBe('/api/summary?from=2026-08-01&to=2026-08-06');
  });
});
```

- [ ] **Step 13: Chạy test**

Chạy: `npm test`
Kỳ vọng: PASS, 7 test. Nếu FAIL ở `deleteMeal` thì `call()` đang parse JSON trước khi kiểm tra 204 — sửa `api.ts` để trả sớm khi `status === 204`.

- [ ] **Step 14: Chạy thử trong trình duyệt**

Chạy: `npm run dev`, mở `http://localhost:7173`.
Kỳ vọng: thấy 3 tab, bấm chuyển được, mỗi tab hiện "Chưa xây".

- [ ] **Step 15: Commit**

```bash
git add web/
git commit -m "feat(web): vite scaffold, api client with tests, tab navigation"
```

---

## Task 13: Trang "Hôm nay"

**Files:**
- Modify: `web/src/pages/Today.tsx`
- Create: `web/src/components/BodyLogForm.tsx`, `web/src/components/MealForm.tsx`, `web/src/components/MealList.tsx`

**Interfaces:**
- Consumes: `api.ts` (Task 12) — `getBodyLog`, `putBodyLog`, `getMeals`, `createMeal`, `deleteMeal`, `getGoal`, `todayIsoLocal`; types từ `types.ts`
- Produces: `Today` component (đã export sẵn ở Task 12)

- [ ] **Step 1: Viết `web/src/components/BodyLogForm.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getBodyLog, putBodyLog } from '../api';

interface Props {
  date: string;
  onSaved: () => void;
}

/** Lưu khi rời khỏi ô (blur). Ô trống nghĩa là xóa giá trị. */
export function BodyLogForm({ date, onSaved }: Props) {
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setStatus(null);
    getBodyLog(date)
      .then((row) => {
        if (cancelled) return;
        setWeight(row?.weightKg != null ? String(row.weightKg) : '');
        setWaist(row?.waistCm != null ? String(row.waistCm) : '');
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [date]);

  async function save(field: 'weightKg' | 'waistCm', raw: string) {
    setError(null);
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) {
      setError('Giá trị phải là số');
      return;
    }
    try {
      await putBodyLog(date, { [field]: value });
      setStatus('Đã lưu');
      setTimeout(() => setStatus(null), 1500);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h2>Số đo</h2>
      <div className="row">
        <div>
          <label htmlFor="weight">Cân nặng (kg)</label>
          <input
            id="weight"
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => void save('weightKg', weight)}
          />
        </div>
        <div>
          <label htmlFor="waist">Vòng bụng (cm)</label>
          <input
            id="waist"
            type="number"
            step="0.1"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
            onBlur={() => void save('waistCm', waist)}
          />
        </div>
        {status && <span className="muted">{status}</span>}
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        Để trống rồi rời khỏi ô để xóa giá trị. Cân buổi sáng lúc bụng đói cho số ổn định nhất.
      </p>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Viết `web/src/components/MealForm.tsx`**

```tsx
import { useState } from 'react';
import { createMeal } from '../api';
import { MEAL_SLOTS, SLOT_LABEL, type MealSlot } from '../types';

interface Props {
  date: string;
  onAdded: () => void;
}

export function MealForm({ date, onAdded }: Props) {
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const kcal = Number(calories);
    if (!name.trim()) {
      setError('Nhập tên món');
      return;
    }
    if (!Number.isInteger(kcal) || kcal < 0) {
      setError('Calo phải là số nguyên không âm');
      return;
    }
    try {
      await createMeal({ date, slot, name: name.trim(), calories: kcal });
      setName('');
      setCalories('');
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form className="row" onSubmit={submit} style={{ marginTop: 16 }}>
      <div>
        <label htmlFor="slot">Buổi</label>
        <select id="slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <label htmlFor="name">Tên món</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Phở bò"
          style={{ width: '100%' }}
        />
      </div>
      <div>
        <label htmlFor="cal">Calo</label>
        <input
          id="cal"
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="450"
          style={{ width: 90 }}
        />
      </div>
      <button className="primary" type="submit">
        Thêm
      </button>
      {error && <div className="error" style={{ width: '100%' }}>{error}</div>}
    </form>
  );
}
```

- [ ] **Step 3: Viết `web/src/components/MealList.tsx`**

```tsx
import { deleteMeal } from '../api';
import { SLOT_LABEL, type Meal } from '../types';

interface Props {
  meals: Meal[];
  onChanged: () => void;
}

export function MealList({ meals, onChanged }: Props) {
  if (meals.length === 0) {
    return <p className="empty">Chưa ghi bữa nào cho ngày này.</p>;
  }

  async function remove(id: string) {
    await deleteMeal(id);
    onChanged();
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Buổi</th>
          <th>Món</th>
          <th style={{ textAlign: 'right' }}>Calo</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {meals.map((meal) => (
          <tr key={meal.id}>
            <td>{SLOT_LABEL[meal.slot]}</td>
            <td>{meal.name}</td>
            <td style={{ textAlign: 'right' }}>{meal.calories}</td>
            <td style={{ textAlign: 'right' }}>
              <button className="link" onClick={() => void remove(meal.id)}>
                Xóa
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Viết `web/src/pages/Today.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { getGoal, getMeals, todayIsoLocal } from '../api';
import { BodyLogForm } from '../components/BodyLogForm';
import { MealForm } from '../components/MealForm';
import { MealList } from '../components/MealList';
import type { Goal, Meal } from '../types';

export function Today() {
  const [date, setDate] = useState(todayIsoLocal());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    getMeals(date)
      .then(setMeals)
      .catch((e: Error) => setError(e.message));
  }, [date]);

  useEffect(reload, [reload]);
  useEffect(() => {
    getGoal().then(setGoal).catch(() => setGoal(null));
  }, []);

  const total = meals.reduce((sum, m) => sum + m.calories, 0);
  const target = goal?.dailyCalorieTarget ?? null;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : null;

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="date">Ngày</label>
          <input
            id="date"
            type="date"
            value={date}
            max={todayIsoLocal()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <BodyLogForm date={date} onSaved={reload} />

      <div className="card">
        <h2>Bữa ăn</h2>
        <MealList meals={meals} onChanged={reload} />
        <MealForm date={date} onAdded={reload} />
      </div>

      <div className="card">
        <h2>Tổng calo</h2>
        <p style={{ fontSize: 28, margin: '0 0 8px', fontWeight: 600 }}>
          {total}
          {target != null && <span className="muted" style={{ fontSize: 16 }}> / {target}</span>}
        </p>
        {pct != null ? (
          <div style={{ background: 'var(--line)', borderRadius: 4, height: 8 }}>
            <div
              style={{
                width: `${pct}%`,
                background: total > (target ?? 0) ? 'var(--warn)' : 'var(--accent)',
                height: '100%',
                borderRadius: 4,
              }}
            />
          </div>
        ) : (
          <p className="muted">Đặt mục tiêu calo ở tab Cài đặt để thấy tiến độ.</p>
        )}
      </div>

      {error && <div className="error">{error}</div>}
    </>
  );
}
```

- [ ] **Step 5: Viết test cho các component (fail trước)**

Tạo `web/src/components/MealForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealForm } from './MealForm';
import * as api from '../api';

beforeEach(() => {
  vi.spyOn(api, 'createMeal').mockResolvedValue({
    id: '1',
    date: '2026-08-06',
    slot: 'breakfast',
    name: 'Phở',
    calories: 450,
    note: null,
  });
});

describe('MealForm', () => {
  it('gửi được bữa ăn hợp lệ và xóa trắng form', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    render(<MealForm date="2026-08-06" onAdded={onAdded} />);

    await user.type(screen.getByLabelText('Tên món'), 'Phở bò');
    await user.type(screen.getByLabelText('Calo'), '450');
    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    expect(api.createMeal).toHaveBeenCalledWith({
      date: '2026-08-06',
      slot: 'breakfast',
      name: 'Phở bò',
      calories: 450,
    });
    expect(onAdded).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Tên món')).toHaveValue('');
  });

  it('chặn tên rỗng, không gọi API', async () => {
    const user = userEvent.setup();
    render(<MealForm date="2026-08-06" onAdded={vi.fn()} />);

    await user.type(screen.getByLabelText('Calo'), '450');
    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    expect(screen.getByText('Nhập tên món')).toBeInTheDocument();
    expect(api.createMeal).not.toHaveBeenCalled();
  });

  it('chặn calo âm, không gọi API', async () => {
    const user = userEvent.setup();
    render(<MealForm date="2026-08-06" onAdded={vi.fn()} />);

    await user.type(screen.getByLabelText('Tên món'), 'Phở');
    await user.type(screen.getByLabelText('Calo'), '-5');
    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    expect(screen.getByText('Calo phải là số nguyên không âm')).toBeInTheDocument();
    expect(api.createMeal).not.toHaveBeenCalled();
  });

  it('hiển thị lỗi từ server', async () => {
    vi.spyOn(api, 'createMeal').mockRejectedValue(new Error('Ngày ở tương lai'));
    const user = userEvent.setup();
    render(<MealForm date="2026-08-06" onAdded={vi.fn()} />);

    await user.type(screen.getByLabelText('Tên món'), 'Phở');
    await user.type(screen.getByLabelText('Calo'), '450');
    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    expect(await screen.findByText('Ngày ở tương lai')).toBeInTheDocument();
  });
});
```

Tạo `web/src/components/MealList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealList } from './MealList';
import * as api from '../api';
import type { Meal } from '../types';

const meal = (over: Partial<Meal> = {}): Meal => ({
  id: 'm1',
  date: '2026-08-06',
  slot: 'lunch',
  name: 'Cơm tấm',
  calories: 700,
  note: null,
  ...over,
});

describe('MealList', () => {
  it('hiện thông báo rỗng khi chưa có bữa nào', () => {
    render(<MealList meals={[]} onChanged={vi.fn()} />);
    expect(screen.getByText('Chưa ghi bữa nào cho ngày này.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('hiện tên buổi bằng tiếng Việt', () => {
    render(<MealList meals={[meal()]} onChanged={vi.fn()} />);
    expect(screen.getByText('Trưa')).toBeInTheDocument();
    expect(screen.getByText('Cơm tấm')).toBeInTheDocument();
    expect(screen.getByText('700')).toBeInTheDocument();
  });

  it('xóa gọi API rồi báo cho cha reload', async () => {
    vi.spyOn(api, 'deleteMeal').mockResolvedValue(undefined);
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<MealList meals={[meal()]} onChanged={onChanged} />);

    await user.click(screen.getByRole('button', { name: 'Xóa' }));

    expect(api.deleteMeal).toHaveBeenCalledWith('m1');
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  });
});
```

Tạo `web/src/pages/Today.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Today } from './Today';
import * as api from '../api';
import type { Meal } from '../types';

const meals: Meal[] = [
  { id: '1', date: '2026-08-06', slot: 'breakfast', name: 'Phở', calories: 450, note: null },
  { id: '2', date: '2026-08-06', slot: 'lunch', name: 'Cơm', calories: 700, note: null },
];

beforeEach(() => {
  vi.spyOn(api, 'getBodyLog').mockResolvedValue(null);
  vi.spyOn(api, 'getMeals').mockResolvedValue(meals);
});

describe('Today', () => {
  it('cộng tổng calo của các bữa trong ngày', async () => {
    vi.spyOn(api, 'getGoal').mockResolvedValue({
      targetWeightKg: null,
      targetDate: null,
      dailyCalorieTarget: null,
    });
    render(<Today />);
    expect(await screen.findByText('1150')).toBeInTheDocument();
  });

  it('nhắc đặt mục tiêu khi chưa có mục tiêu calo', async () => {
    vi.spyOn(api, 'getGoal').mockResolvedValue({
      targetWeightKg: null,
      targetDate: null,
      dailyCalorieTarget: null,
    });
    render(<Today />);
    expect(
      await screen.findByText('Đặt mục tiêu calo ở tab Cài đặt để thấy tiến độ.'),
    ).toBeInTheDocument();
  });

  it('hiện tổng trên mục tiêu khi đã đặt mục tiêu', async () => {
    vi.spyOn(api, 'getGoal').mockResolvedValue({
      targetWeightKg: 68,
      targetDate: null,
      dailyCalorieTarget: 1900,
    });
    render(<Today />);
    expect(await screen.findByText('/ 1900')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Chạy test**

Chạy: `cd web && npm test`
Kỳ vọng: PASS toàn bộ, gồm cả `api.test.ts` từ Task 12.

- [ ] **Step 7: Kiểm tra thủ công**

Chạy server (`cd server && npm run dev`) và web (`cd web && npm run dev`), mở `http://localhost:7173`. Xác nhận từng mục:

1. Nhập cân nặng `72.4`, click ra ngoài → hiện "Đã lưu". Refresh trang → giá trị vẫn còn.
2. Xóa trắng ô vòng bụng, click ra ngoài → không lỗi; refresh → vẫn trống.
3. Thêm bữa "Phở bò" 450 calo buổi Sáng → xuất hiện trong bảng, tổng calo = 450.
4. Thêm bữa thứ hai → tổng cộng dồn đúng.
5. Xóa một bữa → tổng giảm đúng.
6. Nhập calo `-5` → hiện lỗi, không tạo bản ghi.
7. Nhập tên rỗng → hiện lỗi.
8. Đổi ngày sang hôm qua → dữ liệu đổi theo, form số đo nạp lại đúng.
9. Ô chọn ngày không cho chọn ngày tương lai (thuộc tính `max`).

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/ web/src/components/
git commit -m "feat(web): Today page with body log and meal entry"
```

---

## Task 14: Trang "Biểu đồ"

**Files:**
- Modify: `web/src/pages/Charts.tsx`
- Create: `web/src/components/TrendChart.tsx`, `web/src/components/CalorieChart.tsx`, `web/src/components/GoalCard.tsx`

**Interfaces:**
- Consumes: `getSummary` (Task 12); `Summary`, `SummaryDay`, `GoalProgress` (Task 12); `recharts`
- Produces: `Charts` component

- [ ] **Step 1: Viết `web/src/components/TrendChart.tsx`**

```tsx
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SummaryDay } from '../types';

interface Props {
  title: string;
  days: SummaryDay[];
  rawKey: 'weightKg' | 'waistCm';
  maKey: 'weightMa7' | 'waistMa7';
  unit: string;
  targetValue?: number | null;
}

/**
 * MA7 là đường được làm nổi bật; điểm thô để mờ.
 * Cân nặng dao động 1-2 kg mỗi ngày do nước và thức ăn trong ruột —
 * nhìn điểm thô sẽ tưởng lên xuống thất thường, MA7 mới là xu hướng thật.
 */
export function TrendChart({ title, days, rawKey, maKey, unit, targetValue }: Props) {
  const hasData = days.some((d) => d[maKey] !== null);

  return (
    <div className="card">
      <h2>{title}</h2>
      {!hasData ? (
        <p className="empty">Cần ít nhất 2 ngày có số đo trong vòng 7 ngày để vẽ xu hướng.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#e3e0da" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={32} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit={unit} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={rawKey}
              name="Số đo thô"
              stroke="#c9c4bb"
              strokeWidth={1}
              dot={{ r: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={maKey}
              name="Trung bình 7 ngày"
              stroke="#2f6f4f"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {targetValue != null && (
              <ReferenceLine y={targetValue} stroke="#b4553a" strokeDasharray="4 4" label="Mục tiêu" />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Viết `web/src/components/CalorieChart.tsx`**

```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SummaryDay, SummaryWeek } from '../types';

interface Props {
  days: SummaryDay[];
  weeks: SummaryWeek[];
  dailyTarget: number | null;
}

export function CalorieChart({ days, weeks, dailyTarget }: Props) {
  const hasData = days.some((d) => d.mealCount > 0);
  const loggedWeeks = weeks.filter((w) => w.avgCalories !== null);
  const overallAvg =
    loggedWeeks.length > 0
      ? loggedWeeks.reduce((sum, w) => sum + (w.avgCalories as number), 0) / loggedWeeks.length
      : null;

  return (
    <div className="card">
      <h2>Calo theo ngày</h2>
      {!hasData ? (
        <p className="empty">Chưa ghi bữa nào trong khoảng thời gian này.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#e3e0da" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={32} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalCalories" name="Calo" fill="#2f6f4f" isAnimationActive={false} />
              {dailyTarget != null && (
                <ReferenceLine y={dailyTarget} stroke="#b4553a" strokeDasharray="4 4" label="Mục tiêu" />
              )}
              {overallAvg != null && (
                <ReferenceLine y={overallAvg} stroke="#6b6862" strokeDasharray="2 4" label="TB tuần" />
              )}
            </BarChart>
          </ResponsiveContainer>
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Tuần từ</th>
                <th style={{ textAlign: 'right' }}>TB calo/ngày</th>
                <th style={{ textAlign: 'right' }}>TB cân nặng</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.weekStart}>
                  <td>{week.weekStart}</td>
                  <td style={{ textAlign: 'right' }}>
                    {week.avgCalories != null ? Math.round(week.avgCalories) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {week.avgWeightKg != null ? week.avgWeightKg.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            Trung bình tuần chỉ tính trên ngày có ghi bữa ăn — ngày quên ghi không bị coi là 0 calo.
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Viết `web/src/components/GoalCard.tsx`**

```tsx
import type { GoalProgress } from '../types';

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)} kg/tuần`;
}

export function GoalCard({ goal }: { goal: GoalProgress }) {
  if (goal.targetWeightKg == null) {
    return (
      <div className="card">
        <h2>Mục tiêu</h2>
        <p className="empty">Chưa đặt mục tiêu. Vào tab Cài đặt để đặt.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Mục tiêu</h2>
      <table>
        <tbody>
          <tr>
            <td>Cân nặng mục tiêu</td>
            <td style={{ textAlign: 'right' }}>{goal.targetWeightKg} kg</td>
          </tr>
          <tr>
            <td>Trung bình 7 ngày hiện tại</td>
            <td style={{ textAlign: 'right' }}>
              {goal.currentMa7WeightKg != null ? `${goal.currentMa7WeightKg.toFixed(1)} kg` : '—'}
            </td>
          </tr>
          <tr>
            <td>Còn lại</td>
            <td style={{ textAlign: 'right' }}>
              {goal.remainingKg != null ? `${goal.remainingKg.toFixed(1)} kg` : '—'}
            </td>
          </tr>
          <tr>
            <td>Tốc độ hiện tại</td>
            <td style={{ textAlign: 'right' }}>{formatRate(goal.currentRateKgPerWeek)}</td>
          </tr>
          <tr>
            <td>Tốc độ cần thiết</td>
            <td style={{ textAlign: 'right' }}>{formatRate(goal.requiredRateKgPerWeek)}</td>
          </tr>
          <tr>
            <td>Tiến độ</td>
            <td
              style={{
                textAlign: 'right',
                color: goal.onTrack === false ? 'var(--warn)' : 'var(--accent)',
              }}
            >
              {goal.onTrack === null
                ? 'Chưa đủ dữ liệu'
                : goal.onTrack
                  ? 'Đúng tiến độ'
                  : 'Chậm hơn kế hoạch'}
            </td>
          </tr>
        </tbody>
      </table>
      {goal.currentRateKgPerWeek === null && (
        <p className="muted">
          Cần khoảng 3 tuần cân đều để tính được tốc độ thay đổi.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Viết `web/src/pages/Charts.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getSummary, todayIsoLocal } from '../api';
import { CalorieChart } from '../components/CalorieChart';
import { GoalCard } from '../components/GoalCard';
import { TrendChart } from '../components/TrendChart';
import type { Summary } from '../types';

const RANGES = [
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
  { days: 365, label: '1 năm' },
];

function isoDaysAgo(days: number): string {
  const today = todayIsoLocal();
  const ms = Date.parse(`${today}T00:00:00Z`) - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function Charts() {
  const [rangeDays, setRangeDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getSummary(isoDaysAgo(rangeDays - 1), todayIsoLocal())
      .then((data) => !cancelled && setSummary(data))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

  if (error) return <div className="error">{error}</div>;
  if (!summary) return <p className="empty">Đang tải…</p>;

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        {RANGES.map((r) => (
          <button
            key={r.days}
            className={r.days === rangeDays ? 'primary' : 'link'}
            onClick={() => setRangeDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <TrendChart
        title="Cân nặng"
        days={summary.days}
        rawKey="weightKg"
        maKey="weightMa7"
        unit=" kg"
        targetValue={summary.goal.targetWeightKg}
      />
      <TrendChart
        title="Vòng bụng"
        days={summary.days}
        rawKey="waistCm"
        maKey="waistMa7"
        unit=" cm"
      />
      <CalorieChart
        days={summary.days}
        weeks={summary.weeks}
        dailyTarget={summary.goal.dailyCalorieTarget}
      />
      <GoalCard goal={summary.goal} />
    </>
  );
}
```

- [ ] **Step 5: Viết test (fail trước)**

Chỉ test những gì không phụ thuộc Recharts: trạng thái rỗng (render **thay cho** biểu đồ) và `GoalCard` (thuần presentational). Không test nội dung SVG do Recharts sinh — trong jsdom `ResponsiveContainer` có kích thước 0 nên không render gì, test như vậy sẽ giòn và vô nghĩa.

Tạo `web/src/components/GoalCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalCard } from './GoalCard';
import type { GoalProgress } from '../types';

const goal = (over: Partial<GoalProgress> = {}): GoalProgress => ({
  targetWeightKg: 68,
  targetDate: '2026-12-31',
  dailyCalorieTarget: 1900,
  currentMa7WeightKg: 72.9,
  remainingKg: 4.9,
  currentRateKgPerWeek: -0.35,
  requiredRateKgPerWeek: -0.24,
  onTrack: true,
  ...over,
});

describe('GoalCard', () => {
  it('nhắc đặt mục tiêu khi chưa có', () => {
    render(<GoalCard goal={goal({ targetWeightKg: null })} />);
    expect(screen.getByText('Chưa đặt mục tiêu. Vào tab Cài đặt để đặt.')).toBeInTheDocument();
  });

  it('hiện tốc độ kèm dấu, âm là đang giảm', () => {
    render(<GoalCard goal={goal()} />);
    expect(screen.getByText('-0.35 kg/tuần')).toBeInTheDocument();
    expect(screen.getByText('-0.24 kg/tuần')).toBeInTheDocument();
  });

  it('hiện dấu + khi đang tăng cân', () => {
    render(<GoalCard goal={goal({ currentRateKgPerWeek: 0.2 })} />);
    expect(screen.getByText('+0.20 kg/tuần')).toBeInTheDocument();
  });

  it('hiện gạch ngang khi tốc độ là null', () => {
    render(<GoalCard goal={goal({ currentRateKgPerWeek: null })} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('báo chưa đủ dữ liệu khi onTrack là null', () => {
    render(<GoalCard goal={goal({ onTrack: null, currentRateKgPerWeek: null })} />);
    expect(screen.getByText('Chưa đủ dữ liệu')).toBeInTheDocument();
    expect(
      screen.getByText('Cần khoảng 3 tuần cân đều để tính được tốc độ thay đổi.'),
    ).toBeInTheDocument();
  });

  it('phân biệt đúng tiến độ và chậm hơn kế hoạch', () => {
    const { rerender } = render(<GoalCard goal={goal({ onTrack: true })} />);
    expect(screen.getByText('Đúng tiến độ')).toBeInTheDocument();
    rerender(<GoalCard goal={goal({ onTrack: false })} />);
    expect(screen.getByText('Chậm hơn kế hoạch')).toBeInTheDocument();
  });
});
```

Tạo `web/src/components/TrendChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart } from './TrendChart';
import type { SummaryDay } from '../types';

const day = (date: string, weightMa7: number | null): SummaryDay => ({
  date,
  weightKg: 72,
  weightMa7,
  waistCm: null,
  waistMa7: null,
  totalCalories: 0,
  mealCount: 0,
});

describe('TrendChart', () => {
  it('hiện hướng dẫn thay vì biểu đồ trống khi chưa đủ dữ liệu', () => {
    render(
      <TrendChart
        title="Cân nặng"
        days={[day('2026-08-01', null)]}
        rawKey="weightKg"
        maKey="weightMa7"
        unit=" kg"
      />,
    );
    expect(
      screen.getByText('Cần ít nhất 2 ngày có số đo trong vòng 7 ngày để vẽ xu hướng.'),
    ).toBeInTheDocument();
  });

  it('không hiện thông báo rỗng khi đã có MA7', () => {
    render(
      <TrendChart
        title="Cân nặng"
        days={[day('2026-08-01', 72), day('2026-08-02', 72.5)]}
        rawKey="weightKg"
        maKey="weightMa7"
        unit=" kg"
      />,
    );
    expect(screen.queryByText(/Cần ít nhất 2 ngày/)).not.toBeInTheDocument();
    expect(screen.getByText('Cân nặng')).toBeInTheDocument();
  });
});
```

Tạo `web/src/components/CalorieChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalorieChart } from './CalorieChart';
import type { SummaryDay, SummaryWeek } from '../types';

const day = (date: string, totalCalories: number, mealCount: number): SummaryDay => ({
  date,
  weightKg: null,
  weightMa7: null,
  waistCm: null,
  waistMa7: null,
  totalCalories,
  mealCount,
});

describe('CalorieChart', () => {
  it('hiện thông báo rỗng khi chưa ghi bữa nào', () => {
    render(<CalorieChart days={[day('2026-08-01', 0, 0)]} weeks={[]} dailyTarget={null} />);
    expect(screen.getByText('Chưa ghi bữa nào trong khoảng thời gian này.')).toBeInTheDocument();
  });

  it('hiện bảng tuần với gạch ngang cho tuần không có dữ liệu', () => {
    const weeks: SummaryWeek[] = [
      { weekStart: '2026-08-03', avgCalories: 1800, avgWeightKg: null },
    ];
    render(<CalorieChart days={[day('2026-08-03', 1800, 2)]} weeks={weeks} dailyTarget={1900} />);
    expect(screen.getByText('2026-08-03')).toBeInTheDocument();
    expect(screen.getByText('1800')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('giải thích quy tắc trung bình tuần cho người dùng', () => {
    render(<CalorieChart days={[day('2026-08-03', 1800, 2)]} weeks={[]} dailyTarget={null} />);
    expect(screen.getByText(/ngày quên ghi không bị coi là 0 calo/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Chạy test**

Chạy: `cd web && npm test`
Kỳ vọng: PASS toàn bộ.

- [ ] **Step 7: Kiểm tra thủ công**

Với server và web đang chạy:

1. Mở tab Biểu đồ khi DB rỗng → thấy thông báo "Cần ít nhất 2 ngày…", **không** thấy biểu đồ trống hay số 0.
2. Nhập số đo cho 3 ngày liên tiếp (dùng bộ chọn ngày ở tab Hôm nay) → biểu đồ cân nặng hiện, đường MA7 đậm hơn đường điểm thô.
3. Ghi vài bữa ăn ở các ngày khác nhau → biểu đồ cột calo hiện, bảng tuần có dòng.
4. Đặt mục tiêu ở tab Cài đặt (Task 15) → đường mục tiêu xuất hiện trên biểu đồ cân nặng.
5. Chuyển giữa 30/90/365 ngày → dữ liệu tải lại, không lỗi console.

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/ web/src/components/
git commit -m "feat(web): charts page with MA7-forward trend lines"
```

---

## Task 15: Trang "Cài đặt" + README

**Files:**
- Modify: `web/src/pages/Settings.tsx`
- Create: `Lean/README.md`

**Interfaces:**
- Consumes: `getGoal`, `putGoal`, `getReminders`, `putReminder` (Task 12)
- Produces: `Settings` component; README hướng dẫn chạy

- [ ] **Step 1: Viết `web/src/pages/Settings.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getGoal, getReminders, putGoal, putReminder } from '../api';
import type { Goal, Reminder } from '../types';

const REMINDER_LABEL: Record<Reminder['kind'], string> = {
  weigh_in: 'Nhắc cân buổi sáng',
  meal_log: 'Nhắc ghi bữa ăn',
};

export function Settings() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getGoal(), getReminders()])
      .then(([g, r]) => {
        setGoal(g);
        setReminders(r);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function flash(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 1500);
  }

  async function saveGoal(patch: Partial<Goal>) {
    setError(null);
    try {
      setGoal(await putGoal(patch));
      flash('Đã lưu mục tiêu');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveReminder(kind: Reminder['kind'], patch: Partial<Reminder>) {
    setError(null);
    try {
      const updated = await putReminder(kind, patch);
      setReminders((prev) => prev.map((r) => (r.kind === kind ? updated : r)));
      flash('Đã lưu nhắc nhở');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function numberOrNull(raw: string): number | null {
    return raw.trim() === '' ? null : Number(raw);
  }

  if (!goal) return <p className="empty">Đang tải…</p>;

  return (
    <>
      <div className="card">
        <h2>Mục tiêu</h2>
        <div className="row">
          <div>
            <label htmlFor="tw">Cân nặng mục tiêu (kg)</label>
            <input
              id="tw"
              type="number"
              step="0.1"
              defaultValue={goal.targetWeightKg ?? ''}
              onBlur={(e) => void saveGoal({ targetWeightKg: numberOrNull(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="td">Hạn</label>
            <input
              id="td"
              type="date"
              defaultValue={goal.targetDate ?? ''}
              onBlur={(e) =>
                void saveGoal({ targetDate: e.target.value.trim() === '' ? null : e.target.value })
              }
            />
          </div>
          <div>
            <label htmlFor="dc">Calo mục tiêu/ngày</label>
            <input
              id="dc"
              type="number"
              defaultValue={goal.dailyCalorieTarget ?? ''}
              onBlur={(e) => void saveGoal({ dailyCalorieTarget: numberOrNull(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Nhắc nhở</h2>
        <p className="muted">
          Nhắc nhở chỉ hoạt động khi server đang chạy. Máy tính tắt thì không có nhắc, và
          cũng không gửi bù khi bật lại. Cài app ntfy trên điện thoại rồi subscribe đúng topic
          dưới đây để nhận.
        </p>
        {reminders.map((reminder) => (
          <div key={reminder.kind} className="row" style={{ marginTop: 16 }}>
            <div style={{ minWidth: 180 }}>
              <label>{REMINDER_LABEL[reminder.kind]}</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit' }}>
                <input
                  type="checkbox"
                  checked={reminder.enabled}
                  onChange={(e) => void saveReminder(reminder.kind, { enabled: e.target.checked })}
                />
                Bật
              </label>
            </div>
            <div>
              <label htmlFor={`t-${reminder.kind}`}>Giờ</label>
              <input
                id={`t-${reminder.kind}`}
                type="time"
                defaultValue={reminder.timeOfDay}
                onBlur={(e) => void saveReminder(reminder.kind, { timeOfDay: e.target.value })}
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor={`n-${reminder.kind}`}>ntfy topic</label>
              <input
                id={`n-${reminder.kind}`}
                defaultValue={reminder.ntfyTopic ?? ''}
                placeholder="lean-abc123"
                style={{ width: '100%' }}
                onBlur={(e) =>
                  void saveReminder(reminder.kind, {
                    ntfyTopic: e.target.value.trim() === '' ? null : e.target.value.trim(),
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>

      {status && <p className="muted">{status}</p>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
```

- [ ] **Step 2: Viết test cho `Settings` (fail trước)**

Tạo `web/src/pages/Settings.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from './Settings';
import * as api from '../api';
import type { Reminder } from '../types';

const reminders: Reminder[] = [
  { kind: 'weigh_in', timeOfDay: '07:00', enabled: false, ntfyTopic: null },
  { kind: 'meal_log', timeOfDay: '20:00', enabled: false, ntfyTopic: null },
];

beforeEach(() => {
  vi.spyOn(api, 'getGoal').mockResolvedValue({
    targetWeightKg: 68,
    targetDate: '2026-12-31',
    dailyCalorieTarget: 1900,
  });
  vi.spyOn(api, 'getReminders').mockResolvedValue(reminders);
  vi.spyOn(api, 'putGoal').mockImplementation(async (patch) => ({
    targetWeightKg: 68,
    targetDate: '2026-12-31',
    dailyCalorieTarget: 1900,
    ...patch,
  }));
  vi.spyOn(api, 'putReminder').mockImplementation(async (kind, patch) => ({
    ...reminders.find((r) => r.kind === kind)!,
    ...patch,
  }));
});

describe('Settings', () => {
  it('nạp và hiển thị mục tiêu đang lưu', async () => {
    render(<Settings />);
    expect(await screen.findByLabelText('Cân nặng mục tiêu (kg)')).toHaveValue(68);
    expect(screen.getByLabelText('Calo mục tiêu/ngày')).toHaveValue(1900);
  });

  it('lưu mục tiêu khi rời khỏi ô', async () => {
    const user = userEvent.setup();
    render(<Settings />);
    const input = await screen.findByLabelText('Cân nặng mục tiêu (kg)');

    await user.clear(input);
    await user.type(input, '66');
    await user.tab();

    expect(api.putGoal).toHaveBeenCalledWith({ targetWeightKg: 66 });
  });

  it('ô để trống lưu thành null chứ không phải 0', async () => {
    const user = userEvent.setup();
    render(<Settings />);
    const input = await screen.findByLabelText('Calo mục tiêu/ngày');

    await user.clear(input);
    await user.tab();

    expect(api.putGoal).toHaveBeenCalledWith({ dailyCalorieTarget: null });
  });

  it('cảnh báo rõ nhắc nhở chỉ chạy khi server bật', async () => {
    render(<Settings />);
    expect(await screen.findByText(/chỉ hoạt động khi server đang chạy/)).toBeInTheDocument();
  });

  it('hiện cả hai loại nhắc nhở', async () => {
    render(<Settings />);
    expect(await screen.findByText('Nhắc cân buổi sáng')).toBeInTheDocument();
    expect(screen.getByText('Nhắc ghi bữa ăn')).toBeInTheDocument();
  });

  it('bật nhắc nhở gọi API với đúng kind', async () => {
    const user = userEvent.setup();
    render(<Settings />);
    const checkboxes = await screen.findAllByRole('checkbox');

    await user.click(checkboxes[0]!);

    expect(api.putReminder).toHaveBeenCalledWith('weigh_in', { enabled: true });
  });

  it('topic để trống lưu thành null', async () => {
    const user = userEvent.setup();
    render(<Settings />);
    const topic = await screen.findByLabelText('ntfy topic', { selector: '#n-weigh_in' });

    await user.type(topic, '   ');
    await user.tab();

    expect(api.putReminder).toHaveBeenCalledWith('weigh_in', { ntfyTopic: null });
  });

  it('hiện lỗi validate từ server', async () => {
    vi.spyOn(api, 'putGoal').mockRejectedValue(new Error('Dữ liệu không hợp lệ'));
    const user = userEvent.setup();
    render(<Settings />);
    const input = await screen.findByLabelText('Cân nặng mục tiêu (kg)');

    await user.clear(input);
    await user.type(input, '0');
    await user.tab();

    expect(await screen.findByText('Dữ liệu không hợp lệ')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Chạy test**

Chạy: `cd web && npm test`
Kỳ vọng: PASS toàn bộ suite web.

- [ ] **Step 4: Kiểm tra thủ công**

1. Đặt cân nặng mục tiêu `68`, hạn `2026-12-31`, calo `1900` → mỗi ô hiện "Đã lưu mục tiêu" khi rời ô. Refresh → giá trị còn nguyên.
2. Sang tab Hôm nay → thanh tiến độ calo xuất hiện.
3. Sang tab Biểu đồ → đường mục tiêu xuất hiện trên biểu đồ cân nặng.
4. Bật nhắc cân, đặt giờ, nhập topic → lưu được, refresh vẫn còn.
5. Nhập cân nặng mục tiêu `0` → hiện lỗi validate từ server, không lưu.
6. Xóa trắng ô hạn → lưu thành công với `null`.

- [ ] **Step 5: Viết `Lean/README.md`**

````markdown
# Lean — Theo dõi sức khỏe cá nhân

App ghi cân nặng, vòng bụng và bữa ăn hàng ngày, hiển thị xu hướng và tiến độ mục tiêu.
Chạy hoàn toàn trên máy bạn, không tốn phí, không gửi dữ liệu đi đâu.

## Yêu cầu

- Node.js 20 trở lên

## Chạy lần đầu

```bash
# Terminal 1 — server
cd server
npm install
cp .env.example .env
npx prisma db push        # tạo prisma/data.db
npm run dev               # http://localhost:3000

# Terminal 2 — web
cd web
npm install
npm run dev               # http://localhost:7173
```

Mở http://localhost:7173.

## Chạy các lần sau

Chỉ cần `npm run dev` ở cả hai thư mục.

## Nhắc nhở qua điện thoại

1. Cài app **ntfy** (iOS / Android).
2. Nghĩ một topic khó đoán, ví dụ `lean-<tên>-<vài ký tự ngẫu nhiên>`. Ai biết topic
   cũng đọc được thông báo của bạn, nên đừng đặt tên dễ đoán.
3. Subscribe topic đó trong app.
4. Vào tab **Cài đặt** trong Lean, nhập topic, đặt giờ, bật nhắc.

**Nhắc nhở chỉ chạy khi server đang bật.** Tắt máy thì không có nhắc, và cũng không gửi bù.

## Sao lưu

Toàn bộ dữ liệu nằm trong một file: `server/prisma/data.db`. Copy file đó là xong.

## Test

```bash
cd server && npm test    # logic thống kê, API, nhắc nhở
cd web && npm test       # api client, form, trạng thái rỗng
```

## Tài liệu

- `2026-08-06-health-tracker-design.md` — thiết kế: data model, API, logic thống kê
- `2026-08-06-health-tracker-plan.md` — kế hoạch triển khai từng bước
- `CLAUDE.md` — quy ước cho Claude Code

## Vì sao không có AI tính calo từ ảnh

Đã cân nhắc và bỏ. Ước tính calo từ ảnh có sai số ±20–40% vì AI không thấy được khối
lượng thật, dầu mỡ hay cách chế biến; và nó là phần duy nhất tốn tiền. Nhập tay chính
xác hơn và miễn phí. Nếu sau này đổi ý, §10 của file thiết kế mô tả đường mở rộng.
````

- [ ] **Step 6: Chạy đầy đủ trước khi commit**

```bash
cd server && npm test && npm run build
cd ../web && npm test && npm run build
```

Kỳ vọng: cả hai suite test PASS, cả hai build thành công, không lỗi TypeScript.

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/ README.md
git commit -m "feat(web): settings page for goal and reminders; add README"
```

---

## Self-Review

**1. Spec coverage** — đối chiếu từng mục của spec:

| Spec | Task |
|---|---|
| §2 Ghi số đo cơ thể | 7 (API), 13 (UI) |
| §2 Ghi bữa ăn | 8 (API), 13 (UI) |
| §2 Biểu đồ xu hướng + MA7 | 3 (logic), 10 (API), 14 (UI) |
| §2 Thống kê calo, TB tuần | 5 (logic), 10 (API), 14 (UI) |
| §2 Mục tiêu cân nặng + tiến độ | 4 (logic), 9 (API), 14 (UI), 15 (đặt mục tiêu) |
| §2 Nhắc nhở | 11 |
| §3 Cấu trúc thư mục | 1, 6, 12 |
| §3 SQLite, không auth | 2 (schema), 6 (`app.ts` không có middleware auth) |
| §4 Data model | 2 |
| §5 API 13 endpoint | 7, 8, 9, 10, 11 |
| §5 Quy tắc validate | 6 (schema dùng chung), 7–11 (áp dụng) |
| §6 Logic thống kê | 3, 4, 5 |
| §7 Ba màn hình | 13, 14, 15 |
| §7 Xử lý trạng thái rỗng | 14 (`.empty`), 15 |
| §8 Nhắc nhở có điều kiện | 11 |
| §9 Kiểm thử | 1, 2, 3, 4, 5, 7, 8, 9, 10, 11 |
| §11 Chạy thử | 15 (README) |

Không có mục nào của spec thiếu task. §10 (chừa chỗ cho AI) là ghi chú tương lai, đúng ra không có task — đã ghi lại trong README.

**2. Placeholder scan** — không có "TBD"/"TODO"/"tương tự Task N"; mọi bước code đều có code block thật; mọi bước test đều có test code thật và lệnh chạy cụ thể kèm kết quả kỳ vọng.

**3. Type consistency** — đã đối chiếu:
- `DailyValue` (Task 3) dùng nguyên vẹn ở Tasks 4, 10 ✓
- `valueAt` khai báo ở Task 3, dùng ở Tasks 4, 10 ✓
- `DayInput`/`WeekSummary` (Task 5) khớp với cách Task 10 dựng `weekInput` ✓
- `GOAL_SINGLETON_ID` export ở Task 9, import ở Task 10 ✓
- `MEAL_SLOTS` ở `schemas.ts` (server, Task 6) và `types.ts` (web, Task 12) là hai bản riêng biệt có chủ đích — server không chia sẻ type với web; giá trị phải giữ giống nhau ✓
- `sendNtfy(topic, title, message, tags)` khai báo Task 11 Step 1, mock và gọi khớp thứ tự tham số ở Step 5/7 ✓
- Hình dạng `Summary` ở `types.ts` (web) khớp từng trường với JSON mà Task 10 trả ✓

Dòng import của `stats.ts` mở rộng dần qua ba task và mỗi task ghi rõ dạng đầy đủ mới: Task 3 dùng `{ addDays }`, Task 4 đổi thành `{ addDays, daysBetween }`, Task 5 đổi thành `{ addDays, daysBetween, startOfWeekMonday }`.

**Sửa sau khi rà (pre-flight):**
- Test ban đầu chạy chung `data.db` với ứng dụng; `deleteMany()` trong `beforeEach` sẽ xóa sạch dữ liệu thật của người dùng mỗi lần chạy `npm test`. Task 1 Step 3/3b nay tách DB test riêng (`test.db`) qua `env.DATABASE_URL` và `globalSetup`.
- Bỏ dòng `void daysBetween;` (code chết) khỏi Task 3.

---

## Execution Handoff

Plan hoàn tất và đã lưu vào `Lean/2026-08-06-health-tracker-plan.md`.
