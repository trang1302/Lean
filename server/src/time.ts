export const TZ = 'Asia/Ho_Chi_Minh';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Ngày hôm nay theo TZ, dạng "YYYY-MM-DD". */
export function todayIso(): string {
  // 'en-CA' cho ra đúng định dạng YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Chuỗi có đúng định dạng và là ngày thật (bắt 2026-02-30, 2026-13-01). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  // Date.parse chấp nhận vài chuỗi bị "cuộn" — so lại để loại
  return new Date(ms).toISOString().slice(0, 10) === value;
}

function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * MS_PER_DAY);
}

/** Số ngày từ fromIso đến toIso. Âm nếu toIso sớm hơn. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / MS_PER_DAY);
}

/** Mọi ngày lịch trong [fromIso, toIso]. Rỗng nếu fromIso > toIso. */
export function enumerateDates(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const total = daysBetween(fromIso, toIso);
  for (let i = 0; i <= total; i++) out.push(addDays(fromIso, i));
  return out;
}

/** Thứ Hai của tuần chứa iso. */
export function startOfWeekMonday(iso: string): string {
  const dow = new Date(toUtcMs(iso)).getUTCDay(); // 0 = CN, 1 = T2
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(iso, -back);
}
