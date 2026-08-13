import { useEffect, useRef } from 'react';
import { Button, Card, NumberInput } from '../../../components/ui';
import type { BodyLog } from '../../../types/api';
import { MEASURES, measureLabel } from '../../../constants/measures';
import { useBodyLogForm } from '../hooks/useBodyLogForm';
import s from './BodyLogForm.module.css';

interface BodyLogFormProps {
  date: string;
  bodyLog: BodyLog | null;
  /** Trong lúc tải, `useApiResource` còn giữ dữ liệu ngày CŨ để tránh nhấp nháy —
   * disable cả năm ô để không ai gõ vào giá trị của ngày cũ rồi bấm Lưu cho ngày mới. */
  isLoading: boolean;
  /** Báo lên trang gọi khi có/hết thay đổi chưa lưu. `TodayPage` dùng để chặn
   * đổi ngày, chặn điều hướng, và cảnh báo khi đóng tab (spec §3). */
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Năm ô số, lưu bằng nút Lưu — hook `useBodyLogForm` quyết định trường nào
 * (đã sửa so với lúc nạp) vào payload khi `save()` được gọi. Component này
 * chỉ lắp UI.
 *
 * A11y (điều phối viên B3): `FieldError` cố ý không có `role="alert"`, và
 * `useFieldErrors` cố ý không tự focus — trang gọi (ở đây) phải tự đưa
 * focus về ô lỗi đầu tiên sau mỗi lần lưu hỏng (`attemptTick` đổi), có
 * phương án dự phòng khi `firstErrorPath` không map được vào ô DOM nào
 * (rơi về vùng tổng hợp lỗi cấp form, focus được nhờ `tabIndex={-1}`).
 */
export function BodyLogForm({ date, bodyLog, isLoading, onDirtyChange }: BodyLogFormProps) {
  const form = useBodyLogForm(date, bodyLog);
  const { fieldErrors } = form;
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (form.attemptTick === 0) return; // chưa có lần lưu nào hoàn tất
    if (fieldErrors.errorCount === 0) return; // lần gần nhất thành công
    const path = fieldErrors.firstErrorPath;
    if (path && path in fieldErrors.fieldErrors) {
      document.getElementById(path)?.focus();
    } else {
      // `firstErrorPath` không map được vào ô nào của form này (vd. lỗi
      // `date` từ :date param) — KHÔNG im lặng, focus vào vùng tổng hợp.
      formErrorRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.attemptTick]);

  // Đẩy cờ lên trang gọi. Hook không tự làm được: nó không biết ai đang dùng nó.
  useEffect(() => {
    onDirtyChange?.(form.isDirty);
  }, [form.isDirty, onDirtyChange]);

  // M3 (báo cáo review): unmount khi đang bẩn (vd. `GET` lỗi giữa lúc gõ, `TodayPage`
  // thay form bằng `ErrorState`) làm dữ liệu gõ biến mất theo, nhưng không effect nào
  // ở trên báo lại — `TodayPage.isDirty` kẹt ở `true` với KHÔNG CÒN form nào để lưu,
  // khiến ba lớp chặn hỏi thừa về thay đổi không còn tồn tại. Effect mount-only này
  // chỉ chạy lúc unmount, luôn báo `false` bất kể `form.isDirty` lúc đó là gì.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange?.(false), []);

  return (
    <Card heading="Số đo">
      {fieldErrors.formErrors.length > 0 ? (
        <div ref={formErrorRef} tabIndex={-1} role="alert" className={s.formError}>
          {fieldErrors.summary}
        </div>
      ) : null}

      {/* Cân nặng đứng riêng một hàng: đơn vị khác bốn ô còn lại, và là số
          người dùng nhìn nhiều nhất. Bốn vòng xếp lưới bên dưới. */}
      <div className={s.row}>
        <NumberInput
          id={MEASURES[0].field}
          label={measureLabel(MEASURES[0])}
          step={MEASURES[0].step}
          value={form.values[MEASURES[0].field]}
          onChange={(event) => form.onChange(MEASURES[0].field, event.target.value)}
          error={fieldErrors.fieldErrors[MEASURES[0].field]}
          disabled={isLoading}
        />
      </div>

      <div className={s.grid}>
        {MEASURES.slice(1).map((measure) => (
          <NumberInput
            key={measure.field}
            id={measure.field}
            label={measureLabel(measure)}
            step={measure.step}
            value={form.values[measure.field]}
            onChange={(event) => form.onChange(measure.field, event.target.value)}
            error={fieldErrors.fieldErrors[measure.field]}
            disabled={isLoading}
          />
        ))}
      </div>

      <div className={s.actions}>
        <Button
          onClick={() => void form.save()}
          disabled={!form.isDirty || form.isSaving || isLoading}
        >
          {form.isSaving ? 'Đang lưu…' : 'Lưu số đo'}
        </Button>
        <span className={s.hint} aria-live="polite">
          {form.justSaved && !form.isDirty
            ? 'Đã lưu ✓'
            : form.isDirty
              ? 'Có thay đổi chưa lưu.'
              : 'Để trống một ô rồi bấm Lưu để xóa giá trị.'}
        </span>
      </div>
    </Card>
  );
}
