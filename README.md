# BINGSU TEAM — V40 exact UI / Next.js test build

## What this build actually does

- **`/` displays the exact uploaded V40 HTML** using a Next.js route handler. Its original CSS, HTML, JavaScript, animations, menu, admin demo, and user interaction are served byte-for-byte, rather than approximated in React.
- The original source is stored at `reference/v40-original.html` and is NOT in `public/`.
- Other Next.js routes (`/donate`, `/star`, `/trade`, `/love`, `/admin`, `/account`) are previous modular prototypes and are **not equivalent to V40**. The V40 demo's own menu stays within `/`.
- The original V40 **uses localStorage/sessionStorage**, with demo credentials in client JavaScript. Its accounts, donations, bills, draw and trade actions are **NOT shared across devices** and are **NOT suitable for real donations**. The Supabase API/migrations in this repo are an unfinished integration, not connected to the `/` demo.

## Run locally

1. Install Node.js 20+.
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000/` to test the complete original V40 interaction and visual layout.

No Supabase keys are required for the exact V40 preview at `/`.

## Vercel preview

Import this folder into a private GitHub repository and deploy as a Next.js project on Vercel. This is **preview-only**; do not accept real donations or personal information.

## Source organization

- `reference/v40-original.html`: original, unchanged V40 source (do not overwrite).
- `src/app/route.ts`: Next.js route returning the V40 source.
- `src/features/*`: independently editable prior Next.js feature prototypes (not production complete).
- `src/app/api/*` and `supabase/migrations/*`: backend work in progress, requires integration and security tests.

See `AUDIT_CHECKLIST.md` for exact pass/fail statuses. Do not describe this package as production ready.
