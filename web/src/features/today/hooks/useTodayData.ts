import { useApiResource } from '../../../hooks/useApiResource';
import type { BodyLog, Goal, Meal } from '../../../types/api';
import { ApiError } from '../../../types/api';
import { getBodyLog, getGoal, getMeals } from '../api/today.api';

export interface UseTodayDataResult {
  bodyLog: BodyLog | null;
  bodyLogLoading: boolean;
  bodyLogError: ApiError | null;
  reloadBodyLog: () => void;

  meals: Meal[];
  mealsLoading: boolean;
  mealsError: ApiError | null;
  reloadMeals: () => void;

  goal: Goal | null;
  goalLoading: boolean;
  goalError: ApiError | null;
}

/**
 * Nạp ba tài nguyên của trang Hôm nay (SPEC §2): `GET /body-logs/:date`,
 * `GET /meals?date=`, `GET /goal`. Ba lời gọi độc lập → chạy song song,
 * không xếp hàng (mỗi cái là một `useApiResource` riêng, PLAN §4 bước 4).
 *
 * `goal` KHÔNG phụ thuộc `date` (deps `[]`) — SPEC §2 dòng bảng #7: "mục
 * tiêu không phụ thuộc ngày". Đổi `date` phải nạp lại (1) và (3), KHÔNG
 * nạp lại (7) — `useApiResource(getGoal, [])` chỉ chạy đúng một lần lúc
 * mount, đổi `date` không đưa `date` vào deps của nó nên không kích hoạt
 * lại (test khóa hành vi này ở `useTodayData.test.ts`).
 *
 * Chống race khi đổi `date` liên tục đã có sẵn trong `useApiResource`
 * (cờ `cancelled`, SPEC §7 câu hỏi 8) — hook này không cần tự làm lại.
 */
export function useTodayData(date: string): UseTodayDataResult {
  const bodyLogRes = useApiResource(() => getBodyLog(date), [date]);
  const mealsRes = useApiResource(() => getMeals(date), [date]);
  const goalRes = useApiResource(() => getGoal(), []);

  return {
    bodyLog: bodyLogRes.data,
    bodyLogLoading: bodyLogRes.isLoading,
    bodyLogError: bodyLogRes.error,
    reloadBodyLog: bodyLogRes.reload,

    meals: mealsRes.data ?? [],
    mealsLoading: mealsRes.isLoading,
    mealsError: mealsRes.error,
    reloadMeals: mealsRes.reload,

    goal: goalRes.data,
    goalLoading: goalRes.isLoading,
    goalError: goalRes.error,
  };
}
