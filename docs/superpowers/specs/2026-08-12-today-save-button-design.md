# Đợt `today-save-button` — nút Lưu tường minh cho trang Hôm nay

> **Loại tài liệu:** spec thay đổi. Mô tả thứ **chưa tồn tại**.
> Khi code xong, `docs/features/web-today/SPEC.md` §4 và §5.1 phải được sửa cho khớp.

**Ngày chốt:** 2026-08-12
**Trạng thái:** đã duyệt thiết kế, chưa có kế hoạch, chưa có code.

---

## 1. Vì sao đổi

Trang Hôm nay hiện lưu **ngầm khi rời ô** (blur), không có nút Lưu. Trang Cài đặt thì
ngược lại, có nút "Lưu mục tiêu". Chủ dự án báo trang Hôm nay "thiếu chức năng lưu" —
đường lưu vẫn chạy (đã đo: bản ghi ngày 2026-08-12 lưu được qua giao diện), nhưng
**không tin được là đã lưu**. Hai kiểu khác nhau trên hai trang là nguồn của hiểu nhầm đó.

Quyết định (2026-08-12): **bỏ lưu-khi-blur, chỉ lưu bằng nút.**

### 1.1 Cái giá phải trả, và vì sao vẫn chấp nhận

Lưu-khi-blur có một tính chất mà nút Lưu không có: **không bao giờ mất thứ vừa gõ**.
Bỏ nó đi là tạo ra ba tình huống mất dữ liệu chưa từng tồn tại — gõ xong rồi đổi ngày,
rời trang, hoặc đóng tab. §3 tồn tại để bịt đúng ba chỗ đó. **Không làm §3 thì đợt này
làm cho app tệ đi, không phải tốt lên.**

---

## 2. `useBodyLogForm` — hình dạng mới

```ts
export interface UseBodyLogFormResult {
  values: Record<MeasureField, string>;
  onChange: (field: MeasureField, value: string) => void;
  save: () => Promise<void>;
  /** Có ô nào khác giá trị đã nạp. Điều khiển nút Lưu và cả ba lớp chặn ở §3. */
  isDirty: boolean;
  isSaving: boolean;
  /** Vừa lưu xong — hiện "Đã lưu ✓". Tắt khi gõ tiếp hoặc đổi ngày. */
  justSaved: boolean;
  attemptTick: number;
  fieldErrors: UseFieldErrorsResult;
}
```

`onBlur` biến mất.

### 2.1 `save()` gửi gì — quyết định quan trọng nhất của đợt

**Chỉ gửi những trường đã sửa.** Không gửi cả năm.

Bất biến của file này chuyển từ:

> ~~payload chứa **đúng một** khoá~~

sang:

> payload chứa **đúng những trường người dùng đã sửa, không hơn**

Bất biến mới là cái **căn bản hơn**. "Đúng một khoá" chỉ là hệ quả của việc lưu theo từng
lần blur; thứ luôn phải đúng là *đừng đụng vào thứ người ta không đụng*. Gửi cả năm sẽ ghi
đè trường người dùng không sửa và bump `updatedAt` vô cớ — và với upsert 3 trạng thái, một
ô rỗng gửi đi thành `null`, tức **xoá**.

### 2.2 Bốn luật gửi rút còn hai

Luật cũ 1 ("chưa động vào ô thì không gửi") **tự tan** vào luật 2: một ô chưa ai động tới
có `values[f] === loaded[f]`, nên đã bị luật 2 loại. Cờ `touched` vì thế **bị xoá khỏi hook**
— nó không còn phân biệt được ca nào nữa. (Xem `useBodyLogForm.test.ts` bản cũ: đây chính
là điều đã ghi nhận ở đó, rằng `touched` là phòng thủ lớp hai không kiểm được riêng.)

Hai luật còn lại, giữ nguyên từng chữ:

1. **Không đổi so với lúc nạp, so NUMERIC** (`"72.40"` = `"72.4"`) → không đưa vào payload.
2. **Xoá trắng một ô trước đó có giá trị** → đưa vào payload là `null` (xoá).

Cộng một luật cũ vẫn giữ: giá trị `NaN` → **bỏ qua ô đó**, không đưa vào payload.

### 2.3 Bấm Lưu hai lần liên tiếp

`save()` **thoát ngay** nếu `isSaving` đang `true`. Nút cũng bị `disabled` lúc đó, nhưng
chốt chặn phải nằm trong hook chứ không chỉ ở giao diện: hai request chồng nhau trên cùng
một `PUT` upsert có thể ghi đè lẫn nhau theo thứ tự phản hồi, không theo thứ tự gửi.

`save()` cũng thoát ngay nếu `isDirty === false` — không có gì để gửi thì không gửi.

### 2.4 `loaded` chuyển từ `useRef` sang `useState`

`isDirty` phải tính lại sau mỗi lần lưu thành công. Với `useRef`, gán `loaded.current` không
gây re-render nên nút Lưu sẽ vẫn sáng sau khi đã lưu xong. Chuyển sang state là cách đúng,
không phải cách tiện.

---

## 3. Bảo vệ dữ liệu chưa lưu — ba cơ chế, ba tình huống khác nhau

Cả ba đều chỉ kích hoạt khi `isDirty === true`.

| # | Tình huống | Cơ chế |
|---|---|---|
| 1 | Đổi ngày trên `DatePicker` | `BodyLogForm` đẩy `isDirty` lên `TodayPage` qua prop callback; `DatePicker.onChange` hỏi xác nhận trước khi gọi `setDate` |
| 2 | Bấm sang trang Biểu đồ / Cài đặt | `useBlocker` của react-router |
| 3 | Đóng tab, tải lại, đóng trình duyệt | `beforeunload` |

