
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

  const adminButton =
    '<button data-tab="admin">BINGSU TEAM</button>';

  if (!html.includes(accountButton)) {
    throw new Error('Không tìm thấy nút tài khoản V40.');
  }

  if (!html.includes(adminButton)) {
    throw new Error('Không tìm thấy nút Admin V40.');
  }

  html = html.replace(
    accountButton,
    '<a href="/login" class="bst-account-nav">TÀI KHOẢN CỦA TÔI</a>'
  );

  // Hidden by default. Supabase determines visibility.
  // This is navigation only, not an authorization boundary.
  html = html.replace(
    adminButton,
    '<a href="/admin" id="bst-admin-nav" class="bst-account-nav" hidden>BINGSU TEAM</a>'
  );

  const replacements: Array<[string, string]> = [
    [
      "let email=sessionStorage.getItem(USER)||''",
      "let email=''",
    ],
    [
      "if(!email){$('#app').innerHTML=loginBox();bindLogin();return}",
      "if(!email){window.location.assign('/login');return}",
    ],
    [
      "$('#logout').onclick=()=>{email='';sessionStorage.removeItem(USER);render()};",
      "$('#logout').onclick=()=>{window.location.assign('/logout')};",
    ],
    [
      "});render();\n})();",
      `});(async()=>{
        try {
          const response = await fetch('/api/auth/session', {
            credentials: 'same-origin',
            cache: 'no-store'
          });

          if (!response.ok) {
            throw new Error('Session request failed');
          }

          const session = await response.json();

          if (session.authenticated && session.email) {
            email = session.email.toLowerCase();

            if (session.username) {
              db.userProfiles[email] = {
                ...(db.userProfiles[email] || {}),
                username: session.username
              };
            }

            const adminNav = document.getElementById('bst-admin-nav');

            if (adminNav && session.isAdmin === true) {
              adminNav.hidden = false;
            }
          } else {
            email = '';
          }
        } catch (error) {
          console.error('Unable to load Supabase session', error);
          email = '';
        }

        render();
      })();
      })();`,
    ],
  ];

  for (const [from, to] of replacements) {
    if (!html.includes(from)) {
      throw new Error(
        'Missing V40 integration marker: ' +
        from.slice(0, 45)
      );
    }

    html = html.split(from).join(to);
  }

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

      #bst-admin-nav[hidden] {
        display: none !important;
      }
    </style>
  `;

  html = html.replace(
    '</head>',
    `${navigationStyle}</head>`
  );

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
