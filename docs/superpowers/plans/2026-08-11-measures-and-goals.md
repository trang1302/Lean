# Kế hoạch triển khai `measures-and-goals`

> **Cho agent thực thi:** SKILL BẮT BUỘC — dùng `superpowers:subagent-driven-development`
> (khuyến nghị) hoặc `superpowers:executing-plans` để làm từng task một.
> Các bước dùng cú pháp checkbox (`- [ ]`) để theo dõi.

**Mục tiêu:** Thêm 3 số đo cơ thể (`chestCm`, `shoulderCm`, `armCm`) và 6 trường mục tiêu
(`startWeightKg`, `startDate`, 4 target vòng) xuyên suốt DB → API → form web, không đụng biểu đồ.

**Kiến trúc:** Bám 4 lớp sẵn có (controller → service → repository → Prisma). Mọi chỗ đang
liệt kê tay từng số đo được chuyển sang **bảng khai báo + vòng lặp**, vì 5 số đo mà viết tay
là 5 cơ hội quên một dòng — và quên một dòng ở đây nghĩa là mất dữ liệu người dùng. Công thức
thống kê không di chuyển: `shared/stats/` không sửa một dòng.

**Stack:** Express 5 · Prisma 7 + SQLite · Zod 4 · React 19 · Vitest 4 · supertest 7

---

## Global Constraints

Áp dụng cho **mọi** task dưới đây, không nhắc lại ở từng task.

- **KHÔNG chạy `git commit` / `git push`.** `CLAUDE.local.md` cấm. Mỗi task kết thúc bằng
  checkpoint báo cáo, chủ dự án tự commit.
- **KHÔNG đụng `server/data.db`.** Kể cả `npx prisma db push` — xem Task 0.
- **`date` / `startDate` / `targetDate` luôn là chuỗi `"YYYY-MM-DD"`**, không bao giờ `DateTime`.
- **KHÔNG sửa file nào trong `server/src/shared/stats/`.** Đang mở file ở đó = đã làm sai chỗ.
- **KHÔNG đụng `web/src/features/charts/`** — với MỘT ngoại lệ đã chốt (2026-08-11, sau khi
  Task 4 phát hiện): được phép **thêm trường còn thiếu vào object literal trong file test**
  của `charts/`. Chỉ vậy. Không đổi component, không đổi logic vẽ, không đổi cách tính.
  Lý do: `chartData.ts` (file nguồn) vẫn biên dịch được vì `NullableDayKey` là tập con của
  `SummaryDay` mở rộng — nhưng **fixture trong test của charts dựng `SummaryDay` đầy đủ**, nên
  mở rộng hợp đồng API làm chúng đỏ. Đây là chi phí tối thiểu để `npm run build` chạy được sau
  một thay đổi hợp đồng, khác hẳn việc thiết kế lại charts ở đợt 3. Xem Task 8 Bước 0.
- Prisma client import từ `src/generated/prisma`, **không** từ `@prisma/client`.
- Express 5 bắt lỗi async sẵn — không bọc try/catch để nuốt lỗi trong controller.
- Indent 2 spaces, single quotes, có semicolon. Comment bằng tiếng Việt như code hiện có.
- Nếu `npm test` treo tới timeout trong sandbox agent: chạy `VITEST_POOL=threads npm test`
  (lý do ghi ở `web/vite.config.ts` dòng 27–30).

**Spec nguồn:** `docs/superpowers/specs/2026-08-11-measures-and-goals-design.md`

---

## Cấu trúc file

**Server — sửa:**

| File | Trách nhiệm sau khi sửa |
|---|---|
| `server/prisma/schema.prisma` | `BodyLog` +3 cột, `Goal` +6 cột |
| `server/src/shared/validation/commonSchemas.ts` | `waistCmSchema` → `circumferenceCmSchema` dùng chung 4 vòng |
| `server/src/features/bodyLogs/dtos/bodyLogs.request.ts` | 6 khoá upsert, dựng patch bằng vòng lặp |
| `server/src/features/bodyLogs/dtos/bodyLogs.response.ts` | +3 trường |
| `server/src/features/bodyLogs/services/bodyLogs.service.ts` | `toResponse` +3 trường |
| `server/src/features/summary/repositories/summary.repository.ts` | `select` +3 cột, `GoalRow` +2 |
| `server/src/features/summary/dtos/summary.response.ts` | `SummaryDay` 5 cặp, `SummaryGoal` +2 |
| `server/src/features/summary/services/summary.service.ts` | Bảng `MEASURES` + vòng lặp |
| `server/src/features/goal/dtos/goal.request.ts` | 9 khoá, dựng patch bằng vòng lặp |
| `server/src/features/goal/dtos/goal.response.ts` | `GoalRow`/`GoalResponse` +6 |

**Server — KHÔNG cần sửa:** `bodyLogs.repository.ts`, `goal.repository.ts`
(cả hai spread `patch` nên tự nhận khoá mới), `bodyLogs.controller.ts`, `goal.controller.ts`,
`goal.service.ts`, toàn bộ `shared/stats/`.

**Web — tạo mới:** `web/src/constants/measures.ts`,
`web/src/features/settings/components/GoalSettingsSection.test.tsx`

**Web — sửa:** `web/src/types/api.ts`, `web/src/features/today/api/today.api.ts`,
`web/src/features/today/hooks/useBodyLogForm.ts`,
`web/src/features/today/components/BodyLogForm.tsx`,
`web/src/features/settings/api/settings.types.ts`,
`web/src/features/settings/components/GoalSettingsSection.tsx`

---

## Task 0: Đổi schema và đẩy vào DB

**Files:**
- Sửa: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: cột `chestCm`/`shoulderCm`/`armCm` trên `BodyLog`; `startWeightKg`/`startDate`/
  `targetWaistCm`/`targetChestCm`/`targetShoulderCm`/`targetArmCm` trên `Goal`.
  Mọi task sau đều cần Prisma client đã sinh lại từ schema này.

- [ ] **Bước 1: Sửa `model BodyLog`**

```prisma
model BodyLog {
  userId     String
  date       String
  weightKg   Float?
  waistCm    Float?
  chestCm    Float?
  shoulderCm Float?
  armCm      Float?
  note       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@id([userId, date])
}
```

- [ ] **Bước 2: Sửa `model Goal`**

```prisma
model Goal {
  userId             String   @id
  startWeightKg      Float?
  startDate          String?
  targetWeightKg     Float?
  targetWaistCm      Float?
  targetChestCm      Float?
  targetShoulderCm   Float?
  targetArmCm        Float?
  targetDate         String?
  dailyCalorieTarget Int?
  updatedAt          DateTime @updatedAt
}
```

- [ ] **Bước 3: Sinh lại Prisma client**

Chạy: `cd server && npx prisma generate`
Kỳ vọng: `Generated Prisma Client ... to .\src\generated\prisma`

- [ ] **Bước 4: Chạy suite server để xác nhận chưa vỡ gì**

Chạy: `cd server && npm test`
Kỳ vọng: PASS toàn bộ. `globalSetup.ts` tự `db push` vào `test.db`, cột mới xuất hiện ở đó.
Nếu đỏ: dừng, không đi tiếp — schema mới làm vỡ thứ đang chạy.

- [ ] **Bước 5: CHECKPOINT — báo cáo, chờ chủ dự án commit**

**KHÔNG chạy `npx prisma db push` (không tham số).** Lệnh đó ghi vào `server/data.db`.
Migration lên DB thật đã được chủ dự án **dời xuống Task 8** (quyết định 2026-08-11): Task 1–7
chỉ cần `test.db`, mà `globalSetup.ts` tự dựng cái đó. Không có gì chặn ở đây.

Báo cáo kèm output Bước 3 và 4, chờ chủ dự án commit rồi sang Task 1.

---

## Task 1: `BodyLog` nhận 3 số đo mới (server)

**Files:**
- Sửa: `server/src/shared/validation/commonSchemas.ts:22`
- Sửa: `server/src/features/bodyLogs/dtos/bodyLogs.request.ts`
- Sửa: `server/src/features/bodyLogs/dtos/bodyLogs.response.ts`
- Sửa: `server/src/features/bodyLogs/services/bodyLogs.service.ts:9-18`
- Test: `server/test/features/bodyLogs/bodyLogs.controller.test.ts`

**Interfaces:**
- Consumes: cột DB từ Task 0.
- Produces: `circumferenceCmSchema` (export từ `commonSchemas.ts`, thay thế `waistCmSchema`);
  `BodyLogUpsertPatch` với 6 khoá optional; `BodyLogResponse` với 5 trường số đo.

- [ ] **Bước 1: Viết test đỏ — ghi một số đo không được xoá bốn số đo kia**

Thêm vào cuối `server/test/features/bodyLogs/bodyLogs.controller.test.ts`:

```ts
const MEASURE_FIELDS = ['weightKg', 'waistCm', 'chestCm', 'shoulderCm', 'armCm'] as const;

/** Một ngày ghi đủ cả năm số đo — điểm xuất phát của mọi test bên dưới. */
const FULL_ROW = {
  weightKg: 72.4,
  waistCm: 88,
  chestCm: 98,
  shoulderCm: 112,
  armCm: 32,
} as const;

describe('PUT /api/body-logs/:date — ghi MỘT số đo không đụng bốn số đo kia', () => {
  // Đây là test đắt nhất của cả feature. Upsert 3 trạng thái tồn tại CHỈ để
  // bảo đảm điều này; một test chỉ khẳng định "trả 200" sẽ vẫn xanh khi bug
  // xoá dữ liệu xảy ra, tức là một test sai.
  it.each(MEASURE_FIELDS)('sửa %s giữ nguyên bốn trường còn lại', async (field) => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, ...FULL_ROW },
    });

    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ [field]: 50 });

    expect(res.status).toBe(200);
    expect(res.body[field]).toBe(50);
    for (const other of MEASURE_FIELDS) {
      if (other === field) continue;
      expect(res.body[other]).toBe(FULL_ROW[other]);
    }
  });

  it.each(MEASURE_FIELDS)('gửi null xoá đúng %s, bốn trường kia còn nguyên', async (field) => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, ...FULL_ROW },
    });

    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ [field]: null });

    expect(res.status).toBe(200);
    expect(res.body[field]).toBeNull();
    for (const other of MEASURE_FIELDS) {
      if (other === field) continue;
      expect(res.body[other]).toBe(FULL_ROW[other]);
    }
  });

  it('gõ sai tên khoá → 400, KHÔNG lặng lẽ bỏ qua', async () => {
    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ chest: 98 });

    expect(res.status).toBe(400);
  });

  it('vòng ngực âm → 400 kèm đúng tên trường', async () => {
    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ chestCm: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('chestCm');
  });
});

describe('GET /api/body-logs/:date — trả đủ 5 số đo', () => {
  it('ngày ghi đủ năm số đo trả về đủ năm', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, ...FULL_ROW },
    });

    const res = await request(app).get(`/api/body-logs/${YESTERDAY}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(FULL_ROW);
  });
});
```

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd server && npx vitest run test/features/bodyLogs/bodyLogs.controller.test.ts`
Kỳ vọng: FAIL. Các ca `chestCm`/`shoulderCm`/`armCm` trả 400 vì `strictObject` chưa biết khoá đó.

- [ ] **Bước 3: Đổi tên schema vòng đo trong `commonSchemas.ts`**

Thay dòng 22:

```ts
export const waistCmSchema = z.number().positive().lt(300);
```

bằng:

```ts
/**
 * Dùng chung cho CẢ BỐN vòng: bụng, ngực, vai, bắp tay.
 *
 * Cố ý KHÔNG siết trần riêng cho từng vòng (bắp tay ~30cm, ngực ~98cm): trần
 * chung `lt(300)` vẫn chặn được ca gõ nhầm 30 thành 3000, còn ca gõ nhầm 30
 * thành 80 thì không schema nào cứu được. Bốn schema gần-giống-nhau là bốn chỗ
 * để lệch nhau về sau.
 */
export const circumferenceCmSchema = z.number().positive().lt(300);
```

