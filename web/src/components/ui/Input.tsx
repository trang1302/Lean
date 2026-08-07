import { TextFieldBase, type TextFieldBaseProps } from './TextFieldBase';

export type InputProps = Omit<TextFieldBaseProps, 'type'>;

/**
 * Ô nhập văn bản dùng chung — <label htmlFor> gắn đúng `id`, hỗ trợ
 * `aria-invalid` + thông báo lỗi ngay dưới ô qua `error` (xem
 * `TextFieldBase`). Dùng cho ghi chú, tên món ăn… — bất cứ đâu cần chuỗi tự
 * do, không phải số (đó là việc của `NumberInput`).
 */
export function Input(props: InputProps) {
  return <TextFieldBase type="text" {...props} />;
}
