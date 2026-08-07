/// <reference types="vite/client" />
// Tên file theo đúng quy ước mặc định của scaffold Vite. Chỉ MỘT dòng
// reference — không thêm gì khác vào đây.
//
// Vì sao cần file này dù tsconfig.json đặt "types": [] có chủ đích (Bước 3):
// "types": [] chỉ chặn TypeScript TỰ ĐỘNG nạp MỌI gói @types/* làm global
// ambient (chặn @types/node rò process/Buffer vào code trình duyệt — xem
// comment trong tsconfig.json). Nó KHÔNG chặn một reference TƯỜNG MINH như
// dòng trên. `vite/client` chỉ khai hai thứ, cả hai đều an toàn cho trình
// duyệt: kiểu cho `import.meta.env` và — thứ Bước 5 cần — khai module cho
// `*.module.css` (`import s from './X.module.css'` trả về
// `{ readonly [key: string]: string }`). Không có dòng này, `tsc` báo lỗi
// "Cannot find module './X.module.css'" ngay từ file CSS Module đầu tiên.
