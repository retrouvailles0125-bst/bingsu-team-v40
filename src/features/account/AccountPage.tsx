
'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Mode = 'login' | 'signup';

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  border: '1px solid #edc8dc',
  borderRadius: 12,
  fontSize: 14,
  outlineColor: '#e12589',
  marginTop: 7,
};

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: '13px 18px',
  background: '#e12589',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9_]{3,24}$/;

export default function AccountPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage('');
    setIsError(false);
    setPassword('');
    setConfirmPassword('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (!emailPattern.test(cleanEmail)) {
        throw new Error('Email không hợp lệ. Vui lòng kiểm tra lại.');
      }

      if (password.length < 8) {
        throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');
      }

      if (mode === 'signup') {
        const cleanUsername = username.trim().toLowerCase();

        if (!usernamePattern.test(cleanUsername)) {
          throw new Error(
            'ID hiển thị phải có 3–24 ký tự, chỉ gồm chữ không dấu, số hoặc dấu gạch dưới (_).'
          );
        }

        if (password !== confirmPassword) {
          throw new Error('Mật khẩu nhập lại không khớp.');
        }

        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username: cleanUsername,
            },
            emailRedirectTo:
              `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          if (
            error.message.toLowerCase().includes('database') ||
            error.message.toLowerCase().includes('unique')
          ) {
            throw new Error(
              'Không thể tạo tài khoản. ID hiển thị có thể đã được sử dụng hoặc email đã tồn tại.'
            );
          }

          throw error;
        }

        setPassword('');
        setConfirmPassword('');
        setMessage(
          'Đã gửi yêu cầu đăng ký. Nếu email hợp lệ và chưa được sử dụng, hãy kiểm tra hộp thư và Spam để xác minh tài khoản.'
        );

        return;
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        throw new Error(
          error.message.toLowerCase().includes('email not confirmed')
            ? 'Bạn cần xác minh email trước khi đăng nhập.'
            : error.message
        );
      }

      if (!data.user) {
        throw new Error('Không lấy được thông tin tài khoản.');
      }

      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();

        throw new Error(
          'Bạn cần xác minh email trước khi đăng nhập.'
        );
      }

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('blocked,block_message')
          .eq('id', data.user.id)
          .single();

      if (profileError) {
        await supabase.auth.signOut();

        throw new Error(
          'Không thể kiểm tra trạng thái tài khoản.'
        );
      }

      if (profile.blocked) {
        await supabase.auth.signOut();

        throw new Error(
          profile.block_message ||
          'Tài khoản đã bị chặn. Vui lòng liên hệ BST.'
        );
      }

      setMessage('Đăng nhập thành công!');
      router.replace('/');
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Có lỗi xảy ra. Vui lòng thử lại.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 650,
        margin: '40px auto',
        padding: 28,
        background: '#fff',
        borderRadius: 22,
        border: '1px solid #f5d1e5',
        boxShadow: '0 12px 35px #e1258910',
      }}
    >
      <h1 style={{ color: '#c51c76', fontSize: 26 }}>
        TÀI KHOẢN NGƯỜI DÙNG
      </h1>

      <p style={{ color: '#776878', fontSize: 14 }}>
        Đăng ký bằng email và xác minh tài khoản trước khi sử dụng.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 10,
          margin: '20px 0',
        }}
      >
        {(
          [
            ['login', 'Đăng nhập'],
            ['signup', 'Đăng ký mới'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            disabled={busy}
            style={{
              ...buttonStyle,
              background:
                mode === value ? '#e12589' : '#fff0f7',
              color: mode === value ? '#fff' : '#ae216b',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={submit}
        style={{ display: 'grid', gap: 16 }}
      >
        <label style={{ fontWeight: 600, fontSize: 14 }}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            style={fieldStyle}
          />
        </label>

        {mode === 'signup' && (
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            ID HIỂN THỊ (DÙNG TRÊN TOÀN WEBSITE)
            <input
              type="text"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-z0-9_]{3,24}"
              autoComplete="username"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.toLowerCase())
              }
              placeholder="Ví dụ: kandee_125"
              style={fieldStyle}
            />
            <span
              style={{
                display: 'block',
                marginTop: 6,
                fontSize: 12,
                fontWeight: 400,
                color: '#776878',
              }}
            >
              3–24 ký tự. Chỉ gồm chữ không dấu, số và dấu _.
              Không phân biệt chữ hoa/thường.
            </span>
          </label>
        )}

        <label style={{ fontWeight: 600, fontSize: 14 }}>
          Mật khẩu
          <input
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === 'signup'
                ? 'new-password'
                : 'current-password'
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={fieldStyle}
          />
        </label>

        {mode === 'signup' && (
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            Nhập lại mật khẩu
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              style={fieldStyle}
            />
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            ...buttonStyle,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy
            ? 'ĐANG XỬ LÝ...'
            : mode === 'signup'
              ? 'TẠO TÀI KHOẢN'
              : 'ĐĂNG NHẬP'}
        </button>
      </form>

      {message && (
        <p
          role="status"
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            background: isError ? '#fff0f0' : '#fff0f7',
            color: isError ? '#b42338' : '#a41464',
            overflowWrap: 'anywhere',
          }}
        >
          {message}
        </p>
      )}
    </main>
  );
}
