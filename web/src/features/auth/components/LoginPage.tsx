import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, EmailInput, PasswordInput } from '../../../components/ui';
import { useFieldErrors } from '../../../hooks';
import { ApiError } from '../../../types/api';
import { useSession } from '../hooks/useSession';
import s from './AuthPage.module.css';

const KNOWN_FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fieldErrors = useFieldErrors(KNOWN_FIELDS);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // `?next=` do `RequireSession` gắn khi đá người dùng về đây. Chỉ nhận đường
  // dẫn nội bộ bắt đầu bằng một dấu `/` — `//evil.com` hay `https://evil.com`
  // là URL tuyệt đối, nhận vào là mở lỗ chuyển hướng mở (open redirect).
  const nextRaw = searchParams.get('next');
  const next = nextRaw?.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Dọn lỗi cũ TRƯỚC khi gửi, không đợi response — lỗi của lần trước trên
    // một ô đã sửa đúng không nên còn hiện trong lúc chờ.
    fieldErrors.reset();
    setFormError(null);
    setSubmitting(true);

    try {
      await signIn(email, password);
      // `replace` để nút Back không quay lại trang đăng nhập sau khi đã vào.
      void navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        fieldErrors.setError(err);
        // `400` đã có lỗi từng ô; chỉ hiện lỗi cấp form cho những ca còn lại
        // (401 sai mật khẩu, 403 tài khoản bị khóa, lỗi mạng).
        if (err.status !== 400) setFormError(err.message);
      } else {
        setFormError('Lỗi không xác định khi đăng nhập.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.shell}>
      <form className={s.card} onSubmit={handleSubmit}>
        <p className={s.brand}>Lean</p>
        <h1 className={s.title}>Đăng nhập</h1>

        <div className={s.fields}>
          <EmailInput
            id="email"
            label="Email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            error={fieldErrors.fieldErrors['email']}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordInput
            id="password"
            label="Mật khẩu"
            autoComplete="current-password"
            required
            value={password}
            error={fieldErrors.fieldErrors['password']}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {formError ? (
          <p className={s.formError} role="alert">
            {formError}
          </p>
        ) : null}

        <div className={s.actions}>
          {/* `type="submit"` ghi đè mặc định `type="button"` của `Button` — form
              này cần submit thật để Enter trong ô nhập cũng đăng nhập được. */}
          <Button type="submit" className={s.submit} disabled={submitting}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </div>

        <p className={s.switcher}>
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </form>
    </div>
  );
}
