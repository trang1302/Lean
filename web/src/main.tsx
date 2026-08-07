import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Biến CSS dùng chung (màu, khoảng cách) — nạp đúng một lần ở điểm vào.
// Xem src/styles/tokens.css để biết vì sao đây không phải "CSS chung" bị
// cấm ở docs/features/web-shell/SPEC.md §10 câu 7 (chỉ custom property,
// không có class).
import './styles/tokens.css';

// `!` an toàn ở đây: index.html luôn có #root, không phải dữ liệu ngoài tầm kiểm soát.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
