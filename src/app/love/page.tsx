
'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {createBrowserClient} from '@supabase/ssr';

const db = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Letter = {
  id: string;
  body: string;
  created_at: string;
};

const PINK = '#e12589';

export default function Love() {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [body, setBody] = useState('');
  const [privateLetter, setPrivateLetter] = useState(false);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [total, setTotal] = useState(0);
  const [opened, setOpened] = useState<Letter | null>(null);
  const [notice, setNotice] = useState('');
  const [trangCode, setTrangCode] = useState('');
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [textColor, setTextColor] = useState(PINK);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [
        {data, error},
        {data: count, error: countError}
      ] = await Promise.all([
        db
          .from('love_messages')
          .select('id,body,created_at')
          .eq('is_private', false)
          .eq('hidden', false)
          .order('created_at', {ascending: false})
          .limit(100),

        db.rpc('love_message_total')
      ]);

      if (error || countError) {
        throw error || countError;
      }

      setLetters(data || []);
      setTotal(Number(count || 0));
      setOpened(null);

      // Chưa có RPC đếm thư theo ngày.
      // Không lấy 100 thư gần nhất để giả làm tổng hôm nay.
      setTodayCount(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Không tải được thư.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function wrapSelection(before: string, after = before) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);

    const next =
      body.slice(0, start) +
      before +
      selected +
      after +
      body.slice(end);

    if (next.length > 5000) return;

    setBody(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        end + before.length
      );
    });
  }

  function addLine(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const next = body.slice(0, start) + prefix + body.slice(start);

    if (next.length > 5000) return;

    setBody(next);
    requestAnimationFrame(() => textarea.focus());
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setNotice('');

    const text = body.trim();

    if (!text || text.length > 5000) {
      setNotice('Nội dung thư phải từ 1 đến 5.000 ký tự.');
      return;
    }

    setBusy(true);

    try {
      const {
        data: {user},
        error: authError
      } = await db.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error('Bạn cần đăng nhập để gửi thư.');

      const {error} = await db.from('love_messages').insert({
        author_id: user.id,
        body: text,
        is_private: privateLetter
      });

      if (error) throw error;

      setBody('');
      setPrivateLetter(false);
      setNotice('Đã gửi thư thành công! ♡');
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Không gửi được thư.'
      );
    } finally {
      setBusy(false);
    }
  }

  function drawLetter() {
    if (!letters.length) return;
    const random = Math.floor(Math.random() * letters.length);
    setOpened(letters[random]);
  }

  return (
    <main className="bst-love-page">
      <section className="bst-love-card bst-love-hero">
        <div className="bst-love-heading">
          <h1>YÊU THƯƠNG GỬI ĐẾN TRANG ♡</h1>
          <p>Mỗi lời yêu thương là một lá thư nhỏ gửi đến Trang Pháp.</p>
        </div>

        <div className="bst-love-sparkles" aria-hidden="true">
          <span>♡</span>
          <span>✦</span>
          <span>♡</span>
        </div>

        <div className="bst-love-stats">
          <div className="bst-love-stat">
            HÔM NAY
            <strong>{todayCount === null ? '—' : todayCount}</strong>
            LÁ THƯ
          </div>

          <div className="bst-love-stat">
            TỔNG CỘNG
            <strong>{total}</strong>
            LÁ THƯ
          </div>
        </div>

        <button
          type="button"
          className="bst-love-jar-button"
          onClick={drawLetter}
          disabled={loading || !letters.length}
          aria-label="Rút ngẫu nhiên một lá thư"
        >
          <div className="bst-love-jar">
            <div className="bst-love-jar-lid">
              <div className="bst-love-jar-lid-label">
                ✦ MESSAGE JAR ✦
              </div>
            </div>

            <div className="bst-love-jar-body">
              <div className="bst-love-jar-symbols" aria-hidden="true">
                <span>💌</span>
                <span>💗</span>
                <span>💌</span>
                <span>💗</span>
                <span>💌</span>
                <span>💗</span>
                <span>💌</span>
                <span>💗</span>
                <span>💌</span>
              </div>

              <div className="bst-love-jar-paper">
                YÊU THƯƠNG
                <br />
                GỬI ĐẾN TRANG ♡
              </div>
            </div>
          </div>
        </button>

        <p className="bst-love-draw-hint">
          CHẠM VÀO HỘP ĐỂ RÚT NGẪU NHIÊN MỘT LÁ THƯ
        </p>

        {loading && (
          <p className="bst-love-feedback">Đang tải hộp thư...</p>
        )}

        {loadError && (
          <div className="bst-love-feedback" role="alert">
            {loadError}
            <button type="button" onClick={() => void refresh()}>
              Thử lại
            </button>
          </div>
        )}

        {opened && (
          <div className="bst-love-opened-letter">
            <div className="bst-love-opened-top">
              <strong>💌 MỘT LÁ THƯ DÀNH CHO TRANG</strong>
              <button
                type="button"
                onClick={() => setOpened(null)}
                aria-label="Đóng lá thư"
              >
                ✕
              </button>
            </div>
            <p>{opened.body}</p>
            <small>
              {new Date(opened.created_at).toLocaleDateString('vi-VN')}
            </small>
          </div>
        )}

        {!loading && !loadError && letters.length === 0 && (
          <p className="bst-love-feedback">
            Chưa có lá thư công khai nào để rút.
          </p>
        )}
      </section>

      <section className="bst-love-card bst-love-compose">
        <h2>GỬI LỜI YÊU THƯƠNG</h2>

        <p className="bst-love-sender">GỬI TỪ: Ttn</p>

        <form onSubmit={send}>
          <label className="bst-love-label" htmlFor="bst-love-message">
            LỜI NHẮN DÀNH CHO TRANG PHÁP
          </label>

          <div className="bst-love-toolbar">
            <button type="button" onClick={() => wrapSelection('**')}>
              <b>B</b>
            </button>
            <button type="button" onClick={() => wrapSelection('*')}>
              <i>I</i>
            </button>
            <button type="button" onClick={() => wrapSelection('__')}>
              <u>U</u>
            </button>
            <button type="button" onClick={() => wrapSelection('~~')}>
              <s>S</s>
            </button>
            <button type="button" onClick={() => addLine('1. ')}>
              1.
            </button>
            <button type="button" onClick={() => addLine('- ')}>
              ☷
            </button>
            <button type="button" onClick={() => addLine('  ')}>
              ≡
            </button>
            <button type="button" onClick={() => addLine('> ')}>
              ≡
            </button>
            <button
              type="button"
              className="bst-love-clear"
              onClick={() => setBody('')}
            >
              XÓA ĐỊNH DẠNG
            </button>
            <span className="bst-love-color-label">MÀU</span>
            <input
              type="color"
              aria-label="Chọn màu soạn thảo"
              value={textColor}
              onChange={(event) => setTextColor(event.target.value)}
            />
          </div>

          <textarea
            ref={textareaRef}
            id="bst-love-message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Viết lời yêu thương của bạn..."
            rows={9}
            maxLength={5000}
            required
            style={{caretColor: textColor}}
          />

          <div className="bst-love-attachments">
            <div>
              <label className="bst-love-label">
                ẢNH ĐÍNH KÈM (THEO CÀI ĐẶT BST)
              </label>
              <input
                type="file"
                accept="image/*"
                disabled
                title="Chưa kết nối chức năng tải ảnh"
              />
            </div>

            <div>
              <label className="bst-love-label">
                VOICE MESSAGE (THEO CÀI ĐẶT BST)
              </label>
              <input
                type="file"
                accept="audio/*"
                disabled
                title="Chưa kết nối chức năng gửi voice"
              />
            </div>
          </div>

          <label className="bst-love-private">
            <input
              type="checkbox"
              checked={privateLetter}
              onChange={(event) =>
                setPrivateLetter(event.target.checked)
              }
            />
            <span>GỬI RIÊNG TƯ — Chỉ Trang Pháp được xem</span>
          </label>

          <button
            className="bst-love-send"
            type="submit"
            disabled={busy || !body.trim()}
          >
            {busy ? 'ĐANG GỬI...' : 'GẤP THƯ & BỎ VÀO HỘP ♡'}
          </button>

          {notice && (
            <p className="bst-love-notice" role="status">
              {notice}
            </p>
          )}
        </form>
      </section>

      <section className="bst-love-card bst-love-private-section">
        <h2>GÓC RIÊNG DÀNH CHO TRANG PHÁP ♡</h2>
        <p>Chị Trang nhập mật mã ở đây nha</p>

        <div className="bst-love-password-row">
          <input
            type="password"
            value={trangCode}
            onChange={(event) => setTrangCode(event.target.value)}
            placeholder="Mật mã"
            autoComplete="off"
            aria-label="Mật mã dành cho Trang Pháp"
          />
          <button
            type="button"
            disabled
            title="Chưa kết nối xác thực phía máy chủ"
          >
            MỞ HỘP THƯ
          </button>
        </div>

        <p className="bst-love-security-note">
          Chức năng mở thư riêng đang chờ xác thực an toàn phía máy chủ.
          Mật mã chưa được gửi hoặc lưu.
        </p>
      </section>

      <style jsx>{`
        .bst-love-page {
          --love-pink: #e12589;
          --love-dark: #a82368;
          --love-border: #f2d9e7;
          --love-text: #53364a;
          min-height: 100vh;
          padding: 22px 16px 55px;
          background:
            radial-gradient(circle at 12% 10%, #efc6dd 1px, transparent 2px),
            radial-gradient(circle at 82% 30%, #f3cade 1px, transparent 2px),
            linear-gradient(180deg, #ffeaf5 0%, #fff4fa 100%);
          background-size: 145px 145px, 185px 185px, auto;
          color: var(--love-text);
          font-family: Arial, Helvetica, sans-serif;
        }

        .bst-love-card {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto 18px;
          padding: 26px;
          background: #fffefa;
          border: 1px solid var(--love-border);
          border-radius: 22px;
          box-shadow: 0 8px 28px #b86d9810;
        }

        .bst-love-hero {
          position: relative;
          min-height: 600px;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
        }

        .bst-love-heading {
          text-align: center;
          z-index: 1;
        }

        .bst-love-heading h1 {
          margin: 0 0 10px;
          font-size: clamp(20px, 3vw, 26px);
          font-weight: 800;
          color: var(--love-dark);
        }

        .bst-love-heading p {
          margin: 0;
          color: #8f7a87;
          font-size: 13px;
        }

        .bst-love-sparkles {
          position: absolute;
          inset: 35px 7% auto;
          display: flex;
          justify-content: space-between;
          color: #f5d7e7;
          font-size: 42px;
          pointer-events: none;
        }

        .bst-love-stats {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
          margin: 22px 0 32px;
          z-index: 1;
        }

        .bst-love-stat {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border: 1px solid #f0c9df;
          border-radius: 50px;
          background: #fff0f8;
          color: #a3537f;
          font-size: 11px;
          white-space: nowrap;
        }

        .bst-love-stat strong {
          font-size: 23px;
          color: var(--love-pink);
          line-height: 1;
        }

        .bst-love-jar-button {
          appearance: none;
          border: 0;
          padding: 0;
          margin: 8px auto 0;
          background: transparent;
          cursor: pointer;
          transition: transform .2s ease;
        }

        .bst-love-jar-button:hover:not(:disabled) {
          transform: translateY(-5px) rotate(-1deg);
        }

        .bst-love-jar-button:disabled {
          cursor: default;
        }

        .bst-love-jar {
          width: 230px;
          height: 290px;
          position: relative;
          filter: drop-shadow(0 15px 14px #e1258940);
        }

        .bst-love-jar-lid {
          position: absolute;
          top: 0;
          left: 20px;
          width: 190px;
          height: 54px;
          z-index: 2;
          border: 4px solid #b981a2;
          border-radius: 16px;
          background: repeating-linear-gradient(
            90deg,
            #e3bdd4 0 7px,
            #cda0bc 7px 13px
          );
          box-shadow: inset 0 3px 6px #ffffffaa, 0 5px 9px #8b4b7b44;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bst-love-jar-lid-label {
          padding: 6px 13px;
          background: var(--love-pink);
          border-radius: 30px;
          color: white;
          font-size: 10px;
          font-weight: 800;
          box-shadow: 0 2px 5px #a7287050;
        }

        .bst-love-jar-body {
          position: absolute;
          top: 39px;
          left: 5px;
          width: 220px;
          height: 245px;
          border: 5px solid #f6b5dd;
          border-radius: 55px 55px 55px 55px / 65px 65px 45px 45px;
          background:
            linear-gradient(
              105deg,
              #ffffffcc 0%,
              #ffe9f7 25%,
              #ffd1ed 75%,
              #fff2fa 100%
            );
          box-shadow:
            inset 12px 0 15px #ffffffb8,
            inset -12px 0 17px #e78cb93d,
            0 0 15px #ef90c7a0;
          overflow: hidden;
        }

        .bst-love-jar-symbols {
          width: 145px;
          margin: 30px auto 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          justify-items: center;
          align-items: center;
          gap: 4px;
          font-size: 28px;
          transform: rotate(-7deg);
        }

        .bst-love-jar-symbols span:nth-child(even) {
          transform: rotate(15deg);
        }

        .bst-love-jar-paper {
          position: absolute;
          bottom: 22px;
          left: 36px;
          width: 140px;
          padding: 15px 7px;
          border: 2px solid #e7a7ca;
          border-radius: 7px;
          background: #fff8fb;
          box-shadow: 0 5px 9px #a95e8d33;
          transform: rotate(-5deg);
          color: #ae347a;
          font-size: 12px;
          font-weight: 800;
          text-align: center;
          line-height: 1.5;
        }

        .bst-love-draw-hint {
          margin: 25px 0 0;
          font-size: 12px;
          color: #8e828b;
          text-align: center;
        }

        .bst-love-feedback {
          text-align: center;
          color: #98647f;
          font-size: 13px;
        }

        .bst-love-feedback button {
          margin-left: 8px;
          color: var(--love-pink);
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .bst-love-opened-letter {
          width: min(100%, 650px);
          margin-top: 22px;
          padding: 22px;
          border: 1px solid #f0b9d7;
          border-radius: 16px;
          background: #fff5fa;
          box-shadow: 0 8px 20px #b7568a16;
        }

        .bst-love-opened-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--love-dark);
          font-size: 13px;
        }

        .bst-love-opened-top button {
          border: 0;
          background: transparent;
          color: var(--love-dark);
          cursor: pointer;
        }

        .bst-love-opened-letter p {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.7;
        }

        .bst-love-opened-letter small {
          color: #947d8b;
        }

        .bst-love-compose h2,
        .bst-love-private-section h2 {
          margin: 0 0 19px;
          color: var(--love-dark);
          font-size: 21px;
          font-weight: 800;
        }

        .bst-love-sender {
          font-size: 13px;
          color: #877983;
          margin-bottom: 18px;
        }

        .bst-love-label {
          display: block;
          margin: 0 0 12px;
          font-size: 12px;
          font-weight: 800;
          color: #5c3d51;
        }

        .bst-love-toolbar {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          padding: 10px;
          margin-bottom: 8px;
          border-radius: 13px;
          background: #fff0f9;
        }

        .bst-love-toolbar button,
        .bst-love-send,
        .bst-love-password-row button {
          border: 0;
          background: var(--love-pink);
          color: #fff;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 9px #e1258930;
        }

        .bst-love-toolbar button {
          min-width: 36px;
          height: 34px;
          padding: 0 10px;
          font-size: 12px;
        }

        .bst-love-toolbar .bst-love-clear {
          padding: 0 13px;
          font-size: 11px;
        }

        .bst-love-color-label {
          margin-left: 3px;
          font-size: 12px;
          font-weight: 700;
        }

        .bst-love-toolbar input[type="color"] {
          width: 39px;
          height: 34px;
          padding: 3px;
          border: 1px solid #d7bbcc;
          border-radius: 6px;
          background: white;
        }

        .bst-love-compose textarea {
          display: block;
          width: 100%;
          min-height: 225px;
          padding: 18px;
          border: 1px solid #e7bfd5;
          border-radius: 16px;
          outline: none;
          background: #fff;
          resize: vertical;
          color: #4c3b47;
          font: inherit;
          line-height: 1.65;
        }

        .bst-love-compose textarea:focus,
        .bst-love-password-row input:focus {
          border-color: var(--love-pink);
          box-shadow: 0 0 0 3px #e1258914;
        }

        .bst-love-attachments {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 15px 0;
        }

        .bst-love-attachments .bst-love-label {
          margin-bottom: 7px;
        }

        .bst-love-attachments input {
          width: 100%;
          padding: 9px;
          border: 1px solid #e3d7df;
          border-radius: 9px;
          background: #fff;
          font-size: 12px;
        }

        .bst-love-private {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 14px 0;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .bst-love-private input {
          accent-color: var(--love-pink);
          width: 16px;
          height: 16px;
        }

        .bst-love-send {
          padding: 13px 19px;
          font-size: 12px;
        }

        .bst-love-send:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .bst-love-notice {
          color: var(--love-dark);
          font-size: 13px;
          margin-top: 13px;
        }

        .bst-love-private-section p {
          font-size: 13px;
          color: #81717b;
        }

        .bst-love-password-row {
          display: flex;
          gap: 10px;
          max-width: 460px;
          margin: 15px 0;
        }

        .bst-love-password-row input {
          flex: 1;
          min-width: 0;
          padding: 13px;
          border: 1px solid #e6d2de;
          border-radius: 10px;
          background: white;
          outline: none;
        }

        .bst-love-password-row button {
          padding: 0 19px;
          font-size: 12px;
        }

        .bst-love-password-row button:disabled {
          opacity: .8;
          cursor: not-allowed;
        }

        .bst-love-private-section .bst-love-security-note {
          margin-top: 18px;
          font-size: 11px;
          color: #988992;
        }

        @media (max-width: 600px) {
          .bst-love-page {
            padding: 16px 12px 40px;
          }

          .bst-love-card {
            padding: 20px 16px;
            border-radius: 19px;
          }

          .bst-love-hero {
            min-height: 565px;
          }

          .bst-love-heading h1 {
            font-size: 19px;
          }

          .bst-love-heading p {
            font-size: 12px;
          }

          .bst-love-sparkles {
            inset: 48px 2% auto;
            font-size: 30px;
          }

          .bst-love-stats {
            gap: 8px;
            margin-bottom: 25px;
          }

          .bst-love-stat {
            gap: 5px;
            padding: 10px;
            font-size: 10px;
          }

          .bst-love-stat strong {
            font-size: 20px;
          }

          .bst-love-compose h2,
          .bst-love-private-section h2 {
            font-size: 18px;
          }

          .bst-love-attachments {
            grid-template-columns: 1fr;
          }

          .bst-love-toolbar {
            gap: 5px;
          }

          .bst-love-toolbar button {
            min-width: 31px;
            height: 32px;
          }

          .bst-love-password-row button {
            padding: 0 12px;
          }
        }
         /* LOVE V40 — HIGH CONTRAST PINK */

.bst-love-page {
  --love-pink: #e12589;
  --love-dark: #99004f;
  --love-border: #df8db9;
  --love-text: #402238;
  background: linear-gradient(180deg, #ffe0f0, #fff0f8);
}

.bst-love-card {
  background: #fffdfa;
  border: 2px solid #e6a0c5;
  box-shadow: 0 10px 30px rgba(171, 23, 103, .16);
}

.bst-love-heading h1 {
  color: #a60059;
  font-weight: 900;
  text-shadow: none;
}

.bst-love-heading p,
.bst-love-draw-hint {
  color: #604055;
  font-weight: 600;
}

.bst-love-stat {
  background: #ffd1e9;
  border: 2px solid #d85a9d;
  color: #8b004a;
  font-weight: 800;
}

.bst-love-stat strong {
  color: #cf006f;
  font-weight: 900;
}

.bst-love-jar {
  filter: drop-shadow(0 15px 12px rgba(170, 0, 88, .48));
}

.bst-love-jar-lid {
  border: 4px solid #91436e;
  background: repeating-linear-gradient(
    90deg,
    #df94bf 0 7px,
    #a85b8c 7px 13px
  );
  box-shadow: inset 0 3px 5px #fff9, 0 5px 9px #74224e80;
}

.bst-love-jar-lid-label {
  background: #d90078;
  color: #fff;
  font-weight: 900;
}

.bst-love-jar-body {
  border: 5px solid #e86aaf;
  background: linear-gradient(
    105deg,
    #ffe8f5 0%,
    #ffc0e2 28%,
    #ee83c2 75%,
    #ffd3e9 100%
  );
  box-shadow:
    inset 10px 0 12px #ffffff80,
    inset -12px 0 16px #b52a7955,
    0 0 22px #d51b8590;
}

.bst-love-jar-symbols {
  filter: saturate(1.8) contrast(1.35);
}

.bst-love-jar-paper {
  background: #fff0f8;
  border: 2px solid #c84990;
  color: #8e004c;
  font-weight: 900;
  box-shadow: 0 6px 12px #82234f66;
}

.bst-love-sparkles {
  color: #eaa0c8;
}

.bst-love-feedback {
  color: #9c145b;
  font-weight: 600;
} 
  /* MESSAGE JAR — HOT PINK, KHÔNG ÁNH TÍM */

.bst-love-jar-body {
  border: 5px solid #f04b9c;
  background: linear-gradient(
    105deg,
    #ffe0ed 0%,
    #ff9bc9 35%,
    #ff69ae 75%,
    #ffb2d3 100%
  );
  box-shadow:
    inset 10px 0 12px rgba(255,255,255,.45),
    inset -12px 0 16px rgba(232,24,112,.25),
    0 0 20px rgba(255,45,139,.45);
}

.bst-love-jar-lid {
  border-color: #dc438d;
  background: repeating-linear-gradient(
    90deg,
    #ffafd1 0 7px,
    #f36ca9 7px 13px
  );
}

.bst-love-jar-lid-label {
  background: #ed1687;
}

.bst-love-jar-symbols {
  position: relative;
  z-index: 5;
  opacity: 1;
  filter: saturate(1.7);
}

.bst-love-jar-symbols span {
  opacity: 1;
  filter: saturate(1.8) contrast(1.15);
  font-size: 32px;
}

.bst-love-jar-paper {
  z-index: 6;
  background: #fff1f7;
  border-color: #ee559c;
  color: #c21868;
}
      `}</style>
    </main>
  );
}
