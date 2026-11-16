'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
  is_open: boolean;
};

type Bank = {
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_image_url: string;
  instructions: string;
};

type PaymentMethod = {
  id: string;
  kind: 'qr_image' | 'bank_account';
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_image_url: string;
  is_active: boolean;
};

type BankResponse = {
  settings: Bank | null;
  methods: PaymentMethod[];
};

type Field = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date';
  visible: boolean;
  public: boolean;
  required: boolean;
  deleted: boolean;
  system: boolean;
};

type Settings = {
  max_bills: number;
  fields: Field[];
};

const money = (value: string) =>
  value
    .replace(/\D/g, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const allowedMime = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export default function Donate() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState('');
  const [projectError, setProjectError] = useState('');

  const [bank, setBank] = useState<Bank | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [bankError, setBankError] = useState('');

  const selectedPayment =
    methods.find(m => m.id === selectedMethod) ??
    methods.find(m => m.is_active) ??
    methods[0] ??
    null;

  const displayedBank: Bank | null = selectedPayment
    ? {
        bank_name: selectedPayment.kind === 'bank_account'
          ? selectedPayment.bank_name : '',
        account_name: selectedPayment.kind === 'bank_account'
          ? selectedPayment.account_name : '',
        account_number: selectedPayment.kind === 'bank_account'
          ? selectedPayment.account_number : '',
        qr_image_url: selectedPayment.kind === 'qr_image'
          ? selectedPayment.qr_image_url : '',
        instructions: bank?.instructions ?? '',
      }
    : bank;

  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'not_paid' | 'paid'>('not_paid');
  const [amount, setAmount] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [copied, setCopied] = useState('');
  const [completed, setCompleted] = useState(false);

  const numericAmount = Number(amount.replace(/\D/g, ''));
  const validAmount =
    Number.isSafeInteger(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= 1000000000;

  const activeFields =
    settings?.fields.filter(f => f.visible && !f.deleted) ?? [];

  function changeValue(key: string, value: string) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied('Đã sao chép vào clipboard.');
    } catch {
      setCopied('Không thể sao chép tự động.');
    }
  }

  useEffect(() => {
    let live = true;

    async function load() {
      const responses = await Promise.allSettled([
        fetch('/api/projects/open', { cache: 'no-store' })
          .then(async response => {
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || 'Không tải được Project.');
            }
            return data.projects as Project[];
          }),

        fetch('/api/donations/bank-settings', {
          cache: 'no-store',
        }).then(async response => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(
              data.error || 'Không tải được ngân hàng.'
            );
          }
          return {
            settings: data.settings ?? null,
            methods: Array.isArray(data.methods) ? data.methods : [],
          } as BankResponse;
        }),

        fetch('/api/donations/field-settings', {
          cache: 'no-store',
        }).then(async response => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(
              data.error || 'Không tải được cấu hình Donate.'
            );
          }
          return data.settings as Settings;
        }),
      ]);

      if (!live) return;

      const [p, b, s] = responses;

      if (p.status === 'fulfilled') {
        const opened = p.value.filter(x => x.is_open);
        setProjects(opened);

        const requested = new URLSearchParams(
          window.location.search
        ).get('project');

        setProject(
          opened.find(x => x.id === requested)?.id ||
          opened[0]?.id ||
          ''
        );

        if (!opened.length) {
          setProjectError('Hiện chưa có Project đang mở Donate.');
        }
      } else {
        setProjectError(
          p.reason instanceof Error
            ? p.reason.message
            : 'Không tải được Project.'
        );
      }

      if (b.status === 'fulfilled') {
        setBank(b.value.settings);
        setMethods(b.value.methods);
        setSelectedMethod(
          b.value.methods.find(m => m.is_active)?.id ??
          b.value.methods[0]?.id ??
          ''
        );
      } else {
        setBankError(
          b.reason instanceof Error
            ? b.reason.message
            : 'Không tải được thông tin ngân hàng.'
        );
      }

      if (s.status === 'fulfilled') {
        const config = s.value;

        if (
          !config ||
          !Array.isArray(config.fields) ||
          !Number.isInteger(config.max_bills) ||
          config.max_bills < 1 ||
          config.max_bills > 20 ||
          !config.fields.some(f =>
            f.key === 'display_id' &&
            f.visible &&
            f.required &&
            !f.deleted
          ) ||
          !config.fields.some(f =>
            f.key === 'amount' &&
            f.visible &&
            f.required &&
            !f.deleted
          )
        ) {
          setSettingsError('Cấu hình Donate không hợp lệ.');
        } else {
          setSettings(config);
        }
      } else {
        setSettingsError(
          s.reason instanceof Error
            ? s.reason.message
            : 'Không tải được cấu hình Donate.'
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      live = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || completed) return;

    setMessage('');
    setReference('');

    if (!settings) {
      setMessage('Cấu hình Donate chưa sẵn sàng.');
      return;
    }

    if (mode !== 'paid') {
      setMessage('Vui lòng xác nhận đã chuyển khoản.');
      return;
    }

    if (!validAmount) {
      setMessage('Số tiền phải từ 1 đến 1.000.000.000 VND.');
      return;
    }

    if (!projects.some(p => p.id === project)) {
      setMessage('Project không còn mở Donate.');
      return;
    }

    if (files.length < 1 || files.length > settings.max_bills) {
      setMessage(`Cần 1–${settings.max_bills} bill.`);
      return;
    }

    if (files.some(f =>
      f.size === 0 ||
      f.size > 5 * 1024 * 1024 ||
      !allowedMime.includes(f.type)
    )) {
      setMessage(
        'Bill phải là JPG, PNG, WebP hoặc PDF, tối đa 5 MB/file.'
      );
      return;
    }

    const declaration: Record<string, string> = {};

    for (const field of activeFields) {
      if (field.key === 'amount') continue;

      const value = (values[field.key] || '').trim();

      if (field.required && !value) {
        setMessage(`Vui lòng nhập "${field.label}".`);
        return;
      }

      declaration[field.key] = value;
    }

    setBusy(true);

    try {
      const body = new FormData();

      body.set('project_id', project);
      body.set('declared_amount', amount.replace(/\D/g, ''));
      body.set('declaration_fields', JSON.stringify(declaration));

      files.forEach(file => body.append('bills', file));

      const response = await fetch('/api/donations', {
        method: 'POST',
        body,
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.donation_id) {
          setReference(String(result.donation_id));
          setCompleted(true);
        }

        throw new Error(result.error || 'Không gửi được Donate.');
      }

      setReference(result.id);
      setCompleted(true);
      setMessage(
        'Đã gửi khai báo. Đang chờ BST đối soát; ' +
        'chưa cấp lượt quay.'
      );

      setFiles([]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Không gửi được Donate.'
      );
    } finally {
      setBusy(false);
    }
  }

  function renderField(field: Field) {
    if (field.key === 'amount') {
      return (
        <div key={field.key}>
          <label htmlFor="donate-amount">
            {field.label} (VND) *
          </label>
          <input
            id="donate-amount"
            required
            inputMode="numeric"
            value={amount}
            onChange={e => setAmount(money(e.target.value))}
            placeholder="100.000"
          />
        </div>
      );
    }

    const id = `donate-field-${field.key}`;
    const value = values[field.key] || '';

    return (
      <div key={field.key}>
        <label htmlFor={id}>
          {field.label}
          {field.required ? ' *' : ' (KHÔNG BẮT BUỘC)'}
        </label>

        {field.type === 'textarea' ? (
          <textarea
            id={id}
            rows={4}
            required={field.required}
            maxLength={2000}
            value={value}
            onChange={e =>
              changeValue(field.key, e.target.value)
            }
          />
        ) : (
          <input
            id={id}
            type={
              field.type === 'date'
                ? 'date'
                : field.type === 'number'
                  ? 'number'
                  : 'text'
            }
            min={field.type === 'number' ? 0 : undefined}
            step={field.type === 'number' ? 1 : undefined}
            required={field.required}
            maxLength={
              field.type === 'text' ? 255 : undefined
            }
            value={value}
            onChange={e =>
              changeValue(field.key, e.target.value)
            }
          />
        )}

        {field.public && (
          <p className="muted">
            Thông tin này được BST cấu hình là công khai.
          </p>
        )}
      </div>
    );
  }

  return (
    <main className="bst-v40-page">
      <section className="bst-v40-panel">
        <Link href="/">← TRANG CHỦ</Link>

        <h1>DONATE CHO PROJECT</h1>

        <p className="muted">
          Chọn Project, xem thông tin chuyển khoản rồi
          khai báo bill để BST đối soát. Chỉ giao dịch
          Verified mới được cộng vào thống kê.
        </p>

        {projectError && (
          <p role="alert" className="error">
            {projectError}
          </p>
        )}

        {loading ? (
          <p role="status">Đang tải cấu hình Donate...</p>
        ) : settingsError ? (
          <p role="alert" className="error">
            {settingsError}
          </p>
        ) : null}

        <label htmlFor="donate-project">
          PROJECT ĐANG MỞ
        </label>

        <select
          id="donate-project"
          value={project}
          disabled={busy || completed}
          onChange={e => setProject(e.target.value)}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <h2 style={{ marginTop: 24 }}>
          BƯỚC 1 · TRẠNG THÁI CHUYỂN KHOẢN
        </h2>

        <div
          className="grid"
          role="group"
          aria-label="Trạng thái chuyển khoản"
        >
          <button
            type="button"
            className={mode === 'not_paid' ? '' : 'secondary'}
            disabled={busy || completed}
            aria-pressed={mode === 'not_paid'}
            onClick={() => setMode('not_paid')}
          >
            CHƯA CHUYỂN KHOẢN
          </button>

          <button
            type="button"
            className={mode === 'paid' ? '' : 'secondary'}
            disabled={busy || completed}
            aria-pressed={mode === 'paid'}
            onClick={() => setMode('paid')}
          >
            ĐÃ CHUYỂN KHOẢN
          </button>
        </div>

        <div
          className="bst-v40-metric"
          style={{ marginTop: 16 }}
        >
          <h3>THÔNG TIN CHUYỂN KHOẢN</h3>

          {methods.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p className="muted">
                CHỌN PHƯƠNG THỨC NHẬN DONATE
              </p>
              <div
                className="grid"
                role="group"
                aria-label="Phương thức nhận Donate"
              >
                {methods.map(method => (
                  <button
                    key={method.id}
                    type="button"
                    className={
                      selectedPayment?.id === method.id
                        ? ''
                        : 'secondary'
                    }
                    aria-pressed={selectedPayment?.id === method.id}
                    onClick={() => {
                      setSelectedMethod(method.id);
                      setCopied('');
                    }}
                  >
                    {method.kind === 'qr_image'
                      ? `QR · ${method.label}`
                      : method.bank_name.toUpperCase()}
                    {method.is_active ? ' · MẶC ĐỊNH' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {bankError && (
            <p role="alert" className="error">
              {bankError}
            </p>
          )}

          {displayedBank && (
            displayedBank.bank_name ||
            displayedBank.account_number ||
            displayedBank.qr_image_url
          ) ? (
            <>
              {(displayedBank.bank_name ||
                displayedBank.account_name ||
                displayedBank.account_number) && (
                <>
                  {displayedBank.bank_name && (
                    <p>
                      <strong>Ngân hàng:</strong>{' '}
                      {displayedBank.bank_name}
                    </p>
                  )}

                  {displayedBank.account_name && (
                    <p>
                      <strong>Chủ tài khoản:</strong>{' '}
                      {displayedBank.account_name}
                    </p>
                  )}

                  {displayedBank.account_number && (
                    <p>
                      <strong>Số tài khoản:</strong>{' '}
                      {displayedBank.account_number}{' '}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          void copyValue(displayedBank.account_number)
                        }
                      >
                        SAO CHÉP
                      </button>
                    </p>
                  )}
                </>
              )}

              {displayedBank.qr_image_url && (
                <div
                  style={{
                    textAlign: 'center',
                    margin: '16px 0',
                  }}
                >
                  <img
                    src={displayedBank.qr_image_url}
                    alt="QR chuyển khoản do BINGSU TEAM cung cấp"
                    style={{
                      width: 'min(100%,320px)',
                      height: 'auto',
                      borderRadius: 14,
                    }}
                  />
                </div>
              )}

              {displayedBank.instructions && (
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {displayedBank.instructions}
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              BST chưa công bố thông tin chuyển khoản.
              Vui lòng kiểm tra với BST trước khi chuyển tiền.
            </p>
          )}
        </div>

        {copied && (
          <p role="status" className="muted">
            {copied}
          </p>
        )}

        {mode === 'not_paid' && !completed ? (
          <div className="note" style={{ marginTop: 16 }}>
            <h3>CHUẨN BỊ CHUYỂN KHOẢN</h3>

            <label htmlFor="donate-qr-amount">
              SỐ TIỀN MUỐN DONATE (VND)
            </label>

            <input
              id="donate-qr-amount"
              inputMode="numeric"
              value={amount}
              onChange={e =>
                setAmount(money(e.target.value))
              }
              placeholder="100.000"
            />

            <p>
              <strong>Số tiền:</strong>{' '}
              {validAmount
                ? `${amount} VND`
                : 'Chưa nhập số tiền hợp lệ'}
            </p>

            <p className="muted">
              QR hiện tại là ảnh do BST cấu hình,
              chưa chứa số tiền tự động. Hãy kiểm tra
              đúng người nhận và số tài khoản.
            </p>

            <p>
              Sau khi chuyển khoản, chọn
              <strong> ĐÃ CHUYỂN KHOẢN</strong>
              {' '}để khai báo và tải bill.
            </p>

            <button
              type="button"
              disabled={!validAmount || !settings}
              onClick={() => setMode('paid')}
            >
              TÔI ĐÃ CHUYỂN KHOẢN →
            </button>
          </div>
        ) : !completed ? (
          <>
            <h2 style={{ marginTop: 24 }}>
              BƯỚC 2 · KHAI BÁO DONATE ĐÃ CHUYỂN
            </h2>

            {!settings ? (
              <p role="alert" className="error">
                Chưa thể gửi Donate khi cấu hình
                chưa sẵn sàng.
              </p>
            ) : (
              <form onSubmit={submit}>
                {activeFields.map(renderField)}

                <label htmlFor="donate-bills">
                  BILL CHUYỂN KHOẢN (BẮT BUỘC)
                </label>

                <input
                  id="donate-bills"
                  required
                  type="file"
                  multiple
                  accept={allowedMime.join(',')}
                  onChange={e =>
                    setFiles(
                      Array.from(e.target.files || [])
                    )
                  }
                />

                <p className="muted">
                  Đã chọn {files.length} bill ·
                  Tối đa {settings.max_bills} file,
                  5 MB mỗi file (JPG, PNG, WebP, PDF).
                </p>

                <button
                  disabled={
                    busy ||
                    !project ||
                    !validAmount ||
                    files.length < 1 ||
                    files.length > settings.max_bills
                  }
                >
                  {busy
                    ? 'ĐANG GỬI...'
                    : 'GỬI XÁC NHẬN DONATE'}
                </button>
              </form>
            )}
          </>
        ) : null}

        {message && (
          <p role="status" className="result">
            {message}
          </p>
        )}

        {reference && (
          <p>
            <strong>Mã khai báo:</strong>{' '}
            <code>{reference}</code>{' '}

            <button
              type="button"
              className="secondary"
              onClick={() =>
                void copyValue(reference)
              }
            >
              SAO CHÉP MÃ
            </button>
          </p>
        )}

        {completed && (
          <p className="muted">
            Phiên khai báo này đã tạo mã giao dịch.
            Không gửi lại để tránh trùng giao dịch.
          </p>
        )}
      </section>
    </main>
  );
}
