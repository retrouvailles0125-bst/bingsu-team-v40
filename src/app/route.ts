import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let html = await readFile(
    path.join(process.cwd(), 'reference', 'v40-original.html'),
    'utf8'
  );

  const accountButton =
    '<button data-tab="account">TÀI KHOẢN CỦA TÔI</button>';

  const accountLink =
    '<a href="/login" class="bst-account-nav">TÀI KHOẢN CỦA TÔI</a>';

  if (!html.includes(accountButton)) {
    throw new Error('Không tìm thấy nút Tài khoản trong V40 HTML.');
  }

  html = html.replace(accountButton, accountLink);

  const navigationStyle = `
    <style>
      .bst-account-nav {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
        border-radius: 10px;
        padding: 10px 14px;
      }

      .bst-account-nav:hover {
        background: #e1258918;
      }
    </style>
  `;

  html = html.replace('</head>', `${navigationStyle}</head>`);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}