`waistCmSchema` chỉ được import ở đúng một nơi (`bodyLogs.request.ts`) — Bước 4 sửa nốt.

- [ ] **Bước 4: Sửa `bodyLogs.request.ts` — 6 khoá, dựng patch bằng vòng lặp**

Thay phần import, schema, interface và hàm `parseUpsertBodyLog`:

```ts
import { z } from 'zod';
import {
  circumferenceCmSchema,
  dateRangeSchema,
  pastOrTodayDateString,
  weightKgSchema,
} from '../../../shared/validation/commonSchemas.js';

/** Ghi chú tự do; spec không chốt giới hạn, đặt trần để không nuốt cả file. */
const MAX_NOTE_LENGTH = 1000;
const noteSchema = z.string().trim().max(MAX_NOTE_LENGTH);

/** `:date` của mọi route trong feature này. Không nhận ngày tương lai. */
export const bodyLogDateParamSchema = z.object({ date: pastOrTodayDateString });

/** `?from=&to=` của GET danh sách. */
export const bodyLogRangeQuerySchema = dateRangeSchema;

/**
 * Body của PUT. `strictObject` để `{ chest: 98 }` (gõ sai tên) báo 400 thay vì
 * lặng lẽ không làm gì — với upsert "vắng mặt = giữ nguyên", một lỗi gõ sai mà
 * trả 200 là kiểu lỗi người dùng không bao giờ phát hiện ra.
 */
const upsertBodyLogSchema = z
  .strictObject({
    weightKg: weightKgSchema.nullable(),
    waistCm: circumferenceCmSchema.nullable(),
    chestCm: circumferenceCmSchema.nullable(),
    shoulderCm: circumferenceCmSchema.nullable(),
    armCm: circumferenceCmSchema.nullable(),
    note: noteSchema.nullable(),
  })
  .partial();

/**
 * Chỉ chứa những trường NGƯỜI GỬI thực sự gửi lên.
 * - khóa vắng mặt → giữ nguyên giá trị đang có trong DB
 * - khóa có mặt, giá trị `null` → xóa giá trị
 * - khóa có mặt, có giá trị → đặt giá trị mới
 */
export interface BodyLogUpsertPatch {
  weightKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  shoulderCm?: number | null;
  armCm?: number | null;
  note?: string | null;
}

/**
 * Nguồn sự thật DUY NHẤT cho danh sách khoá của patch. Trước đây mỗi khoá là
 * một dòng `if ('x' in raw)` viết tay; với 6 khoá thì đó là 6 cơ hội quên một
 * dòng, mà quên một dòng ở đây nghĩa là trường đó KHÔNG BAO GIỜ lưu được và
 * không có lỗi nào báo. Thêm số đo mới = thêm vào đây và vào hai khối trên.
 */
const PATCH_KEYS = ['weightKg', 'waistCm', 'chestCm', 'shoulderCm', 'armCm', 'note'] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Ném `ZodError` khi body sai — errorHandler dịch thành 400 + danh sách trường.
 *
 * Phải soi `key in rawBody` chứ KHÔNG phải `parsed[key] !== undefined`: sau
 * `.partial()` cả hai ca "vắng mặt" và "gửi undefined" đều ra `undefined`, nên
 * kiểm tra theo giá trị sẽ biến ca 2 (gửi `null` để xóa) thành ca 1 (giữ nguyên).
 */
export function parseUpsertBodyLog(rawBody: unknown): BodyLogUpsertPatch {
  const parsed = upsertBodyLogSchema.parse(rawBody);
  const raw = asRecord(rawBody);

  const patch: BodyLogUpsertPatch = {};
  for (const key of PATCH_KEYS) {
    if (!(key in raw)) continue;
    // Ép kiểu vì TS không suy được rằng `parsed[key]` khớp `patch[key]` khi
    // `key` là biến vòng lặp. `PATCH_KEYS` là `as const` nên tập khoá vẫn
    // được kiểm tại chỗ khai báo.
    (patch as Record<string, unknown>)[key] = parsed[key] ?? null;
  }
  return patch;
}
```

- [ ] **Bước 5: Sửa `bodyLogs.response.ts` — thêm 3 trường**

