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
