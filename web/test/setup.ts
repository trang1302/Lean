import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom không tự dọn cây DOM giữa các test — nếu thiếu dòng này, phần tử
// `render()` của test trước còn sống sang test sau, khiến `screen.getByText`
// khớp nhầm hoặc báo lỗi "multiple elements found".
afterEach(() => {
  cleanup();
});
