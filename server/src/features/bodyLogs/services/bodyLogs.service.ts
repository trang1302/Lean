import type { BodyLog } from '../../../generated/prisma/client.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { DateRange } from '../../../shared/validation/commonSchemas.js';
import type { BodyLogUpsertPatch } from '../dtos/bodyLogs.request.js';
import type { BodyLogResponse } from '../dtos/bodyLogs.response.js';
import * as repository from '../repositories/bodyLogs.repository.js';

/** Cắt `userId` khỏi hàng DB và đổi dấu thời gian sang ISO cho JSON. */
function toResponse(row: BodyLog): BodyLogResponse {
  return {
    date: row.date,
    weightKg: row.weightKg,
    waistCm: row.waistCm,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getByDate(date: string): Promise<BodyLogResponse> {
  const row = await repository.findByDate(date);
  if (!row) throw AppError.notFound(`Chưa có số đo cho ngày ${date}`);
  return toResponse(row);
}

export async function listInRange(range: DateRange): Promise<BodyLogResponse[]> {
  const rows = await repository.findInRange(range.from, range.to);
  return rows.map(toResponse);
}

export async function upsertByDate(
  date: string,
  patch: BodyLogUpsertPatch,
): Promise<BodyLogResponse> {
  const row = await repository.upsertByDate(date, patch);
  return toResponse(row);
}

export async function removeByDate(date: string): Promise<void> {
  const deleted = await repository.deleteByDate(date);
  if (!deleted) throw AppError.notFound(`Chưa có số đo cho ngày ${date}`);
}
