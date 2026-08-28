import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, EmailInput, Input, PasswordInput } from '../../../components/ui';
import { useFieldErrors } from '../../../hooks';
import { ApiError } from '../../../types/api';
import * as authApi from '../api/auth.api';
import { useSession } from '../hooks/useSession';
import s from './AuthPage.module.css';

const KNOWN_FIELDS = ['email', 'password', 'displayName'] as const;

export function RegisterPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const fieldErrors = useFieldErrors(KNOWN_FIELDS);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    fieldErrors.reset();
    setFormError(null);
    setSubmitting(true);

    try {
      // `POST /register` KHÔNG mở phiên (server không gọi session.save ở đó),
      // nên đăng nhập ngay sau đó bằng đúng thông tin vừa đăng ký. Làm vậy để
      // người dùng không phải nhập lại hai lần — nhưng phải là hai request
      // thật, không phải giả định rằng register đã đăng nhập hộ.
      await authApi.register({
        email,
        password,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      });
      await signIn(email, password);
      void navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        fieldErrors.setError(err);
        if (err.status !== 400) setFormError(err.message);
      } else {
        setFormError('Lỗi không xác định khi đăng ký.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.shell}>
      <form className={s.card} onSubmit={handleSubmit}>
        <p className={s.brand}>Lean</p>
        <h1 className={s.title}>Đăng ký</h1>

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
          <Input
            id="displayName"
            label="Tên hiển thị (không bắt buộc)"
            autoComplete="name"
            value={displayName}
            error={fieldErrors.fieldErrors['displayName']}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <PasswordInput
            id="password"
            label="Mật khẩu"
            autoComplete="new-password"
            required
            // `minLength` chỉ để trình duyệt cản sớm cho đỡ một vòng mạng.
            // Ràng buộc THẬT nằm ở Zod phía server (registerSchema, min 8) —
            // thuộc tính HTML này người dùng tắt được, server thì không.
            minLength={8}
            value={password}
            error={fieldErrors.fieldErrors['password']}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <p className={s.notice}>Mật khẩu tối thiểu 8 ký tự.</p>

        {formError ? (
          <p className={s.formError} role="alert">
            {formError}
          </p>
        ) : null}

        <div className={s.actions}>
          <Button type="submit" className={s.submit} disabled={submitting}>
            {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
          </Button>
        </div>

        <p className={s.switcher}>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </form>
    </div>
  );
}
