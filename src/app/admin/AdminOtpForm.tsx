
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminOtpForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function sendOtp() {
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/otp/send', {
        method: 'POST',
        credentials: 'same-origin',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Không thể gửi OTP.');
      }

      setMessage('Đã gửi mã OTP. Hãy kiểm tra Gmail.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Có lỗi xảy ra.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/otp/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'OTP không hợp lệ.');
      }

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Có lỗi xảy ra.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, marginTop: 20 }}>
      <p>Mã xác thực gồm 6 số và có hiệu lực trong 5 phút.</p>

      <button
        type="button"
        onClick={sendOtp}
        disabled={busy}
        style={{
          padding: '12px 18px',
          background: '#e12589',
          color: '#fff',
          border: 0,
          borderRadius: 12,
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        GỬI MÃ OTP QUA EMAIL
      </button>

      <form
        onSubmit={verifyOtp}
        style={{ display: 'grid', gap: 12, marginTop: 20 }}
      >
        <label htmlFor="admin-otp-code">Mã OTP</label>

        <input
          id="admin-otp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]{6}"
          required
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, ''))
          }
          placeholder="Nhập 6 chữ số"
          style={{
            padding: 14,
            borderRadius: 12,
            border: '1px solid #edc8dc',
            fontSize: 18,
            letterSpacing: 4,
          }}
        />

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          style={{
            padding: 14,
            background: '#e12589',
            color: '#fff',
            border: 0,
            borderRadius: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {busy ? 'ĐANG XỬ LÝ...' : 'XÁC MINH OTP'}
        </button>
      </form>

      {message && <p role="status">{message}</p>}
    </div>
  );
}
