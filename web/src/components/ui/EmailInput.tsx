import { TextFieldBase, type TextFieldBaseProps } from './TextFieldBase';

export type EmailInputProps = Omit<TextFieldBaseProps, 'type'>;

/**
 * Ô nhập email — CHỈ khác `Input` ở `type="email"`, cùng khuôn `NumberInput`.
 *
 * `type="email"` đổi lấy phần kiểm định dạng miễn phí của trình duyệt (bong
 * bóng "Please enter an email address" khi submit) — nghĩa là sai chính tả bắt
 * được ngay, không mất một vòng lên server.
 *
 * Nhưng đó CHỈ là tiện nghi: kiểm định dạng thật nằm ở Zod phía server
 * (`emailSchema` = trim → lowercase → `z.email()`). Người dùng tắt validate của
 * trình duyệt được, server thì không — và chuẩn hóa hoa/thường bắt buộc phải
 * làm ở server vì `@unique` của SQLite phân biệt hoa thường.
 */
export function EmailInput(props: EmailInputProps) {
  return <TextFieldBase type="email" {...props} />;
}
