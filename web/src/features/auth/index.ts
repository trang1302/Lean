// Điểm vào DUY NHẤT của feature `auth` phía web — `routes.tsx`, `App.tsx` và
// `AppLayout.tsx` chỉ import từ đây, không chọc vào đường dẫn bên trong.
export { LoginPage } from './components/LoginPage';
export { RegisterPage } from './components/RegisterPage';
export { RequireSession } from './components/RequireSession';
export { SessionProvider, useSession } from './hooks/useSession';
