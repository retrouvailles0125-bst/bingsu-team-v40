
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
    throw new Error('Không tìm thấy nút Account V40.');
  }

  if (!html.includes(adminButton)) {
    throw new Error('Không tìm thấy nút Admin V40.');
  }

  // Giữ nguyên nút Account và hệ thống tab của V40.
  // Nút Admin sử dụng button gốc để kế thừa CSS V40.
  html = html.replace(
    adminButton,
    '<button type="button" id="bst-admin-nav" data-tab="admin-link" hidden>BINGSU TEAM</button>'
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
        const requestedTab = new URLSearchParams(
          window.location.search
        ).get('tab');

        try {
          const response = await fetch('/api/auth/session', {
            credentials: 'same-origin',
            cache: 'no-store'
          });

          if (!response.ok) {
            throw new Error('Không thể kiểm tra session');
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

            const adminNav = document.getElementById(
              'bst-admin-nav'
            );

            if (adminNav) {
              adminNav.hidden = session.isAdmin !== true;
            }
          } else {
            email = '';
          }
        } catch (error) {
          console.error(
            'Không thể tải Supabase session:',
            error
          );
          email = '';
        }

        if (requestedTab === 'account') {
          if (!email) {
            window.location.replace('/login');
            return;
          }

          tab = 'account';
        }

        try {
          const projectsResponse = await fetch('/api/projects/open', {
            credentials: 'same-origin',
            cache: 'no-store'
          });
          const projectsPayload = await projectsResponse.json();
          if (!projectsResponse.ok) throw new Error(projectsPayload.error || 'Không tải được Project');
          db.projects = projectsPayload.projects.map(function(p) {
            return {id:p.id,name:p.name,description:p.description,open:p.is_open};
          });
          window.__bstBackendProjects = true;
        } catch (projectError) {
          console.error('Lỗi đồng bộ Project Supabase:', projectError);
          db.projects = [];
        }
        render();
      })();
      })();`,
    ],
  ];

  for (const [from, to] of replacements) {
    if (!html.includes(from)) {
      throw new Error(
        'Không tìm thấy marker V40: ' +
        from.slice(0, 60)
      );
    }

    html = html.replace(from, to);
  }

  // V40 gốc gán onclick cho toàn bộ nav button.
  // Vì vậy phải gắn handler Admin sau handler gốc
  // để tránh mở trang Admin demo của V40.
  const adminNavigationScript = `
    <script>
      (function () {
        function bindAdminNavigation() {
          const button = document.getElementById(
            'bst-admin-nav'
          );

          if (!button) return;

          button.addEventListener(
            'click',
            function (event) {
              event.preventDefault();
              event.stopImmediatePropagation();

              window.location.assign('/admin');
            },
            true
          );
        }

        if (document.readyState === 'loading') {
          document.addEventListener(
            'DOMContentLoaded',
            bindAdminNavigation,
            { once: true }
          );
        } else {
          bindAdminNavigation();
        }
      })();
    </script>
  `;

  // Nút Donate trên giao diện V40 đi thẳng tới form Supabase, không dùng localStorage.
  const donateBridgeScript = `
    <script>
      document.addEventListener('click', function(event) {
        var trackingButton = event.target.closest('[data-tab="tracking"], #toTracking');
        if (trackingButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.location.assign('/tracking');
          return;
        }
        // The original project detail view uses #projectDonate, not data-project.
        // Intercept before the legacy onclick saves a donation to localStorage.
        var detailDonate = event.target.closest('#projectDonate');
        if (detailDonate) {
          event.preventDefault();
          event.stopImmediatePropagation();
          var projectTitle = document.querySelector('.project-detail h2');
          var projectName = projectTitle ? projectTitle.textContent.trim() : '';
          fetch('/api/projects/open', { credentials: 'same-origin', cache: 'no-store' })
            .then(function(response) {
              if (!response.ok) throw new Error('Không tải được Project');
              return response.json();
            })
            .then(function(payload) {
              var match = (payload.projects || []).find(function(project) {
                return project.is_open && project.name.toLowerCase() === projectName.toLowerCase();
              });
              if (!match) throw new Error('Project không còn mở Donate trên Supabase');
              window.location.assign('/donate?project=' + encodeURIComponent(match.id));
            })
            .catch(function(error) { alert(error.message || 'Không thể mở Donate'); });
          return;
        }
        var button = event.target.closest('[data-project]');
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var projectId = button.getAttribute('data-project');
        if (projectId) window.location.assign('/donate?project=' + encodeURIComponent(projectId));
      }, true);
    </script>
  `;

  const navigationStyle = `
    <style>
      #bst-admin-nav[hidden] {
        display: none !important;
      }
    </style>
  `;

  if (!html.includes('</head>')) {
    throw new Error('HTML V40 không có thẻ đóng head.');
  }

  if (!html.includes('</body>')) {
    throw new Error('HTML V40 không có thẻ đóng body.');
  }

  html = html.replace(
    '</head>',
    `${navigationStyle}</head>`
  );

  html = html.replace(
    '</body>',
    `${adminNavigationScript}${donateBridgeScript}</body>`
  );

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
