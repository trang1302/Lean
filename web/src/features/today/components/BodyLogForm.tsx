import { useEffect, useRef } from 'react';
import { Card, NumberInput } from '../../../components/ui';
import type { BodyLog } from '../../../types/api';
import { MEASURES, measureLabel } from '../../../constants/measures';
import { useBodyLogForm } from '../hooks/useBodyLogForm';
import s from './BodyLogForm.module.css';

interface BodyLogFormProps {
  date: string;
  bodyLog: BodyLog | null;
  /** SPEC §7 câu hỏi 8: khi ngày đổi, request cũ có thể còn giữ dữ liệu
   * ngày trước trong lúc chờ (`useApiResource` không xóa `data` cũ để
   * tránh nhấp nháy) — disable hai ô trong lúc tải để không ai blur vào
   * giá trị của ngày CŨ rồi bị gán nhầm cho ngày MỚI. */
  isLoading: boolean;
}

/**
 * Năm ô số, lưu khi blur — không có nút Lưu (SPEC §4). Toàn bộ ngữ nghĩa
 * upsert 3 trạng thái + so sánh trước khi gửi nằm trong `useBodyLogForm`;
 * component này chỉ lắp UI.
 *
 * A11y (điều phối viên B3): `FieldError` cố ý không có `role="alert"`, và
 * `useFieldErrors` cố ý không tự focus — trang gọi (ở đây) phải tự đưa
 * focus về ô lỗi đầu tiên sau mỗi lần blur hỏng (`attemptTick` đổi), có
 * phương án dự phòng khi `firstErrorPath` không map được vào ô DOM nào
 * (rơi về vùng tổng hợp lỗi cấp form, focus được nhờ `tabIndex={-1}`).
 */
export function BodyLogForm({ date, bodyLog, isLoading }: BodyLogFormProps) {
  const form = useBodyLogForm(date, bodyLog);
  const { fieldErrors } = form;
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (form.attemptTick === 0) return; // chưa có lần blur nào hoàn tất
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
          onBlur={() => form.onBlur(MEASURES[0].field)}
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
            onBlur={() => form.onBlur(measure.field)}
            error={fieldErrors.fieldErrors[measure.field]}
            disabled={isLoading}
          />
        ))}
      </div>

      <p className={s.hint} aria-live="polite">
        Để trống rồi rời ô để xóa giá trị.{form.savedField ? ' Đã lưu ✓' : ''}
      </p>
    </Card>
  );
}
