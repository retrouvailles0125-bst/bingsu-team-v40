'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

type DonateField = {
  key: string;
  label: string;
  type: FieldType;
  visible: boolean;
  public: boolean;
  required: boolean;
  deleted: boolean;
  system: boolean;
};

type Settings = {
  max_bills: number;
  fields: DonateField[];
  updated_at?: string;
};

const SYSTEM = [
  'display_id',
  'phone',
  'amount',
  'transfer_date',
  'kandee_message',
  'bst_message',
];

// Nhãn mặc định theo HTML V40 gốc, dùng khi BST để trống tên hiển thị.
const DEFAULT_LABELS: Record<string, string> = {
  display_id: 'ID HIỂN THỊ',
  phone: 'SỐ ĐIỆN THOẠI',
  amount: 'SỐ TIỀN DONATE',
  transfer_date: 'NGÀY CHUYỂN KHOẢN',
  kandee_message: 'LỜI NHẮN CHO CÁC BẠN KANDEE',
  bst_message: 'LỜI NHẮN DÀNH CHO BINGSU TEAM',
};

const LOCKED = new Set(['display_id', 'amount']);
const PRIVATE = new Set(['phone', 'email', 'bst_message']);
const API = '/api/admin/donate-fields';

function makeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export default function AdminDonateFields() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState('');
  const [kind, setKind] = useState<FieldType>('text');
  const [required, setRequired] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(API, { cache: 'no-store' });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Không tải được cấu hình Donate.');
      }

      if (!json.settings || !Array.isArray(json.settings.fields)) {
        throw new Error('Dữ liệu cấu hình không hợp lệ.');
      }

      setSettings(json.settings);
      setDirty(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không tải được cấu hình.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => settings?.fields.filter(field => !field.deleted) ?? [],
    [settings]
  );

  const removed = useMemo(
    () => settings?.fields.filter(field => field.deleted) ?? [],
    [settings]
  );

  const defaultFields = SYSTEM
    .map(key => active.find(field => field.key === key))
    .filter((field): field is DonateField => Boolean(field));

  const customFields = active.filter(field => !field.system);

  function changeField(key: string, update: Partial<DonateField>) {
    setSettings(previous =>
      previous
        ? {
            ...previous,
            fields: previous.fields.map(field =>
              field.key === key ? { ...field, ...update } : field
            ),
          }
        : null
    );

    setDirty(true);
    setSuccess('');
  }

  function removeField(field: DonateField) {
    if (LOCKED.has(field.key)) return;

    changeField(field.key, {
      deleted: true,
      visible: false,
      public: false,
      required: false,
    });
  }

  function restoreField(field: DonateField) {
    changeField(field.key, {
      deleted: false,
      visible: true,
      public: false,
    });
  }

  // Khởi tạo thông tin mới: thêm vào danh sách và lưu ngay, giống HTML V40 gốc.
  function addField() {
    if (!settings || saving) return;

    const label = name.trim();

    if (!label || label.length > 120) {
      setError('Tên thông tin phải có từ 1 đến 120 ký tự.');
      return;
    }

    if (
      settings.fields.some(
        field =>
          !field.deleted &&
          field.label.trim().toLowerCase() === label.toLowerCase()
      )
    ) {
      setError('Tên thông tin đã tồn tại.');
      return;
    }

    const base = makeKey(label);

    if (!base) {
      setError('Tên thông tin cần có chữ cái hoặc chữ số Latin.');
      return;
    }

    if (settings.fields.length >= 60) {
      setError('Đã đạt giới hạn 60 trường.');
      return;
    }

    let key = `custom_${base}`.slice(0, 63);
    let index = 2;

    while (settings.fields.some(field => field.key === key)) {
      const suffix = `_${index++}`;
      key =
        `custom_${base}`.slice(0, 63 - suffix.length) + suffix;
    }

    const nextFields: DonateField[] = [
      ...settings.fields,
      {
        key,
        label,
        type: kind,
        visible: true,
        public: isPublic,
        required,
        deleted: false,
        system: false,
      },
    ];

    setSettings({ ...settings, fields: nextFields });
    setName('');
    setKind('text');
    setRequired(false);
    setIsPublic(false);
    setError('');
    void save(nextFields);
  }

  async function save(nextFields?: DonateField[]) {
    if (!settings || saving) return;

    // Tên để trống thì quay về nhãn mặc định, giống bản gốc.
    const fields = (nextFields ?? settings.fields).map(field => ({
      ...field,
      label: field.label.trim() || DEFAULT_LABELS[field.key] || field.key,
    }));

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_bills: settings.max_bills,
          fields,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        const details =
          json.details?.formErrors?.join(' ') ||
          Object.values(
            json.details?.fieldErrors || {}
          ).flat().join(' ');

        throw new Error(
          [json.error, details].filter(Boolean).join(' ') ||
            'Không lưu được cấu hình.'
        );
      }

      setSettings(json.settings);
      setDirty(false);
      setSuccess('Đã lưu cấu hình Donate vào Supabase.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không lưu được cấu hình.'
      );
    } finally {
      setSaving(false);
    }
  }

  function checkbox(
    field: DonateField,
    property: 'visible' | 'public' | 'required',
    disabled = false
  ) {
    return (
      <input
        type="checkbox"
        style={{ width: 'auto' }}
        aria-label={`${property} ${field.label}`}
        checked={field[property]}
        disabled={disabled || saving}
        title={
          property === 'public' && field.key === 'phone'
            ? 'Thông tin riêng tư'
            : undefined
        }
        onChange={event => {
          const checked = event.target.checked;

          if (property === 'visible') {
            changeField(field.key, {
              visible: checked,
              ...(!checked ? { public: false } : {}),
            });
          } else if (property === 'required') {
            changeField(field.key, { required: checked });
          } else {
            changeField(field.key, { public: checked });
          }
        }}
      />
    );
  }

  return (
    <section className="panel" id="bst-admin-donate-fields">
      <h2>KHAI BÁO DONATE</h2>

      <p className="muted">
        BST quyết định trường nào hiển thị và lời nhắn nào
        được công khai. Người Donate không tự chọn quyền công khai.
        Email, số điện thoại và bill không được công khai
        để bảo vệ thông tin cá nhân. ID và số tiền bắt buộc
        cho quy trình QR.
      </p>

      {loading && (
        <p role="status">Đang tải cấu hình Donate...</p>
      )}

      {error && (
        <p role="alert" className="error">{error}</p>
      )}

      {success && (
        <p role="status" className="result">{success}</p>
      )}

      {!loading && !settings && (
        <button type="button" onClick={() => void load()}>
          THỬ TẢI LẠI
        </button>
      )}

      {settings && (
        <>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>THÔNG TIN</th>
                  <th>HIỂN THỊ TRÊN FORM</th>
                  <th>CÔNG KHAI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>

              <tbody>
                {defaultFields.map(field => (
                  <tr key={field.key}>
                    <td>
                      <input
                        className="field-label-edit"
                        aria-label={`Tên hiển thị ${field.key}`}
                        maxLength={90}
                        value={field.label}
                        disabled={saving}
                        onChange={event =>
                          changeField(field.key, {
                            label: event.target.value,
                          })
                        }
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {checkbox(
                        field,
                        'visible',
                        LOCKED.has(field.key)
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {checkbox(
                        field,
                        'public',
                        PRIVATE.has(field.key) || !field.visible
                      )}
                    </td>

                    <td>
                      {LOCKED.has(field.key) ? (
                        <span className="muted">BẮT BUỘC</span>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => removeField(field)}
                        >
                          XÓA
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bill-count-config">
            <h3>BILL CHUYỂN KHOẢN · BẮT BUỘC</h3>

            <p className="muted">
              Mỗi lượt Donate phải tải ít nhất một bill.
              BST có thể điều chỉnh số bill tối đa.
            </p>

            <label htmlFor="bst-max-bills">
              SỐ BILL TỐI ĐA MỖI LẦN DONATE
            </label>

            <input
              id="bst-max-bills"
              type="number"
              min={1}
              max={20}
              step={1}
              value={settings.max_bills}
              onChange={event => {
                setSettings(previous =>
                  previous
                    ? {
                        ...previous,
                        max_bills: Number(event.target.value),
                      }
                    : null
                );

                setDirty(true);
                setSuccess('');
              }}
            />
          </div>

          <p>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void save()}
            >
              {saving
                ? 'ĐANG LƯU...'
                : 'LƯU CẤU HÌNH KHAI BÁO'}
            </button>
          </p>

          {dirty && (
            <p className="muted">
              Có thay đổi chưa lưu.
            </p>
          )}

          <h3>KHÔI PHỤC TRƯỜNG ĐÃ XÓA</h3>

          <div className="row">
            {removed.length === 0 ? (
              <span className="muted">
                KHÔNG CÓ TRƯỜNG ĐÃ XÓA
              </span>
            ) : (
              removed.map(field => (
                <button
                  key={field.key}
                  type="button"
                  className="secondary"
                  onClick={() => restoreField(field)}
                >
                  + {field.label}
                </button>
              ))
            )}
          </div>

          <h3>KHỞI TẠO THÔNG TIN KHAI BÁO MỚI</h3>

          <form
            onSubmit={event => {
              event.preventDefault();
              addField();
            }}
          >
            <div className="grid">
              <div>
                <label htmlFor="bst-new-field-name">
                  TÊN THÔNG TIN
                </label>

                <input
                  id="bst-new-field-name"
                  maxLength={90}
                  required
                  value={name}
                  onChange={event => setName(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="bst-new-field-type">
                  KIỂU DỮ LIỆU
                </label>

                <select
                  id="bst-new-field-type"
                  value={kind}
                  onChange={event =>
                    setKind(event.target.value as FieldType)
                  }
                >
                  <option value="text">VĂN BẢN</option>
                  <option value="textarea">LỜI NHẮN DÀI</option>
                  <option value="number">SỐ</option>
                  <option value="date">NGÀY</option>
                </select>
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={required}
                    onChange={event =>
                      setRequired(event.target.checked)
                    }
                  />{' '}
                  BẮT BUỘC NHẬP
                </label>
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={isPublic}
                    onChange={event =>
                      setIsPublic(event.target.checked)
                    }
                  />{' '}
                  CÔNG KHAI TRÊN THEO DÕI DONATE
                </label>
              </div>
            </div>

            <p>
              <button type="submit" disabled={saving}>
                + KHỞI TẠO &amp; LƯU THÔNG TIN
              </button>
            </p>
          </form>

          <h3>THÔNG TIN ĐÃ KHỞI TẠO</h3>

          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>TÊN</th>
                  <th>KIỂU</th>
                  <th>BẮT BUỘC</th>
                  <th>CÔNG KHAI</th>
                  <th>HIỂN THỊ</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>

              <tbody>
                {customFields.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      CHƯA CÓ THÔNG TIN MỚI
                    </td>
                  </tr>
                ) : (
                  customFields.map(field => (
                    <tr key={field.key}>
                      <td>{field.label}</td>

                      <td>{field.type}</td>

                      <td>{field.required ? 'CÓ' : 'KHÔNG'}</td>

                      <td>
                        {checkbox(
                          field,
                          'public',
                          !field.visible
                        )}
                      </td>

                      <td>
                        {checkbox(
                          field,
                          'visible',
                          field.required
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => removeField(field)}
                        >
                          XÓA
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void save()}
            >
              {saving
                ? 'ĐANG LƯU...'
                : 'LƯU THAY ĐỔI THÔNG TIN'}
            </button>
          </p>
        </>
      )}
    </section>
  );
}