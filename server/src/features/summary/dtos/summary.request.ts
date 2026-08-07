import { dateRangeSchema } from '../../../shared/validation/commonSchemas.js';

/**
 * Query của `GET /api/summary?from=&to=`.
 *
 * Dùng thẳng `dateRangeSchema` dùng chung — nó đã kiểm `from <= to` và giới hạn
 * 730 ngày (spec §5). Không định nghĩa lại ở đây để hai chỗ không lệch nhau.
 */
export const summaryQuerySchema = dateRangeSchema;

export type SummaryQuery = typeof summaryQuerySchema._output;
