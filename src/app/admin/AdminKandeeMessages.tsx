'use client';

import { useEffect, useMemo, useState } from 'react';

type ProjectRef = { name: string | null };

type MessageRow = {
  id: string;
  user_id: string | null;
  project_id: string | null;
  declared_amount: number | string | null;
  received_amount: number | string | null;
  status: string | null;
  created_at: string;
  kandee_message: string | null;
  bst_message: string | null;
  projects?: ProjectRef | ProjectRef[] | null;
};

type Project = { id: string; name: string };
type UserRow = { id: string; username: string | null };

type Props = {
  rows: MessageRow[];
  projects: Project[];
  users: UserRow[];
  error?: string | null;
};

type FieldSetting = { key: string; public?: boolean };

const money = (value: number | string | null | undefined) =>
  `${Number(value ?? 0).toLocaleString('vi-VN')} VND`;

function projectName(row: MessageRow) {
  const ref = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  return ref?.name || '—';
}

export default function AdminKandeeMessages({
  rows,
  projects,
  users,
  error,
}: Props) {
  const [project, setProject] = useState('all');
  const [type, setType] = useState<'all' | 'kandee' | 'bst'>('all');
  const [pub, setPub] = useState<{ kandee: boolean; bst: boolean } | null>(
    null
  );

  // Đọc cài đặt công khai từ cấu hình Khai báo Donate (mục 1).
  useEffect(() => {
    let alive = true;

    fetch('/api/admin/donate-fields', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => {
        if (!alive || !Array.isArray(json?.settings?.fields)) return;

        const find = (key: string) =>
          (json.settings.fields as FieldSetting[]).find(
            field => field.key === key
          );

        setPub({
          kandee: Boolean(find('kandee_message')?.public),
          bst: Boolean(find('bst_message')?.public),
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const names = useMemo(
    () => new Map(users.map(user => [user.id, user.username || '—'])),
    [users]
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        row =>
          (project === 'all' || row.project_id === project) &&
          ((type !== 'bst' && Boolean(row.kandee_message?.trim())) ||
            (type !== 'kandee' && Boolean(row.bst_message?.trim())))
      ),
    [rows, project, type]
  );

  const visibility = (isPublic: boolean | undefined) =>
    isPublic === undefined ? null : (
      <small className="muted">
        {isPublic
          ? ' · Công khai theo cài đặt BST'
          : ' · Riêng tư theo cài đặt BST'}
      </small>
    );

  return (
    <>
      <p className="muted">
        Lọc theo project và loại lời nhắn. Nội dung riêng tư chỉ hiển thị
        trong quản trị BST.
      </p>

      {error && (
        <p role="alert" className="error">
          Không thể tải Supabase: {error}
        </p>
      )}

      <div className="grid">
        <div>
          <label htmlFor="bst-message-project">PROJECT</label>

          <select
            id="bst-message-project"
            value={project}
            onChange={event => setProject(event.target.value)}
          >
            <option value="all">TẤT CẢ PROJECT</option>
            {projects.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bst-message-type">LOẠI LỜI NHẮN</label>

          <select
            id="bst-message-type"
            value={type}
            onChange={event =>
              setType(event.target.value as 'all' | 'kandee' | 'bst')
            }
          >
            <option value="all">TẤT CẢ LỜI NHẮN</option>
            <option value="kandee">CHO CÁC BẠN KANDEE</option>
            <option value="bst">CHO BINGSU TEAM</option>
          </select>
        </div>
      </div>

      <p className="muted">{filtered.length} khai báo có lời nhắn</p>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>TÊN PROJECT</th>
              <th>EMAIL DONATE</th>
              <th>SỐ TIỀN DONATE</th>
              {type !== 'bst' && <th>LỜI NHẮN CHO CÁC BẠN KANDEE</th>}
              {type !== 'kandee' && <th>LỜI NHẮN CHO BINGSU TEAM</th>}
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>CHƯA CÓ LỜI NHẮN</td>
              </tr>
            ) : (
              filtered.map(row => {
                const verified =
                  (row.status ?? '').toLowerCase() === 'verified';

                return (
                  <tr key={row.id}>
                    <td>{projectName(row)}</td>
                    <td>{names.get(row.user_id ?? '') ?? '—'}</td>
                    <td>
                      {money(
                        verified && row.received_amount != null
                          ? row.received_amount
                          : row.declared_amount
                      )}
                    </td>

                    {type !== 'bst' && (
                      <td>
                        {row.kandee_message?.trim() || '—'}
                        {visibility(pub?.kandee)}
                      </td>
                    )}

                    {type !== 'kandee' && (
                      <td>
                        {row.bst_message?.trim() || '—'}
                        {visibility(pub?.bst)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}