/**
 * Bản này chưa có đăng nhập, nhưng mọi bảng đã mang cột `userId` từ đầu.
 * Mọi bản ghi thuộc về người dùng cục bộ duy nhất này.
 *
 * Khi thêm auth: thay mọi chỗ dùng hằng này bằng user lấy từ session.
 * Grep `LOCAL_USER_ID` sẽ ra đúng danh sách chỗ cần sửa — đó là lý do
 * nó là một hằng có tên chứ không phải chuỗi 'local' rải khắp nơi.
 *
 * Nhưng grep ra danh sách KHÔNG có nghĩa là mỗi chỗ chỉ sửa một dòng:
 *   - `goal`, `meals`      — hằng ở service, repository đã nhận userId làm
 *                            tham số. Thay đúng một chỗ.
 *   - `bodyLogs`, `summary`,
 *     `reminders`          — hằng import thẳng vào repository. Phải đổi chữ ký
 *                            hàm rồi sửa mọi lời gọi.
 *   - scheduler nhắc nhở   — chạy theo cron, KHÔNG có request nên không có
 *                            phiên. `ReminderRunnerDeps` không có userId ở hàm
 *                            nào; phải viết lại vòng quét theo từng user.
 *                            Làm ẩu là gửi nhắc của người này sang topic ntfy
 *                            của người khác.
 *
 * Xem `docs/features/auth/PLAN.md` để biết thứ tự làm.
 */
export const LOCAL_USER_ID = 'local';