```ts
export interface BodyLogResponse {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  shoulderCm: number | null;
  armCm: number | null;
  note: string | null;
  /** ISO 8601 — đây là dấu thời gian thật, khác hẳn `date`. */
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Bước 6: Sửa `toResponse` trong `bodyLogs.service.ts`**

```ts
function toResponse(row: BodyLog): BodyLogResponse {
  return {
    date: row.date,
    weightKg: row.weightKg,
    waistCm: row.waistCm,
    chestCm: row.chestCm,
    shoulderCm: row.shoulderCm,
    armCm: row.armCm,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

- [ ] **Bước 7: Chạy test, xác nhận XANH**

Chạy: `cd server && npx vitest run test/features/bodyLogs/bodyLogs.controller.test.ts`
Kỳ vọng: PASS toàn bộ, gồm 10 ca `it.each` mới.

- [ ] **Bước 8: Chạy cả suite + typecheck**

Chạy: `cd server && npm test && npx tsc --noEmit`
Kỳ vọng: PASS, không lỗi kiểu.

- [ ] **Bước 9: CHECKPOINT** — báo cáo kèm output thật của Bước 8, chờ chủ dự án commit.

---

## Task 2: `GET /api/summary` trả 5 cặp số đo

**Files:**
- Sửa: `server/src/features/summary/repositories/summary.repository.ts:14-18,27-31,45,83`
- Sửa: `server/src/features/summary/dtos/summary.response.ts`
- Sửa: `server/src/features/summary/services/summary.service.ts`
- Test: `server/test/features/summary/summary.controller.test.ts`

**Interfaces:**
- Consumes: cột DB từ Task 0.
- Produces: `SummaryDay` với `weightKg`/`weightMa7`/`waistCm`/`waistMa7`/`chestCm`/`chestMa7`/
  `shoulderCm`/`shoulderMa7`/`armCm`/`armMa7`/`totalCalories`/`mealCount`/`date`;
  `SummaryGoal` thêm `startWeightKg: number | null` và `startDate: string | null`.

- [ ] **Bước 1: Viết test đỏ**

Thêm vào `server/test/features/summary/summary.controller.test.ts`:

```ts
describe('GET /api/summary — cả 5 số đo đều có cặp thô + MA7', () => {
  const MEASURE_PAIRS = [
    ['weightKg', 'weightMa7'],
    ['waistCm', 'waistMa7'],
    ['chestCm', 'chestMa7'],
    ['shoulderCm', 'shoulderMa7'],
    ['armCm', 'armMa7'],
  ] as const;

  it.each(MEASURE_PAIRS)('mỗi ngày mang %s và %s', async (rawKey, ma7Key) => {
    const res = await request(app).get(`/api/summary?from=${TWO_DAYS_AGO}&to=${TODAY}`);

    expect(res.status).toBe(200);
    for (const day of res.body.days) {
      expect(day).toHaveProperty(rawKey);
      expect(day).toHaveProperty(ma7Key);
    }
  });

  // Cạm bẫy đã ghi trong CLAUDE.md: cửa sổ dưới 2 giá trị thì MA7 phải null.
  // Trước đây chỉ cân nặng được kiểm; giờ phải đúng cho CẢ NĂM số đo, nếu
  // không thì một điểm đơn lẻ sẽ được vẽ như thể nó là trung bình.
  it.each(MEASURE_PAIRS)('%s chỉ có 1 giá trị trong cửa sổ → %s là null', async (rawKey, ma7Key) => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: TODAY, [rawKey]: 50 },
    });

    const res = await request(app).get(`/api/summary?from=${TODAY}&to=${TODAY}`);

    const today = res.body.days.find((d: { date: string }) => d.date === TODAY);
    expect(today[rawKey]).toBe(50);
    expect(today[ma7Key]).toBeNull();
  });

  it('goal trả startWeightKg và startDate đọc thẳng từ bảng', async () => {
    await prisma.goal.create({
      data: { userId: LOCAL_USER_ID, startWeightKg: 75, startDate: FIVE_DAYS_AGO },
    });

    const res = await request(app).get(`/api/summary?from=${TWO_DAYS_AGO}&to=${TODAY}`);

    expect(res.body.goal.startWeightKg).toBe(75);
    expect(res.body.goal.startDate).toBe(FIVE_DAYS_AGO);
  });
});
```

Nếu `TWO_DAYS_AGO` / `FIVE_DAYS_AGO` chưa có ở đầu file test này, thêm:

```ts
const TWO_DAYS_AGO = addDays(TODAY, -2);
const FIVE_DAYS_AGO = addDays(TODAY, -5);
```

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd server && npx vitest run test/features/summary/summary.controller.test.ts`
Kỳ vọng: FAIL — `chestCm` chưa có trong response.

- [ ] **Bước 3: Mở rộng repository**

Trong `summary.repository.ts`:

```ts
export interface BodyLogRow {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  shoulderCm: number | null;
  armCm: number | null;
}

export interface GoalRow {
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
}
```

và hai câu truy vấn:

```ts
  return prisma.bodyLog.findMany({
    where: { userId: LOCAL_USER_ID, date: { gte: fromIso, lte: toIso } },
    select: {
      date: true,
      weightKg: true,
      waistCm: true,
      chestCm: true,
      shoulderCm: true,
      armCm: true,
    },
    orderBy: { date: 'asc' },
  });
```

```ts
  return prisma.goal.findUnique({
    where: { userId: LOCAL_USER_ID },
    select: {
      startWeightKg: true,
      startDate: true,
      targetWeightKg: true,
      targetDate: true,
      dailyCalorieTarget: true,
    },
  });
```

- [ ] **Bước 4: Mở rộng `summary.response.ts`**

```ts
export interface SummaryDay {
  /** "YYYY-MM-DD". */
  date: string;
  /** Số đo thô của đúng ngày đó; `null` nếu ngày đó không ghi. */
  weightKg: number | null;
  /** Trung bình trượt 7 ngày; `null` khi cửa sổ có dưới 2 giá trị. */
  weightMa7: number | null;
  waistCm: number | null;
  waistMa7: number | null;
  chestCm: number | null;
  chestMa7: number | null;
  shoulderCm: number | null;
  shoulderMa7: number | null;
  armCm: number | null;
  armMa7: number | null;
  /** Luôn là số — ngày không ghi bữa nào là 0, không phải `null`. */
  totalCalories: number;
  mealCount: number;
}
```

và trong `SummaryGoal`, thêm hai trường đầu tiên:

```ts
export interface SummaryGoal {
  /** Điểm xuất phát của % tiến độ. Đọc thẳng từ bảng, KHÔNG tính toán —
   * công thức % thuộc đợt `charts-mui`. */
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  currentMa7WeightKg: number | null;
  remainingKg: number | null;
  currentRateKgPerWeek: number | null;
  requiredRateKgPerWeek: number | null;
  onTrack: boolean | null;
}
```

- [ ] **Bước 5: Chuyển `summary.service.ts` sang bảng khai báo**

Thêm ngay dưới hằng `TREND_LOOKBACK_DAYS`:

```ts
/**
 * Năm số đo, mỗi cái một cặp (trường thô, trường MA7). Đây là nguồn sự thật
 * cho toàn bộ vòng lặp bên dưới — trước đây mỗi số đo là một khối code chép
 * lại, và chép lại chính là cách chắc chắn nhất để hai chỗ lệch nhau.
 */
const MEASURES = [
  { raw: 'weightKg', ma7: 'weightMa7' },
  { raw: 'waistCm', ma7: 'waistMa7' },
  { raw: 'chestCm', ma7: 'chestMa7' },
  { raw: 'shoulderCm', ma7: 'shoulderMa7' },
  { raw: 'armCm', ma7: 'armMa7' },
] as const;
```

Thay khối dựng `weightPoints`/`waistPoints` và hai lần gọi `movingAverage7`:

```ts
  // Gom điểm dữ liệu cho từng số đo. Bỏ qua `null` — "không đo" khác "đo ra 0".
  const pointsByMeasure = new Map<string, DatedValue[]>(
    MEASURES.map((measure) => [measure.raw, [] as DatedValue[]]),
  );
  for (const log of bodyLogs) {
    for (const measure of MEASURES) {
      const value = log[measure.raw];
      if (value !== null) {
        pointsByMeasure.get(measure.raw)!.push({ date: log.date, value });
      }
    }
  }

  const ma7ByMeasure = new Map<string, Map<string, number | null>>(
    MEASURES.map((measure) => [
      measure.raw,
      ma7ByDate(movingAverage7(pointsByMeasure.get(measure.raw)!, range.from, range.to)),
    ]),
  );

  // Cân nặng vẫn cần riêng cho xu hướng và trung bình tuần — cả hai chỉ nói về
  // cân nặng, không mở rộng sang bốn vòng.
  const weightPoints = pointsByMeasure.get('weightKg')!;
```

Phần `trendMa7` / `ma7Today` / `ma7TwoWeeksAgo` giữ nguyên (đã dùng `weightPoints`).

Thay khối dựng `days`:

```ts
  const days: SummaryDay[] = enumerateDates(range.from, range.to).map((date) => {
    const log = bodyLogByDate.get(date);
    const meals = mealsByDate.get(date);
    const day = {
      date,
      totalCalories: meals?.totalCalories ?? 0,
      mealCount: meals?.mealCount ?? 0,
    } as SummaryDay;

    for (const measure of MEASURES) {
      // Ép kiểu vì `measure.raw` là biến vòng lặp; `MEASURES` là `as const`
      // nên tập tên trường vẫn được kiểm tại chỗ khai báo.
      (day as unknown as Record<string, number | null>)[measure.raw] = log?.[measure.raw] ?? null;
      (day as unknown as Record<string, number | null>)[measure.ma7] =
        ma7ByMeasure.get(measure.raw)!.get(date) ?? null;
    }
    return day;
  });
```

Thêm hai trường vào `goalProgress`:

```ts
  const goalProgress: SummaryGoal = {
    startWeightKg: goal?.startWeightKg ?? null,
    startDate: goal?.startDate ?? null,
    targetWeightKg,
    targetDate,
    dailyCalorieTarget: goal?.dailyCalorieTarget ?? null,
    currentMa7WeightKg: ma7Today,
    remainingKg: remainingKg(ma7Today, targetWeightKg),
    currentRateKgPerWeek: currentRate,
    requiredRateKgPerWeek: requiredRate,
    onTrack: isOnTrack(currentRate, requiredRate),
  };
```

- [ ] **Bước 6: Chạy test, xác nhận XANH**

Chạy: `cd server && npx vitest run test/features/summary/summary.controller.test.ts`
Kỳ vọng: PASS.

- [ ] **Bước 7: Xác nhận `shared/stats/` không bị đụng**

Chạy: `cd C:/Project/WorkSpace/Lean && git diff --name-only -- server/src/shared/stats/`
Kỳ vọng: **không in ra gì**. Có tên file = đã làm sai chỗ, hoàn tác phần đó.

- [ ] **Bước 8: Chạy cả suite + typecheck**

Chạy: `cd server && npm test && npx tsc --noEmit`
Kỳ vọng: PASS.

- [ ] **Bước 9: CHECKPOINT** — báo cáo kèm output Bước 7 và 8, chờ chủ dự án commit.

---

## Task 3: `Goal` nhận 6 trường mới (server)

**Files:**
- Sửa: `server/src/features/goal/dtos/goal.request.ts`
- Sửa: `server/src/features/goal/dtos/goal.response.ts`
- Test: `server/test/features/goal/goal.controller.test.ts`

**Interfaces:**
- Consumes: cột DB từ Task 0; `circumferenceCmSchema` từ Task 1.
- Produces: `GoalResponse` với 9 trường + `updatedAt`; `GoalPatch` với 9 khoá optional.

> **Cạm bẫy riêng của feature này:** `goalUpsertSchema` dùng `z.object().partial()`, **KHÔNG
> `.strict()`** — khoá lạ bị strip **im lặng**, không báo lỗi. Nghĩa là nếu quên thêm một
> trường vào schema, client gửi lên sẽ bị bỏ đi mà không có 400 nào. Test ở Bước 1 chốt chặn
> đúng chỗ này: gửi cả 9 trường, đọc lại đủ 9.

- [ ] **Bước 1: Viết test đỏ**

Thêm vào `server/test/features/goal/goal.controller.test.ts`:

```ts
describe('PUT /api/goal — 9 trường, không trường nào bị strip im lặng', () => {
  const FULL_GOAL = {
    startWeightKg: 75,
    startDate: TWO_DAYS_AGO,
    targetWeightKg: 68,
    targetWaistCm: 80,
    targetChestCm: 95,
    targetShoulderCm: 110,
    targetArmCm: 30,
    targetDate: '2027-01-01',
    dailyCalorieTarget: 1800,
  } as const;

  it('gửi cả 9 trường thì đọc lại đủ 9', async () => {
    const put = await request(app).put('/api/goal').send(FULL_GOAL);
    expect(put.status).toBe(200);

    const get = await request(app).get('/api/goal');
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject(FULL_GOAL);
  });

  it('gửi một trường không đụng tám trường kia', async () => {
    await request(app).put('/api/goal').send(FULL_GOAL);

    await request(app).put('/api/goal').send({ targetArmCm: 28 });

    const get = await request(app).get('/api/goal');
    expect(get.body.targetArmCm).toBe(28);
    expect(get.body).toMatchObject({ ...FULL_GOAL, targetArmCm: 28 });
  });

  it('gửi null xoá đúng một trường', async () => {
    await request(app).put('/api/goal').send(FULL_GOAL);

    await request(app).put('/api/goal').send({ startWeightKg: null });

    const get = await request(app).get('/api/goal');
    expect(get.body.startWeightKg).toBeNull();
    expect(get.body.startDate).toBe(TWO_DAYS_AGO);
  });

  // startDate là mốc ĐÃ XẢY RA (điểm xuất phát), ngược hẳn targetDate là mốc
  // TƯƠNG LAI. Hai trường ngày, hai schema khác nhau — đây là chỗ dễ chép nhầm.
  it('startDate ở tương lai → 400', async () => {
    const res = await request(app).put('/api/goal').send({ startDate: TOMORROW });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('startDate');
  });

  it('startDate sai định dạng → 400', async () => {
    const res = await request(app).put('/api/goal').send({ startDate: '01-01-2026' });

    expect(res.status).toBe(400);
  });

  it('targetDate ở tương lai vẫn hợp lệ', async () => {
    const res = await request(app).put('/api/goal').send({ targetDate: '2030-06-01' });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/goal — chưa đặt gì trả 9 trường null', () => {
  it('không 404, mọi trường null', async () => {
    const res = await request(app).get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: null,
      updatedAt: null,
    });
  });
});
```

Nếu `TWO_DAYS_AGO` / `TOMORROW` chưa có ở đầu file test này, thêm:

```ts
const TODAY = todayIso();
const TWO_DAYS_AGO = addDays(TODAY, -2);
const TOMORROW = addDays(TODAY, 1);
```

kèm import `import { addDays, todayIso } from '../../../src/lib/time.js';` nếu chưa có.

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd server && npx vitest run test/features/goal/goal.controller.test.ts`
Kỳ vọng: FAIL — `targetArmCm` bị strip im lặng nên `toMatchObject` không khớp.

- [ ] **Bước 3: Sửa `goal.request.ts`**

```ts
import { z } from 'zod';
import {
  caloriesSchema,
  circumferenceCmSchema,
  dateString,
  pastOrTodayDateString,
  weightKgSchema,
} from '../../../shared/validation/commonSchemas.js';

/**
 * Body của `PUT /api/goal`.
 *
 * Mọi trường đều optional VÀ nullable — hai chuyện khác nhau:
 *   vắng mặt → giữ nguyên giá trị cũ
 *   `null`   → xóa giá trị
 * `.partial()` gộp cả hai thành `undefined` sau khi parse, nên phần phân biệt
 * nằm ở `toGoalPatch()` bên dưới, đọc trên body THÔ.
 *
 * HAI TRƯỜNG NGÀY DÙNG HAI SCHEMA KHÁC NHAU, cố ý:
 * - `targetDate` là `dateString` — mục tiêu nằm ở TƯƠNG LAI;
 * - `startDate` là `pastOrTodayDateString` — điểm xuất phát là mốc ĐÃ XẢY RA.
 *   Một mốc xuất phát ở tương lai sẽ làm % tiến độ (đợt `charts-mui`) ra số vô nghĩa.
 */
export const goalUpsertSchema = z
  .object({
    startWeightKg: weightKgSchema.nullable(),
    startDate: pastOrTodayDateString.nullable(),
    targetWeightKg: weightKgSchema.nullable(),
    targetWaistCm: circumferenceCmSchema.nullable(),
    targetChestCm: circumferenceCmSchema.nullable(),
    targetShoulderCm: circumferenceCmSchema.nullable(),
    targetArmCm: circumferenceCmSchema.nullable(),
    targetDate: dateString.nullable(),
    dailyCalorieTarget: caloriesSchema.nullable(),
  })
  .partial();

export type GoalUpsertRequest = z.infer<typeof goalUpsertSchema>;

/**
 * Các trường sẽ được ghi. Trường vắng mặt trong object này = không đụng tới;
 * trường mang `null` = xóa. Prisma hiểu đúng cả hai vì `undefined` là "bỏ qua".
 */
export interface GoalPatch {
  startWeightKg?: number | null;
  startDate?: string | null;
  targetWeightKg?: number | null;
  targetWaistCm?: number | null;
  targetChestCm?: number | null;
  targetShoulderCm?: number | null;
  targetArmCm?: number | null;
  targetDate?: string | null;
  dailyCalorieTarget?: number | null;
}

/**
 * Nguồn sự thật DUY NHẤT cho danh sách khoá. Quan trọng hơn bình thường ở đây
 * vì `goalUpsertSchema` KHÔNG `.strict()`: khoá lạ bị strip im lặng, không có
 * 400 nào. Quên một khoá = trường đó không bao giờ lưu được và không ai biết.
 */
const GOAL_PATCH_KEYS = [
  'startWeightKg',
  'startDate',
  'targetWeightKg',
  'targetWaistCm',
  'targetChestCm',
  'targetShoulderCm',
  'targetArmCm',
  'targetDate',
  'dailyCalorieTarget',
] as const;

/**
 * Dựng patch từ body thô + kết quả đã validate.
 *
 * Phải nhìn `key in rawBody` chứ không nhìn `parsed[key] !== undefined`:
 * sau khi Zod parse, `{ targetDate: null }` và `{}` không còn phân biệt được,
 * mà chúng mang hai ý nghĩa trái ngược nhau.
 */
export function toGoalPatch(rawBody: unknown, parsed: GoalUpsertRequest): GoalPatch {
  // Zod đã chặn body không phải object trước khi tới đây; ép kiểu chỉ để đọc key.
  const body = (rawBody ?? {}) as Record<string, unknown>;
  const patch: GoalPatch = {};

  for (const key of GOAL_PATCH_KEYS) {
    if (!(key in body)) continue;
    (patch as Record<string, unknown>)[key] = parsed[key] ?? null;
  }

  return patch;
}
```

- [ ] **Bước 4: Sửa `goal.response.ts`**

```ts
/** Hàng `Goal` đọc từ Prisma. Khai lại tại chỗ để tầng dto không phụ thuộc client sinh ra. */
export interface GoalRow {
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetChestCm: number | null;
  targetShoulderCm: number | null;
  targetArmCm: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  updatedAt: Date;
}

export interface GoalResponse {
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetChestCm: number | null;
  targetShoulderCm: number | null;
  targetArmCm: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  /** `null` khi chưa từng đặt mục tiêu — dùng để phân biệt với "đặt rồi nhưng để trống". */
  updatedAt: string | null;
}

/** Chín trường dữ liệu, không kể `updatedAt` (kiểu khác, xử lý riêng). */
const GOAL_FIELDS = [
  'startWeightKg',
  'startDate',
  'targetWeightKg',
  'targetWaistCm',
  'targetChestCm',
  'targetShoulderCm',
  'targetArmCm',
  'targetDate',
  'dailyCalorieTarget',
] as const;

/**
 * `null` = chưa có hàng nào trong bảng → trả object toàn `null`, KHÔNG phải 404.
 * Đây là ngoại lệ có chủ đích ở spec §5: mục tiêu là singleton, "chưa đặt" là
 * một trạng thái hợp lệ chứ không phải tài nguyên không tồn tại.
 */
export function toGoalResponse(goal: GoalRow | null): GoalResponse {
  const response = { updatedAt: goal ? goal.updatedAt.toISOString() : null } as GoalResponse;
  for (const field of GOAL_FIELDS) {
    (response as unknown as Record<string, unknown>)[field] = goal ? goal[field] : null;
  }
  return response;
}
```

- [ ] **Bước 5: Chạy test, xác nhận XANH**

Chạy: `cd server && npx vitest run test/features/goal/goal.controller.test.ts`
Kỳ vọng: PASS.

- [ ] **Bước 6: Chạy cả suite + typecheck**

Chạy: `cd server && npm test && npx tsc --noEmit`
Kỳ vọng: PASS. Backend hoàn tất — có thể kiểm tay bằng `curl` nếu muốn.

- [ ] **Bước 7: CHECKPOINT** — báo cáo kèm output, chờ chủ dự án commit.

---

## Task 4: Kiểu và hằng phía web

**Files:**
- Tạo: `web/src/constants/measures.ts`
- Sửa: `web/src/types/api.ts`
- Sửa: `web/src/features/today/api/today.api.ts:18`
- Sửa: `web/src/features/settings/api/settings.types.ts:26-30`
- Sửa: `web/src/features/settings/api/settings.api.ts:67-74` (**danh sách trắng cứng — dễ quên nhất**)

**Interfaces:**
- Consumes: hình dạng response từ Task 1–3.
- Produces: `MEASURES` (mảng `as const`), `MeasureField` (union 5 chuỗi),
  `MEASURE_FIELDS`, `measureLabel()`, `BodyLog`/`Goal`/`SummaryDay`/`SummaryGoal` đã mở rộng,
  `BodyLogPatch` 6 khoá, `GoalPatch` 9 khoá, `updateGoal()` gửi đủ 9 khoá,
  `fetchCurrentMa7WeightKg(): Promise<number | null>`. Task 5–7 đều dựa vào những tên này.

Task này không có test riêng — nó chỉ là kiểu và hằng. Cổng kiểm là `tsc --noEmit`.

- [ ] **Bước 1: Tạo `web/src/constants/measures.ts`**

```ts
// Nguồn sự thật DUY NHẤT cho danh sách số đo cơ thể ở phía web: điều khiển
// các ô của form Hôm nay, nhãn hiển thị, và (đợt `charts-mui`) danh sách biểu
// đồ. Thêm số đo thứ sáu = thêm MỘT dòng ở đây.
//
// Đặt ở `constants/` cạnh `meals.ts` theo đúng quán lệ đã có, không nhét vào
// `features/today/` — `features/charts/` cũng sẽ dùng.

export const MEASURES = [
  { field: 'weightKg', label: 'Cân nặng', unit: 'kg', step: '0.1' },
  { field: 'waistCm', label: 'Vòng bụng', unit: 'cm', step: '0.1' },
  { field: 'chestCm', label: 'Vòng ngực', unit: 'cm', step: '0.1' },
  { field: 'shoulderCm', label: 'Vòng vai', unit: 'cm', step: '0.1' },
  { field: 'armCm', label: 'Vòng bắp tay', unit: 'cm', step: '0.1' },
] as const;

export type MeasureField = (typeof MEASURES)[number]['field'];

/** Chỉ danh sách tên trường — dùng cho vòng lặp và `useFieldErrors`. */
export const MEASURE_FIELDS: readonly MeasureField[] = MEASURES.map((m) => m.field);

/** Nhãn kèm đơn vị, đúng như hiển thị trên `<label>`: "Cân nặng (kg)". */
export function measureLabel(measure: (typeof MEASURES)[number]): string {
  return `${measure.label} (${measure.unit})`;
}
```

- [ ] **Bước 2: Mở rộng `web/src/types/api.ts`**

`BodyLog`:

```ts
export interface BodyLog {
  date: string; // "YYYY-MM-DD" — không bao giờ là Date/DateTime
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  shoulderCm: number | null;
  armCm: number | null;
  note: string | null;
  createdAt: string; // ISO 8601 — thời điểm thật
  updatedAt: string; // ISO 8601
}
```

`Goal`:

```ts
export interface Goal {
  startWeightKg: number | null;
  startDate: string | null; // "YYYY-MM-DD" — mốc 0% của tiến độ
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetChestCm: number | null;
  targetShoulderCm: number | null;
  targetArmCm: number | null;
  targetDate: string | null; // "YYYY-MM-DD"
  dailyCalorieTarget: number | null;
  updatedAt: string | null; // ISO 8601 — null khi chưa từng ghi mục tiêu
}
```

`SummaryDay`:

```ts
export interface SummaryDay {
  date: string; // "YYYY-MM-DD" — không bao giờ null
  weightKg: number | null;
  weightMa7: number | null; // null khi cửa sổ MA7 có dưới 2 giá trị
  waistCm: number | null;
  waistMa7: number | null;
  chestCm: number | null;
  chestMa7: number | null;
  shoulderCm: number | null;
  shoulderMa7: number | null;
  armCm: number | null;
  armMa7: number | null;
  totalCalories: number; // không bao giờ null — ngày không ghi bữa là 0
  mealCount: number; // 0 khi không ghi bữa nào
}
```

`SummaryGoal` — thêm hai trường vào ĐẦU interface:

```ts
export interface SummaryGoal {
  startWeightKg: number | null;
  startDate: string | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  currentMa7WeightKg: number | null;
  remainingKg: number | null;
  currentRateKgPerWeek: number | null;
  requiredRateKgPerWeek: number | null;
  onTrack: boolean | null;
}
```

- [ ] **Bước 3: Mở rộng `BodyLogPatch` trong `today.api.ts`**

Thay dòng 18:

```ts
export type BodyLogPatch = Partial<
  Record<'weightKg' | 'waistCm' | 'chestCm' | 'shoulderCm' | 'armCm' | 'note', number | string | null>
>;
```

- [ ] **Bước 4: Mở rộng `GoalPatch` trong `settings.types.ts`**

```ts
/**
 * Body của `PUT /api/goal`. Mọi trường optional + nullable (SPEC §3):
 * vắng mặt = giữ nguyên, `null` = xóa, có giá trị = ghi đè.
 *
 * `goalUpsertSchema` ở server KHÔNG `.strict()` — khóa lạ bị strip IM LẶNG,
 * không có 400 nào. Vì vậy kiểu này phải liệt kê chính xác 9 khóa server biết:
 * gõ thừa một khóa ở đây thì TypeScript bắt được, còn để lọt xuống runtime thì
 * không ai bắt được.
 */
export interface GoalPatch {
  startWeightKg?: number | null;
  startDate?: string | null;
  targetWeightKg?: number | null;
  targetWaistCm?: number | null;
  targetChestCm?: number | null;
  targetShoulderCm?: number | null;
  targetArmCm?: number | null;
  targetDate?: string | null;
  dailyCalorieTarget?: number | null;
}
```

- [ ] **Bước 5: Mở rộng `updateGoal` trong `settings.api.ts` — BẮT BUỘC, dễ quên nhất cả kế hoạch**

`settings.api.ts:67` hiện dựng body bằng **danh sách trắng cứng ba khoá**:

```ts
const body: GoalPatch = {
  targetWeightKg: patch.targetWeightKg,
  targetDate: patch.targetDate,
  dailyCalorieTarget: patch.dailyCalorieTarget,
};
```

Chỉ mở rộng *kiểu* `GoalPatch` mà bỏ quên hàm này thì form gửi đủ 9 trường nhưng **6 trường bị
vứt tại đây**, và `goalUpsertSchema` không `.strict()` nên server trả 200 như không có chuyện gì.
Không lỗi, không cảnh báo, giá trị chỉ đơn giản là biến mất.

Thay bằng:

```ts
/**
 * Dựng patch bằng kiểu tường minh (`GoalPatch`), KHÔNG spread object nhận từ
 * `GET` — `goalUpsertSchema` không `.strict()` nên gõ sai tên trường sẽ trả
 * 200 im lặng, không có 400 nào để bắt lỗi chính tả (SPEC §3).
 *
 * Liệt kê tay cả CHÍN khoá, cố ý không lặp: đây là chỗ TypeScript kiểm được
 * rằng không khoá nào bị bỏ sót. Thêm trường mục tiêu mới mà quên dòng ở đây
 * thì trường đó KHÔNG BAO GIỜ lưu được và không có gì báo.
 */
export function updateGoal(patch: GoalPatch): Promise<GoalResponse> {
  const body: GoalPatch = {
    startWeightKg: patch.startWeightKg,
    startDate: patch.startDate,
    targetWeightKg: patch.targetWeightKg,
    targetWaistCm: patch.targetWaistCm,
    targetChestCm: patch.targetChestCm,
    targetShoulderCm: patch.targetShoulderCm,
    targetArmCm: patch.targetArmCm,
    targetDate: patch.targetDate,
    dailyCalorieTarget: patch.dailyCalorieTarget,
  };
  return apiClient.put<GoalResponse>('/goal', body);
}
```

- [ ] **Bước 6: Thêm `fetchCurrentMa7WeightKg` vào `settings.api.ts`**

Nguồn của giá trị điền sẵn cho ô "Cân nặng lúc bắt đầu" (spec §5.4). Thêm vào cuối khối
"Mục tiêu", ngay dưới `updateGoal`:

```ts
/**
 * MA7 cân nặng của HÔM NAY, để form Mục tiêu điền sẵn ô "Cân nặng lúc bắt đầu".
 *
 * Đi qua `GET /api/summary` sẵn có thay vì thêm trường vào `/api/goal`: bắt
 * `goal.service` tính MA7 là kéo dữ liệu `BodyLog` xuyên qua ranh giới feature,
 * chỉ để tiện điền một ô nháp (spec §8.3). Cái giá là một request thừa ở trang
 * Cài đặt — đã cân nhắc và chấp nhận.
 *
 * Khoảng ngày truyền vào KHÔNG ảnh hưởng kết quả: `summary.service` tính
 * `currentMa7WeightKg` neo vào hôm nay bất kể `from`/`to`. Dùng `today..today`
 * cho payload nhỏ nhất.
 *
 * `null` khi chưa đủ dữ liệu để có MA7 — form để ô trống, không bịa số.
 */
export function fetchCurrentMa7WeightKg(): Promise<number | null> {
  const today = todayIso();
  return apiClient
    .get<SummaryResponse>(`/summary?from=${today}&to=${today}`)
    .then((res) => res.goal.currentMa7WeightKg);
}
```

Thêm hai import ở đầu `settings.api.ts`:

```ts
import { todayIso } from '../../../lib/format';
import type { SummaryResponse } from '../../../types/api';
```

- [ ] **Bước 7: Typecheck — sẽ ĐỎ, đó là dự kiến**

Chạy: `cd web && npx tsc -p tsconfig.json --noEmit`
Kỳ vọng: FAIL ở `useBodyLogForm.ts`, `BodyLogForm.tsx`, `GoalSettingsSection.tsx` và các file
test tạo `BodyLog`/`Goal` thiếu trường mới. Task 5–7 sửa hết.

**Ghi lại danh sách file lỗi** — đó là checklist còn phải làm.

- [ ] **Bước 8: Xác nhận `features/charts/` KHÔNG nằm trong danh sách lỗi**

`chartData.ts` khai `NullableDayKey = 'weightKg' | 'weightMa7' | 'waistCm' | 'waistMa7'` — đó là
tập con của `SummaryDay` mở rộng nên vẫn hợp lệ. Nếu `features/charts/` báo lỗi kiểu, **dừng và
báo cáo** thay vì tự sửa: biểu đồ thuộc đợt 3, chạm vào là ra ngoài phạm vi.

- [ ] **Bước 9: CHECKPOINT** — báo cáo danh sách file còn đỏ, chờ chủ dự án commit.

---

## Task 5: `useBodyLogForm` — 2 ô thành 5, giữ nguyên 4 luật gửi

**Files:**
- Sửa: `web/src/features/today/hooks/useBodyLogForm.ts` (viết lại phần state)
- Test: `web/src/features/today/hooks/useBodyLogForm.test.ts` (viết lại theo API mới)

**Interfaces:**
- Consumes: `MEASURES`, `MEASURE_FIELDS`, `MeasureField` từ Task 4; `BodyLogPatch` từ Task 4.
- Produces: `UseBodyLogFormResult` với `values: Record<MeasureField, string>`,
  `onChange(field, value)`, `onBlur(field)`, `savedField: MeasureField | null`,
  `attemptTick: number`, `fieldErrors: UseFieldErrorsResult`. Task 6 dùng chính xác các tên này.

> **Đây là task rủi ro nhất của cả kế hoạch.** File này là nơi duy nhất có thể làm mất dữ liệu
> người dùng. Viết test TRƯỚC, chạy đỏ, rồi mới sửa hook — không làm ngược lại.

- [ ] **Bước 1: Viết lại file test theo API mới**

Thay toàn bộ `web/src/features/today/hooks/useBodyLogForm.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBodyLogForm } from './useBodyLogForm';
import { ApiError } from '../../../types/api';
import type { BodyLog } from '../../../types/api';
import { MEASURE_FIELDS, type MeasureField } from '../../../constants/measures';

// Test canh giữ đúng bốn luật gửi của docs/features/web-today/SPEC.md §5.1 và
// hợp đồng upsert 3 trạng thái. Mock `putBodyLog` truyền vào qua tham số thứ ba
// (dependency injection), không vi.mock module, để khẳng định trực tiếp payload.
//
// QUAN TRỌNG: `bodyLog` phải được tạo ĐÚNG MỘT LẦN bên ngoài hàm factory của
// `renderHook` — hook có `useEffect` phụ thuộc `bodyLog` theo REFERENCE; một
// object mới mỗi lần render sẽ làm effect chạy lại vô hạn.

const DATE = '2026-08-07';

function makeBodyLog(overrides: Partial<BodyLog> = {}): BodyLog {
  return {
    date: DATE,
    weightKg: null,
    waistCm: null,
    chestCm: null,
    shoulderCm: null,
    armCm: null,
    note: null,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

/** Một ngày đã ghi đủ năm số đo — nền của mọi test "không được xoá". */
const FULL_LOG_VALUES = {
  weightKg: 72.4,
  waistCm: 88,
  chestCm: 98,
  shoulderCm: 112,
  armCm: 32,
} as const;

describe('useBodyLogForm — TEST CANH MẤT DỮ LIỆU (bắt buộc)', () => {
  it.each(MEASURE_FIELDS)(
    'ngày đã có đủ 5 số đo, chỉ sửa %s → payload KHÔNG chứa bốn khoá kia',
    async (field: MeasureField) => {
      const put = vi.fn().mockResolvedValue(makeBodyLog(FULL_LOG_VALUES));
      const initialLog = makeBodyLog(FULL_LOG_VALUES);
      const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

      act(() => result.current.onChange(field, '50'));
      act(() => result.current.onBlur(field));

      await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
      expect(put).toHaveBeenCalledWith(DATE, { [field]: 50 });

      for (const call of put.mock.calls) {
        const body = call[1] as Record<string, unknown>;
        expect(Object.keys(body)).toEqual([field]);
      }

      // Giá trị hiển thị của bốn ô kia không hề đổi.
      for (const other of MEASURE_FIELDS) {
        if (other === field) continue;
        expect(result.current.values[other]).toBe(String(FULL_LOG_VALUES[other]));
      }
    },
  );
});

describe('useBodyLogForm — luật 1: chưa động vào ô thì KHÔNG gửi', () => {
  it.each(MEASURE_FIELDS)('blur %s mà chưa gõ gì → không request nào', async (field: MeasureField) => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onBlur(field));

    await new Promise((r) => setTimeout(r, 0));
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — luật 2: giá trị không đổi thì KHÔNG gửi', () => {
  it('gõ "72.40" lên ô đang là 72.4 → không gửi (so numeric, không so chuỗi)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ weightKg: 72.4 }));
    const initialLog = makeBodyLog({ weightKg: 72.4 });
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('weightKg', '72.40'));
    act(() => result.current.onBlur('weightKg'));

    await new Promise((r) => setTimeout(r, 0));
    // Gửi patch không đổi vẫn bump `updatedAt` và có thể tạo bản ghi rỗng cho
    // ngày chưa có gì — đó là lý do luật này tồn tại, không phải vì hiệu năng.
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — luật 3: xoá trắng ô đang có giá trị → gửi null', () => {
  it.each(MEASURE_FIELDS)('xoá trắng %s → gửi { [field]: null }', async (field: MeasureField) => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const initialLog = makeBodyLog(FULL_LOG_VALUES);
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange(field, ''));
    act(() => result.current.onBlur(field));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(DATE, { [field]: null });
  });
});

describe('useBodyLogForm — luật 4: giá trị mới hợp lệ → gửi số', () => {
  it('gõ số mới vào ô rỗng → gửi Number(raw)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ chestCm: 98 }));
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('chestCm', '98'));
    act(() => result.current.onBlur('chestCm'));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(DATE, { chestCm: 98 });
  });

  it('gõ chuỗi không phải số → không gửi (chặn NaN ở client)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('armCm', 'abc'));
    act(() => result.current.onBlur('armCm'));

    await new Promise((r) => setTimeout(r, 0));
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — lỗi 400 gắn vào đúng ô', () => {
  it('server trả lỗi trường chestCm → fieldErrors mang đúng khoá đó', async () => {
    const put = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'VALIDATION_ERROR', 'sai', [{ path: 'chestCm', message: 'quá lớn' }]),
      );
    const initialLog = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, initialLog, put));

    act(() => result.current.onChange('chestCm', '9999'));
    act(() => result.current.onBlur('chestCm'));

    await waitFor(() => expect(result.current.fieldErrors.fieldErrors['chestCm']).toBe('quá lớn'));
    expect(result.current.attemptTick).toBeGreaterThan(0);
  });
});

describe('useBodyLogForm — đồng bộ lại khi đổi ngày', () => {
  it('bodyLog mới thay cả 5 ô và xoá cờ touched', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const firstLog = makeBodyLog(FULL_LOG_VALUES);
    const secondLog = makeBodyLog({ date: '2026-08-08', weightKg: 70 });

    const { result, rerender } = renderHook(
      ({ date, log }: { date: string; log: BodyLog }) => useBodyLogForm(date, log, put),
      { initialProps: { date: DATE, log: firstLog } },
    );

    expect(result.current.values.chestCm).toBe('98');

    rerender({ date: '2026-08-08', log: secondLog });

    await waitFor(() => expect(result.current.values.weightKg).toBe('70'));
    expect(result.current.values.chestCm).toBe('');
    expect(result.current.savedField).toBeNull();
  });
});
```

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd web && npx vitest run src/features/today/hooks/useBodyLogForm.test.ts`
Kỳ vọng: FAIL — `result.current.onChange is not a function`.

- [ ] **Bước 3: Viết lại `useBodyLogForm.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../types/api';
import { useFieldErrors, type UseFieldErrorsResult } from '../../../hooks/useFieldErrors';
import type { BodyLog } from '../../../types/api';
import { MEASURE_FIELDS, type MeasureField } from '../../../constants/measures';
import { putBodyLog as defaultPutBodyLog, type BodyLogPatch } from '../api/today.api';

const KNOWN_FIELDS: readonly string[] = MEASURE_FIELDS;

type MeasureRecord<T> = Record<MeasureField, T>;

function fillRecord<T>(value: T): MeasureRecord<T> {
  return Object.fromEntries(MEASURE_FIELDS.map((field) => [field, value])) as MeasureRecord<T>;
}

/** Chuỗi hiển thị cho mỗi ô, lấy từ bản ghi server. `null` → ô rỗng. */
function valuesFromLog(bodyLog: BodyLog | null): MeasureRecord<string> {
  return Object.fromEntries(
    MEASURE_FIELDS.map((field) => {
      const value = bodyLog?.[field];
      return [field, value == null ? '' : String(value)];
    }),
  ) as MeasureRecord<string>;
}

export interface UseBodyLogFormResult {
  /** Giá trị đang gõ của cả năm ô, khóa theo tên trường. */
  values: MeasureRecord<string>;
  onChange: (field: MeasureField, value: string) => void;
  onBlur: (field: MeasureField) => void;
  /** Trường vừa lưu thành công, `null` sau đó (đổi ngày, hoặc ô khác vừa lưu).
   * Chỉ để hiển thị "Đã lưu ✓" — KHÔNG phải cờ đang lưu. */
  savedField: MeasureField | null;
  /** Tăng dần mỗi lần một lần lưu (thành công hoặc lỗi) hoàn tất — trang gọi
   * dùng để biết "vừa có một lần submit mới" và tự đưa focus về ô lỗi đầu tiên. */
  attemptTick: number;
  fieldErrors: UseFieldErrorsResult;
}

/**
 * State + hành vi của `BodyLogForm` — hiện thực SPEC §5.1 (upsert 3 trạng thái)
 * và §5.2 (lỗi 400 gắn vào đúng ô). Đây là chỗ rủi ro nhất của feature: gửi sai
 * một khóa là XÓA MẤT dữ liệu người dùng không đụng tới.
 *
 * Ba mảnh state giữ cho MỖI ô, tất cả khóa theo tên trường (trước đây viết tay
 * từng biến; với 5 số đo thì đó là 25 khai báo song song và 25 cơ hội gõ nhầm):
 * 1. giá trị đang gõ trên input (chuỗi thô, hiển thị trực tiếp);
 * 2. giá trị ĐÃ NẠP từ server lúc đồng bộ gần nhất (so sánh trước khi gửi);
 * 3. cờ "người dùng đã động vào ô này chưa" (ref, không phải state — chỉ cần
 *    đọc lúc blur, không cần re-render khi đổi).
 *
 * Bốn luật gửi khi blur (SPEC §5.1) — KHÔNG đổi so với bản 2 ô:
 * - chưa từng động vào ô → KHÔNG gửi, bất kể giá trị;
 * - giá trị hiện tại không đổi so với lúc nạp, so NUMERIC ("72.40" và "72.4" là
 *   cùng một giá trị) → KHÔNG gửi. Không phải vì hiệu năng: `PUT` với patch
 *   không đổi vẫn bump `updatedAt` và có thể tạo bản ghi rỗng cho ngày chưa có gì;
 * - ô vừa bị xóa trắng (trước đó có giá trị) → gửi `{ [field]: null }`;
 * - ô có giá trị mới, hợp lệ (không `NaN`) → gửi `{ [field]: Number(raw) }`.
 *
 * Đồng bộ lại CẢ BA mảnh mỗi khi `date` đổi HOẶC `bodyLog` đổi — bao gồm cả lúc
 * `bodyLog` tạm thời còn là dữ liệu của ngày CŨ trong khi request của ngày MỚI
 * đang chạy (`useApiResource` cố ý giữ `data` cũ để tránh nhấp nháy). Trang gọi
 * (`BodyLogForm`) PHẢI disable các ô trong lúc `isLoading`, để không ai gõ/blur
 * vào giá trị của ngày cũ rồi gán nhầm cho ngày mới — hook này không tự chặn
 * được vì nó không biết `isLoading`.
 */
export function useBodyLogForm(
  date: string,
  bodyLog: BodyLog | null,
  putBodyLog: (date: string, patch: BodyLogPatch) => Promise<BodyLog> = defaultPutBodyLog,
): UseBodyLogFormResult {
  const [values, setValues] = useState<MeasureRecord<string>>(() => fillRecord(''));
  const [savedField, setSavedField] = useState<MeasureField | null>(null);
  const [attemptTick, setAttemptTick] = useState(0);

  const loaded = useRef<MeasureRecord<string>>(fillRecord(''));
  const touched = useRef<MeasureRecord<boolean>>(fillRecord(false));

  const fieldErrors = useFieldErrors(KNOWN_FIELDS);

  useEffect(() => {
    const next = valuesFromLog(bodyLog);
    setValues(next);
    loaded.current = next;
    touched.current = fillRecord(false);
    setSavedField(null);
    fieldErrors.reset();
    // `fieldErrors.reset` là hàm ổn định (useCallback rỗng deps) — không cần
    // đưa vào deps, đưa vào không sai nhưng thừa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, bodyLog]);

  function isUnchanged(raw: string, loadedValue: string): boolean {
    const rawEmpty = raw.trim() === '';
    const loadedEmpty = loadedValue.trim() === '';
    if (rawEmpty && loadedEmpty) return true;
    if (rawEmpty !== loadedEmpty) return false;
    return Number(raw) === Number(loadedValue);
  }

  async function commit(field: MeasureField, raw: string) {
    if (!touched.current[field]) return; // luật 1
    if (isUnchanged(raw, loaded.current[field])) return; // luật 2

    let value: number | null;
    if (raw.trim() === '') {
      value = null; // luật 3
    } else {
      const num = Number(raw);
      if (Number.isNaN(num)) return; // chặn NaN ở client (SPEC §5.4)
      value = num; // luật 4
    }

    // Xóa lỗi cũ TRƯỚC khi gửi (SPEC §5.2) — lỗi tồn đọng của lần trước trên
    // một ô đã sửa đúng không được hiển thị trong lúc chờ.
    fieldErrors.reset();

    try {
      // Object literal ĐÚNG MỘT KHÓA. Đây là dòng quyết định của cả file:
      // thêm bất cứ khóa nào khác vào đây là xóa dữ liệu của ô đó.
      await putBodyLog(date, { [field]: value } as BodyLogPatch);
      loaded.current = { ...loaded.current, [field]: raw };
      setSavedField(field);
    } catch (err) {
      if (err instanceof ApiError) {
        fieldErrors.setError(err);
      } else {
        throw err;
      }
    } finally {
      setAttemptTick((t) => t + 1);
    }
  }

  return {
    values,
    savedField,
    attemptTick,
    fieldErrors,
    onChange: (field: MeasureField, value: string) => {
      touched.current[field] = true;
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    onBlur: (field: MeasureField) => {
      void commit(field, values[field]);
    },
  };
}
```

- [ ] **Bước 4: Chạy test, xác nhận XANH**

Chạy: `cd web && npx vitest run src/features/today/hooks/useBodyLogForm.test.ts`
Kỳ vọng: PASS, gồm 5 ca `it.each` của nhóm "TEST CANH MẤT DỮ LIỆU".

- [ ] **Bước 5: CHECKPOINT** — báo cáo kèm output, chờ chủ dự án commit.

---

## Task 6: `BodyLogForm` — 2 ô thành 5

**Files:**
- Sửa: `web/src/features/today/components/BodyLogForm.tsx`
- Sửa: `web/src/features/today/components/BodyLogForm.module.css`
- Test: `web/src/features/today/components/BodyLogForm.test.tsx`

**Interfaces:**
- Consumes: `UseBodyLogFormResult` từ Task 5; `MEASURES`/`measureLabel` từ Task 4.
- Produces: không có gì cho task sau.

- [ ] **Bước 1: Viết test đỏ**

Thêm vào `web/src/features/today/components/BodyLogForm.test.tsx`:

```ts
describe('BodyLogForm — năm ô số đo', () => {
  it('render đủ 5 ô với nhãn kèm đơn vị', () => {
    render(<BodyLogForm date="2026-08-07" bodyLog={null} isLoading={false} />);

    expect(screen.getByLabelText('Cân nặng (kg)')).toBeDefined();
    expect(screen.getByLabelText('Vòng bụng (cm)')).toBeDefined();
    expect(screen.getByLabelText('Vòng ngực (cm)')).toBeDefined();
    expect(screen.getByLabelText('Vòng vai (cm)')).toBeDefined();
    expect(screen.getByLabelText('Vòng bắp tay (cm)')).toBeDefined();
  });

  it('cả 5 ô bị disable khi đang tải', () => {
    render(<BodyLogForm date="2026-08-07" bodyLog={null} isLoading={true} />);

    for (const label of [
      'Cân nặng (kg)',
      'Vòng bụng (cm)',
      'Vòng ngực (cm)',
      'Vòng vai (cm)',
      'Vòng bắp tay (cm)',
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
    }
  });
});
```

Giữ nguyên các `describe` sẵn có trong file. Nếu file chưa import `render`/`screen`, thêm
`import { render, screen } from '@testing-library/react';`.

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd web && npx vitest run src/features/today/components/BodyLogForm.test.tsx`
Kỳ vọng: FAIL — không tìm thấy nhãn "Vòng ngực (cm)".

- [ ] **Bước 3: Viết lại phần render của `BodyLogForm.tsx`**

Giữ nguyên toàn bộ khối `useEffect` đưa focus về ô lỗi. Thay import và phần `return`:

```tsx
import { useEffect, useRef } from 'react';
import { Card, NumberInput } from '../../../components/ui';
import type { BodyLog } from '../../../types/api';
import { MEASURES, measureLabel } from '../../../constants/measures';
import { useBodyLogForm } from '../hooks/useBodyLogForm';
import s from './BodyLogForm.module.css';
```

```tsx
  return (
    <Card heading="Số đo">
      {fieldErrors.formErrors.length > 0 ? (
        <div ref={formErrorRef} tabIndex={-1} role="alert" className={s.formError}>
          {fieldErrors.summary}
        </div>
      ) : null}

      {/* Cân nặng đứng riêng một hàng: đơn vị khác bốn ô còn lại, và là số
          người dùng nhìn nhiều nhất. Bốn vòng xếp lưới bên dưới. */}
      <div className={s.row}>
        <NumberInput
          id={MEASURES[0].field}
          label={measureLabel(MEASURES[0])}
          step={MEASURES[0].step}
          value={form.values[MEASURES[0].field]}
          onChange={(event) => form.onChange(MEASURES[0].field, event.target.value)}
          onBlur={() => form.onBlur(MEASURES[0].field)}
          error={fieldErrors.fieldErrors[MEASURES[0].field]}
          disabled={isLoading}
        />
      </div>

      <div className={s.grid}>
        {MEASURES.slice(1).map((measure) => (
          <NumberInput
            key={measure.field}
            id={measure.field}
            label={measureLabel(measure)}
            step={measure.step}
            value={form.values[measure.field]}
            onChange={(event) => form.onChange(measure.field, event.target.value)}
            onBlur={() => form.onBlur(measure.field)}
            error={fieldErrors.fieldErrors[measure.field]}
            disabled={isLoading}
          />
        ))}
      </div>

      <p className={s.hint} aria-live="polite">
        Để trống rồi rời ô để xóa giá trị.{form.savedField ? ' Đã lưu ✓' : ''}
      </p>
    </Card>
  );
```

- [ ] **Bước 4: Thêm lớp `.grid` vào `BodyLogForm.module.css`**

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
```

- [ ] **Bước 5: Chạy test file này, xác nhận XANH**

Chạy: `cd web && npx vitest run src/features/today/components/BodyLogForm.test.tsx`
Kỳ vọng: PASS.

- [ ] **Bước 6: Chạy cả suite web**

Chạy: `cd web && npm test`
Kỳ vọng: PASS. `TodayPage.test.tsx` và `useTodayData.test.ts` tạo object `BodyLog` — nếu đỏ vì
thiếu 3 trường mới, bổ sung `chestCm: null, shoulderCm: null, armCm: null` vào các factory đó.

- [ ] **Bước 7: CHECKPOINT** — báo cáo kèm output, chờ chủ dự án commit.

---

## Task 7: `GoalSettingsSection` — 3 ô thành 9, chia hai nhóm

**Files:**
- Sửa: `web/src/features/settings/components/GoalSettingsSection.tsx`
- Sửa: `web/src/features/settings/components/GoalSettingsSection.module.css`
- Tạo: `web/src/features/settings/components/GoalSettingsSection.test.tsx`

**Interfaces:**
- Consumes: `GoalPatch` 9 khoá từ Task 4; `Goal` mở rộng từ Task 4.
- Produces: không có gì cho task sau.

> Component này hiện **chưa có test nào**, mà sắp nâng từ 3 lên 9 ô. Ánh xạ 9 ô lệch nhau một
> dòng là bug không phát hiện được bằng mắt và không có 400 nào báo (server strip im lặng).

- [ ] **Bước 1: Tạo file test đỏ**

Tạo `web/src/features/settings/components/GoalSettingsSection.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/apiClient';
import { GoalSettingsSection } from './GoalSettingsSection';
import type { Goal } from '../../../types/api';

// Component này ánh xạ 9 ô nhập sang 9 khóa của `GoalPatch`. Server KHÔNG
// `.strict()` nên một ánh xạ sai bị strip IM LẶNG — không 400, không lỗi, chỉ
// là giá trị biến mất. Test dưới đây là chốt chặn duy nhất cho việc đó.
//
// Mock ở tầng `apiClient`, KHÔNG ở tầng `settings.api` — cùng quán lệ với
// `SettingsPage.test.tsx`. Mock ở `apiClient` còn phủ được cả `updateGoal`,
// nơi có danh sách trắng cứng dễ bỏ sót khóa.

const EMPTY_GOAL: Goal = {
  startWeightKg: null,
  startDate: null,
  targetWeightKg: null,
  targetWaistCm: null,
  targetChestCm: null,
  targetShoulderCm: null,
  targetArmCm: null,
  targetDate: null,
  dailyCalorieTarget: null,
  updatedAt: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** `ma7` = giá trị `goal.currentMa7WeightKg` mà `/summary` trả về. */
function mockLoads(goal: Goal = EMPTY_GOAL, ma7: number | null = null) {
  vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
    if (path === '/goal') return Promise.resolve(goal);
    if (path.startsWith('/summary')) {
      return Promise.resolve({ days: [], weeks: [], goal: { currentMa7WeightKg: ma7 } });
    }
    return Promise.reject(new Error(`unexpected path in test: ${path}`));
  });
  return vi.spyOn(apiClient, 'put').mockResolvedValue(goal);
}

describe('GoalSettingsSection — 9 ô ánh xạ sang đúng 9 khóa', () => {
  it('render đủ 9 ô, chia hai nhóm có tiêu đề', async () => {
    mockLoads();
    render(<GoalSettingsSection />);

    await screen.findByText('Điểm xuất phát');
    expect(screen.getByText('Đích đến')).toBeTruthy();

    for (const label of [
      'Cân nặng lúc bắt đầu (kg)',
      'Ngày bắt đầu',
      'Cân nặng đích (kg)',
      'Vòng bụng đích (cm)',
      'Vòng ngực đích (cm)',
      'Vòng vai đích (cm)',
      'Vòng bắp tay đích (cm)',
      'Ngày đích',
      'Calo mục tiêu / ngày',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('bấm Lưu gửi đúng 9 khóa với đúng giá trị từng ô', async () => {
    const put = mockLoads();
    const user = userEvent.setup();
    render(<GoalSettingsSection />);

    await screen.findByLabelText('Cân nặng đích (kg)');

    await user.type(screen.getByLabelText('Cân nặng lúc bắt đầu (kg)'), '75');
    await user.type(screen.getByLabelText('Ngày bắt đầu'), '2026-08-01');
    await user.type(screen.getByLabelText('Cân nặng đích (kg)'), '68');
    await user.type(screen.getByLabelText('Vòng bụng đích (cm)'), '80');
    await user.type(screen.getByLabelText('Vòng ngực đích (cm)'), '95');
    await user.type(screen.getByLabelText('Vòng vai đích (cm)'), '110');
    await user.type(screen.getByLabelText('Vòng bắp tay đích (cm)'), '30');
    await user.type(screen.getByLabelText('Ngày đích'), '2027-01-01');
    await user.type(screen.getByLabelText('Calo mục tiêu / ngày'), '1800');

    await user.click(screen.getByRole('button', { name: /Lưu mục tiêu/ }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    // Khẳng định trên BODY thật gửi đi, không phải trên tham số của `updateGoal`
    // — đó là cách duy nhất bắt được danh sách trắng cứng bỏ sót khóa.
    expect(put).toHaveBeenCalledWith('/goal', {
      startWeightKg: 75,
      startDate: '2026-08-01',
      targetWeightKg: 68,
      targetWaistCm: 80,
      targetChestCm: 95,
      targetShoulderCm: 110,
      targetArmCm: 30,
      targetDate: '2027-01-01',
      dailyCalorieTarget: 1800,
    });
  });

  it('ô để trống gửi null, không gửi chuỗi rỗng', async () => {
    const put = mockLoads();
    const user = userEvent.setup();
    render(<GoalSettingsSection />);

    await screen.findByLabelText('Cân nặng đích (kg)');
    await user.click(screen.getByRole('button', { name: /Lưu mục tiêu/ }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const body = put.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body)).toHaveLength(9);
    for (const value of Object.values(body)) {
      expect(value).toBeNull();
    }
  });
});

describe('GoalSettingsSection — tự điền "cân đầu" (spec §5.4)', () => {
  it('startWeightKg chưa đặt → ô điền sẵn MA7 hôm nay', async () => {
    mockLoads(EMPTY_GOAL, 72.4);
    render(<GoalSettingsSection />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
      ).toBe('72.4'),
    );
  });

  it('startWeightKg ĐÃ đặt → giữ giá trị đã lưu, KHÔNG đè bằng MA7', async () => {
    mockLoads({ ...EMPTY_GOAL, startWeightKg: 80 }, 72.4);
    render(<GoalSettingsSection />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
      ).toBe('80'),
    );
  });

  it('chưa đủ dữ liệu để có MA7 → ô để trống, không bịa số', async () => {
    mockLoads(EMPTY_GOAL, null);
    render(<GoalSettingsSection />);

    await screen.findByLabelText('Cân nặng lúc bắt đầu (kg)');
    expect(
      (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
    ).toBe('');
  });

  it('giá trị điền sẵn là BẢN NHÁP — không tự lưu khi chưa bấm Lưu', async () => {
    const put = mockLoads(EMPTY_GOAL, 72.4);
    render(<GoalSettingsSection />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
      ).toBe('72.4'),
    );
    expect(put).not.toHaveBeenCalled();
  });
});
```

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd web && npx vitest run src/features/settings/components/GoalSettingsSection.test.tsx`
Kỳ vọng: FAIL — không tìm thấy nhãn "Điểm xuất phát".

- [ ] **Bước 3: Viết lại `GoalSettingsSection.tsx`**

Giữ nguyên `formatUpdatedAt`, `useGoalSettings`, khối `loadError`/`!goal`, và khối hiển thị lỗi.
Thay phần state, đồng bộ, `handleSave` và `return`:

```tsx
const KNOWN_FIELDS = [
  'startWeightKg',
  'startDate',
  'targetWeightKg',
  'targetWaistCm',
  'targetChestCm',
  'targetShoulderCm',
  'targetArmCm',
  'targetDate',
  'dailyCalorieTarget',
] as const;

type GoalField = (typeof KNOWN_FIELDS)[number];

/** Sáu ô SỐ. Hai ô ngày (`startDate`, `targetDate`) không nằm đây vì
 * `<input type="date">` là loại control khác, render riêng bên dưới. */
const NUMERIC_FIELDS = [
  { field: 'startWeightKg', label: 'Cân nặng lúc bắt đầu (kg)', step: '0.1', group: 'start' },
  { field: 'targetWeightKg', label: 'Cân nặng đích (kg)', step: '0.1', group: 'target' },
  { field: 'targetWaistCm', label: 'Vòng bụng đích (cm)', step: '0.1', group: 'target' },
  { field: 'targetChestCm', label: 'Vòng ngực đích (cm)', step: '0.1', group: 'target' },
  { field: 'targetShoulderCm', label: 'Vòng vai đích (cm)', step: '0.1', group: 'target' },
  { field: 'targetArmCm', label: 'Vòng bắp tay đích (cm)', step: '0.1', group: 'target' },
  { field: 'dailyCalorieTarget', label: 'Calo mục tiêu / ngày', step: '1', group: 'target' },
] as const;
```

```tsx
  const [inputs, setInputs] = useState<Record<GoalField, string>>(
    () => Object.fromEntries(KNOWN_FIELDS.map((f) => [f, ''])) as Record<GoalField, string>,
  );
  const [initialized, setInitialized] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Đồng bộ ô nhập từ dữ liệu server ĐÚNG MỘT LẦN khi tải xong lần đầu — sau
  // đó `goal` chỉ còn đổi khi CHÍNH form này lưu (giá trị mới đã khớp input),
  // nên không cần đồng bộ lại và không có rủi ro đè bản nháp đang gõ.
  useEffect(() => {
    if (goal && !initialized) {
      setInputs(
        Object.fromEntries(
          KNOWN_FIELDS.map((field) => [field, goal[field] === null ? '' : String(goal[field])]),
        ) as Record<GoalField, string>,
      );
      setInitialized(true);
    }
  }, [goal, initialized]);
```

Điền sẵn "cân đầu" (spec §5.4) — thêm ngay dưới effect đồng bộ ở trên:

```tsx
  // Nguồn của giá trị điền sẵn. `useApiResource` đã chống race sẵn; lỗi mạng
  // làm `data` là `null` → không điền gì, form vẫn dùng được bình thường.
  const { data: currentMa7 } = useApiResource(fetchCurrentMa7WeightKg, []);
  const prefilledRef = useRef(false);

  /**
   * Điền sẵn ô "Cân nặng lúc bắt đầu" bằng MA7 hôm nay, ĐÚNG MỘT LẦN.
   *
   * Bốn điều kiện, thiếu một là không điền:
   * - chưa từng điền trong phiên này (`prefilledRef`) — nếu không, mỗi lần
   *   `currentMa7` đổi tham chiếu sẽ đè lên thứ người dùng đang gõ;
   * - `goal` đã về (`initialized`) — điền trước đó sẽ bị effect đồng bộ ghi đè;
   * - `goal.startWeightKg` đang là `null` — ĐÃ đặt rồi thì tuyệt đối không đè,
   *   giá trị đã lưu là ý định của người dùng, MA7 chỉ là gợi ý;
   * - có MA7 thật — chưa đủ dữ liệu thì để ô TRỐNG, không bịa số.
   *
   * Đây là BẢN NHÁP trong ô, không phải một lần ghi: không bấm Lưu thì DB
   * không đổi.
   */
  useEffect(() => {
    if (prefilledRef.current) return;
    if (!initialized) return;
    if (goal?.startWeightKg !== null) return;
    if (currentMa7 == null) return;
    prefilledRef.current = true;
    setInputs((prev) =>
      prev.startWeightKg === '' ? { ...prev, startWeightKg: String(currentMa7) } : prev,
    );
  }, [initialized, goal, currentMa7]);
```

Cập nhật import ở đầu file:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useApiResource, useFieldErrors } from '../../../hooks';
import { fetchCurrentMa7WeightKg, numericInputToPatchValue, textInputToPatchValue } from '../api/settings.api';
```

```tsx
  function setField(field: GoalField, value: string) {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setSavedFlash(false);
  }

  async function handleSave() {
    fieldErrorsApi.reset();
    setGeneralError(null);
    setSavedFlash(false);
    try {
      await save({
        startWeightKg: numericInputToPatchValue(inputs.startWeightKg),
        startDate: textInputToPatchValue(inputs.startDate),
        targetWeightKg: numericInputToPatchValue(inputs.targetWeightKg),
        targetWaistCm: numericInputToPatchValue(inputs.targetWaistCm),
        targetChestCm: numericInputToPatchValue(inputs.targetChestCm),
        targetShoulderCm: numericInputToPatchValue(inputs.targetShoulderCm),
        targetArmCm: numericInputToPatchValue(inputs.targetArmCm),
        targetDate: textInputToPatchValue(inputs.targetDate),
        dailyCalorieTarget: numericInputToPatchValue(inputs.dailyCalorieTarget),
      });
      setSavedFlash(true);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      fieldErrorsApi.setError(apiErr);
      if (!apiErr?.fields || apiErr.fields.length === 0) {
        setGeneralError(apiErr?.status === 0 ? apiErr.message : 'Lưu thất bại. Vui lòng thử lại.');
      }
    }
  }
```

`handleSave` cố ý **liệt kê tay cả 9 dòng** thay vì lặp: đây là chỗ TypeScript kiểm được rằng
mọi khóa của `GoalPatch` đã có mặt. Lặp qua `KNOWN_FIELDS` sẽ cần ép kiểu, và ép kiểu ở đúng
chỗ này là bỏ mất tấm lưới an toàn duy nhất — server strip khóa lạ im lặng.

Phần render, một helper cục bộ cho ô ngày và hai nhóm:

```tsx
  function renderDateField(field: 'startDate' | 'targetDate', label: string) {
    const id = `goal-${field}`;
    return (
      <div className={s.field}>
        <label htmlFor={id} className={s.label}>
          {label}
        </label>
        <input
          id={id}
          type="date"
          className={s.dateInput}
          value={inputs[field]}
          aria-invalid={fieldErrorsApi.fieldErrors[field] ? true : undefined}
          onChange={(e) => setField(field, e.target.value)}
        />
        {fieldErrorsApi.fieldErrors[field] ? (
          <FieldError id={id} message={fieldErrorsApi.fieldErrors[field]} />
        ) : null}
      </div>
    );
  }

  function renderNumericField(spec: (typeof NUMERIC_FIELDS)[number]) {
    return (
      <NumberInput
        key={spec.field}
        id={spec.field}
        label={spec.label}
        step={spec.step}
        value={inputs[spec.field]}
        error={fieldErrorsApi.fieldErrors[spec.field]}
        onChange={(e) => setField(spec.field, e.target.value)}
      />
    );
  }
```

```tsx
  return (
    <div className={s.section}>
      {/* Chín ô phẳng trên một lưới thì không đọc được. Hai nhóm trả lời hai
          câu khác nhau: "tôi bắt đầu từ đâu" và "tôi muốn tới đâu". */}
      <h3 className={s.groupHeading}>Điểm xuất phát</h3>
      <div className={s.grid}>
        {NUMERIC_FIELDS.filter((f) => f.group === 'start').map(renderNumericField)}
        {renderDateField('startDate', 'Ngày bắt đầu')}
      </div>

      <h3 className={s.groupHeading}>Đích đến</h3>
      <div className={s.grid}>
        {NUMERIC_FIELDS.filter((f) => f.group === 'target').map(renderNumericField)}
        {renderDateField('targetDate', 'Ngày đích')}
      </div>

      {fieldErrorsApi.formErrors.length > 0 ? (
        <p className={s.generalError} role="alert">
          {fieldErrorsApi.summary} {fieldErrorsApi.formErrors.map((f) => f.message).join(' ')}
        </p>
      ) : null}
      {generalError ? (
        <p className={s.generalError} role="alert">
          {generalError}
        </p>
      ) : null}

      <div className={s.actions}>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Đang lưu…' : 'Lưu mục tiêu'}
        </Button>
        {savedFlash ? <span className={s.savedFlash}>Đã lưu.</span> : null}
        <span className={s.updatedAt}>
          {goal.updatedAt
            ? `Cập nhật lần cuối ${formatUpdatedAt(goal.updatedAt)}`
            : 'Chưa từng đặt mục tiêu'}
        </span>
      </div>
    </div>
  );
```

Cập nhật `KNOWN_FIELDS` truyền vào `useFieldErrors` — nó đã là hằng ở đầu file, không cần đổi
lời gọi `useFieldErrors(KNOWN_FIELDS)`.

- [ ] **Bước 4: Thêm `.groupHeading` vào `GoalSettingsSection.module.css`**

```css
.groupHeading {
  margin: 16px 0 8px;
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.75;
}

.groupHeading:first-child {
  margin-top: 0;
}
```

- [ ] **Bước 5: Chạy test file này, xác nhận XANH**

Chạy: `cd web && npx vitest run src/features/settings/components/GoalSettingsSection.test.tsx`
Kỳ vọng: PASS cả 3 ca.

- [ ] **Bước 6: Chạy cả suite web + typecheck**

Chạy: `cd web && npm test && npx tsc -p tsconfig.json --noEmit`
Kỳ vọng: PASS, không lỗi kiểu. `SettingsPage.test.tsx` có thể cần bổ sung trường mới vào
object `Goal` giả — sửa cho khớp.

- [ ] **Bước 7: CHECKPOINT** — báo cáo kèm output, chờ chủ dự án commit.

---

## Task 8: Chạy thật và cập nhật tài liệu

**Files:**
- Sửa: `docs/overview/02-data-model.md`
- Sửa: `docs/features/body-logs/SPEC.md`
- Sửa: `docs/features/goal/SPEC.md`
- Sửa: `docs/features/summary/SPEC.md`
- Sửa: `docs/features/web-today/SPEC.md`
- Sửa: `docs/features/web-settings/SPEC.md`
- Sửa: `docs/README.md` (bảng trạng thái)

**Interfaces:** không sinh ra gì cho task sau — đây là task cuối.

- [ ] **Bước 0: Vá fixture test đang đỏ (thêm vào sau khi Task 4 phát hiện)**

Task 4 mở rộng `BodyLog`/`Goal`/`SummaryDay`/`SummaryGoal`, làm **18 lỗi typecheck** ở 10 file
test — toàn bộ là object literal thiếu trường mới, **không có lỗi logic nào**. Phân bố đo được:

```
8 src/features/charts/components     5 src/features/today/components
1 src/features/charts/utils          4 src/features/today/hooks
```

Tasks 5–7 vá phần `today/`. Bước này vá phần còn lại. Với mỗi fixture đỏ, thêm các trường thiếu
với giá trị `null`:

- literal `SummaryDay` → thêm `chestCm`, `chestMa7`, `shoulderCm`, `shoulderMa7`, `armCm`, `armMa7`
- literal `SummaryGoal` → thêm `startWeightKg`, `startDate`
- literal `Goal` → thêm `startWeightKg`, `startDate`, `targetWaistCm`, `targetChestCm`,
  `targetShoulderCm`, `targetArmCm`
- literal `BodyLog` → thêm `chestCm`, `shoulderCm`, `armCm`

**Chỉ thêm trường vào fixture. TUYỆT ĐỐI không** đổi component biểu đồ, logic vẽ, hay một
assertion nào. Nếu một test bắt đầu fail vì lý do khác việc thiếu trường, **dừng và báo** —
đó là dấu hiệu thay đổi hợp đồng đã làm vỡ hành vi thật, không phải chỉ vỡ kiểu.

Chạy: `cd web && npx tsc -p tsconfig.json --noEmit`
Kỳ vọng: 0 lỗi.

- [ ] **Bước 1: Chạy toàn bộ test và typecheck cả hai bên**

```bash
cd server && npm test && npx tsc --noEmit
cd ../web && npm test && npx tsc -p tsconfig.json --noEmit
```

Kỳ vọng: PASS cả bốn lệnh. **Dán output thật** vào báo cáo, không tóm tắt.

- [ ] **Bước 2: Xác nhận `shared/stats/` và `features/charts/` không bị đụng**

```bash
cd C:/Project/WorkSpace/Lean
git diff --name-only -- server/src/shared/stats/ web/src/features/charts/
```

Kỳ vọng: **không in ra gì**.

- [ ] **Bước 3: Chạy BE trên DB tạm**

```bash
cd server && DATABASE_URL=file:./scratch.db npx prisma db push
cd server && DATABASE_URL=file:./scratch.db npm run dev
```

`scratch.db` khớp mẫu `*.db` trong `.gitignore` nên không lọt vào git.
**Tuyệt đối không dùng `data.db` ở bước này.**

- [ ] **Bước 4: Chạy FE và kiểm bằng tay**

```bash
cd web && npm run dev     # http://localhost:7173
```

Kiểm đủ ba việc, chụp màn hình hoặc dán response:

1. Mở `/`, nhập đủ 5 số đo cho hôm nay, tải lại trang → cả 5 còn nguyên.
2. Mở `/settings`, điền đủ 9 trường mục tiêu, bấm Lưu, tải lại → cả 9 còn nguyên.
3. `curl "http://localhost:3000/api/summary?from=<hôm nay>&to=<hôm nay>"` → mỗi phần tử `days`
   có đủ 10 trường số đo; `goal` có `startWeightKg` và `startDate`.

- [ ] **Bước 5: Cập nhật 6 file tài liệu**

Với mỗi file, sửa để mô tả **hành vi thật của code sau đợt này**:

| File | Sửa gì |
|---|---|
| `docs/overview/02-data-model.md` | Bảng cột của `BodyLog` (+3) và `Goal` (+6), kèm ghi chú `startDate` là `String` không `DateTime` |
| `docs/features/body-logs/SPEC.md` | Upsert 6 khoá thay vì 3; ràng buộc 4 vòng dùng chung `circumferenceCmSchema` |
| `docs/features/goal/SPEC.md` | 9 trường; `startDate` dùng `pastOrTodayDateString` còn `targetDate` dùng `dateString` — nêu rõ vì sao khác nhau |
| `docs/features/summary/SPEC.md` | `SummaryDay` 5 cặp số đo; `SummaryGoal` thêm `startWeightKg`/`startDate` |
| `docs/features/web-today/SPEC.md` | Form 5 ô; API mới của `useBodyLogForm` (`values`/`onChange`/`onBlur`) |
| `docs/features/web-settings/SPEC.md` | Form 9 ô chia hai nhóm; vì sao `handleSave` liệt kê tay 9 dòng thay vì lặp. **VÀ sửa §2** — xem dưới |
| `web/src/features/settings/components/SettingsPage.tsx` | **Chỉ comment đầu file** — xem dưới |

**Sửa §2 của `web-settings/SPEC.md` và comment đầu `SettingsPage.tsx`** (phát sinh ở Task 7,
chủ dự án chốt 2026-08-11). Hai chỗ đó đang khẳng định trang Cài đặt **không gọi**
`GET /api/summary`. Từ Task 7 thì có gọi — `GoalSettingsSection` đọc `goal.currentMa7WeightKg`
để điền sẵn ô "Cân nặng lúc bắt đầu".

Sửa theo hướng **phân biệt hai việc khác nhau**, KHÔNG phải bỏ điều cấm:

- **Vẫn cấm:** hiển thị tiến độ mục tiêu (`remainingKg`, `onTrack`, `currentRate`) ở trang Cài
  đặt. Đó là việc của trang Biểu đồ; kéo sang đây là nhân bản công thức.
- **Được phép:** đọc **một giá trị** từ `/summary` để điền sẵn một ô nhập. Không tính toán gì,
  không hiển thị tiến độ, và giá trị điền sẵn chỉ là bản nháp cho tới khi người dùng bấm Lưu.

Lý do gốc của điều cấm — "đừng nhân bản công thức" — **không bị vi phạm**: prefill tiêu thụ một
số mà server đã tính, ngược hẳn với việc tính lại. Câu chữ cũ cấm tuyệt đối nên phải nới cho
khớp hành vi thật, thay vì để tài liệu nói dối (`docs/README.md`: code và tài liệu lệch nhau thì
code đúng).

Test `'trang KHÔNG gọi GET /api/summary…'` trong `SettingsPage.test.tsx` đã được Task 7 đổi tên
và ghi comment cho khớp — **không sửa lại nữa**, chỉ kiểm rằng nó còn nói đúng sự thật.

- [ ] **Bước 6: Cập nhật bảng trạng thái trong `docs/README.md`**

Thêm dòng ghi nhận đợt `measures-and-goals` đã xong và trỏ tới spec
`docs/superpowers/specs/2026-08-11-measures-and-goals-design.md`.

- [ ] **Bước 7: CHECKPOINT CUỐI**

Báo cáo cho chủ dự án:
- output thật của 4 lệnh ở Bước 1
- output của Bước 2 (phải rỗng)
- kết quả 3 việc kiểm tay ở Bước 4
- danh sách 7 file tài liệu đã sửa
- **Yêu cầu chủ dự án chạy migration lên DB thật** — việc này dời từ Task 0 xuống đây:

  > ```bash
  > cd server && npx prisma db push
  > ```
  >
  > Cột mới đều nullable nên chỉ thêm cột trống, không mất dữ liệu. Chưa chạy lệnh này thì
  > app thật vẫn báo lỗi cột không tồn tại, dù mọi test đều xanh.

  **Agent KHÔNG tự chạy lệnh này** — nó ghi vào `server/data.db`.
- nhắc: `scratch.db` có thể xoá sau khi kiểm tay xong

Chờ chủ dự án commit. **Đợt `measures-and-goals` kết thúc ở đây.**
Đợt tiếp theo là `ui-mui` hoặc `charts-mui` — cần spec riêng, không nối tiếp vào kế hoạch này.

---

## Phụ lục: những chỗ CỐ Ý không làm

Ghi lại để người thực thi không "sửa thêm cho hợp lý":

- **`bodyLogs.repository.ts` và `goal.repository.ts` không đổi.** Cả hai spread `patch` vào
  `create`/`update` nên tự nhận khoá mới. Thêm code ở đó là thêm chỗ để sai.
- **`shared/stats/movingAverage.ts` không đổi.** Nó nhận `DatedValue[]`; năm số đo chỉ là gọi
  nó năm lần với năm mảng.
- **`web/src/features/charts/` không đổi.** `NullableDayKey` vẫn hợp lệ vì là tập con.
- **Không tính % tiến độ ở đợt này.** `startWeightKg`/`startDate` chỉ được lưu và trả ra.
- **Không thêm `currentMa7WeightKg` vào `/api/goal`.** Đã cân nhắc và bác ở spec §8.3.
- **Không đổi UI kit sang MUI.** Đó là đợt `ui-mui`, chạy độc lập.
