import { EmptyState } from '../../../components/shared';
import { MEAL_SLOTS, SLOT_LABEL } from '../../../constants/meals';
import type { Meal, MealSlot } from '../../../types/api';
import { MealRow } from './MealRow';
import s from './MealList.module.css';

interface MealListProps {
  meals: Meal[];
  onChanged: () => void;
}

/**
 * Nhóm mảng `meals` (server trả theo `createdAt` tăng dần — SPEC §5.3)
 * bằng `MEAL_SLOTS`, KHÔNG bằng `.sort()`/`orderBy` nào khác — đây là
 * quyết định đã chốt ở SPEC §5.3 phương án (A): sắp ở client, giữ nguyên
 * thứ tự `createdAt` bên trong mỗi nhóm.
 */
function groupBySlot(meals: Meal[]): Record<MealSlot, Meal[]> {
  const grouped: Record<MealSlot, Meal[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const meal of meals) {
    grouped[meal.slot].push(meal);
  }
  return grouped;
}

/**
 * Danh sách bữa ăn nhóm theo buổi. Buổi rỗng vẫn hiện tiêu đề (SPEC §7
 * câu hỏi 5, đề nghị đã chốt: "hiện đủ 4, buổi rỗng để một dòng mờ") —
 * giữ bố cục ổn định và nhắc người dùng còn thiếu buổi nào.
 *
 * Mảng rỗng hoàn toàn → `EmptyState`, KHÔNG render khung 4 nhóm trống
 * (SPEC §6: "Chưa ghi bữa nào cho ngày này." là trạng thái bình thường).
 */
export function MealList({ meals, onChanged }: MealListProps) {
  if (meals.length === 0) {
    return <EmptyState message="Chưa ghi bữa nào cho ngày này." />;
  }

  const grouped = groupBySlot(meals);

  return (
    <div className={s.list}>
      {MEAL_SLOTS.map((slot) => (
        <div key={slot} className={s.group}>
          <h3 className={s.slotLabel}>{SLOT_LABEL[slot]}</h3>
          {grouped[slot].length === 0 ? (
            <p className={s.emptySlot}>—</p>
          ) : (
            grouped[slot].map((meal) => <MealRow key={meal.id} meal={meal} onChanged={onChanged} />)
          )}
        </div>
      ))}
    </div>
  );
}
