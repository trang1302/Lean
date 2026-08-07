import { TextFieldBase, type TextFieldBaseProps } from './TextFieldBase';

export type NumberInputProps = Omit<TextFieldBaseProps, 'type'>;

/**
 * Ô nhập số — CHỈ khác `Input` ở `type="number"`. `value`/`onChange` vẫn là
 * chuỗi thô của `<input>` gốc, y hệt `Input` — component này KHÔNG tự
 * parse/format giá trị, việc đó thuộc về trang gọi nó (số lần dùng khác
 * nhau: cân nặng cho phép thập phân, calo thì không, v.v. — logic đó là
 * riêng của từng trang, không thuộc component chung).
 *
 * CẢNH BÁO (CLAUDE.md, lib/format.ts): TUYỆT ĐỐI không dùng
 * `formatNumber`/`formatNullable` làm `value` truyền vào đây. Hai hàm đó
 * cho ra chuỗi kiểu `vi-VN` (`"72,4"`, `"1.234"`) — `<input type="number">`
 * coi dấu phẩy/dấu chấm phân cách nghìn là không hợp lệ và tự hiển thị Ô
 * RỖNG, không báo lỗi gì. Muốn hiện giá trị hiện có thì dùng thẳng
 * `String(value)` (giá trị số gốc), không đi qua hai hàm format kia.
 */
export function NumberInput(props: NumberInputProps) {
  return <TextFieldBase type="number" {...props} />;
}