Ba cơ chế vì đây là **ba đường thoát khác nhau ở ba tầng khác nhau**, không cái nào bắt được
việc của cái kia: `useBlocker` không thấy việc đổi `date` (không có điều hướng nào xảy ra),
và `beforeunload` không chặn được điều hướng trong SPA.

### 3.1 Dùng `window.confirm`, không dựng modal riêng

Dự án chưa có component dialog nào. Dựng một cái chỉ để dùng ở đúng đây là abstraction cho
thứ dùng một lần — ngược Rule 2 của `CLAUDE.local.md`. App chạy localhost một người dùng.

### 3.2 Bấm Huỷ phải thật sự huỷ

Ca dễ sai nhất cả đợt: hỏi xác nhận, người dùng bấm Huỷ, **mà ngày vẫn đổi**. Lúc đó dữ
liệu mất đúng vào khoảnh khắc họ vừa nói là không muốn mất. Phải có test riêng cho ca này.

---

## 4. Lỗi khi lưu

`save()` là **một** request. Lỗi 400 làm hỏng cả request → **không trường nào lưu**. Sạch
hơn kiểu cũ, nơi ô này lưu được còn ô kia hỏng, để lại bản ghi nửa vời.

- `fieldErrors.setError(err)` gắn lỗi vào đúng ô như cũ; effect đưa focus ở `BodyLogForm`
  giữ nguyên không đổi.
- Lưu hỏng → `isDirty` **vẫn `true`**, nút vẫn sáng, cả ba lớp chặn ở §3 vẫn canh.
- `fieldErrors.reset()` gọi TRƯỚC khi gửi, giữ nguyên lý do cũ: lỗi tồn đọng của lần trước
  trên một ô đã sửa đúng không được hiển thị trong lúc chờ.

---

## 5. Test

Viết lại quanh bất biến mới. Những ca bắt buộc:

| Ca | Vì sao |
|---|---|
| Sửa 2/5 ô → payload có **đúng 2 khoá đó** | Bất biến §2.1. Đây là test đắt nhất của đợt. |
| Không sửa gì mà bấm Lưu → **không request nào** | Luật 1 |
| Xoá trắng ô đang có giá trị → `{ [field]: null }` | Luật 2 |
| Gõ `NaN` → ô đó không vào payload, các ô khác vẫn vào | Chặn NaN không được làm hỏng cả lần lưu |
| `isDirty` bật khi gõ, **tắt sau khi lưu xong** | §2.4 — sai chỗ này thì nút sáng mãi |
| Bấm Lưu hai lần liên tiếp → chỉ **một** request | §2.3 — hai request chồng nhau ghi đè theo thứ tự phản hồi |
| Lưu hỏng 400 → `isDirty` vẫn `true` | §4 |
| Đổi ngày khi bẩn → có hỏi; bấm **Huỷ** → ngày **không** đổi | §3.2 |
| Đổi ngày khi sạch → **không** hỏi | Hỏi thừa thì người dùng sẽ bấm bừa |

---

## 6. Quyết định vượt spec

### 6.1 Gửi trường đã sửa, không gửi cả năm
Xem §2.1. **Đã cân nhắc và bác:** gửi cả năm cho đơn giản — nó biến mọi lần lưu thành một
lần ghi đè toàn bộ và làm mất ý nghĩa của upsert 3 trạng thái.

### 6.2 Xoá cờ `touched`
Xem §2.2. Nó không còn phân biệt được ca nào. Giữ lại một cờ không phân biệt được gì là để
lại một thứ người sau tưởng là quan trọng.

### 6.3 `loaded` thành state, không phải ref
Xem §2.4. Đây là đổi vì **tính đúng đắn**, không phải vì tiện.

### 6.4 Ba cơ chế chặn, không phải một
Xem §3. Đã cân nhắc chỉ làm cơ chế 1 (đổi ngày) vì đó là ca hay gặp nhất — bác, vì hai ca
kia mất dữ liệu y hệt và mỗi cơ chế chỉ vài dòng.

### 6.5 `window.confirm`
Xem §3.1.

### 6.6 Nút Lưu đặt ở đâu
Cuối khối "Số đo", cùng chỗ dòng chữ gợi ý hiện tại. Không đặt cố định (sticky) ở đáy màn
hình: form chỉ có 5 ô, không cuộn.

---

## 7. Cố ý KHÔNG làm

- **Không đụng khối Bữa ăn.** `MealQuickAddForm` có nút riêng và lưu ngay; nó không có
  khái niệm "chưa lưu". Đợt này chỉ về khối Số đo.
- **Không đụng trang Cài đặt.** Nó đã có nút Lưu.
- **Không thêm nút "Huỷ thay đổi".** Chưa ai yêu cầu.
- **Không đụng `server/`.** Hợp đồng API không đổi.

---

## 8. Tài liệu phải cập nhật khi code xong

| File | Sửa gì |
|---|---|
| `docs/features/web-today/SPEC.md` §4 | Bỏ mô tả "lưu khi blur, không có nút Lưu" |
| `docs/features/web-today/SPEC.md` §5.1 | Bốn luật gửi → hai luật; bất biến mới; ba cơ chế chặn |

---

## 9. Rủi ro đã biết

**`useBodyLogForm` vẫn là nơi duy nhất có thể mất dữ liệu sức khoẻ.** Đợt này viết lại
đúng phần quyết định payload. Giảm rủi ro bằng cách viết test cho bất biến mới **trước**,
chạy đỏ, rồi mới sửa hook.

**Ca "bấm Huỷ mà ngày vẫn đổi"** (§3.2) là loại lỗi trông như đã xử lý xong nhưng thực ra
làm mọi thứ tệ hơn không có gì.
