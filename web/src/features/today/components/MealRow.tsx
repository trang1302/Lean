import { useRef, useState } from 'react';
import { Button, Input, NumberInput, Select } from '../../../components/ui';
import { useFieldErrors } from '../../../hooks/useFieldErrors';
import { MEAL_SLOTS, SLOT_LABEL } from '../../../constants/meals';
import { ApiError } from '../../../types/api';
import type { Meal, MealSlot } from '../../../types/api';
import { deleteMeal, updateMeal, type MealPatch } from '../api/today.api';
import s from './MealRow.module.css';

interface MealRowProps {
  meal: Meal;
  /** Gọi lại sau khi sửa/xóa thành công (hoặc xóa "thành công" vì đã bị
   * xóa từ trước, SPEC §5.4) — trang cha nạp lại danh sách bữa ăn. */
  onChanged: () => void;
}

const KNOWN_FIELDS: readonly string[] = ['slot', 'name', 'calories'];

/**
 * Một dòng bữa ăn + chế độ sửa inline (điều phối viên: SPEC §7 câu hỏi 2
 * đã chốt "inline, chỉ sửa slot/name/calories, không cho đổi date").
 *
 * Xóa (SPEC §5.4): vô hiệu hóa nút NGAY khi bấm — dùng `useRef` (không chỉ
 * `useState`) để chặn được cả hai lần bấm xảy ra trong cùng một tick trước
 * khi React kịp render `disabled` lên DOM. Nhận `404` (đã bị xóa từ tab
 * khác/lần bấm trước) thì coi như xóa xong, gọi `onChanged()`, KHÔNG báo
 * lỗi đỏ.
 */
export function MealRow({ meal, onChanged }: MealRowProps) {
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState<MealSlot>(meal.slot);
  const [name, setName] = useState(meal.name);
  const [calories, setCalories] = useState(String(meal.calories));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const deletingRef = useRef(false);
  const fieldErrors = useFieldErrors(KNOWN_FIELDS);

  function startEdit() {
    setSlot(meal.slot);
    setName(meal.name);
    setCalories(String(meal.calories));
    fieldErrors.reset();
    setEditing(true);
  }

  function cancelEdit() {
    fieldErrors.reset();
    setEditing(false);
  }

  async function saveEdit() {
    fieldErrors.reset();
    const trimmedName = name.trim();
    const caloriesNum = Number(calories);
    const localErrors = [];
    if (trimmedName === '') localErrors.push({ path: 'name', message: 'Nhập tên món' });
    if (calories.trim() === '' || Number.isNaN(caloriesNum)) {
      localErrors.push({ path: 'calories', message: 'Nhập số calo hợp lệ' });
    }
    if (localErrors.length > 0) {
      fieldErrors.setError(new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', localErrors));
      return;
    }

    const patch: MealPatch = {};
    if (slot !== meal.slot) patch.slot = slot;
    if (trimmedName !== meal.name) patch.name = trimmedName;
    if (caloriesNum !== meal.calories) patch.calories = caloriesNum;

    // Không đổi gì → không gọi PATCH (bẫy SPEC §5.4: `{}` vẫn bump
    // `updatedAt`, gửi khi không cần thiết là vô nghĩa).
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateMeal(meal.id, patch);
      setEditing(false);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) fieldErrors.setError(err);
      else throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    // Guard bằng REF, không chỉ state — hai lần bấm xảy ra trong cùng một
    // tick (trước khi React kịp render `disabled` lên DOM) vẫn phải chỉ
    // lọt qua đúng một lần (SPEC §5.4 deliverable bước 5 #3).
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteMeal(meal.id);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Đã bị xóa từ trước (không idempotent, SPEC §5.4) — coi như xong.
        onChanged();
      } else {
        deletingRef.current = false;
        setDeleting(false);
        setDeleteFailed(true);
      }
    }
  }

  if (editing) {
    return (
      <div className={s.editRow}>
        {fieldErrors.formErrors.length > 0 ? (
          <div role="alert" className={s.formError}>
            {fieldErrors.summary}
          </div>
        ) : null}
        <Select
          id={`meal-${meal.id}-slot`}
          label="Buổi"
          value={slot}
          onChange={(event) => setSlot(event.target.value as MealSlot)}
          error={fieldErrors.fieldErrors['slot']}
        >
          {MEAL_SLOTS.map((option) => (
            <option key={option} value={option}>
              {SLOT_LABEL[option]}
            </option>
          ))}
        </Select>
        <Input
          id={`meal-${meal.id}-name`}
          label="Tên món"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.fieldErrors['name']}
        />
        <NumberInput
          id={`meal-${meal.id}-calories`}
          label="Calo"
          value={calories}
          onChange={(event) => setCalories(event.target.value)}
          error={fieldErrors.fieldErrors['calories']}
        />
        <Button variant="primary" onClick={saveEdit} disabled={saving}>
          Lưu
        </Button>
        <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
          Hủy
        </Button>
      </div>
    );
  }

  return (
    <div className={s.row}>
      <span className={s.name}>{meal.name}</span>
      <span className={s.calories}>{meal.calories}</span>
      <div className={s.actions}>
        <Button variant="secondary" onClick={startEdit}>
          Sửa
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={deleting}>
          Xóa
        </Button>
      </div>
      {deleteFailed ? <span role="alert">Không xóa được, thử lại.</span> : null}
    </div>
  );
}
