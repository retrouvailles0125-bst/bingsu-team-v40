
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Account = {
  id: string;
  username: string | null;
  role: string | null;
  blocked: boolean | null;
  block_message: string | null;
};

type Props = {
  accounts: Account[];
};

export default function AdminAccountsTable({ accounts }: Props) {
  const router = useRouter();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [messages, setMessages] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        accounts.map((account) => [
          account.id,
          account.block_message ?? '',
        ])
      )
  );

  async function toggleBlock(account: Account) {
    if (busy || account.role === 'admin') return;

    const nextBlocked = !account.blocked;
    const message = (messages[account.id] ?? '').trim();

    if (message.length > 500) {
      setError('Thông báo không được vượt quá 500 ký tự.');
      return;
    }

    const confirmed = window.confirm(
      `${nextBlocked ? 'CHẶN LOGIN' : 'MỞ CHẶN'}\n` +
        `Tài khoản: ${account.username || account.id}\n\n` +
        (nextBlocked
          ? `Thông báo: ${message || '(Không có)'}`
          : 'Thông báo chặn hiện tại sẽ bị xóa.') +
        '\n\nXác nhận thao tác?'
    );

    if (!confirmed) return;

    setBusy(account.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/manage', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'profile.block',
          target: account.id,
          blocked: nextBlocked,
          message: nextBlocked ? message : '',
        }),
      });

      const contentType =
        response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        throw new Error(
          'Máy chủ không trả về JSON. Hãy kiểm tra phiên đăng nhập Admin OTP.'
        );
      }

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || 'Không thể cập nhật tài khoản.'
        );
      }

      setSuccess(
        nextBlocked
          ? 'Đã chặn đăng nhập và lưu thông báo.'
          : 'Đã mở chặn tài khoản.'
      );

      if (!nextBlocked) {
        setMessages((previous) => ({
          ...previous,
          [account.id]: '',
        }));
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra.'
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <p className="muted">
        Danh sách tài khoản Supabase. Mật khẩu được bảo
        vệ bởi hệ thống xác thực và không thể xem lại
        dưới dạng văn bản gốc.
      </p>

      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>EMAIL</th>
              <th>ID HIỂN THỊ</th>
              <th>MẬT KHẨU</th>
              <th>ĐĂNG NHẬP</th>
              <th>THÔNG BÁO KHI BỊ CHẶN</th>
              <th>THAO TÁC</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((account) => {
              const isAdmin = account.role === 'admin';

              return (
                <tr key={account.id}>
                  <td>
                    <span className="muted">
                      Chưa kết nối email
                    </span>
                  </td>

                  <td>{account.username || '—'}</td>

                  <td>
                    <span
                      className="muted"
                      title="Không hiển thị mật khẩu gốc"
                    >
                      Đã đặt · bảo mật
                    </span>
                  </td>

                  <td>
                    <span
                      className={
                        account.blocked ? 'pending' : 'ok'
                      }
                    >
                      {account.blocked
                        ? 'ĐÃ CHẶN'
                        : 'HOẠT ĐỘNG'}
                    </span>
                  </td>

                  <td>
                    <textarea
                      className="block-message"
                      rows={3}
                      maxLength={500}
                      value={
                        messages[account.id] ?? ''
                      }
                      disabled={isAdmin || busy !== null}
                      placeholder="Nhập thông báo hiển thị khi user bị chặn..."
                      onChange={(event) =>
                        setMessages((previous) => ({
                          ...previous,
                          [account.id]: event.target.value,
                        }))
                      }
                    />

                    {!isAdmin && (
                      <small className="muted">
                        {account.blocked
                          ? 'Thông báo đã lưu. Backend hiện chưa hỗ trợ lưu riêng khi đang chặn.'
                          : 'Thông báo sẽ được lưu khi bấm CHẶN LOGIN.'}
                      </small>
                    )}
                  </td>

                  <td>
                    {isAdmin ? (
                      <span className="muted">
                        TÀI KHOẢN ADMIN
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={
                          account.blocked
                            ? 'secondary'
                            : ''
                        }
                        disabled={busy !== null}
                        onClick={() =>
                          void toggleBlock(account)
                        }
                      >
                        {busy === account.id
                          ? 'ĐANG XỬ LÝ...'
                          : account.blocked
                            ? 'MỞ CHẶN'
                            : 'CHẶN LOGIN'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {accounts.length === 0 && (
              <tr>
                <td colSpan={6}>
                  Chưa có tài khoản.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
