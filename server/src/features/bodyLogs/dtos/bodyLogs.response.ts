/**
 * Hình dạng trả về của mọi endpoint body-logs.
 *
 * `userId` cố ý KHÔNG có mặt: nó là chi tiết lưu trữ (xem shared/constants.ts),
 * không phải thứ client cần biết. `date` là chuỗi "YYYY-MM-DD", không phải Date.
 */
export interface BodyLogResponse {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  note: string | null;
  /** ISO 8601 — đây là dấu thời gian thật, khác hẳn `date`. */
  createdAt: string;
  updatedAt: string;
}
