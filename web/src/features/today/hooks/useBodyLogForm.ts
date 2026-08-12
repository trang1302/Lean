import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../types/api';
import { useFieldErrors, type UseFieldErrorsResult } from '../../../hooks/useFieldErrors';
import type { BodyLog } from '../../../types/api';
import { MEASURE_FIELDS, type MeasureField } from '../../../constants/measures';
import { putBodyLog as defaultPutBodyLog, type BodyLogPatch } from '../api/today.api';

const KNOWN_FIELDS: readonly string[] = MEASURE_FIELDS;

type MeasureRecord<T> = Record<MeasureField, T>;

function fillRecord<T>(value: T): MeasureRecord<T> {
  return Object.fromEntries(MEASURE_FIELDS.map((field) => [field, value])) as MeasureRecord<T>;
}

/** Chuỗi hiển thị cho mỗi ô, lấy từ bản ghi server. `null` → ô rỗng. */
function valuesFromLog(bodyLog: BodyLog | null): MeasureRecord<string> {
  return Object.fromEntries(
    MEASURE_FIELDS.map((field) => {
      const value = bodyLog?.[field];
      return [field, value == null ? '' : String(value)];
    }),
  ) as MeasureRecord<string>;
}

export interface UseBodyLogFormResult {
  /** Giá trị đang gõ của cả năm ô, khóa theo tên trường. */
  values: MeasureRecord<string>;
  onChange: (field: MeasureField, value: string) => void;
  onBlur: (field: MeasureField) => void;
  /** Trường vừa lưu thành công, `null` sau đó (đổi ngày, hoặc ô khác vừa lưu).
   * Chỉ để hiển thị "Đã lưu ✓" — KHÔNG phải cờ đang lưu. */
  savedField: MeasureField | null;
  /** Tăng dần mỗi lần một lần lưu (thành công hoặc lỗi) hoàn tất — trang gọi
   * dùng để biết "vừa có một lần submit mới" và tự đưa focus về ô lỗi đầu tiên. */
  attemptTick: number;
  fieldErrors: UseFieldErrorsResult;
}

/**
 * State + hành vi của `BodyLogForm` — hiện thực SPEC §5.1 (upsert 3 trạng thái)
 * và §5.2 (lỗi 400 gắn vào đúng ô). Đây là chỗ rủi ro nhất của feature: gửi sai
 * một khóa là XÓA MẤT dữ liệu người dùng không đụng tới.
 *
 * Ba mảnh state giữ cho MỖI ô, tất cả khóa theo tên trường (trước đây viết tay
 * từng biến; với 5 số đo thì đó là 25 khai báo song song và 25 cơ hội gõ nhầm):
 * 1. giá trị đang gõ trên input (chuỗi thô, hiển thị trực tiếp);
 * 2. giá trị ĐÃ NẠP từ server lúc đồng bộ gần nhất (so sánh trước khi gửi);
 * 3. cờ "người dùng đã động vào ô này chưa" (ref, không phải state — chỉ cần
 *    đọc lúc blur, không cần re-render khi đổi).
 *
 * Bốn luật gửi khi blur (SPEC §5.1) — KHÔNG đổi so với bản 2 ô:
 * - chưa từng động vào ô → KHÔNG gửi, bất kể giá trị;
 * - giá trị hiện tại không đổi so với lúc nạp, so NUMERIC ("72.40" và "72.4" là
 *   cùng một giá trị) → KHÔNG gửi. Không phải vì hiệu năng: `PUT` với patch
 *   không đổi vẫn bump `updatedAt` và có thể tạo bản ghi rỗng cho ngày chưa có gì;
 * - ô vừa bị xóa trắng (trước đó có giá trị) → gửi `{ [field]: null }`;
 * - ô có giá trị mới, hợp lệ (không `NaN`) → gửi `{ [field]: Number(raw) }`.
 *
 * Đồng bộ lại CẢ BA mảnh mỗi khi `date` đổi HOẶC `bodyLog` đổi — bao gồm cả lúc
 * `bodyLog` tạm thời còn là dữ liệu của ngày CŨ trong khi request của ngày MỚI
 * đang chạy (`useApiResource` cố ý giữ `data` cũ để tránh nhấp nháy). Trang gọi
 * (`BodyLogForm`) PHẢI disable các ô trong lúc `isLoading`, để không ai gõ/blur
 * vào giá trị của ngày cũ rồi gán nhầm cho ngày mới — hook này không tự chặn
 * được vì nó không biết `isLoading`.
 */
export function useBodyLogForm(
  date: string,
  bodyLog: BodyLog | null,
  putBodyLog: (date: string, patch: BodyLogPatch) => Promise<BodyLog> = defaultPutBodyLog,
): UseBodyLogFormResult {
  const [values, setValues] = useState<MeasureRecord<string>>(() => fillRecord(''));
  const [savedField, setSavedField] = useState<MeasureField | null>(null);
  const [attemptTick, setAttemptTick] = useState(0);

  const loaded = useRef<MeasureRecord<string>>(fillRecord(''));
  const touched = useRef<MeasureRecord<boolean>>(fillRecord(false));

  const fieldErrors = useFieldErrors(KNOWN_FIELDS);

  useEffect(() => {
    const next = valuesFromLog(bodyLog);
    setValues(next);
    loaded.current = next;
    touched.current = fillRecord(false);
    setSavedField(null);
    fieldErrors.reset();
    // `fieldErrors.reset` là hàm ổn định (useCallback rỗng deps) — không cần
    // đưa vào deps, đưa vào không sai nhưng thừa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, bodyLog]);

  function isUnchanged(raw: string, loadedValue: string): boolean {
    const rawEmpty = raw.trim() === '';
    const loadedEmpty = loadedValue.trim() === '';
    if (rawEmpty && loadedEmpty) return true;
    if (rawEmpty !== loadedEmpty) return false;
    return Number(raw) === Number(loadedValue);
  }

  async function commit(field: MeasureField, raw: string) {
    if (!touched.current[field]) return; // luật 1
    if (isUnchanged(raw, loaded.current[field])) return; // luật 2

    let value: number | null;
    if (raw.trim() === '') {
      value = null; // luật 3
    } else {
      const num = Number(raw);
      if (Number.isNaN(num)) return; // chặn NaN ở client (SPEC §5.4)
      value = num; // luật 4
    }

    // Xóa lỗi cũ TRƯỚC khi gửi (SPEC §5.2) — lỗi tồn đọng của lần trước trên
    // một ô đã sửa đúng không được hiển thị trong lúc chờ.
    fieldErrors.reset();

    try {
      // Object literal ĐÚNG MỘT KHÓA. Đây là dòng quyết định của cả file:
      // thêm bất cứ khóa nào khác vào đây là xóa dữ liệu của ô đó.
      await putBodyLog(date, { [field]: value } as BodyLogPatch);
      loaded.current = { ...loaded.current, [field]: raw };
      setSavedField(field);
    } catch (err) {
      if (err instanceof ApiError) {
        fieldErrors.setError(err);
      } else {
        throw err;
      }
    } finally {
      setAttemptTick((t) => t + 1);
    }
  }

  return {
    values,
    savedField,
    attemptTick,
    fieldErrors,
    onChange: (field: MeasureField, value: string) => {
      touched.current[field] = true;
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    onBlur: (field: MeasureField) => {
      void commit(field, values[field]);
    },
  };
}
