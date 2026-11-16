'use client';

import { useCallback, useEffect, useState } from 'react';

type LegacySettings = {
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_image_url: string;
  instructions: string;
};

type Method = {
  id: string;
  kind: 'qr_image' | 'bank_account';
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_image_url: string;
  is_active: boolean;
};

const BANKS = ['Techcombank', 'Vietcombank'] as const;

export default function AdminBankSettings({
  initial: _initial,
}: {
  initial: LegacySettings | null;
}) {
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [qrUrl, setQrUrl] = useState('');
  const [qrLabel, setQrLabel] = useState('QR DONATE BST');

  const [bankName, setBankName] =
    useState<(typeof BANKS)[number]>('Techcombank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/bank-settings', {
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Không tải được cấu hình.');
    }

    setMethods(Array.isArray(data.methods) ? data.methods : []);
  }, []);

  useEffect(() => {
    let live = true;

    async function start() {
      try {
        const response = await fetch('/api/admin/bank-settings', {
          cache: 'no-store',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Không tải được cấu hình.');
        }

        if (live) {
          setMethods(Array.isArray(data.methods) ? data.methods : []);
        }
      } catch (e) {
        if (live) {
          setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
        }
      } finally {
        if (live) setLoading(false);
      }
    }

    void start();

    return () => {
      live = false;
    };
  }, []);

  async function request(
    method: 'POST' | 'PATCH' | 'DELETE',
    payload: Record<string, string>,
    success: string
  ) {
    if (busy) return false;

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/bank-settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Thao tác thất bại.');
      }

      await load();
      setMessage(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addQr(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const ok = await request(
      'POST',
      {
        kind: 'qr_image',
        label: qrLabel.trim(),
        qr_image_url: qrUrl.trim(),
      },
      'Đã thêm ảnh QR.'
    );

    if (ok) {
      setQrUrl('');
      setQrLabel('QR DONATE BST');
    }
  }

  async function addBank(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const ok = await request(
      'POST',
      {
        kind: 'bank_account',
        bank_name: bankName,
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
      },
      'Đã thêm tài khoản Donate.'
    );

    if (ok) {
      setAccountNumber('');
      setAccountName('');
    }
  }

  async function activate(id: string) {
    if (!window.confirm('Chọn phương thức này làm mặc định?')) {
      return;
    }

    await request(
      'PATCH',
      { id },
      'Đã cập nhật phương thức mặc định.'
    );
  }

  async function remove(id: string) {
    if (!window.confirm('Xóa phương thức nhận Donate này?')) {
      return;
    }

    await request(
      'DELETE',
      { id },
      'Đã xóa phương thức nhận Donate.'
    );
  }

  const active = methods.find(m => m.is_active);

  const panelStyle: React.CSSProperties = {
    padding: 16,
    border: '1px solid #f1d9e7',
    borderRadius: 18,
    background: 'linear-gradient(135deg,#fff8fc,#f6f0ff)',
    minWidth: 0,
  };

  const fieldStyle: React.CSSProperties = {
    display: 'grid',
    gap: 6,
    marginBottom: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div id="bank-settings" style={{ scrollMarginTop: 24 }}>

      <p className="muted">
        Thêm link ảnh QR có sẵn, hoặc thêm tài khoản nhận Donate.
        Không yêu cầu nhập mã BIN.
      </p>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="result">
          {message}
        </p>
      )}

      <div style={{ marginTop: 20, marginBottom: 22 }}>
        <h3>CHƯA CÓ THÔNG TIN NHẬN DONATE</h3>

        {loading ? (
          <p className="muted">Đang tải phương thức nhận Donate...</p>
        ) : methods.length === 0 ? (
          <p className="muted">
            Chưa có phương thức nào trong danh sách mới.
          </p>
        ) : (
          <>
            <p className="muted">
              PHƯƠNG THỨC MẶC ĐỊNH:{' '}
              <strong>
                {active
                  ? active.kind === 'qr_image'
                    ? active.label
                    : `${active.bank_name} · ${active.account_number}`
                  : 'Chưa chọn'}
              </strong>
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              {methods.map(method => (
                <div
                  key={method.id}
                  style={{
                    ...panelStyle,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                    <strong>
                      {method.kind === 'qr_image'
                        ? method.label
                        : method.bank_name.toUpperCase()}
                    </strong>

                    {method.is_active && (
                      <p style={{ margin: '5px 0', color: '#c51c80' }}>
                        ★ ĐANG MẶC ĐỊNH
                      </p>
                    )}

                    {method.kind === 'bank_account' ? (
                      <>
                        <p style={{ margin: '5px 0' }}>
                          {method.account_number}
                        </p>
                        <p className="muted" style={{ margin: 0 }}>
                          {method.account_name}
                        </p>
                      </>
                    ) : (
                      <p
                        className="muted"
                        style={{
                          margin: '5px 0',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {method.qr_image_url}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {!method.is_active && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void activate(method.id)}
                      >
                        CHỌN MẶC ĐỊNH
                      </button>
                    )}

                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => void remove(method.id)}
                    >
                      XÓA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(min(100%,280px),1fr))',
          gap: 12,
        }}
      >
        <form onSubmit={addQr} style={panelStyle}>
          <h3>1 · THÊM LINK ẢNH QR</h3>

          <label style={fieldStyle}>
            LINK ẢNH QR (HTTPS)
            <input
              style={inputStyle}
              type="url"
              required
              maxLength={1000}
              placeholder="https://..."
              value={qrUrl}
              onChange={e => setQrUrl(e.target.value)}
            />
          </label>

          <label style={fieldStyle}>
            TÊN HIỂN THỊ
            <input
              style={inputStyle}
              required
              maxLength={120}
              placeholder="QR DONATE BST"
              value={qrLabel}
              onChange={e => setQrLabel(e.target.value)}
            />
          </label>

          <button type="submit" disabled={busy || loading}>
            {busy ? 'ĐANG XỬ LÝ...' : 'THÊM ẢNH QR'}
          </button>
        </form>

        <form onSubmit={addBank} style={panelStyle}>
          <h3>2 · THÊM TÀI KHOẢN DONATE</h3>

          <label style={fieldStyle}>
            NGÂN HÀNG
            <select
              style={inputStyle}
              value={bankName}
              onChange={e =>
                setBankName(e.target.value as (typeof BANKS)[number])
              }
            >
              {BANKS.map(bank => (
                <option key={bank} value={bank}>
                  {bank.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            SỐ TÀI KHOẢN
            <input
              style={inputStyle}
              required
              inputMode="numeric"
              pattern="[0-9]{5,25}"
              maxLength={25}
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
            />
          </label>

          <label style={fieldStyle}>
            TÊN CHỦ TÀI KHOẢN
            <input
              style={inputStyle}
              required
              maxLength={120}
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
            />
          </label>

          <button type="submit" disabled={busy || loading}>
            {busy ? 'ĐANG XỬ LÝ...' : 'THÊM TÀI KHOẢN DONATE'}
          </button>
        </form>
      </div>
    </div>
  );
}
