// State của trang Biểu đồ: lựa chọn khoảng (`RangeOption`) → `from`/`to` →
// gọi `GET /api/summary` qua `useApiResource` (chống race có sẵn ở
// web-shell, xem docs/features/web-shell/SPEC.md §8) → trả
// `{ data, isLoading, error, reload }` cho `ChartsPage`.

import { useMemo, useState } from 'react';
import { useApiResource } from '../../../hooks/useApiResource';
import { todayIso } from '../../../lib/format';
import type { SummaryResponse } from '../../../types/api';
import { getSummary } from '../api/charts.api';
import { rangeToDates, type RangeOption } from '../utils/dateRange';

export interface UseChartsResult {
  range: RangeOption;
  setRange: (range: RangeOption) => void;
  from: string;
  to: string;
  data: SummaryResponse | null;
  isLoading: boolean;
  error: ReturnType<typeof useApiResource<SummaryResponse>>['error'];
  reload: () => void;
}

export function useCharts(): UseChartsResult {
  const [range, setRange] = useState<RangeOption>('30d');

  // `todayIso()` gọi lại mỗi render — rẻ (một `Intl.DateTimeFormat.format`)
  // và tránh phải nhớ làm mới "hôm nay" nếu trang mở qua nửa đêm; `useMemo`
  // chỉ tính lại `from`/`to` khi `range` đổi, không phải mỗi render.
  const { from, to } = useMemo(() => rangeToDates(range, todayIso()), [range]);

  const { data, isLoading, error, reload } = useApiResource(
    () => getSummary(from, to),
    [from, to],
  );

  return { range, setRange, from, to, data, isLoading, error, reload };
}
