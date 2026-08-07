import { z } from 'zod';
import {
  dateRangeSchema,
  pastOrTodayDateString,
  waistCmSchema,
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
 * Body của PUT. `strictObject` để `{ weight: 72 }` (gõ sai tên) báo 400 thay vì
 * lặng lẽ không làm gì — với upsert "vắng mặt = giữ nguyên", một lỗi gõ sai mà
 * trả 200 là kiểu lỗi người dùng không bao giờ phát hiện ra.
 */
const upsertBodyLogSchema = z
  .strictObject({
    weightKg: weightKgSchema.nullable(),
    waistCm: waistCmSchema.nullable(),
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
  note?: string | null;
}

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
  if ('weightKg' in raw) patch.weightKg = parsed.weightKg ?? null;
  if ('waistCm' in raw) patch.waistCm = parsed.waistCm ?? null;
  if ('note' in raw) patch.note = parsed.note ?? null;
  return patch;
}
