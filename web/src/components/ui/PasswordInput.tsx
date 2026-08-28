import { TextFieldBase, type TextFieldBaseProps } from './TextFieldBase';

export type PasswordInputProps = Omit<TextFieldBaseProps, 'type'>;

/**
 * Ô nhập mật khẩu — CHỈ khác `Input` ở `type="password"`, đúng cùng khuôn với
 * `NumberInput`.
 *
 * Lý do phải là một component riêng chứ không phải `Input` nhận thêm prop
 * `type`: `Input` cố ý `Omit<…, 'type'>` để không ai truyền vào một `type` sai
 * (`type="number"` trên `Input` sẽ lặng lẽ cho ra một ô số không có logic số).
 * Giữ ranh giới đó và thêm một control mới là cách bám quán lệ sẵn có.
 *
 * KHÔNG thêm nút "hiện mật khẩu" ở đây — nó cần state riêng, và một control
 * dùng chung không nên tự quyết chuyện đó cho mọi trang gọi nó.
 */
export function PasswordInput(props: PasswordInputProps) {
  return <TextFieldBase type="password" {...props} />;
}
