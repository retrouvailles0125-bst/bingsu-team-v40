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

  // Bridge the legacy V40 UI to the same Supabase session used by /login.
  // Never use the old localStorage password database for authentication.
  const replacements: Array<[string, string]> = [
    ["let email=sessionStorage.getItem(USER)||''", "let email=''"],
    ["if(!email){$('#app').innerHTML=loginBox();bindLogin();return}", "if(!email){window.location.assign('/login');return}"],
    ["$('#logout').onclick=()=>{email='';sessionStorage.removeItem(USER);render()};",
      "$('#logout').onclick=()=>{window.location.assign('/logout')};"],
    ["});render();\n})();", "});(async()=>{try{const response=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});const session=await response.json();if(session.authenticated&&session.email){email=session.email.toLowerCase();if(session.username){db.userProfiles[email]={...(db.userProfiles[email]||{}),username:session.username}}}else{email='';}}catch(error){console.error('Unable to load Supabase session',error);email='';}render()})();\n})();"],
  ];
  for (const [from, to] of replacements) {
    if (!html.includes(from)) throw new Error('Missing V40 auth integration marker: ' + from.slice(0, 45));
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