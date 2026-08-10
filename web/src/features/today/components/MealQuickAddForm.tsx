import { useEffect, useRef, useState } from 'react';
import { Button, Input, NumberInput, Select } from '../../../components/ui';
import { useFieldErrors } from '../../../hooks/useFieldErrors';
import { MEAL_SLOTS, SLOT_LABEL } from '../../../constants/meals';
import { ApiError, type FieldError } from '../../../types/api';
import type { MealSlot } from '../../../types/api';
import { createMeal } from '../api/today.api';
import s from './MealQuickAddForm.module.css';

interface MealQuickAddFormProps {
  date: string;
  onCreated: () => void;
}

const NAME_INPUT_ID = 'meal-quick-add-name';
const KNOWN_FIELDS: readonly string[] = ['slot', 'name', 'calories', 'date'];

/**
 * `[buổi ▾][tên món][calo][+]` (SPEC §4). Sau `201`: xóa trắng tên + calo,
 * GIỮ NGUYÊN buổi (người dùng thường nhập liền hai món cùng buổi), focus
 * trả về ô tên món (PLAN §4 bước 6).
 */
export function MealQuickAddForm({ date, onCreated }: MealQuickAddFormProps) {
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attemptTick, setAttemptTick] = useState(0);
  const fieldErrors = useFieldErrors(KNOWN_FIELDS);
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (attemptTick === 0) return;
    if (fieldErrors.errorCount === 0) return;
    const path = fieldErrors.firstErrorPath;
    if (path && path in fieldErrors.fieldErrors) {
      document.getElementById(path === 'name' ? NAME_INPUT_ID : `meal-quick-add-${path}`)?.focus();
    } else {
      formErrorRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptTick]);

  async function handleAdd() {
    fieldErrors.reset();
    const trimmedName = name.trim();
    const caloriesNum = Number(calories);
    const localErrors: FieldError[] = [];
    if (trimmedName === '') localErrors.push({ path: 'name', message: 'Nhập tên món' });
    if (calories.trim() === '' || Number.isNaN(caloriesNum)) {
      localErrors.push({ path: 'calories', message: 'Nhập số calo hợp lệ' });
    }
    if (localErrors.length > 0) {
      // Chặn ở client — KHÔNG gọi API (PLAN §4 bước 6 deliverable).
      fieldErrors.setError(new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', localErrors));
      setAttemptTick((t) => t + 1);
      return;
    }

    setSubmitting(true);
    try {
      await createMeal({ date, slot, name: trimmedName, calories: caloriesNum });
      setName('');
      setCalories('');
      onCreated();
      document.getElementById(NAME_INPUT_ID)?.focus();
    } catch (err) {
      if (err instanceof ApiError) fieldErrors.setError(err);
      else throw err;
    } finally {
      setSubmitting(false);
      setAttemptTick((t) => t + 1);
    }
  }

  return (
    <div className={s.form}>
      {fieldErrors.formErrors.length > 0 ? (
        <div ref={formErrorRef} tabIndex={-1} role="alert" className={s.formError}>
          {fieldErrors.summary}
        </div>
      ) : null}
      <Select
        id="meal-quick-add-slot"
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
        id={NAME_INPUT_ID}
        label="Tên món"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.fieldErrors['name']}
      />
      <NumberInput
        id="meal-quick-add-calories"
        label="Calo"
        value={calories}
        onChange={(event) => setCalories(event.target.value)}
        error={fieldErrors.fieldErrors['calories']}
      />
      <Button className={s.addButton} onClick={handleAdd} disabled={submitting}>
        +
      </Button>
    </div>
  );
}
