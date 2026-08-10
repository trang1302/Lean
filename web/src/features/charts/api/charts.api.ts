// Gọi API DUY NHẤT của trang Biểu đồ — `GET /api/summary?from=&to=` — qua
// `lib/apiClient.ts` (điểm gọi `fetch()` duy nhất của `web/`, xem
// docs/features/web-charts/SPEC.md §2). KHÔNG gọi thêm bất kỳ endpoint nào
// khác (`/body-logs`, `/meals`, `/goal`) — mọi thứ trang này cần đã nằm
// trong response của `summary` (SPEC §2, PLAN §5.3).

import { apiClient } from '../../../lib/apiClient';
import type { SummaryResponse } from '../../../types/api';

/**
 * `from`/`to` phải là "YYYY-MM-DD" hợp lệ theo hợp đồng backend
 * (`dateRangeSchema`, docs/features/summary/SPEC.md §1). Trang này chỉ tạo
 * `from`/`to` qua `utils/dateRange.ts` (ba nút cố định 30/90/365 ngày) nên
 * không bao giờ vi phạm `from <= to` hay biên 730 ngày — không cần xử lý
 * `400` đặc biệt ở đây (SPEC §7.2/§7.3, quyết định đã chốt).
 */
export function getSummary(from: string, to: string): Promise<SummaryResponse> {
  const params = new URLSearchParams({ from, to });
  return apiClient.get<SummaryResponse>(`/summary?${params.toString()}`);
}
